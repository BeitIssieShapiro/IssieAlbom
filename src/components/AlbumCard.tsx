import React, { useState } from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Album } from '../types/Album';

const NUM_COLUMNS = 4;
const CARD_MARGIN = 8;
const LIST_PADDING = 8;

interface AlbumCardProps {
  album: Album;
  onPress: (album: Album) => void;
  onRename?: (album: Album) => void;
  onDelete?: (album: Album) => void;
  screenWidth: number;
}

export function AlbumCard({ album, onPress, onRename, onDelete, screenWidth }: AlbumCardProps) {
  const cardWidth = (screenWidth - LIST_PADDING * 2 - CARD_MARGIN * 2 * NUM_COLUMNS) / NUM_COLUMNS;
  const [menuVisible, setMenuVisible] = useState(false);
  const formattedDate = new Date(album.createdAt).toLocaleDateString('he-IL');

  const handleMenuOption = (action: 'rename' | 'delete') => {
    setMenuVisible(false);
    if (action === 'rename') {
      onRename?.(album);
    } else if (action === 'delete') {
      onDelete?.(album);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, { width: cardWidth }]}
      onPress={() => onPress(album)}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        {album.previewImagePath ? (
          <Image
            source={{ uri: `file://${album.previewImagePath}?t=${album.updatedAt}` }}
            style={styles.previewImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>📖</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setMenuVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.menuDots}>•••</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {album.name}
        </Text>
        <Text style={styles.date}>{formattedDate}</Text>
      </View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
        supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>{album.name}</Text>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuOption('rename')}
            >
              <Text style={styles.menuItemText}>שינוי שם</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDestructive]}
              onPress={() => handleMenuOption('delete')}
            >
              <Text style={styles.menuItemTextDestructive}>מחיקה</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemCancel]}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={styles.menuItemTextCancel}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: CARD_MARGIN,
    backgroundColor: '#fff',
    borderRadius: 12,
    boxShadow: '5px 5px 5px 0px rgba(0, 0, 0, 0.2)',
    overflow: 'hidden',
  },
  imageContainer: {
    aspectRatio: 16 / 9,
    backgroundColor: '#f0f0f0',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e8e8e8',
  },
  placeholderIcon: {
    fontSize: 48,
  },
  menuButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  menuDots: {
    fontSize: 12,
    color: '#666',
    letterSpacing: -1,
  },
  info: {
    padding: 12,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#888',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 14,
    width: 280,
    overflow: 'hidden',
  },
  menuTitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  menuItem: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  menuItemText: {
    fontSize: 18,
    color: '#007AFF',
    textAlign: 'center',
  },
  menuItemDestructive: {},
  menuItemTextDestructive: {
    fontSize: 18,
    color: '#FF3B30',
    textAlign: 'center',
  },
  menuItemCancel: {
    borderBottomWidth: 0,
    backgroundColor: '#f8f8f8',
  },
  menuItemTextCancel: {
    fontSize: 18,
    color: '#007AFF',
    textAlign: 'center',
    fontWeight: '600',
  },
});
