/**
 * Word-timing heuristics shared between the editor (auto-regen on tile
 * merge/split) and the AudioWordMappingModal (Auto-map button).
 *
 * Strategy:
 * 1. extractAmplitudes(): pulls real amplitude samples from the audio file
 *    via the simform native module.
 * 2. applyWaveformHeuristics(): detects speech bursts and maps unit timings.
 *    Each unit is treated as a phrase — its weight is the sum of sub-word
 *    weights, so merged multi-word tiles get proportionally more audio time.
 */

import { useAudioPlayer } from '@simform_solutions/react-native-audio-waveform';

export interface WordTiming {
  word: string;
  startTime: number;
}

const WAVEFORM_SAMPLE_COUNT = 200;

/**
 * Pull real amplitudes from a native extractor. Returns null on failure.
 * `extractFn` should be `useAudioPlayer().extractWaveformData` from a hook.
 */
export async function extractAmplitudes(
  extractFn: (args: { playerKey: string; path: string; noOfSamples?: number }) => Promise<number[][]>,
  absolutePath: string,
  playerKey: string,
): Promise<number[] | null> {
  try {
    const result = await extractFn({
      playerKey,
      path: absolutePath,
      noOfSamples: WAVEFORM_SAMPLE_COUNT,
    });
    const flat: number[] = [];
    if (Array.isArray(result)) {
      for (const chunk of result) {
        if (Array.isArray(chunk)) flat.push(...chunk);
      }
    }
    if (flat.length === 0) return null;
    let max = 0;
    for (const v of flat) {
      const a = Math.abs(v);
      if (a > max) max = a;
    }
    if (max <= 0) max = 1;
    return flat.map(v => Math.min(1, Math.abs(v) / max));
  } catch (err) {
    console.warn('[wordTimingHeuristics] extractAmplitudes failed:', err);
    return null;
  }
}

/**
 * Apply smart heuristics to map units (words/phrases) to waveform data.
 *
 * - Each unit's weight is sum of sub-word weights (handles merged tiles).
 * - First unit starts no earlier than 0.5s.
 * - With waveform: detects speech bursts and groups them by unit weight.
 * - Without waveform: weighted distribution starting at 0.5s.
 */
