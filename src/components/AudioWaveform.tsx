import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Waveform, useAudioPlayer } from '@simform_solutions/react-native-audio-waveform';
import Sound from 'react-native-nitro-sound';
import { AttachmentService } from '../services/AttachmentService';

interface AudioWaveformProps {
  audioFile: string; // Relative path to audio file
  albumId: string; // Album ID for path conversion
  width: number;
  height: number;
  color?: string;
  backgroundColor?: string;
  onLoad?: (duration: number) => void;
  onWaveformData?: (data: number[]) => void; // NEW: Callback with waveform amplitude data
}

const WAVEFORM_SAMPLE_COUNT = 200;
const PLAYER_KEY_PREFIX = 'word-mapping-extract';

export function AudioWaveform({
  audioFile,
  albumId,
  width,
  height,
  color = '#007AFF',
  backgroundColor = '#f0f0f0',
  onLoad,
  onWaveformData,
}: AudioWaveformProps) {
  const waveformRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  const { extractWaveformData } = useAudioPlayer();

  // Load audio duration + real amplitude samples ONCE
  useEffect(() => {
    console.log('[AudioWaveform] Effect running - loaded:', loaded, 'audioFile:', audioFile);
    if (loaded) return;

    const absolutePath = AttachmentService.getAbsolutePath(albumId, audioFile);
    const filePath = `file://${absolutePath}`;
    let cancelled = false;

    const loadDurationAndAmplitudes = async () => {
      // Extract real amplitudes via simform native module
      const playerKey = `${PLAYER_KEY_PREFIX}-${audioFile}`;
      let amplitudes: number[] | null = null;
      try {
        console.log('[AudioWaveform] Extracting waveform data for', absolutePath);
        const result = await extractWaveformData({
          playerKey,
          path: absolutePath,
          noOfSamples: WAVEFORM_SAMPLE_COUNT,
        });
        // result is number[][] (channels × samples or one batch). Flatten + normalize.
        const flat: number[] = [];
        if (Array.isArray(result)) {
          for (const chunk of result) {
            if (Array.isArray(chunk)) flat.push(...chunk);
          }
        }
        if (flat.length > 0) {
          // Normalize 0..1 by max absolute value
          let max = 0;
          for (const v of flat) {
            const a = Math.abs(v);
            if (a > max) max = a;
          }
          if (max <= 0) max = 1;
          amplitudes = flat.map(v => Math.min(1, Math.abs(v) / max));
          console.log('[AudioWaveform] Extracted real amplitudes:', amplitudes.length, 'max=', max);
        } else {
          console.log('[AudioWaveform] extractWaveformData returned empty');
        }
      } catch (err) {
        console.warn('[AudioWaveform] extractWaveformData failed:', err);
      }

      // Get duration via Sound (kept for compatibility with existing flow)
      try {
        console.log('[AudioWaveform] Starting player for duration extraction:', filePath);
        await Sound.startPlayer(filePath);

        Sound.addPlayBackListener((e) => {
          if (e.duration > 0 && !loadedRef.current && !cancelled) {
            const durationInSeconds = e.duration / 1000;
            console.log('[AudioWaveform] Got duration from playback listener:', durationInSeconds);

            Sound.stopPlayer().catch(() => {});
            Sound.removePlayBackListener();

            if (onWaveformData && amplitudes && amplitudes.length > 0) {
              console.log('[AudioWaveform] Calling onWaveformData with', amplitudes.length, 'real samples');
              onWaveformData(amplitudes);
            }

            if (onLoad) {
              console.log('[AudioWaveform] Calling onLoad with duration:', durationInSeconds);
              onLoad(durationInSeconds);
            }

            loadedRef.current = true;
            setLoaded(true);
          }
        });

        // Timeout fallback
        setTimeout(() => {
          if (!loadedRef.current && !cancelled) {
            console.log('[AudioWaveform] Timeout fallback triggered - no duration received');
            Sound.stopPlayer().catch(() => {});
            Sound.removePlayBackListener();
            if (onWaveformData && amplitudes && amplitudes.length > 0) {
              onWaveformData(amplitudes);
            }
            if (onLoad) {
              console.log('[AudioWaveform] Calling onLoad with fallback duration: 10');
              onLoad(10);
            }
            loadedRef.current = true;
            setLoaded(true);
          }
        }, 1500);

      } catch (error) {
        console.error('[AudioWaveform] Error loading audio duration:', error);
        if (onLoad && !loadedRef.current) {
          if (onWaveformData && amplitudes && amplitudes.length > 0) {
            onWaveformData(amplitudes);
          }
          onLoad(10);
          loadedRef.current = true;
        }
        setLoaded(true);
      }
    };

    loadDurationAndAmplitudes();

    return () => {
      console.log('[AudioWaveform] Cleanup function called');
      cancelled = true;
      Sound.stopPlayer().catch(() => {});
      Sound.removePlayBackListener();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioFile, loaded]);

  return (
    <View style={[styles.container, { width, height, backgroundColor }]}>
      <Waveform
        ref={waveformRef}
        mode="static"
        path={AttachmentService.getAbsolutePath(albumId, audioFile)}
        candleSpace={2}
        candleWidth={4}
        scrubColor={color}
        waveColor={color}
        containerStyle={{
          width,
          height,
          backgroundColor,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
  },
});
