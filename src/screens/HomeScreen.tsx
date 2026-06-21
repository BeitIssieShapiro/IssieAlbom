import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
  TouchableOpacity,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { RTLAlertStatic } from '../components/RTLAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SplashScreen from 'react-native-splash-screen';
import Icon from '@react-native-vector-icons/ionicons';
import { Album } from '../types/Album';
import { AlbumService } from '../services/AlbumService';
import { AlbumCard } from '../components/AlbumCard';
import { AddAlbumButton } from '../components/AddAlbumButton';
import { ExportModal } from '../components/ExportModal';
import { AboutScreen } from './AboutScreen';
import { SettingsScreen } from './SettingsScreen';
import { spacing, borderRadius } from '../theme/colors';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { GlobalContext } from '../contexts/GlobalContext';

const MIN_CARD_WIDTH = 100; // Smaller for mobile landscape to fit more columns
const MAX_COLUMNS = 4; // Maximum columns on larger screens
const CARD_MARGIN = spacing.md;
const LIST_PADDING = spacing.md;

// Phone = short side < 600dp (excludes iPad and large Android tablets)
const { width: _w, height: _h } = Dimensions.get('window');
const isPhone = Platform.OS !== 'web' && Math.min(_w, _h) < 600;

interface HomeScreenProps {
  onOpenAlbum: (album: Album) => void;
  refreshTrigger?: number;
}