export function applyWaveformHeuristics(
  words: string[],
  duration: number,
  waveformData: number[],
): WordTiming[] {
  const SPEECH_START_DELAY = 0.5;
  const SILENCE_THRESHOLD = 0.15;
  const MIN_BURST_DURATION = 0.1;

  const subWordWeight = (w: string): number => {
    const len = w.length;
    if (len <= 2) return 0.5;
    if (len <= 4) return 1.0;
    return 1.5;
  };
  const wordWeights = words.map(unit => {
    const subs = unit.trim().split(/\s+/).filter(s => s.length > 0);
    if (subs.length === 0) return 1.0;
    return subs.reduce((sum, s) => sum + subWordWeight(s), 0);
  });
  const totalWeight = wordWeights.reduce((a, b) => a + b, 0) || 1;

  // No waveform — weighted even distribution
  if (!waveformData || waveformData.length === 0) {
    const availableTime = Math.max(duration - SPEECH_START_DELAY, 1);
    let acc = 0;
    return words.map((word, index) => {
      const startTime = SPEECH_START_DELAY + (acc / totalWeight) * availableTime;
      acc += wordWeights[index];
      return { word, startTime };
    });
  }

  // Detect speech bursts
  interface SpeechBurst {
    startTime: number;
    endTime: number;
    avgAmplitude: number;
  }

  const bursts: SpeechBurst[] = [];
  let inBurst = false;
  let burstStart = 0;
  let burstAmplitudes: number[] = [];

  waveformData.forEach((amplitude, index) => {
    const time = (index / waveformData.length) * duration;
    if (amplitude > SILENCE_THRESHOLD) {
      if (!inBurst) {
        inBurst = true;
        burstStart = time;
        burstAmplitudes = [amplitude];
      } else {
        burstAmplitudes.push(amplitude);
      }
    } else if (inBurst) {
      const burstDuration = time - burstStart;
      if (burstDuration >= MIN_BURST_DURATION) {
        const avgAmplitude = burstAmplitudes.reduce((a, b) => a + b, 0) / burstAmplitudes.length;
        bursts.push({ startTime: burstStart, endTime: time, avgAmplitude });
      }
      inBurst = false;
    }
  });
  if (inBurst && burstAmplitudes.length > 0) {
    const avgAmplitude = burstAmplitudes.reduce((a, b) => a + b, 0) / burstAmplitudes.length;
    bursts.push({ startTime: burstStart, endTime: duration, avgAmplitude });
  }

  // No bursts — weighted distribution fallback
  if (bursts.length === 0) {
    const availableTime = Math.max(duration - SPEECH_START_DELAY, 1);
    let acc = 0;
    return words.map((word, index) => {
      const startTime = SPEECH_START_DELAY + (acc / totalWeight) * availableTime;
      acc += wordWeights[index];
      return { word, startTime };
    });
  }

  const adjustedBursts = bursts.map(burst => ({
    ...burst,
    startTime: Math.max(burst.startTime, SPEECH_START_DELAY),
  }));

  const timings: WordTiming[] = [];

  if (adjustedBursts.length >= words.length) {
    // More bursts than units — group by weight so merged units consume more bursts
    let burstIdx = 0;
    let weightAcc = 0;
    words.forEach((word, index) => {
      const remainingWeight = totalWeight - weightAcc;
      const remainingBursts = adjustedBursts.length - burstIdx;
      const share = remainingWeight > 0
        ? Math.max(1, Math.round((wordWeights[index] / remainingWeight) * remainingBursts))
        : 1;
      const remainingUnits = words.length - index - 1;
      const cappedShare = Math.min(share, remainingBursts - remainingUnits);
      const startBurst = adjustedBursts[burstIdx];
      timings.push({
        word,
        startTime: Math.max(SPEECH_START_DELAY, startBurst.startTime),
      });
      burstIdx += Math.max(1, cappedShare);
      weightAcc += wordWeights[index];
    });
  } else {
    // Fewer bursts than units — distribute units within each burst by weight
    let wordIndex = 0;
    adjustedBursts.forEach((burst, burstIndex) => {
      const burstDuration = burst.endTime - burst.startTime;
      const remainingWords = words.length - wordIndex;
      const remainingBursts = adjustedBursts.length - burstIndex;
      const wordsInBurst = Math.ceil(remainingWords / remainingBursts);
      const wordsForBurst = words.slice(wordIndex, wordIndex + wordsInBurst);
      const weightsForBurst = wordWeights.slice(wordIndex, wordIndex + wordsInBurst);
      const burstTotalWeight = weightsForBurst.reduce((a, b) => a + b, 0) || 1;
      let accumulatedWeight = 0;
      wordsForBurst.forEach((word, i) => {
        const wordWeight = weightsForBurst[i];
        const relativePosition = accumulatedWeight / burstTotalWeight;
        const wordTime = burst.startTime + relativePosition * burstDuration;
        timings.push({
          word,
          startTime: Math.max(SPEECH_START_DELAY, wordTime),
        });
        accumulatedWeight += wordWeight;
      });
      wordIndex += wordsInBurst;
    });
  }

  return timings;
}

/**
 * React hook wrapper: exposes a function that runs the heuristic against a
 * given audio file. Use from components/screens that have access to hooks.
 */
export function useWordTimingHeuristics() {
  const { extractWaveformData } = useAudioPlayer();

  const computeTimings = async (
    units: string[],
    durationSeconds: number,
    absoluteAudioPath: string,
    playerKey: string,
  ): Promise<WordTiming[]> => {
    const amplitudes = await extractAmplitudes(extractWaveformData, absoluteAudioPath, playerKey);
    return applyWaveformHeuristics(units, durationSeconds, amplitudes ?? []);
  };

  return { computeTimings };
}
