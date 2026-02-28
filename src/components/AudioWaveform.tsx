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
}

export function AudioWaveform({
  audioFile,
  albumId,
  width,
  height,
  color = '#007AFF',
  backgroundColor = '#f0f0f0',
  onLoad,
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

        Sound.addPlayBackListener((e) => {
          if (e.duration > 0 && !loadedRef.current) {
            const durationInSeconds = e.duration / 1000;
            console.log('[AudioWaveform] Got duration from playback listener:', durationInSeconds);

            Sound.stopPlayer().catch(() => {});
            Sound.removePlayBackListener();

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
