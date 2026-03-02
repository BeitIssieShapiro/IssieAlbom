import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';

const NUM_COLUMNS = 4;
const CARD_MARGIN = spacing.md;
const LIST_PADDING = spacing.md;

interface AddAlbumButtonProps {
  onPress: () => void;
  screenWidth: number;
}

export function AddAlbumButton({ onPress, screenWidth }: AddAlbumButtonProps) {
  const cardWidth = (screenWidth - LIST_PADDING * 2 - CARD_MARGIN * 2 * NUM_COLUMNS) / NUM_COLUMNS;

  return (
    <TouchableOpacity
      style={[styles.container, { width: cardWidth }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>+</Text>
      </View>
      <Text style={styles.label}>אלבום חדש</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: CARD_MARGIN,
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.large,
    borderWidth: 3,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    boxShadow: shadows.card,
    overflow: 'hidden',
  },
  iconContainer: {
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  icon: {
    fontSize: 64,
    color: colors.primary,
    fontWeight: '300',
  },
  label: {
    padding: spacing.md,
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
});
