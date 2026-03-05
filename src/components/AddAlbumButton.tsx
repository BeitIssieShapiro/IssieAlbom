import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { spacing, borderRadius, shadows } from '../theme/colors';
import { useTheme } from '../contexts/ThemeContext';

const NUM_COLUMNS = 4;
const CARD_MARGIN = spacing.md;
const LIST_PADDING = spacing.md;

interface AddAlbumButtonProps {
  onPress: () => void;
  screenWidth: number;
}

export function AddAlbumButton({ onPress, screenWidth }: AddAlbumButtonProps) {
  const { colors } = useTheme();
  const cardWidth = (screenWidth - LIST_PADDING * 2 - CARD_MARGIN * 2 * NUM_COLUMNS) / NUM_COLUMNS;

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
        <Text style={[styles.icon, { color: colors.primary }]}>+</Text>
      </View>
      <Text style={[styles.label, { color: colors.primary }]}>אלבום חדש</Text>
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
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
    fontWeight: '300',
  },
  label: {
    padding: spacing.md,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
});
