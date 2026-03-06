import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { MyIcon } from '../common/icons';

interface ImageEditModalProps {
  visible: boolean;
  imageUri: string;
  pageAspectRatio: number; // width / height of the page canvas
  onApply: (editedUri: string, rotation: number) => void;
  onCancel: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

export function ImageEditModal({ visible, imageUri, pageAspectRatio, onApply, onCancel }: ImageEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [cropFrameSize, setCropFrameSize] = useState({ width: 0, height: 0 });
  const insets = useSafeAreaInsets();
  const viewShotRef = useRef<View>(null);

  // Image transform values
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const savedRotation = useSharedValue(0);

  // Calculate crop frame size when modal opens
  React.useEffect(() => {
    if (visible) {
      const containerWidth = SCREEN_WIDTH - 40;
      const containerHeight = SCREEN_HEIGHT - 300;

      let frameWidth, frameHeight;

      if (pageAspectRatio > containerWidth / containerHeight) {
        // Page is wider relative to container
        frameWidth = containerWidth;
        frameHeight = containerWidth / pageAspectRatio;
      } else {
        // Page is taller relative to container
        frameHeight = containerHeight;
        frameWidth = containerHeight * pageAspectRatio;
      }

      setCropFrameSize({ width: frameWidth, height: frameHeight });

      // Reset transforms
      scale.value = 1;
      savedScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
      rotation.value = 0;
      savedRotation.value = 0;
    }
  }, [visible, pageAspectRatio]);

  // Pinch gesture for zoom
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  // Pan gesture for moving
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Rotation gesture
  const rotationGesture = Gesture.Rotation()
    .onUpdate((e) => {
      rotation.value = savedRotation.value + e.rotation;
    })
    .onEnd(() => {
      savedRotation.value = rotation.value;
    });

  // Combine gestures
  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    rotationGesture
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
        { rotate: `${rotation.value}rad` },
      ],
    };
  });

  const handleApply = async () => {
    try {
      setLoading(true);

      if (!viewShotRef.current) {
        Alert.alert('שגיאה', 'לא ניתן לצלם את התמונה');
        return;
      }

      // Capture the crop frame as an image
      const uri = await captureRef(viewShotRef, {
        format: 'jpg',
        quality: 0.9,
      });

      console.log('Captured cropped image:', uri);

      // Pass captured image URI (rotation is already applied in the capture)
      onApply(uri, 0);
    } catch (error) {
      console.error('Failed to capture image:', error);
      Alert.alert('שגיאה', 'לא ניתן לשמור את התמונה');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onCancel();
  };

  const handleReset = () => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    rotation.value = withSpring(0);
    savedRotation.value = 0;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleCancel}
      supportedOrientations={[
        'portrait',
        'portrait-upside-down',
        'landscape',
        'landscape-left',
        'landscape-right',
      ]}
    >
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.container}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>ביטול</Text>
            </TouchableOpacity>
            <Text style={styles.title}>עריכת תמונה</Text>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={handleApply}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.applyButtonText}>אישור</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Crop frame with image */}
          <View style={[styles.imageContainer, { paddingBottom: insets.bottom + 80 }]}>
            <View style={{ position: 'relative' }}>
              <View
                ref={viewShotRef}
                collapsable={false}
                style={{
                  width: cropFrameSize.width,
                  height: cropFrameSize.height,
                  backgroundColor: '#000',
                  overflow: 'hidden',
                }}
              >
                <GestureDetector gesture={composedGesture}>
                  <Animated.View
                    style={[
                      {
                        width: cropFrameSize.width,
                        height: cropFrameSize.height,
                        justifyContent: 'center',
                        alignItems: 'center',
                      },
                      animatedStyle,
                    ]}
                  >
                    <Image
                      source={{ uri: imageUri }}
                      style={{
                        width: cropFrameSize.width,
                        height: cropFrameSize.height,
                      }}
                      resizeMode="contain"
                    />
                  </Animated.View>
                </GestureDetector>
              </View>

              {/* Crop frame border (overlays the viewshot) */}
              <View
                style={[
                  styles.cropFrameBorder,
                  {
                    width: cropFrameSize.width,
                    height: cropFrameSize.height,
                  },
                ]}
                pointerEvents="none"
              />
            </View>
          </View>

          {/* Controls */}
          <View style={[styles.controls, { paddingBottom: insets.bottom }]}>
            <Text style={styles.instructionText}>
              יש להשתמש בשתי אצבעות כדי לזוז, לסובב ולהגדיל
            </Text>
            <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
              <MyIcon
                info={{
                  type: 'MDI',
                  name: 'refresh',
                  size: 24,
                  color: '#007AFF',
                }}
              />
              <Text style={styles.resetButtonText}>איפוס</Text>
            </TouchableOpacity>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
    textAlign: 'center',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cropFrameBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 3,
    borderColor: '#007AFF',
    pointerEvents: 'none',
  },
  controls: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  instructionText: {
    color: '#FFF',
    fontSize: 14,
    textAlign: 'center',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  resetButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
