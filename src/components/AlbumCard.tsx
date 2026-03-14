import React, { useState } from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from '@react-native-vector-icons/ionicons';
import { Album } from '../types/Album';
import { spacing, borderRadius, shadows } from '../theme/colors';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { AlbumIcon } from './AlbumIcon';

const MIN_CARD_WIDTH = 100; // Smaller for mobile landscape to fit more columns
const MAX_COLUMNS = 4; // Maximum columns on larger screens
const CARD_MARGIN = spacing.md;
const LIST_PADDING = spacing.md;

interface AlbumCardProps {
  album: Album;
  onPress: (album: Album) => void;
  onRename?: (album: Album) => void;
  onDelete?: (album: Album) => void;
  onShare?: (album: Album) => void;
  screenWidth: number;
}

export function AlbumCard({ album, onPress, onRename, onDelete, onShare, screenWidth }: AlbumCardProps) {
  const { colors } = useTheme();
  const { t, language, isRTL } = useLanguage();

  // Calculate responsive number of columns based on screen width
  const availableWidth = screenWidth - LIST_PADDING * 2;
  const calculatedColumns = Math.floor(availableWidth / (MIN_CARD_WIDTH + CARD_MARGIN * 2));
  const numColumns = Math.max(1, Math.min(calculatedColumns, MAX_COLUMNS));
  const cardWidth = (availableWidth - CARD_MARGIN * 2 * numColumns) / numColumns;

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

  const handleMenuOption = (action: 'rename' | 'delete' | 'share') => {
    setMenuVisible(false);
    // Delay action to ensure modal unmounts properly
    setTimeout(() => {
      if (action === 'rename') {
        onRename?.(album);
      } else if (action === 'delete') {
        onDelete?.(album);
      } else if (action === 'share') {
        onShare?.(album);
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
            <View style={[styles.menuHeader, {
              borderBottomColor: colors.border,
              
            }]}>
              <AlbumIcon size={40} />
              <Text style={[styles.menuTitle, {
                color: colors.textPrimary,
                textAlign: isRTL ? 'right' : 'left',
              }]} numberOfLines={1}>{album.name}</Text>
            </View>
            {/** Menu Actions */}
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={() => handleMenuOption('rename')}
            >
              <View style={[styles.menuItemContent, { flexDirection: 'row' }]}>
                <Icon name="create-outline" size={24} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.primary, textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('albumCard.menuRename')}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border,}]}
              onPress={() => handleMenuOption('share')}
            >
              <View style={[styles.menuItemContent, { flexDirection: 'row' }]}>
                <Icon name="share-outline" size={24} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.primary, textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('export.share')}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDestructive, { borderBottomColor: colors.border }]}
              onPress={() => handleMenuOption('delete')}
            >
              <View style={[styles.menuItemContent, { flexDirection: 'row' }]}>
                <Icon name="trash-outline" size={24} color={colors.error} />
                <Text style={[styles.menuItemTextDestructive, { color: colors.error, textAlign: isRTL ? 'right' : 'left' }]}>
                  {t('albumCard.menuDelete')}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemCancel, { backgroundColor: colors.background }]}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={[styles.menuItemTextCancel, { color: colors.textPrimary, textAlign: 'center' }]}>{t('albumCard.menuCancel')}</Text>
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
    aspectRatio: 2 / 1, // Even more compact for mobile landscape (was 3/2)
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
    padding: spacing.sm, // Reduced from spacing.md for more compact cards
  },
  name: {
    fontSize: 14, // Reduced from 16 for more compact cards
    fontWeight: '700',
    marginBottom: 2, // Reduced from 4
  },
  date: {
    fontSize: 11, // Reduced from 13 for more compact cards
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(93, 78, 109, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    borderRadius: borderRadius.large,
    width: 300,
    overflow: 'hidden',
    boxShadow: shadows.card,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent:"flex-start",
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 2,
    gap: spacing.md,
  },
  menuTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  menuItem: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 2,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  menuItemText: {
    fontSize: 20,
    fontWeight: '600',
  },
  menuItemDestructive: {},
  menuItemTextDestructive: {
    fontSize: 20,
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
