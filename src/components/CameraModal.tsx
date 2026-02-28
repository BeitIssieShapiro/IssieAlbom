import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';
import { MyIcon } from '../common/icons';

interface CameraModalProps {
  visible: boolean;
  onCapture: (uri: string) => void;
  onCancel: () => void;
}

export function CameraModal({ visible, onCapture, onCancel }: CameraModalProps) {
  const cameraRef = useRef<any>(null);
  const [cameraType, setCameraType] = useState<CameraType>(CameraType.Back);
  const [captureInProgress, setCaptureInProgress] = useState(false);

  const takePicture = async () => {
    if (captureInProgress || !cameraRef.current) return;

    try {
      setCaptureInProgress(true);
      const image = await cameraRef.current.capture();
      console.log('Picture taken:', image.uri);
      onCapture(image.uri);
    } catch (error) {
      console.error('Failed to capture image:', error);
    } finally {
      setCaptureInProgress(false);
    }
  };

  const toggleCamera = () => {
    setCameraType(prev =>
      prev === CameraType.Back ? CameraType.Front : CameraType.Back
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <Camera
          ref={cameraRef}
          style={styles.camera}
          cameraType={cameraType}
          saveToCameraRoll={false}
          showFrame={false}
          scanBarcode={false}
          zoomMode="on"
          zoom={1.0}
          maxZoom={3.0}
          resizeMode="contain"
        />

        {/* Top controls */}
        <View style={styles.topControls}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>ביטול</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.switchButton} onPress={toggleCamera}>
            <MyIcon
              info={{
                type: "Ionicons",
                name: "camera-reverse-outline",
                size: 32,
                color: "#FFFFFF",
              }}
            />
          </TouchableOpacity>
        </View>

        {/* Bottom capture button */}
        <View style={styles.bottomControls}>
          <TouchableOpacity
            style={[styles.captureButton, captureInProgress && styles.captureButtonDisabled]}
            onPress={takePicture}
            disabled={captureInProgress}
          >
            {captureInProgress ? (
              <ActivityIndicator size="large" color="#FFFFFF" />
            ) : (
              <View style={styles.captureButtonInner} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  topControls: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
  },
});
