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
import { colors, spacing, borderRadius, shadows } from '../theme/colors';

const NUM_COLUMNS = 4;
const CARD_MARGIN = spacing.md;
const LIST_PADDING = spacing.md;

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
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.large,
    boxShadow: shadows.card,
    overflow: 'hidden',
  },
  imageContainer: {
    aspectRatio: 16 / 9,
    backgroundColor: colors.background,
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
    backgroundColor: colors.accent2,
  },
  placeholderIcon: {
    fontSize: 56,
  },
  menuButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  menuDots: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: 'bold',
    letterSpacing: 0,
  },
  info: {
    padding: spacing.md,
    backgroundColor: colors.cardBackground,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  date: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(93, 78, 109, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.large,
    width: 280,
    overflow: 'hidden',
    boxShadow: shadows.card,
  },
  menuTitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  menuItem: {
    paddingVertical: spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  menuItemText: {
    fontSize: 20,
    color: colors.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
  menuItemDestructive: {},
  menuItemTextDestructive: {
    fontSize: 20,
    color: colors.error,
    textAlign: 'center',
    fontWeight: '600',
  },
  menuItemCancel: {
    borderBottomWidth: 0,
    backgroundColor: colors.background,
  },
  menuItemTextCancel: {
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '700',
  },
});
