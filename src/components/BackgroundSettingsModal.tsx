import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Image,
} from 'react-native';
import { Canvas, Rect, Path } from '@shopify/react-native-skia';
import { BackgroundPattern } from '../types/Album';
import { PATTERN_PRESETS, SOLID_COLOR_PRESETS, BACKGROUND_IMAGE_PRESETS, BACKGROUND_IMAGE_SOURCES, generatePatternPaths } from '../utils/backgroundPatterns';
import { MyIcon } from '../common/icons';
import { useLanguage } from '../contexts/LanguageContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MODAL_WIDTH = SCREEN_WIDTH * 0.9;

interface BackgroundSettingsModalProps {
  visible: boolean;
  currentPattern?: BackgroundPattern;
  onApply: (pattern: BackgroundPattern | undefined) => void;
  onClose: () => void;
}

export function BackgroundSettingsModal({
  visible,
  currentPattern,
  onApply,
  onClose,
}: BackgroundSettingsModalProps) {
  const { t } = useLanguage();
  const [selectedTab, setSelectedTab] = useState<'solid' | 'pattern' | 'image'>(
    currentPattern?.type || 'solid'
  );
  const [tempPattern, setTempPattern] = useState<BackgroundPattern | undefined>(
    currentPattern
  );

  const handleApply = () => {
    onApply(tempPattern);
    onClose();
  };

  const handleClear = () => {
    onApply(undefined);
    onClose();
  };

  const handleSelectSolid = (color: string) => {
    setTempPattern({
      type: 'solid',
      color,
    });
  };

  const handleSelectPattern = (
    patternType: keyof typeof PATTERN_PRESETS
  ) => {
    const preset = PATTERN_PRESETS[patternType];
    setTempPattern({
      type: 'pattern',
      patternType,
      patternColor: preset.defaultColor,
      backgroundColor: preset.defaultBgColor,
      patternScale: 1.0,
    });
  };

  const handleSelectImage = (imageName: string) => {
    setTempPattern({
      type: 'image',
      imageName,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('background.title')}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MyIcon info={{ name: 'close', size: 24, color: '#666', type: 'MDI' }} />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'solid' && styles.tabActive]}
              onPress={() => setSelectedTab('solid')}
            >
              <Text style={[styles.tabText, selectedTab === 'solid' && styles.tabTextActive]}>
                {t('background.solidColors')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'pattern' && styles.tabActive]}
              onPress={() => setSelectedTab('pattern')}
            >
              <Text style={[styles.tabText, selectedTab === 'pattern' && styles.tabTextActive]}>
                {t('background.patterns')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'image' && styles.tabActive]}
              onPress={() => setSelectedTab('image')}
            >
              <Text style={[styles.tabText, selectedTab === 'image' && styles.tabTextActive]}>
                {t('background.image')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {selectedTab === 'solid' ? (
              <View style={styles.colorGrid}>
                {SOLID_COLOR_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: preset.color },
                      tempPattern?.type === 'solid' &&
                        tempPattern.color === preset.color &&
                        styles.colorOptionSelected,
                    ]}
                    onPress={() => handleSelectSolid(preset.color)}
                  >
                    {tempPattern?.type === 'solid' &&
                      tempPattern.color === preset.color && (
                        <MyIcon
                          info={{ name: 'check', size: 24, color: '#000', type: 'MDI' }}
                        />
                      )}
                  </TouchableOpacity>
                ))}
              </View>
            ) : selectedTab === 'pattern' ? (
              <View style={styles.patternGrid}>
                {(Object.keys(PATTERN_PRESETS) as Array<keyof typeof PATTERN_PRESETS>).map(
                  (key) => {
                    const preset = PATTERN_PRESETS[key];
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.patternOption,
                          tempPattern?.type === 'pattern' &&
                            tempPattern.patternType === key &&
                            styles.patternOptionSelected,
                        ]}
                        onPress={() => handleSelectPattern(key)}
                      >
                        <View style={styles.patternPreview}>
                          {renderPatternPreview(key, preset)}
                        </View>
                        <Text style={styles.patternName}>{preset.name}</Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>
            ) : (
              <View style={styles.imageGrid}>
                {BACKGROUND_IMAGE_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.fileName}
                    style={[
                      styles.imageOption,
                      tempPattern?.type === 'image' &&
                        tempPattern.imageName === preset.fileName &&
                        styles.imageOptionSelected,
                    ]}
                    onPress={() => handleSelectImage(preset.fileName)}
                  >
                    <Image
                      source={BACKGROUND_IMAGE_SOURCES[preset.fileName]}
                      style={styles.imagePreview}
                      resizeMode="cover"
                    />
                    <Text style={styles.imageName}>{preset.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
              <Text style={styles.clearButtonText}>{t('background.removeBackground')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>{t('home.create')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function renderPatternPreview(
  patternType: string,
  preset: { defaultColor: string; defaultBgColor: string }
) {
  const previewWidth = (MODAL_WIDTH - 60) / 2;
  const previewHeight = 100;

  // Create a temporary pattern object for preview
  const tempPattern: BackgroundPattern = {
    type: 'pattern',
    patternType: patternType as any,
    patternColor: preset.defaultColor,
    backgroundColor: preset.defaultBgColor,
    patternScale: 0.5, // Smaller scale for preview to show more repetitions
  };

  // Generate the actual pattern paths
  const paths = generatePatternPaths(tempPattern, previewWidth, previewHeight);

  return (
    <Canvas style={{ width: previewWidth, height: previewHeight }}>
      {/* Background */}
      <Rect
        x={0}
        y={0}
        width={previewWidth}
        height={previewHeight}
        color={preset.defaultBgColor}
      />

      {/* Pattern paths - all use stroke for clean preview */}
      {paths.map((path, index) => (
        <Path
          key={index}
          path={path}
          color={preset.defaultColor}
          style="stroke"
          strokeWidth={2}
        />
      ))}
    </Canvas>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: MODAL_WIDTH,
    maxHeight: '80%',
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
  tabs: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#FFF',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    maxHeight: 400,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 70,
    height: 70,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionSelected: {
    borderColor: '#007AFF',
    borderWidth: 3,
  },
  patternGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  patternOption: {
    width: (MODAL_WIDTH - 60) / 2,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  patternOptionSelected: {
    borderColor: '#007AFF',
    borderWidth: 3,
  },
  patternPreview: {
    height: 100,
    overflow: 'hidden',
  },
  patternName: {
    padding: 8,
    textAlign: 'center',
    fontSize: 14,
    color: '#333',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageOption: {
    width: (MODAL_WIDTH - 60) / 2,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  imageOptionSelected: {
    borderColor: '#007AFF',
    borderWidth: 3,
  },
  imagePreview: {
    height: 100,
    width: '100%',
  },
  imageName: {
    padding: 8,
    textAlign: 'center',
    fontSize: 14,
    color: '#333',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
