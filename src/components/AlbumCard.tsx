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
import { spacing, borderRadius, shadows } from '../theme/colors';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

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
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const cardWidth = (screenWidth - LIST_PADDING * 2 - CARD_MARGIN * 2 * NUM_COLUMNS) / NUM_COLUMNS;
  const [menuVisible, setMenuVisible] = useState(false);

  const locale = { en: 'en-US', he: 'he-IL', ar: 'ar-SA' }[language];
  const formattedDate = new Date(album.createdAt).toLocaleDateString(locale);

  // Close modal when component unmounts (e.g., when navigating away)
  React.useEffect(() => {
    return () => {
      setMenuVisible(false);
    };
  }, []);

  const handleCardPress = () => {
    // Ensure modal is closed before navigating
    if (menuVisible) {
      setMenuVisible(false);
      return;
    }
    onPress(album);
  };

  const handleMenuOption = (action: 'rename' | 'delete') => {
    setMenuVisible(false);
    // Delay action to ensure modal unmounts properly
    setTimeout(() => {
      if (action === 'rename') {
        onRename?.(album);
      } else if (action === 'delete') {
        onDelete?.(album);
      }
    }, 100);
  };

  return (
    <TouchableOpacity
      style={[styles.container, {
        width: cardWidth,
        backgroundColor: colors.cardBackground,
      }]}
      onPress={handleCardPress}
      activeOpacity={0.7}
    >
      <View style={[styles.imageContainer, { backgroundColor: colors.background }]}>
        {album.previewImagePath ? (
          <Image
            source={{ uri: `file://${album.previewImagePath}?t=${album.updatedAt}` }}
            style={styles.previewImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.placeholder, { backgroundColor: colors.accent2 }]}>
            <Text style={styles.placeholderIcon}>📖</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setMenuVisible(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.menuDots, { color: colors.primary }]}>•••</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.info, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
          {album.name}
        </Text>
        <Text style={[styles.date, { color: colors.textSecondary }]}>{formattedDate}</Text>
      </View>

      <Modal
        key={`modal-${album.id}`}
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
          <View style={[styles.menuContainer, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.menuTitle, {
              color: colors.textSecondary,
              borderBottomColor: colors.border,
            }]}>{album.name}</Text>
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={() => handleMenuOption('rename')}
            >
              <Text style={[styles.menuItemText, { color: colors.primary }]}>{t('albumCard.menuRename')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDestructive, { borderBottomColor: colors.border }]}
              onPress={() => handleMenuOption('delete')}
            >
              <Text style={[styles.menuItemTextDestructive, { color: colors.error }]}>{t('albumCard.menuDelete')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemCancel, { backgroundColor: colors.background }]}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={[styles.menuItemTextCancel, { color: colors.textPrimary }]}>{t('albumCard.menuCancel')}</Text>
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
    borderRadius: borderRadius.large,
    boxShadow: shadows.card,
    overflow: 'hidden',
  },
  imageContainer: {
    aspectRatio: 16 / 9,
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
    fontWeight: 'bold',
    letterSpacing: 0,
  },
  info: {
    padding: spacing.md,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  date: {
    fontSize: 13,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(93, 78, 109, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    borderRadius: borderRadius.large,
    width: 280,
    overflow: 'hidden',
    boxShadow: shadows.card,
  },
  menuTitle: {
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
  },
  menuItem: {
    paddingVertical: spacing.lg,
    borderBottomWidth: 2,
  },
  menuItemText: {
    fontSize: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  menuItemDestructive: {},
  menuItemTextDestructive: {
    fontSize: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  menuItemCancel: {
    borderBottomWidth: 0,
  },
  menuItemTextCancel: {
    fontSize: 20,
    textAlign: 'center',
    fontWeight: '700',
  },
});
