import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { MyIcon } from '../common/icons';

interface CameraModalProps {
  visible: boolean;
  onCapture: (uri: string) => void;
  onCancel: () => void;
}

export function CameraModal({ visible, onCapture, onCancel }: CameraModalProps) {
  const cameraRef = useRef<Camera>(null);
  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back');
  const [captureInProgress, setCaptureInProgress] = useState(false);
  const { hasPermission, requestPermission } = useCameraPermission();

  const device = useCameraDevice(cameraPosition);

  // Request permissions when modal opens
  useEffect(() => {
    if (visible && !hasPermission) {
      requestPermission();
    }
  }, [visible, hasPermission]);

  const takePicture = async () => {
    if (captureInProgress || !cameraRef.current || !device) {
      console.log('[CameraModal] Cannot capture:', {
        captureInProgress,
        hasRef: !!cameraRef.current,
        hasDevice: !!device
      });
      return;
    }

    try {
      setCaptureInProgress(true);
      console.log('[CameraModal] Starting capture...');

      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
      });

      const photoUri = `file://${photo.path}`;
      console.log('[CameraModal] Picture taken:', photoUri);
      onCapture(photoUri);
    } catch (error) {
      console.error('[CameraModal] Failed to capture image:', error);
      Alert.alert('Error', 'Failed to capture photo');
    } finally {
      setCaptureInProgress(false);
    }
  };

  const toggleCamera = () => {
    setCameraPosition(prev => prev === 'back' ? 'front' : 'back');
  };

  // Don't render camera if no permission or no device
  if (!hasPermission) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: '#FFFFFF', fontSize: 18 }}>Camera permission required</Text>
          <TouchableOpacity
            style={[styles.cancelButton, { marginTop: 20 }]}
            onPress={onCancel}
          >
            <Text style={styles.cancelButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  if (!device) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 16, marginTop: 20 }}>Loading camera...</Text>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
      supportedOrientations={[
        'portrait',
        'portrait-upside-down',
        'landscape',
        'landscape-left',
        'landscape-right',
      ]}
    >
      <View style={styles.container}>
        <Camera
          ref={cameraRef}
          style={styles.camera}
          device={device}
          isActive={visible}
          photo={true}
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