export function HomeScreen({ onOpenAlbum, refreshTrigger }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const globalContext = useContext(GlobalContext);
  const { colors } = useTheme();
  const { t, direction, isRTL } = useLanguage();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNewAlbumModal, setShowNewAlbumModal] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [selectedOrientation, setSelectedOrientation] = useState<'portrait' | 'landscape'>(() => {
    const { width, height } = Dimensions.get('window');
    return height >= width ? 'portrait' : 'landscape';
  });
  const [showAbout, setShowAbout] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [albumToExport, setAlbumToExport] = useState<Album | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [albumToRename, setAlbumToRename] = useState<Album | null>(null);
  const [renameAlbumName, setRenameAlbumName] = useState('');
  const [newAlbumError, setNewAlbumError] = useState<string>('');

  // Track screen dimensions for rotation support
  const [screenDimensions, setScreenDimensions] = useState(() => {
    const window = Dimensions.get('window');
    return { width: window.width, height: window.height };
  });

  // Listen for dimension changes (device rotation)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      console.log('[HomeScreen] Dimensions changed:', window);
      setScreenDimensions({ width: window.width, height: window.height });
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  const loadAlbums = useCallback(async () => {
    try {
      const loadedAlbums = await AlbumService.getAllAlbums();
      setAlbums(loadedAlbums);
    } catch (error) {
      console.error('Failed to load albums:', error);
      RTLAlertStatic.alert(t('home.error'), t('home.errorLoadAlbums'));
    }
  }, [t]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        await loadAlbums();
      } finally {
        setIsLoading(false);

        // Hide splash screen after minimum 2 seconds from native start
        const now = Date.now();
        const nativeStartTime = globalContext?.nativeStartTime || now;
        const elapsed = now - nativeStartTime;
        const minDuration = 2000;
        const remaining = Math.max(0, minDuration - elapsed);

        console.log('[HomeScreen] Splash delay remaining:', remaining);
        setTimeout(() => {
          console.log('[HomeScreen] Hiding splash screen');
          if (Platform.OS !== 'android') {
            SplashScreen.hide();
          }
        }, remaining);
      }
    };
    init();
  }, [loadAlbums, globalContext]);

  // Reload albums when refreshTrigger changes (after import)
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      console.log('[HomeScreen] Refresh trigger detected, reloading albums');
      loadAlbums();
    }
  }, [refreshTrigger, loadAlbums]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAlbums();
    setIsRefreshing(false);
  };

  const handleAddAlbum = () => {
    setNewAlbumName('');
    setNewAlbumError('');
    if (!isPhone) {
      const { width, height } = Dimensions.get('window');
      setSelectedOrientation(height >= width ? 'portrait' : 'landscape');
    } else {
      setSelectedOrientation('landscape');
    }
    setShowNewAlbumModal(true);
  };

  const handleCreateAlbum = async () => {
    const trimmedName = newAlbumName.trim();
    if (!trimmedName) {
      setNewAlbumError(t('home.errorEnterName'));
      return;
    }

    setNewAlbumError('');
    try {
      const { width, height } = Dimensions.get('window');
      const canvasWidth = selectedOrientation === 'landscape'
        ? Math.max(width, height)
        : Math.min(width, height);
      const canvasHeight = selectedOrientation === 'landscape'
        ? Math.min(width, height)
        : Math.max(width, height);
      const newAlbum = await AlbumService.createAlbum(trimmedName, canvasWidth, canvasHeight);
      setShowNewAlbumModal(false);
      onOpenAlbum(newAlbum);
    } catch (error) {
      let errorMessage = t('home.errorCreateAlbum');
      if (error instanceof Error && error.message.startsWith('VALIDATION_ERROR:')) {
        const errorCode = error.message.replace('VALIDATION_ERROR:', '');
        switch (errorCode) {
          case 'EMPTY': errorMessage = t('home.errorNameEmpty'); break;
          case 'TOO_LONG': errorMessage = t('home.errorNameTooLong'); break;
          case 'INVALID_CHARS': errorMessage = t('home.errorNameInvalidChars'); break;
          case 'RESERVED_NAME': errorMessage = t('home.errorNameReserved'); break;
          case 'DUPLICATE_NAME': errorMessage = t('home.errorNameDuplicate'); break;
        }
      }
      setNewAlbumError(errorMessage);
    }
  };

  const handleAlbumPress = (album: Album) => {
    onOpenAlbum(album);
  };

  const confirmDeleteAlbum = (album: Album) => {
    RTLAlertStatic.alert(
      t('home.deleteAlbumTitle'),
      t('home.deleteAlbumMessage', { name: album.name }),
      [
        { text: t('home.cancel'), style: 'cancel' },
        {
          text: t('home.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await AlbumService.deleteAlbum(album.id);
              await loadAlbums();
            } catch (error) {
              console.error('Failed to delete album:', error);
              RTLAlertStatic.alert(t('home.error'), t('home.errorDeleteAlbum'));
            }
          },
        },
      ]
    );
  };

  const handleRenameAlbum = (album: Album) => {
    setAlbumToRename(album);
    setRenameAlbumName(album.name);
    setShowRenameModal(true);
  };

  const handleConfirmRename = async () => {
    if (!albumToRename) return;

    const trimmedName = renameAlbumName.trim();
    if (!trimmedName) {
      RTLAlertStatic.alert(t('home.error'), t('home.errorEnterName'));
      return;
    }

    try {
      await AlbumService.updateAlbumName(albumToRename.id, trimmedName);
      setShowRenameModal(false);
      setAlbumToRename(null);
      await loadAlbums();
    } catch (error) {
      // Translate validation error codes
      let errorMessage = t('home.errorRenameAlbum');
      if (error instanceof Error && error.message.startsWith('VALIDATION_ERROR:')) {
        const errorCode = error.message.replace('VALIDATION_ERROR:', '');
        switch (errorCode) {
          case 'EMPTY':
            errorMessage = t('home.errorNameEmpty');
            break;
          case 'TOO_LONG':
            errorMessage = t('home.errorNameTooLong');
            break;
          case 'INVALID_CHARS':
            errorMessage = t('home.errorNameInvalidChars');
            break;
          case 'RESERVED_NAME':
            errorMessage = t('home.errorNameReserved');
            break;
          case 'DUPLICATE_NAME':
            errorMessage = t('home.errorNameDuplicate');
            break;
        }
      }
      RTLAlertStatic.alert(t('home.error'), errorMessage);
      // Keep modal open so user can fix the name
    }
  };

  const handleShareAlbum = (album: Album) => {
    setAlbumToExport(album);
    setExportModalVisible(true);
  };

  const handleExportModalClose = async () => {
    setExportModalVisible(false);
    setAlbumToExport(null);
    // Refresh albums list in case thumbnail changed
    await loadAlbums();
  };

  const renderItem = ({ item, index }: { item: Album | 'add'; index: number }) => {
    if (item === 'add') {
      return <AddAlbumButton onPress={handleAddAlbum} screenWidth={safeWidth} />;
    }
    return (
      <AlbumCard
        album={item}
        onPress={handleAlbumPress}
        onRename={handleRenameAlbum}
        onDelete={confirmDeleteAlbum}
        onShare={handleShareAlbum}
        screenWidth={safeWidth}
      />
    );
  };

  const data: (Album | 'add')[] = [...albums, 'add'];

  // Calculate responsive number of columns based on screen width (subtract safe area insets on mobile)
  const safeWidth = screenDimensions.width - (isPhone ? insets.left + insets.right : 0);
  const availableWidth = safeWidth - LIST_PADDING * 2;
  const calculatedColumns = Math.floor(availableWidth / (MIN_CARD_WIDTH + CARD_MARGIN * 2));
  const numColumns = Math.max(1, Math.min(calculatedColumns, MAX_COLUMNS));

  if (showAbout) {
    return <AboutScreen onClose={() => setShowAbout(false)} />;
  }

  if (showSettings) {
    return <SettingsScreen visible={showSettings} onClose={() => setShowSettings(false)} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, {
        backgroundColor: colors.headerBackground,
      }]}>
        <TouchableOpacity
          onPress={() => setShowSettings(true)}
          style={styles.menuButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="menu-outline" size={32} color={colors.primary} />
        </TouchableOpacity>
        <Text allowFontScaling={false} style={[styles.title, { color: colors.primary }]}>{t('home.title')}</Text>
        <TouchableOpacity
          onPress={() => setShowAbout(true)}
          style={styles.aboutButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="information-circle-outline" size={32} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text allowFontScaling={false} style={[styles.loadingText, { color: colors.textSecondary }]}>{t('home.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item) => (item === 'add' ? 'add-button' : item.id)}
          key={`grid-${numColumns}`}
          numColumns={numColumns}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={numColumns > 1 ? { flexDirection: 'row' } : undefined}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text allowFontScaling={false} style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t('home.empty')}
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={showNewAlbumModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewAlbumModal(false)}
        supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowNewAlbumModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoid}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.modalContent, {
                backgroundColor: colors.cardBackground,
                shadowColor: colors.primary,
              }]}>
                <Text allowFontScaling={false} style={[styles.modalTitle, { color: colors.primary }]}>{t('home.newAlbumPrompt')}</Text>
                <TextInput
                  style={[styles.input, {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    color: colors.textPrimary,
                    textAlign: isRTL ? 'right' : 'left',
                    writingDirection: direction,
                  }]}
                  placeholder={t('home.albumNamePlaceholder')}
                  value={newAlbumName}
                  onChangeText={v => { setNewAlbumName(v); setNewAlbumError(''); }}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleCreateAlbum}
                />
                {!!newAlbumError && (
                  <Text allowFontScaling={false} style={{ color: '#FF3B30', fontSize: 13, marginTop: 6, textAlign: isRTL ? 'right' : 'left' }}>
                    {newAlbumError}
                  </Text>
                )}
                {!isPhone && (
                <View style={styles.orientationPicker}>
                  <TouchableOpacity
                    style={[
                      styles.orientationOption,
                      {
                        borderColor: selectedOrientation === 'portrait' ? '#007AFF' : colors.border,
                        borderWidth: selectedOrientation === 'portrait' ? 2 : 1,
                        backgroundColor: selectedOrientation === 'portrait' ? '#007AFF10' : colors.background,
                      },
                    ]}
                    onPress={() => setSelectedOrientation('portrait')}
                  >
                    <View style={[styles.orientationIconPortrait, { borderColor: selectedOrientation === 'portrait' ? '#007AFF' : colors.textLight }]} />
                    <Text allowFontScaling={false} style={[styles.orientationLabel, { color: selectedOrientation === 'portrait' ? '#007AFF' : colors.textPrimary }]}>
                      {t('home.portrait')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.orientationOption,
                      {
                        borderColor: selectedOrientation === 'landscape' ? '#007AFF' : colors.border,
                        borderWidth: selectedOrientation === 'landscape' ? 2 : 1,
                        backgroundColor: selectedOrientation === 'landscape' ? '#007AFF10' : colors.background,
                      },
                    ]}
                    onPress={() => setSelectedOrientation('landscape')}
                  >
                    <View style={[styles.orientationIconLandscape, { borderColor: selectedOrientation === 'landscape' ? '#007AFF' : colors.textLight }]} />
                    <Text allowFontScaling={false} style={[styles.orientationLabel, { color: selectedOrientation === 'landscape' ? '#007AFF' : colors.textPrimary }]}>
                      {t('home.landscape')}
                    </Text>
                  </TouchableOpacity>
                </View>
                )}
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton, {
                      backgroundColor: colors.textLight,
                    }]}
                    onPress={() => setShowNewAlbumModal(false)}
                  >
                    <Text allowFontScaling={false} style={[styles.cancelButtonText, { color: colors.cardBackground }]}>{t('home.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.createButton, {
                      backgroundColor: colors.primary,
                    }]}
                    onPress={handleCreateAlbum}
                  >
                    <Text allowFontScaling={false} style={[styles.createButtonText, { color: colors.cardBackground }]}>{t('home.create')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showRenameModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowRenameModal(false);
          setAlbumToRename(null);
        }}
        supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowRenameModal(false);
            setAlbumToRename(null);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoid}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.modalContent, {
                backgroundColor: colors.cardBackground,
                shadowColor: colors.primary,
              }]}>
                <Text allowFontScaling={false} style={[styles.modalTitle, { color: colors.primary }]}>{t('home.renameAlbumPrompt')}</Text>
                <TextInput
                  style={[styles.input, {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    color: colors.textPrimary,
                    textAlign: isRTL ? 'right' : 'left',
                    writingDirection: direction,
                  }]}
                  placeholder={t('home.albumNamePlaceholder')}
                  value={renameAlbumName}
                  onChangeText={setRenameAlbumName}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleConfirmRename}
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton, {
                      backgroundColor: colors.textLight,
                    }]}
                    onPress={() => {
                      setShowRenameModal(false);
                      setAlbumToRename(null);
                    }}
                  >
                    <Text allowFontScaling={false} style={[styles.cancelButtonText, { color: colors.cardBackground }]}>{t('home.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.createButton, {
                      backgroundColor: colors.primary,
                    }]}
                    onPress={handleConfirmRename}
                  >
                    <Text allowFontScaling={false} style={[styles.createButtonText, { color: colors.cardBackground }]}>{t('home.rename')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {albumToExport && (
        <ExportModal
          visible={exportModalVisible}
          albumId={albumToExport.id}
          albumName={albumToExport.name}
          onClose={handleExportModalClose}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderBottomWidth: 0,
    position: 'relative',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  aboutButton: {
    position: 'absolute',
    right: spacing.lg,
    padding: spacing.sm,
  },
  menuButton: {
    position: 'absolute',
    left: spacing.lg,
    padding: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
  },
  listContent: {
    padding: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyText: {
    fontSize: 18,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(93, 78, 109, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardAvoid: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: borderRadius.large,
    padding: spacing.xl,
    width: 400,
    maxWidth: '90%',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  input: {
    borderWidth: 2,
    borderRadius: borderRadius.medium,
    padding: spacing.md,
    fontSize: 18,
    marginBottom: spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
  },
  cancelButton: {
  },
  cancelButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  createButton: {
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  orientationPicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: spacing.lg,
  },
  orientationOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.medium,
  },
  orientationIconPortrait: {
    width: 28,
    height: 40,
    borderWidth: 2,
    borderRadius: 4,
    marginBottom: spacing.sm,
  },
  orientationIconLandscape: {
    width: 40,
    height: 28,
    borderWidth: 2,
    borderRadius: 4,
    marginBottom: spacing.sm,
  },
  orientationLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
});
