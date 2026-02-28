import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, PermissionsAndroid, Alert } from 'react-native';
import Sound from 'react-native-nitro-sound';
import { MyIcon } from '../common/icons';

interface AudioElementProps {
  audioFile?: string;
  editMode?: boolean;
  onUpdateAudioFile?: (filePath: string) => void;
  width?: number;
  height?: number;
  autoPlay?: boolean; // Auto-play audio when component mounts
}

export function AudioElement({
  audioFile,
  editMode,
  onUpdateAudioFile,
  width = 80,
  height = 80,
  autoPlay = false,
}: AudioElementProps) {
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);

  console.log('AudioElement render:', { audioFile, editMode, width, height, autoPlay });

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
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        ]);

        if (
          grants['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED &&
          grants['android.permission.WRITE_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED &&
          grants['android.permission.READ_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED
        ) {
          return true;
        } else {
          Alert.alert('הרשאות', 'יש לאפשר הרשאות הקלטה ושמירת קבצים');
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
      const audioConfig = {
        AudioSamplingRate: 44100,
        AudioEncodingBitRate: 128000,
        AudioChannels: 1,
      };

      await Sound.startRecorder(undefined, audioConfig, true);
      Sound.addRecordBackListener((e) => {
        setRecordSecs(e.currentPosition);
      });
      setRecording(true);
      console.log('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('שגיאה', 'ההקלטה נכשלה');
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
      const filePath = audioFile.startsWith('file://') ? audioFile : `file://${audioFile}`;
      console.log('Starting playback for:', filePath);
      await Sound.startPlayer(filePath);
      Sound.addPlayBackListener((e) => {
        if (e.currentPosition >= e.duration && e.duration > 0) {
          setPlaying(false);
          Sound.stopPlayer().catch(console.error);
        }
      });
      setPlaying(true);
      console.log('Playback started successfully');
    } catch (error) {
      console.error('Failed to start playback:', error);
      Alert.alert('שגיאה', 'הפעלת ההקלטה נכשלה');
    }
  };

  const onStopPlay = async () => {
    try {
      await Sound.stopPlayer();
      Sound.removePlayBackListener();
      setPlaying(false);
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
