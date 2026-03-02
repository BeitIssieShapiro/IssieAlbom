import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const NUM_COLUMNS = 4;
const CARD_MARGIN = 8;
const LIST_PADDING = 8;

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
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    boxShadow: '5px 5px 5px 0px rgba(0, 0, 0, 0.2)',
    overflow: 'hidden',
  },
  iconContainer: {
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  icon: {
    fontSize: 48,
    color: '#999',
    fontWeight: '300',
  },
  label: {
    padding: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
});
