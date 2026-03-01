import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { BackgroundPattern } from '../types/Album';
import { PATTERN_PRESETS, SOLID_COLOR_PRESETS } from '../utils/backgroundPatterns';
import { MyIcon } from '../common/icons';

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
  const [selectedTab, setSelectedTab] = useState<'solid' | 'pattern'>(
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
    patternType: 'dots' | 'stripes' | 'grid' | 'diagonal'
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
            <Text style={styles.title}>רקע עמוד</Text>
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
                צבע אחיד
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'pattern' && styles.tabActive]}
              onPress={() => setSelectedTab('pattern')}
            >
              <Text style={[styles.tabText, selectedTab === 'pattern' && styles.tabTextActive]}>
                תבניות
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
            ) : (
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
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
              <Text style={styles.clearButtonText}>נקה רקע</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>החל</Text>
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
  const previewStyle = {
    backgroundColor: preset.defaultBgColor,
  };

  switch (patternType) {
    case 'dots':
      return (
        <View style={[styles.previewContainer, previewStyle]}>
          <View style={[styles.dot, { backgroundColor: preset.defaultColor, top: 20, left: 20 }]} />
          <View style={[styles.dot, { backgroundColor: preset.defaultColor, top: 20, right: 20 }]} />
          <View style={[styles.dot, { backgroundColor: preset.defaultColor, bottom: 20, left: 20 }]} />
          <View style={[styles.dot, { backgroundColor: preset.defaultColor, bottom: 20, right: 20 }]} />
        </View>
      );
    case 'stripes':
      return (
        <View style={[styles.previewContainer, previewStyle]}>
          <View style={[styles.stripe, { backgroundColor: preset.defaultColor, top: 15 }]} />
          <View style={[styles.stripe, { backgroundColor: preset.defaultColor, top: 55 }]} />
        </View>
      );
    case 'grid':
      return (
        <View style={[styles.previewContainer, previewStyle]}>
          <View style={[styles.gridLine, styles.gridLineV, { backgroundColor: preset.defaultColor }]} />
          <View style={[styles.gridLine, styles.gridLineH, { backgroundColor: preset.defaultColor }]} />
        </View>
      );
    case 'diagonal':
      return (
        <View style={[styles.previewContainer, previewStyle]}>
          <View
            style={[
              styles.diagonalLine,
              { backgroundColor: preset.defaultColor },
            ]}
          />
        </View>
      );
    default:
      return null;
  }
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
  },
  patternName: {
    padding: 8,
    textAlign: 'center',
    fontSize: 14,
    color: '#333',
  },
  previewContainer: {
    flex: 1,
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stripe: {
    position: 'absolute',
    width: '100%',
    height: 20,
  },
  gridLine: {
    position: 'absolute',
  },
  gridLineV: {
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
  },
  gridLineH: {
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
  },
  diagonalLine: {
    position: 'absolute',
    width: 140,
    height: 2,
    transform: [{ rotate: '45deg' }],
    top: '50%',
    left: -20,
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
