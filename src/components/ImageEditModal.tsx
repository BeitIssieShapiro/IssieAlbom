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
  runOnJS,
} from 'react-native-reanimated';
import { MODAL_ORIENTATIONS } from '../types/Album';
import { captureRef } from 'react-native-view-shot';
import { MyIcon } from '../common/icons';
import { useLanguage } from '../contexts/LanguageContext';

interface ImageEditModalProps {
  visible: boolean;
  imageUri: string;
  pageAspectRatio: number; // width / height of the page canvas
  onApply: (editedUri: string, rotation: number) => void;
  onCancel: () => void;
  allowAspectRatioChange?: boolean; // If true, allow resizing crop frame (for adding images)
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

export function ImageEditModal({ visible, imageUri, pageAspectRatio, onApply, onCancel, allowAspectRatioChange = false }: ImageEditModalProps) {
  const { t, isRTL } = useLanguage();
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const viewShotRef = useRef<View>(null);

  // Crop frame resize values (for allowAspectRatioChange mode)
  const frameWidth = useSharedValue(0);
  const frameHeight = useSharedValue(0);
  const savedFrameWidth = useSharedValue(0);
  const savedFrameHeight = useSharedValue(0);

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

      let initialFrameWidth, initialFrameHeight;

      if (pageAspectRatio > containerWidth / containerHeight) {
        // Page is wider relative to container
        initialFrameWidth = containerWidth;
        initialFrameHeight = containerWidth / pageAspectRatio;
      } else {
        // Page is taller relative to container
        initialFrameHeight = containerHeight;
        initialFrameWidth = containerHeight * pageAspectRatio;
      }

      // Initialize shared values for resizable frame
      frameWidth.value = initialFrameWidth;
      frameHeight.value = initialFrameHeight;
      savedFrameWidth.value = initialFrameWidth;
      savedFrameHeight.value = initialFrameHeight;

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

  // Resize gestures for crop frame (only when allowAspectRatioChange is true)
  const rightHandlePan = Gesture.Pan()
    .onUpdate((e) => {
      const containerWidth = SCREEN_WIDTH - 40;
      const newWidth = Math.max(100, Math.min(containerWidth, savedFrameWidth.value + e.translationX));
      frameWidth.value = newWidth;
    })
    .onEnd(() => {
      savedFrameWidth.value = frameWidth.value;
    });

  const bottomHandlePan = Gesture.Pan()
    .onUpdate((e) => {
      const containerHeight = SCREEN_HEIGHT - 300;
      const newHeight = Math.max(100, Math.min(containerHeight, savedFrameHeight.value + e.translationY));
      frameHeight.value = newHeight;
    })
    .onEnd(() => {
      savedFrameHeight.value = frameHeight.value;
    });

  const cornerHandlePan = Gesture.Pan()
    .onUpdate((e) => {
      const containerWidth = SCREEN_WIDTH - 40;
      const containerHeight = SCREEN_HEIGHT - 300;
      const newWidth = Math.max(100, Math.min(containerWidth, savedFrameWidth.value + e.translationX));
      const newHeight = Math.max(100, Math.min(containerHeight, savedFrameHeight.value + e.translationY));
      frameWidth.value = newWidth;
      frameHeight.value = newHeight;
    })
    .onEnd(() => {
      savedFrameWidth.value = frameWidth.value;
      savedFrameHeight.value = frameHeight.value;
    });

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

  // Animated styles for the crop frame
  const frameAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: frameWidth.value,
      height: frameHeight.value,
    };
  });

  // Animated styles for handle positions
  const rightHandleStyle = useAnimatedStyle(() => {
    return {
      left: frameWidth.value - 20,
      height: frameHeight.value,
    };
  });

  const bottomHandleStyle = useAnimatedStyle(() => {
    return {
      top: frameHeight.value - 20,
      width: frameWidth.value,
    };
  });

  const cornerHandleStyle = useAnimatedStyle(() => {
    return {
      left: frameWidth.value - 20,
      top: frameHeight.value - 20,
    };
  });

  const handleApply = async () => {
    try {
      setLoading(true);

      if (!viewShotRef.current) {
        Alert.alert(t('imageEdit.error'), t('imageEdit.errorCapture'));
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
      Alert.alert(t('imageEdit.error'), t('imageEdit.errorSave'));
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

    // Reset frame size to initial values
    if (allowAspectRatioChange) {
      const containerWidth = SCREEN_WIDTH - 40;
      const containerHeight = SCREEN_HEIGHT - 300;

      let initialFrameWidth, initialFrameHeight;

      if (pageAspectRatio > containerWidth / containerHeight) {
        initialFrameWidth = containerWidth;
        initialFrameHeight = containerWidth / pageAspectRatio;
      } else {
        initialFrameHeight = containerHeight;
        initialFrameWidth = containerHeight * pageAspectRatio;
      }

      frameWidth.value = withSpring(initialFrameWidth);
      frameHeight.value = withSpring(initialFrameHeight);
      savedFrameWidth.value = initialFrameWidth;
      savedFrameHeight.value = initialFrameHeight;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleCancel}
      supportedOrientations={MODAL_ORIENTATIONS}
    >
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.container}>
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 16, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>{t('imageEdit.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t('imageEdit.title')}</Text>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={handleApply}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.applyButtonText}>{t('imageEdit.apply')}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Crop frame with image */}
          <View style={[styles.imageContainer, { paddingBottom: insets.bottom + 80 }]}>
            <Animated.View style={[{ position: 'relative' }, frameAnimatedStyle]}>
              <Animated.View
                ref={viewShotRef}
                collapsable={false}
                style={[
                  {
                    backgroundColor: '#000',
                    overflow: 'hidden',
                  },
                  frameAnimatedStyle,
                ]}
              >
                <GestureDetector gesture={composedGesture}>
                  <Animated.View
                    style={[
                      {
                        width: SCREEN_WIDTH,
                        height: SCREEN_HEIGHT,
                        justifyContent: 'center',
                        alignItems: 'center',
                      },
                      animatedStyle,
                    ]}
                  >
                    <Image
                      source={{ uri: imageUri }}
                      style={{
                        width: SCREEN_WIDTH,
                        height: SCREEN_HEIGHT,
                      }}
                      resizeMode="contain"
                    />
                  </Animated.View>
                </GestureDetector>
              </Animated.View>

              {/* Crop frame border (overlays the viewshot) */}
              <Animated.View
                style={[
                  styles.cropFrameBorder,
                  frameAnimatedStyle,
                ]}
                pointerEvents="none"
              />

              {/* Resize handles (only when allowAspectRatioChange is true) */}
              {allowAspectRatioChange && (
                <>
                  {/* Right handle */}
                  <GestureDetector gesture={rightHandlePan}>
                    <Animated.View
                      style={[
                        styles.resizeHandle,
                        styles.rightHandle,
                        rightHandleStyle,
                      ]}
                    >
                      <View style={styles.handleBar} />
                    </Animated.View>
                  </GestureDetector>

                  {/* Bottom handle */}
                  <GestureDetector gesture={bottomHandlePan}>
                    <Animated.View
                      style={[
                        styles.resizeHandle,
                        styles.bottomHandle,
                        bottomHandleStyle,
                      ]}
                    >
                      <View style={[styles.handleBar, { width: 60, height: 4 }]} />
                    </Animated.View>
                  </GestureDetector>

                  {/* Corner handle */}
                  <GestureDetector gesture={cornerHandlePan}>
                    <Animated.View
                      style={[
                        styles.resizeHandle,
                        styles.cornerHandle,
                        cornerHandleStyle,
                      ]}
                    >
                      <MyIcon
                        info={{
                          type: 'MDI',
                          name: 'resize-bottom-right',
                          size: 24,
                          color: '#007AFF',
                        }}
                      />
                    </Animated.View>
                  </GestureDetector>
                </>
              )}
            </Animated.View>
          </View>

          {/* Controls */}
          <View style={[styles.controls, { paddingBottom: insets.bottom }]}>
            <Text style={[styles.instructionText, { textAlign: isRTL ? 'right' : 'left' }]}>
              {t('imageEdit.instructions')}
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
              <Text style={styles.resetButtonText}>{t('imageEdit.reset')}</Text>
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
  resizeHandle: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    zIndex: 10,
  },
  rightHandle: {
    top: 0,
    width: 40,
    cursor: 'ew-resize',
  },
  bottomHandle: {
    left: 0,
    height: 40,
    cursor: 'ns-resize',
  },
  cornerHandle: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0, 122, 255, 0.5)',
    borderRadius: 20,
    cursor: 'nwse-resize',
  },
  handleBar: {
    width: 4,
    height: 60,
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
});
