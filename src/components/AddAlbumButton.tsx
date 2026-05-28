import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { spacing, borderRadius, shadows } from '../theme/colors';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

const CARD_MARGIN = spacing.md;
const LIST_PADDING = spacing.md;
const MIN_CARD_WIDTH = 100; // Smaller for mobile landscape to fit more columns
const MAX_COLUMNS = 4; // Maximum columns on larger screens

interface AddAlbumButtonProps {
  onPress: () => void;
  screenWidth: number;
}

export function AddAlbumButton({ onPress, screenWidth }: AddAlbumButtonProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();

  // Calculate responsive number of columns based on screen width
  const availableWidth = screenWidth - LIST_PADDING * 2;
  const calculatedColumns = Math.floor(availableWidth / (MIN_CARD_WIDTH + CARD_MARGIN * 2));
  const numColumns = Math.max(1, Math.min(calculatedColumns, MAX_COLUMNS));
  const cardWidth = (availableWidth - CARD_MARGIN * 2 * numColumns) / numColumns;

  return (
    <TouchableOpacity
      style={[styles.container, {
        width: cardWidth,
        backgroundColor: colors.cardBackground,
        borderColor: colors.primary,
      }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: colors.background }]}>
        <Text allowFontScaling={false} style={[styles.icon, { color: colors.primary }]}>+</Text>
      </View>
      <Text allowFontScaling={false} style={[styles.label, { color: colors.primary }]}>{t('home.newAlbum')}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: CARD_MARGIN,
    borderRadius: borderRadius.large,
    borderWidth: 3,
    borderStyle: 'dashed',
    boxShadow: shadows.card,
    overflow: 'hidden',
  },
  iconContainer: {
    aspectRatio: 2 / 1, // Even more compact for mobile landscape (was 3/2)
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 48, // Reduced from 64 for more compact cards
    fontWeight: '300',
  },
  label: {
    padding: spacing.sm, // Reduced from spacing.md for more compact cards
    fontSize: 14, // Reduced from 16 for more compact cards
    fontWeight: '700',
    textAlign: 'center',
  },
});
