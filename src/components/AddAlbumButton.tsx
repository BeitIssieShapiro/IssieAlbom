import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface AddAlbumButtonProps {
  onPress: () => void;
}

export function AddAlbumButton({ onPress }: AddAlbumButtonProps) {
  return (
    <TouchableOpacity
      style={styles.container}
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
    flex: 1,
    margin: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  iconContainer: {
    aspectRatio: 1,
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
