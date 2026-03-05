import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  PanResponder,
  Alert,
} from 'react-native';
import { AudioWaveform } from './AudioWaveform';
import Sound from 'react-native-nitro-sound';
import { MyIcon } from '../common/icons';
import { AttachmentService } from '../services/AttachmentService';
import { useLanguage } from '../contexts/LanguageContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const MODAL_WIDTH = SCREEN_WIDTH * 0.9;
const WAVEFORM_HEIGHT = 150;

export interface WordTiming {
  word: string;
  startTime: number; // in seconds
}

/**
 * Apply smart heuristics to map words to waveform data
 *
 * Algorithm:
 * 1. If waveform data exists, detect speech bursts (high amplitude regions)
 * 2. Start first word at 0.5s (typical speech delay)
 * 3. Map words to speech bursts, accounting for word length:
 *    - Short words (1-2 chars like "I", "a", "an") get less time
 *    - Longer words get more time within their burst
 * 4. Fall back to even distribution if no waveform data
 */
function applyWaveformHeuristics(
  words: string[],
  duration: number,
  waveformData: number[]
): WordTiming[] {
  const SPEECH_START_DELAY = 0.5; // Start first word at 0.5s
  const SILENCE_THRESHOLD = 0.15; // Amplitude below this is considered silence
  const MIN_BURST_DURATION = 0.1; // Minimum duration for a speech burst (seconds)

  // If no waveform data, use simple distribution starting at 0.5s
  if (!waveformData || waveformData.length === 0) {
    console.log('[Heuristics] No waveform data, using simple distribution');
    const availableTime = duration - SPEECH_START_DELAY;
    return words.map((word, index) => ({
      word,
      startTime: SPEECH_START_DELAY + (index / words.length) * availableTime,
    }));
  }

  console.log('[Heuristics] Analyzing waveform data, samples:', waveformData.length);

  // Detect speech bursts from waveform
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
        // Start new burst
        inBurst = true;
        burstStart = time;
        burstAmplitudes = [amplitude];
      } else {
        burstAmplitudes.push(amplitude);
      }
    } else if (inBurst) {
      // End current burst
      const burstDuration = time - burstStart;
      if (burstDuration >= MIN_BURST_DURATION) {
        const avgAmplitude = burstAmplitudes.reduce((a, b) => a + b, 0) / burstAmplitudes.length;
        bursts.push({
          startTime: burstStart,
          endTime: time,
          avgAmplitude,
        });
      }
      inBurst = false;
    }
  });

  // Close final burst if still open
  if (inBurst && burstAmplitudes.length > 0) {
    const avgAmplitude = burstAmplitudes.reduce((a, b) => a + b, 0) / burstAmplitudes.length;
    bursts.push({
      startTime: burstStart,
      endTime: duration,
      avgAmplitude,
    });
  }

  console.log('[Heuristics] Detected speech bursts:', bursts.length);

  // If no bursts detected or too few, fall back to simple distribution
  if (bursts.length === 0) {
    console.log('[Heuristics] No speech bursts detected, using simple distribution');
    const availableTime = duration - SPEECH_START_DELAY;
    return words.map((word, index) => ({
      word,
      startTime: SPEECH_START_DELAY + (index / words.length) * availableTime,
    }));
  }

  // Ensure first burst starts at least at SPEECH_START_DELAY
  const adjustedBursts = bursts.map(burst => ({
    ...burst,
    startTime: Math.max(burst.startTime, SPEECH_START_DELAY),
  }));

  // Calculate relative weights for words (short words get less weight)
  const wordWeights = words.map(word => {
    const len = word.length;
    if (len <= 2) return 0.5; // Short words like "I", "a", "an"
    if (len <= 4) return 1.0; // Medium words
    return 1.5; // Longer words
  });
  const totalWeight = wordWeights.reduce((a, b) => a + b, 0);

  // Map words to time positions based on bursts
  const timings: WordTiming[] = [];

  if (adjustedBursts.length >= words.length) {
    // More bursts than words - assign one word per burst
    words.forEach((word, index) => {
      timings.push({
        word,
        startTime: adjustedBursts[index].startTime,
      });
    });
  } else {
    // Fewer bursts than words - distribute words across bursts
    let wordIndex = 0;

    adjustedBursts.forEach((burst, burstIndex) => {
      const burstDuration = burst.endTime - burst.startTime;

      // Calculate how many words to fit in this burst
      const remainingWords = words.length - wordIndex;
      const remainingBursts = adjustedBursts.length - burstIndex;
      const wordsInBurst = Math.ceil(remainingWords / remainingBursts);

      // Distribute words within this burst based on their weights
      const wordsForBurst = words.slice(wordIndex, wordIndex + wordsInBurst);
      const weightsForBurst = wordWeights.slice(wordIndex, wordIndex + wordsInBurst);
      const burstTotalWeight = weightsForBurst.reduce((a, b) => a + b, 0);

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

  console.log('[Heuristics] Final timings:', timings);
  return timings;
}

interface AudioWordMappingModalProps {
  visible: boolean;
  audioFile: string; // Relative path to audio file
  albumId: string; // Album ID for path conversion
  titleText: string;
  audioDuration?: number; // Duration in seconds (from stored audio element)
  initialWordTimings?: WordTiming[];
  onClose: (wordTimings: WordTiming[]) => void; // Called when modal closes with final state
  onReRecord?: () => void;
  onDelete?: () => void;
}

export function AudioWordMappingModal({
  visible,
  audioFile,
  albumId,
  titleText,
  audioDuration: propDuration,
  initialWordTimings = [],
  onClose,
  onReRecord,
  onDelete,
}: AudioWordMappingModalProps) {
  console.log('[AudioWordMappingModal] Component initialized with propDuration:', propDuration);

  const { t, isRTL } = useLanguage();

  // Simple state - single source of truth
  const [audioDuration, setAudioDuration] = useState(propDuration || 10);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [wordTimings, setWordTimings] = useState<WordTiming[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [draggingX, setDraggingX] = useState<number>(0);
  const [waveformData, setWaveformData] = useState<number[]>([]); // Waveform amplitude data
  const draggingTimingsRef = useRef<WordTiming[]>([]);

  // Refs to avoid closure traps
  const audioDurationRef = useRef(audioDuration);
  const wordTimingsRef = useRef<WordTiming[]>([]);
  const waveformDataRef = useRef<number[]>([]);

  // Simple flags
  const initializedRef = useRef(false);
  const hasAppliedHeuristicsRef = useRef(false);
  const hasTitle = titleText && titleText.trim().length > 0;

  // Sync refs
  useEffect(() => {
    audioDurationRef.current = audioDuration;
  }, [audioDuration]);

  useEffect(() => {
    wordTimingsRef.current = wordTimings;
  }, [wordTimings]);

  useEffect(() => {
    waveformDataRef.current = waveformData;
  }, [waveformData]);

  // Use prop duration if provided
  useEffect(() => {
    console.log('[AudioWordMappingModal] propDuration effect:', propDuration);
    if (propDuration && propDuration > 0) {
      console.log('[AudioWordMappingModal] Setting audioDuration from prop:', propDuration);
      setAudioDuration(propDuration);
    }
  }, [propDuration]);

  // Initialize ONCE on mount
  useEffect(() => {
    console.log('[AudioWordMappingModal] Mount effect - initialized:', initializedRef.current);
    if (initializedRef.current) return;

    const parsedWords = titleText.split(/\s+/).filter(w => w.length > 0);
    console.log('[AudioWordMappingModal] Mount - parsedWords:', parsedWords.length, 'initialWordTimings:', initialWordTimings.length, 'audioDuration:', audioDuration);

    if (initialWordTimings.length > 0) {
      // Use existing mappings as-is (Requirement #5)
      console.log('[AudioWordMappingModal] Using existing mappings:', initialWordTimings);
      setWordTimings(initialWordTimings);
      wordTimingsRef.current = initialWordTimings; // Update ref immediately
      hasAppliedHeuristicsRef.current = true; // Don't apply heuristics
    } else if (parsedWords.length > 0) {
      // Create initial even distribution
      const timings: WordTiming[] = parsedWords.map((word, index) => ({
        word,
        startTime: (index / parsedWords.length) * audioDuration,
      }));
      console.log('[AudioWordMappingModal] Creating initial even distribution:', timings);
      setWordTimings(timings);
      wordTimingsRef.current = timings; // Update ref immediately so handleAudioLoad can see it
      // Don't mark hasAppliedHeuristicsRef yet - let handleAudioLoad optimize if it has timing data
    }

    initializedRef.current = true;
    console.log('[AudioWordMappingModal] Initialization complete, hasAppliedHeuristics:', hasAppliedHeuristicsRef.current);
  }, []);

  const handleAudioLoad = (duration: number) => {
    console.log('[AudioWordMappingModal] handleAudioLoad called - duration:', duration, 'propDuration:', propDuration, 'hasAppliedHeuristics:', hasAppliedHeuristicsRef.current, 'current audioDuration:', audioDuration);
    console.log('[AudioWordMappingModal] wordTimings state length:', wordTimings.length, 'wordTimings ref length:', wordTimingsRef.current.length);

    // If we already have the correct duration from props, don't do anything
    if (propDuration && Math.abs(propDuration - duration) < 0.1) {
      console.log('[AudioWordMappingModal] Duration matches prop, skipping re-distribution');
      hasAppliedHeuristicsRef.current = true;
      return;
    }

    // If duration is changing significantly, we need to re-scale existing timings
    const oldDuration = audioDurationRef.current;
    if (Math.abs(oldDuration - duration) > 0.1 && wordTimingsRef.current.length > 0) {
      console.log('[AudioWordMappingModal] Duration changed significantly from', oldDuration, 'to', duration);

      // Re-scale existing timings to new duration
      const scaledTimings = wordTimingsRef.current.map(wt => ({
        ...wt,
        startTime: (wt.startTime / oldDuration) * duration,
      }));
      console.log('[AudioWordMappingModal] Re-scaled timings:', scaledTimings);
      setWordTimings(scaledTimings);
      wordTimingsRef.current = scaledTimings;
    }

    // Update duration
    console.log('[AudioWordMappingModal] Updating audioDuration to:', duration);
    setAudioDuration(duration);

    // Use ref to check word timings (state might not be updated yet)
    const currentWordTimings = wordTimingsRef.current;

    // Apply heuristics if we haven't already and no initial mappings existed
    if (!hasAppliedHeuristicsRef.current && currentWordTimings.length > 0) {
      const parsedWords = titleText.split(/\s+/).filter(w => w.length > 0);
      const currentWaveformData = waveformDataRef.current;
      const optimizedTimings = applyWaveformHeuristics(parsedWords, duration, currentWaveformData);
      console.log('[AudioWordMappingModal] Applied waveform heuristics:', optimizedTimings);
      setWordTimings(optimizedTimings);
      hasAppliedHeuristicsRef.current = true;
    } else {
      console.log('[AudioWordMappingModal] Skipping heuristics - hasAppliedHeuristics:', hasAppliedHeuristicsRef.current, 'currentWordTimings.length:', currentWordTimings.length);
    }
  };

  const handleWaveformData = (data: number[]) => {
    console.log('[AudioWordMappingModal] Waveform data received, samples:', data.length);
    setWaveformData(data);

    // If we haven't applied heuristics yet and have word timings, re-run with waveform data
    if (!hasAppliedHeuristicsRef.current && wordTimingsRef.current.length > 0) {
      const parsedWords = titleText.split(/\s+/).filter(w => w.length > 0);
      const duration = audioDurationRef.current;
      const optimizedTimings = applyWaveformHeuristics(parsedWords, duration, data);
      console.log('[AudioWordMappingModal] Re-applied heuristics with new waveform data:', optimizedTimings);
      setWordTimings(optimizedTimings);
      hasAppliedHeuristicsRef.current = true;
    }
  };

  const handlePlay = async () => {
    if (playing) {
      await Sound.stopPlayer();
      Sound.removePlayBackListener();
      setPlaying(false);
      setCurrentTime(0);
    } else {
      try {
        // Convert relative path to absolute
        const absolutePath = AttachmentService.getAbsolutePath(albumId, audioFile);
        const filePath = `file://${absolutePath}`;
        console.log("start play", filePath)
        await Sound.startPlayer(filePath);

        Sound.addPlayBackListener((e) => {
          // Get actual duration from the first event - but only if we don't have a good duration yet
          if (e.duration > 0 && audioDuration === 10) {
            const durationInSeconds = e.duration / 1000;
            console.log('[AudioWordMappingModal handlePlay] Got duration from playback:', durationInSeconds, 'current duration:', audioDuration);

            // Only update if we still have the default 10s duration (meaning AudioWaveform didn't provide real duration yet)
            if (Math.abs(audioDuration - 10) < 0.1) {
              console.log('[AudioWordMappingModal handlePlay] Updating duration from', audioDuration, 'to', durationInSeconds);
              setAudioDuration(durationInSeconds);
            }
          }

          setCurrentTime(e.currentPosition / 1000); // Convert to seconds
          if (e.currentPosition >= e.duration && e.duration > 0) {
            setPlaying(false);
            setCurrentTime(0);
            Sound.stopPlayer().catch(console.error);
          }
        });
        setPlaying(true);
      } catch (error) {
        console.error('Failed to play audio:', error);
        Alert.alert('שגיאה', 'הפעלת השמע נכשלה');
      }
    }
  };

  const handleWordMarkerDragMove = (wordIndex: number, currentX: number) => {
    setDraggingIndex(wordIndex);
    setDraggingX(currentX);

    // Use refs to avoid closure trap
    const currentAudioDuration = audioDurationRef.current;
    const currentWordTimings = wordTimingsRef.current;

    // Update dragging ref with current positions
    const waveformWidth = MODAL_WIDTH - 40;
    const newTime = (currentX / waveformWidth) * currentAudioDuration;
    const updatedTimings = [...currentWordTimings];
    updatedTimings[wordIndex] = {
      ...updatedTimings[wordIndex],
      startTime: Math.max(0, Math.min(currentAudioDuration, newTime)),
    };
    draggingTimingsRef.current = updatedTimings;
  };

  const handleWordMarkerDragEnd = (wordIndex: number, newX: number) => {
    // Use refs to avoid closure trap
    const currentAudioDuration = audioDurationRef.current;
    const currentWordTimings = wordTimingsRef.current;

    const waveformWidth = MODAL_WIDTH - 40;
    const WORD_GAP = 10;

    // Use dragging timings if available (current positions during drag)
    const currentTimings = draggingTimingsRef.current.length > 0 ? draggingTimingsRef.current : currentWordTimings;

    const timeToXLocal = (time: number) => (time / currentAudioDuration) * waveformWidth;

    const minX = wordIndex > 0 ? timeToXLocal(currentTimings[wordIndex - 1].startTime) + WORD_GAP : 0;
    const maxX = wordIndex < currentTimings.length - 1 ? timeToXLocal(currentTimings[wordIndex + 1].startTime) - WORD_GAP : waveformWidth;
    const constrainedX = Math.max(minX, Math.min(maxX, newX));
    const newTime = (constrainedX / waveformWidth) * currentAudioDuration;

    const updatedTimings = [...currentTimings];
    updatedTimings[wordIndex] = {
      ...updatedTimings[wordIndex],
      startTime: Math.max(0, Math.min(currentAudioDuration, newTime)),
    };

    setWordTimings(updatedTimings);
    setDraggingIndex(null);
    draggingTimingsRef.current = [];

    // Mark that user has manually adjusted timings - don't auto-redistribute
    hasAppliedHeuristicsRef.current = true;
  };

  const handleClose = async () => {
    // Stop playback if active
    if (playing) {
      await Sound.stopPlayer();
      Sound.removePlayBackListener();
      setPlaying(false);
    }

    // Use ref to get latest word timings (avoid closure trap)
    const finalWordTimings = wordTimingsRef.current;

    // Pass final word timings to parent
    onClose(finalWordTimings);
  };

  const handleDelete = async () => {
    // Stop playback if active
    if (playing) {
      await Sound.stopPlayer();
      Sound.removePlayBackListener();
      setPlaying(false);
    }

    onDelete?.();
  };

  const timeToX = (time: number) => {
    const waveformWidth = MODAL_WIDTH - 40;
    return (time / audioDuration) * waveformWidth;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {hasTitle ? t('audioWordMapping.title') : t('audioWordMapping.title')}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
            >
              <MyIcon info={{ name: 'close', size: 24, color: '#666', type: 'MDI' }} />
            </TouchableOpacity>
          </View>

          {/* Only show word mapping UI if there's a title (requirement #2) */}
          {hasTitle && (
            <>
              {/* Word Markers */}
              <View style={styles.wordsContainer}>
                <View style={[styles.wordsRow, isRTL && { transform: [{ scaleX: -1 }] }]}>
                  {wordTimings.map((wt, index) => {
                    const waveformWidth = MODAL_WIDTH - 40;
                    const WORD_GAP = 10;
                    const minX = index > 0 ? timeToX(wordTimings[index - 1].startTime) + WORD_GAP : 0;
                    const maxX = index < wordTimings.length - 1 ? timeToX(wordTimings[index + 1].startTime) - WORD_GAP : waveformWidth;
                    const pos = timeToX(wt.startTime);

                    return (
                      <WordMarker
                        key={wt.word + index}
                        word={wt.word}
                        position={pos}
                        minX={minX}
                        maxX={maxX}
                        isRTL={isRTL}
                        onDragMove={(currentX) => handleWordMarkerDragMove(index, currentX)}
                        onDragEnd={(newX) => handleWordMarkerDragEnd(index, newX)}
                        isActive={currentTime >= wt.startTime &&
                          (index === wordTimings.length - 1 || currentTime < wordTimings[index + 1].startTime)}
                      />
                    );
                  })}
                </View>
              </View>

              {/* Waveform */}
              <View style={[styles.waveformContainer, isRTL && { transform: [{ scaleX: -1 }] }]}>
                <AudioWaveform
                  audioFile={audioFile}
                  albumId={albumId}
                  width={MODAL_WIDTH - 40}
                  height={WAVEFORM_HEIGHT}
                  onLoad={handleAudioLoad}
                  onWaveformData={handleWaveformData}
                />

                {/* Word marker lines */}
                {wordTimings.map((wt, index) => {
                  // If this word is being dragged, use dragging position, otherwise use timing position
                  const x = (draggingIndex === index) ? draggingX : timeToX(wt.startTime);
                  return (
                    <View
                      key={`line-${index}`}
                      style={[
                        styles.markerLine,
                        { left: x },
                        draggingIndex === index && styles.markerLineDragging
                      ]}
                    />
                  );
                })}

                {/* Playback position indicator */}
                {playing && (
                  <View
                    style={[styles.playbackIndicator, { left: timeToX(currentTime) }]}
                  />
                )}
              </View>
            </>
          )}

          {/* Controls */}
          <View style={styles.controls}>
            {onDelete && (
              <TouchableOpacity
                style={[styles.controlButton, styles.deleteButton]}
                onPress={handleDelete}
              >
                <MyIcon info={{ name: 'delete', size: 28, color: '#FF3B30', type: 'MDI' }} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.controlButton}
              onPress={onReRecord}
            >
              <MyIcon info={{ name: 'microphone', size: 28, color: '#C8572A', type: 'MDI' }} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.playButton]}
              onPress={handlePlay}
            >
              <MyIcon
                info={{
                  name: playing ? 'pause' : 'play',
                  size: 32,
                  color: '#fff',
                  type: 'MDI',
                }}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface WordMarkerProps {
  word: string;
  position: number;
  onDragMove: (currentX: number) => void;
  onDragEnd: (newX: number) => void;
  isActive: boolean;
  isRTL: boolean;
  minX?: number;
  maxX?: number;
}

const WordMarker = React.memo(function WordMarker({ word, position, onDragMove, onDragEnd, isActive, isRTL, minX = 0, maxX = 1000 }: WordMarkerProps) {
  const [localPosition, setLocalPosition] = useState(position);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef(position);
  const prevPositionRef = useRef(position);
  const localPositionRef = useRef(position);

  // Refs to avoid closure trap in panResponder
  const minXRef = useRef(minX);
  const maxXRef = useRef(maxX);
  const onDragMoveRef = useRef(onDragMove);
  const onDragEndRef = useRef(onDragEnd);
  const isRTLRef = useRef(isRTL);

  // Sync localPosition to ref
  useEffect(() => {
    localPositionRef.current = localPosition;
  }, [localPosition]);

  // Sync refs
  useEffect(() => {
    minXRef.current = minX;
  }, [minX]);

  useEffect(() => {
    maxXRef.current = maxX;
  }, [maxX]);

  useEffect(() => {
    onDragMoveRef.current = onDragMove;
  }, [onDragMove]);

  useEffect(() => {
    onDragEndRef.current = onDragEnd;
  }, [onDragEnd]);

  useEffect(() => {
    isRTLRef.current = isRTL;
  }, [isRTL]);

  // Only update local position when prop changes AND we're not dragging AND position actually changed
  useEffect(() => {
    if (!isDragging && Math.abs(position - prevPositionRef.current) > 0.1) {
      setLocalPosition(position);
      prevPositionRef.current = position;
    }
  }, [position, isDragging]);

  // Create panResponder once with useRef
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
        // Use current localPosition as drag start (from ref to avoid closure)
        dragStartRef.current = localPositionRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        // In RTL, parent is flipped with scaleX(-1), so gesture.dx is inverted
        const dx = isRTLRef.current ? -gesture.dx : gesture.dx;
        const newX = dragStartRef.current + dx;
        const constrainedX = Math.max(minXRef.current, Math.min(maxXRef.current, newX));
        setLocalPosition(constrainedX);
        onDragMoveRef.current(constrainedX);
      },
      onPanResponderRelease: (_, gesture) => {
        const dx = isRTLRef.current ? -gesture.dx : gesture.dx;
        const finalX = dragStartRef.current + dx;
        const constrainedX = Math.max(minXRef.current, Math.min(maxXRef.current, finalX));
        setIsDragging(false);
        onDragEndRef.current(constrainedX);
      },
    })
  ).current;

  return (
    <View
      style={[
        styles.wordMarker,
        {
          left: localPosition,
        },
        isActive && styles.wordMarkerActive,
        isDragging && styles.wordMarkerDragging
      ]}
      {...panResponder.panHandlers}
    >
      <Text style={[
        styles.wordText,
        isActive && styles.wordTextActive,
        isRTL && { transform: [{ scaleX: -1 }] } // Flip text back only for text
      ]}>
        {word}
      </Text>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if position changed by more than 0.1px
  return (
    prevProps.word === nextProps.word &&
    Math.abs(prevProps.position - nextProps.position) < 0.1 &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isRTL === nextProps.isRTL &&
    prevProps.minX === nextProps.minX &&
    prevProps.maxX === nextProps.maxX
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: MODAL_WIDTH,
    maxHeight: SCREEN_HEIGHT * 0.85,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#333',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ddd',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#34C759',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  toggleThumbActive: {
    transform: [{ translateX: 22 }],
  },
  wordsContainer: {
    height: 50,
    marginBottom: 10,
  },
  wordsRow: {
    flexDirection: 'row',
    position: 'relative',
    height: '100%',
  },
  wordMarker: {
    position: 'absolute',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordMarkerActive: {
    backgroundColor: '#FF9500',
  },
  wordMarkerDragging: {
    opacity: 0.8,
    transform: [{ scale: 1.1 }],
  },
  wordText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  wordTextActive: {
    color: '#fff',
  },
  waveformContainer: {
    position: 'relative',
    marginBottom: 30,
  },
  markerLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(0, 122, 255, 0.5)',
  },
  markerLineDragging: {
    backgroundColor: 'rgba(255, 149, 0, 0.8)',
    width: 3,
  },
  playbackIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#FF3B30',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 30,
    marginBottom: 20,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#FFF0F0',
  },
  playButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#007AFF',
  },
});
