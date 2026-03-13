import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { MODAL_ORIENTATIONS } from '../types/Album';

const BG_COLORS = ['#FF6B9D', '#C44569', '#4A69BD', '#60A3BC', '#78E08F', '#FFC312', '#EE5A6F', '#B8E994'];
const TEXT_COLORS = ['#FFFFFF', '#000000', '#333333', '#666666', '#2C3E50', '#E74C3C', '#3498DB', '#2ECC71'];
const SIZES = [
  { label: 'XS', value: 0.08 },
  { label: 'S', value: 0.10 },
  { label: 'M', value: 0.12 },
  { label: 'L', value: 0.15 },
  { label: 'XL', value: 0.18 },
];

interface TilesModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (text: string, bgColor: string, textColor: string, size: number) => void;
  initialText?: string;
  initialBgColor?: string;
  initialTextColor?: string;
  initialSize?: number;
  isEditing?: boolean; // Flag to indicate if we're editing existing tiles
}

export function TilesModal({
  visible,
  onClose,
  onConfirm,
  initialText = '',
  initialBgColor = '#4A69BD',
  initialTextColor = '#FFFFFF',
  initialSize = 0.12, // Default to M
  isEditing = false,
}: TilesModalProps) {
  const { colors, spacing, borderRadius } = useTheme();
  const { t, isRTL } = useLanguage();

  const [text, setText] = useState(initialText);
  const [bgColor, setBgColor] = useState(initialBgColor);
  const [textColor, setTextColor] = useState(initialTextColor);
  const [size, setSize] = useState(initialSize);

  // Update state when modal opens with new initial values
  React.useEffect(() => {
    if (visible) {
      setText(initialText);
      setBgColor(initialBgColor);
      setTextColor(initialTextColor);
      setSize(initialSize);
    }
  }, [visible, initialText, initialBgColor, initialTextColor, initialSize]);

  const handleConfirm = () => {
    if (text.trim()) {
      onConfirm(text.trim(), bgColor, textColor, size);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      supportedOrientations={MODAL_ORIENTATIONS}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.modal,
            {
              backgroundColor: colors.cardBackground,
              borderRadius: borderRadius.large,
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('editor.tilesTitle')}
          </Text>

          {/* Text Input */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {t('editor.tilesPrompt')}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: bgColor,
                color: textColor,
                fontSize: Math.max(300 * size, 18), // Preview: use 300 as base width
                borderColor: colors.border,
                borderRadius: borderRadius.medium,
                fontWeight: 'bold',
                textAlign: 'center',
              },
            ]}
            value={text}
            onChangeText={setText}
            placeholder={t('editor.tilesPlaceholder')}
            placeholderTextColor={textColor + '80'} // 50% opacity
            cursorColor={textColor}
            multiline
            autoFocus
          />

          <ScrollView style={styles.scrollContent}>
            {/* Background Color */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: spacing.md }]}>
              {t('editor.tilesBackgroundColor')}
            </Text>
            <View style={styles.colorGrid}>
              {BG_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    bgColor === color && styles.colorSwatchActive,
                  ]}
                  onPress={() => setBgColor(color)}
                />
              ))}
            </View>

            {/* Text Color */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: spacing.md }]}>
              {t('editor.tilesTextColor')}
            </Text>
            <View style={styles.colorGrid}>
              {TEXT_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    textColor === color && styles.colorSwatchActive,
                  ]}
                  onPress={() => setTextColor(color)}
                />
              ))}
            </View>

            {/* Size */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: spacing.md }]}>
              {t('editor.size')}
            </Text>
            <View style={styles.sizeGrid}>
              {SIZES.map((s) => (
                <TouchableOpacity
                  key={s.label}
                  style={[
                    styles.sizeButton,
                    {
                      backgroundColor: size === s.value ? colors.primary : colors.background,
                      borderRadius: borderRadius.small,
                    },
                  ]}
                  onPress={() => setSize(s.value)}
                >
                  <Text
                    style={[
                      styles.sizeText,
                      { color: size === s.value ? '#FFF' : colors.textPrimary },
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: colors.border, borderRadius: borderRadius.medium },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.buttonText, { color: colors.textPrimary }]}>
                {t('imageEdit.cancel')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: text.trim() ? colors.primary : colors.border,
                  borderRadius: borderRadius.medium,
                },
              ]}
              onPress={handleConfirm}
              disabled={!text.trim()}
            >
              <Text style={[styles.buttonText, { color: '#FFF' }]}>
                {isEditing ? t('editor.tilesUpdate') : t('editor.tilesCreate')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    width: "100%",
    textAlign: "left"
  },
  input: {
    minHeight: 80,
    borderWidth: 1,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  scrollContent: {
    maxHeight: 300,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: '#000',
    borderWidth: 3,
  },
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sizeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  sizeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
