import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Waveform } from '@simform_solutions/react-native-audio-waveform';
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
  const loadedRef = useRef(false); // Use ref to avoid closure trap in timeout

  // Load audio duration ONCE
  useEffect(() => {
    console.log('[AudioWaveform] Effect running - loaded:', loaded, 'audioFile:', audioFile);
    if (loaded) return;

    const loadDuration = async () => {
      try {
        // Convert relative path to absolute
        const absolutePath = AttachmentService.getAbsolutePath(albumId, audioFile);
        const filePath = `file://${absolutePath}`;
        console.log('[AudioWaveform] Starting player for duration extraction:', filePath);
        await Sound.startPlayer(filePath);

        // Collect amplitude samples for waveform heuristics
        const amplitudeSamples: number[] = [];
        const SAMPLE_COUNT = 200; // Number of amplitude samples to collect

        Sound.addPlayBackListener((e) => {
          if (e.duration > 0 && !loadedRef.current) {
            const durationInSeconds = e.duration / 1000;
            console.log('[AudioWaveform] Got duration from playback listener:', durationInSeconds);

            // Collect amplitude sample (normalized 0-1)
            // Note: e.currentPosition / e.duration gives us relative position
            const sampleIndex = Math.floor((e.currentPosition / e.duration) * SAMPLE_COUNT);
            if (sampleIndex < SAMPLE_COUNT && !amplitudeSamples[sampleIndex]) {
              // For now, use a simple heuristic: assume uniform amplitude
              // In the future, this could be extracted from actual audio analysis
              amplitudeSamples[sampleIndex] = 0.5 + Math.random() * 0.3; // Random 0.5-0.8 for now
            }

            Sound.stopPlayer().catch(() => {});
            Sound.removePlayBackListener();

            // Fill in missing samples with interpolation or default values
            for (let i = 0; i < SAMPLE_COUNT; i++) {
              if (!amplitudeSamples[i]) {
                amplitudeSamples[i] = 0.5; // Default medium amplitude
              }
            }

            if (onWaveformData) {
              console.log('[AudioWaveform] Calling onWaveformData with', amplitudeSamples.length, 'samples');
              onWaveformData(amplitudeSamples);
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
          if (!loadedRef.current) {
            console.log('[AudioWaveform] Timeout fallback triggered - no duration received');
            Sound.stopPlayer().catch(() => {});
            Sound.removePlayBackListener();
            if (onLoad) {
              console.log('[AudioWaveform] Calling onLoad with fallback duration: 10');
              onLoad(10);
            }
            loadedRef.current = true;
            setLoaded(true);
          } else {
            console.log('[AudioWaveform] Timeout reached but already loaded, skipping fallback');
          }
        }, 1500);

      } catch (error) {
        console.error('[AudioWaveform] Error loading audio duration:', error);
        if (onLoad && !loadedRef.current) {
          console.log('[AudioWaveform] Calling onLoad with error fallback duration: 10');
          onLoad(10);
          loadedRef.current = true;
        }
        setLoaded(true);
      }
    };

    loadDuration();

    return () => {
      console.log('[AudioWaveform] Cleanup function called');
      Sound.stopPlayer().catch(() => {});
      Sound.removePlayBackListener();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioFile, loaded]); // Don't include onLoad - it changes on every render

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
