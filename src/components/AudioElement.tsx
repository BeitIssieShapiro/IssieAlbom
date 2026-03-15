import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, PermissionsAndroid } from 'react-native';
import { RTLAlertStatic } from './RTLAlert';
import Sound from 'react-native-nitro-sound';
import { MyIcon } from '../common/icons';
import { WordTiming } from '../types/Album';
import { AttachmentService } from '../services/AttachmentService';
import { useLanguage } from '../contexts/LanguageContext';

interface AudioElementProps {
  audioFile?: string; // Relative path to audio file
  albumId: string; // Album ID for path conversion
  editMode?: boolean;
  onUpdateAudioFile?: (filePath: string) => void;
  width?: number;
  height?: number;
  autoPlay?: boolean; // Auto-play audio when component mounts
  wordTimings?: WordTiming[]; // Word timings for highlighting
  onWordChange?: (wordIndex: number) => void; // Callback when current word changes
}

export function AudioElement({
  audioFile,
  albumId,
  editMode,
  onUpdateAudioFile,
  width = 80,
  height = 80,
  autoPlay = false,
  wordTimings = [],
  onWordChange,
}: AudioElementProps) {
  const { t } = useLanguage();
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const isMountedRef = useRef(true);

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Auto-play effect
  useEffect(() => {
    if (autoPlay && audioFile && !playing) {
      console.log('Auto-playing audio:', audioFile);
      onStartPlay();
    }
  }, [autoPlay, audioFile]);

  useEffect(() => {
    return () => {
      // Cleanup on unmount - only stop what we might have started
      if (recording) {
        Sound.stopRecorder().catch(console.error);
        Sound.removeRecordBackListener();
      }
      if (playing) {
        Sound.stopPlayer().catch(console.error);
        Sound.removePlayBackListener();
      }
    };
  }, [recording, playing]);

  const checkPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        // On Android 13+ (API 33+), WRITE_EXTERNAL_STORAGE is not needed for app-specific directories
        // We only need RECORD_AUDIO permission
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);

        if (grants['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED) {
          return true;
        } else {
          RTLAlertStatic.alert(t('editor.permissions'), t('editor.permissionsMessage'));
          return false;
        }
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const onStartRecord = async () => {
    const hasPermission = await checkPermissions();
    if (!hasPermission) return;

    try {
      // Use VOICE_RECOGNITION audio source for better voice capture on Android
      const audioConfig = {
        AudioSourceAndroid: 6, // VOICE_RECOGNITION - optimized for voice with noise cancellation
        OutputFormatAndroid: 2, // MPEG_4
        AudioEncoderAndroid: 3, // AAC
      };
      await Sound.startRecorder(undefined, audioConfig, true);
      Sound.addRecordBackListener((e) => {
        setRecordSecs(e.currentPosition);
      });
      setRecording(true);
      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      RTLAlertStatic.alert(t('home.error'), t('editor.errorRecording'));
    }
  };

  const onStopRecord = async () => {
    try {
      const result = await Sound.stopRecorder();
      Sound.removeRecordBackListener();
      setRecording(false);
      setRecordSecs(0);
      console.log('Recording stopped, file:', result);

      if (onUpdateAudioFile) {
        onUpdateAudioFile(result);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const onStartPlay = async () => {
    if (!audioFile) {
      console.log('onStartPlay: No audio file');
      return;
    }

    try {
      // Convert relative path to absolute
      const absolutePath = AttachmentService.getAbsolutePath(albumId, audioFile);
      const filePath = `file://${absolutePath}`;
      console.log('Starting playback for:', filePath);
      await Sound.startPlayer(filePath);
      Sound.addPlayBackListener((e) => {
        const currentTimeSec = e.currentPosition / 1000;

        // Update current word based on playback position
        if (wordTimings && wordTimings.length > 0) {
          let wordIndex = -1;
          for (let i = wordTimings.length - 1; i >= 0; i--) {
            if (currentTimeSec >= wordTimings[i].startTime) {
              wordIndex = i;
              break;
            }
          }
          if (wordIndex !== currentWordIndex) {
            setCurrentWordIndex(wordIndex);
            if (onWordChange) {
              onWordChange(wordIndex);
            }
          }
        } else {
          // No word timings - highlight all text (index 0)
          if (currentWordIndex !== 0) {
            setCurrentWordIndex(0);
            if (onWordChange) {
              onWordChange(0);
            }
          }
        }

        if (e.currentPosition >= e.duration && e.duration > 0) {
          setPlaying(false);
          setCurrentWordIndex(-1);
          if (isMountedRef.current && onWordChange) {
            onWordChange(-1); // Clear highlights when playback ends
          }
          Sound.stopPlayer().catch(console.error);
        }
      });
      setPlaying(true);
      console.log('Playback started successfully');
    } catch (error) {
      console.error('Failed to start playback:', error);
      RTLAlertStatic.alert(t('home.error'), t('editor.errorPlayRecording'));
    }
  };

  const onStopPlay = async () => {
    try {
      await Sound.stopPlayer();
      Sound.removePlayBackListener();
      setPlaying(false);
      setCurrentWordIndex(-1);
      if (isMountedRef.current && onWordChange) {
        onWordChange(-1); // Clear highlights when manually stopped
      }
      console.log('Playback stopped');
    } catch (error) {
      console.error('Failed to stop playback:', error);
    }
  };

  return (
    <View style={[styles.container, { width, height }]}>
      {editMode && !audioFile ? (
        // Recording mode
        <TouchableOpacity
          style={[styles.button, recording && styles.recordingButton, { width: width * 0.7, height: height * 0.7, borderRadius: width * 0.35 }]}
          onPress={recording ? onStopRecord : onStartRecord}
        >
          <MyIcon
            info={{
              name: recording ? 'stop' : 'microphone',
              size: width * 0.45,
              color: recording ? '#fff' : '#C8572A',
              type: 'MDI',
            }}
          />
        </TouchableOpacity>
      ) : audioFile ? (
        // Playback mode - only show if there's an audio file
        <TouchableOpacity
          style={[styles.button, { width: width * 0.7, height: height * 0.7, borderRadius: width * 0.35 }]}
          onPress={playing ? onStopPlay : onStartPlay}
        >
          <MyIcon
            info={{
              name: playing ? 'pause' : 'play',
              size: width * 0.45,
              color: '#C8572A',
              type: 'MDI',
            }}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#DCDCDC',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 3.84,
    elevation: 5,
  },
  button: {
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingButton: {
    backgroundColor: '#C8572A',
  },
});
