import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { MODAL_ORIENTATIONS } from '../types/Album';

interface TilesModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (text: string) => void;
  initialText?: string;
  isEditing?: boolean; // Flag to indicate if we're editing existing tiles
}

export function TilesModal({
  visible,
  onClose,
  onConfirm,
  initialText = '',
  isEditing = false,
}: TilesModalProps) {
  const { colors, spacing, borderRadius } = useTheme();
  const { t, isRTL } = useLanguage();

  const [text, setText] = useState(initialText);

  // Update state when modal opens with new initial values
  React.useEffect(() => {
    if (visible) {
      setText(initialText);
    }
  }, [visible, initialText]);

  const handleConfirm = () => {
    if (text.trim()) {
      onConfirm(text.trim());
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
                backgroundColor: colors.background,
                color: colors.textPrimary,
                borderColor: colors.border,
                borderRadius: borderRadius.medium,
                fontWeight: 'bold',
                textAlign: 'center',
              },
            ]}
            value={text}
            onChangeText={setText}
            placeholder={t('editor.tilesPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            multiline
            autoFocus
          />

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
    marginBottom: 20,
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
