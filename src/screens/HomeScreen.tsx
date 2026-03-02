import React, { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Album } from '../types/Album';
import { AlbumService } from '../services/AlbumService';
import { AlbumCard } from '../components/AlbumCard';
import { AddAlbumButton } from '../components/AddAlbumButton';

const NUM_COLUMNS = 4;

interface HomeScreenProps {
  onOpenAlbum: (album: Album) => void;
}

export function HomeScreen({ onOpenAlbum }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNewAlbumModal, setShowNewAlbumModal] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');

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
      await loadAlbums();
      setIsLoading(false);
    };
    init();
  }, [loadAlbums]);

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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>האלבומים שלי</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>טוען אלבומים...</Text>
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
              <Text style={styles.emptyText}>
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
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>אלבום חדש</Text>
            <TextInput
              style={styles.input}
              placeholder="שם האלבום"
              value={newAlbumName}
              onChangeText={setNewAlbumName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreateAlbum}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowNewAlbumModal(false)}
              >
                <Text style={styles.cancelButtonText}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.createButton]}
                onPress={handleCreateAlbum}
              >
                <Text style={styles.createButtonText}>יצירה</Text>
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
    // TODO: grid view, not flex
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
  },
  listContent: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#007AFF',
    marginLeft: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
