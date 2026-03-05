import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  Alert,
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SplashScreen from 'react-native-splash-screen';
import Icon from '@react-native-vector-icons/ionicons';
import { Album } from '../types/Album';
import { AlbumService } from '../services/AlbumService';
import { AlbumCard } from '../components/AlbumCard';
import { AddAlbumButton } from '../components/AddAlbumButton';
import { AboutScreen } from './AboutScreen';
import { SettingsScreen } from './SettingsScreen';
import { spacing, borderRadius } from '../theme/colors';
import { useTheme } from '../contexts/ThemeContext';
import { GlobalContext } from '../contexts/GlobalContext';

const NUM_COLUMNS = 4;

interface HomeScreenProps {
  onOpenAlbum: (album: Album) => void;
}

export function HomeScreen({ onOpenAlbum }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const globalContext = useContext(GlobalContext);
  const { colors } = useTheme();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNewAlbumModal, setShowNewAlbumModal] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [showAbout, setShowAbout] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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
      Alert.alert('שגיאה', 'טעינת האלבומים נכשלה');
    }
  }, []);

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAlbums();
    setIsRefreshing(false);
  };

  const handleAddAlbum = () => {
    setNewAlbumName('');
    setShowNewAlbumModal(true);
  };

  const handleCreateAlbum = async () => {
    const trimmedName = newAlbumName.trim();
    if (!trimmedName) {
      Alert.alert('שגיאה', 'נא להזין שם לאלבום');
      return;
    }

    try {
      const newAlbum = await AlbumService.createAlbum(trimmedName);
      setShowNewAlbumModal(false);
      onOpenAlbum(newAlbum);
    } catch (error) {
      console.error('Failed to create album:', error);
      const errorMessage = error instanceof Error ? error.message : 'יצירת האלבום נכשלה';
      Alert.alert('שגיאה', errorMessage);
    }
  };

  const handleAlbumPress = (album: Album) => {
    onOpenAlbum(album);
  };

  const confirmDeleteAlbum = (album: Album) => {
    Alert.alert(
      'מחיקת אלבום',
      `האם למחוק את "${album.name}"? לא ניתן לבטל פעולה זו.`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחיקה',
          style: 'destructive',
          onPress: async () => {
            try {
              await AlbumService.deleteAlbum(album.id);
              await loadAlbums();
            } catch (error) {
              console.error('Failed to delete album:', error);
              Alert.alert('שגיאה', 'מחיקת האלבום נכשלה');
            }
          },
        },
      ]
    );
  };

  const handleRenameAlbum = (album: Album) => {
    Alert.prompt(
      'שינוי שם אלבום',
      'הזן שם חדש:',
      async (newName) => {
        if (newName && newName.trim()) {
          try {
            await AlbumService.updateAlbumName(album.id, newName.trim());
            await loadAlbums();
          } catch (error) {
            console.error('Failed to rename album:', error);
            const errorMessage = error instanceof Error ? error.message : 'שינוי שם האלבום נכשל';
            Alert.alert('שגיאה', errorMessage);
          }
        }
      },
      'plain-text',
      album.name
    );
  };

  const renderItem = ({ item, index }: { item: Album | 'add'; index: number }) => {
    if (item === 'add') {
      return <AddAlbumButton onPress={handleAddAlbum} screenWidth={screenDimensions.width} />;
    }
    return (
      <AlbumCard
        album={item}
        onPress={handleAlbumPress}
        onRename={handleRenameAlbum}
        onDelete={confirmDeleteAlbum}
        screenWidth={screenDimensions.width}
      />
    );
  };

  const data: (Album | 'add')[] = [...albums, 'add'];

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
        <Text style={[styles.title, { color: colors.primary }]}>האלבומים שלי</Text>
        <TouchableOpacity
          onPress={() => setShowAbout(true)}
          style={styles.aboutButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="information-circle-outline" size={32} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>טוען אלבומים...</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item) => (item === 'add' ? 'add-button' : item.id)}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={{ flexDirection: 'row-reverse' }}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                אין אלבומים עדיין. לחצו על + ליצירת האלבום הראשון!
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
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {
            backgroundColor: colors.cardBackground,
            shadowColor: colors.primary,
          }]}>
            <Text style={[styles.modalTitle, { color: colors.primary }]}>אלבום חדש</Text>
            <TextInput
              style={[styles.input, {
                borderColor: colors.border,
                backgroundColor: colors.background,
                color: colors.textPrimary,
              }]}
              placeholder="שם האלבום"
              value={newAlbumName}
              onChangeText={setNewAlbumName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateAlbum}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, {
                  backgroundColor: colors.textLight,
                }]}
                onPress={() => setShowNewAlbumModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.cardBackground }]}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.createButton, {
                  backgroundColor: colors.primary,
                }]}
                onPress={handleCreateAlbum}
              >
                <Text style={[styles.createButtonText, { color: colors.cardBackground }]}>יצירה</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  modalContent: {
    borderRadius: borderRadius.large,
    padding: spacing.xl,
    width: '80%',
    maxWidth: 400,
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
  },
  modalButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
  },
  cancelButton: {
    marginRight: spacing.sm,
  },
  cancelButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  createButton: {
    marginLeft: spacing.sm,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});
