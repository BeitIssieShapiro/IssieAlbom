import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Album, AlbumPage } from '../types/Album';
import { AlbumService } from '../services/AlbumService';
import { PageService } from '../services/PageService';
import { PageCard } from '../components/PageCard';

interface AlbumScreenProps {
  album: Album;
  isFirstOpen: boolean;
  onBack: () => void;
}

export function AlbumScreen({ album, isFirstOpen, onBack }: AlbumScreenProps) {
  const insets = useSafeAreaInsets();
  const [pages, setPages] = useState<AlbumPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(isFirstOpen);
  const [menuVisible, setMenuVisible] = useState(false);

  const loadPages = useCallback(async () => {
    try {
      const loadedPages = await PageService.getPages(album.id);
      setPages(loadedPages);
    } catch (error) {
      console.error('Failed to load pages:', error);
      Alert.alert('שגיאה', 'טעינת העמודים נכשלה');
    }
  }, [album.id]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadPages();
      setIsLoading(false);
      // Mark album as viewed after first open
      if (isFirstOpen) {
        await AlbumService.markAlbumAsViewed(album.id);
      }
    };
    init();
  }, [loadPages, isFirstOpen, album.id]);

  const handleAddPage = async () => {
    try {
      await PageService.createPage(album.id);
      await loadPages();
    } catch (error) {
      console.error('Failed to create page:', error);
      Alert.alert('שגיאה', 'יצירת העמוד נכשלה');
    }
  };

  const handlePagePress = (page: AlbumPage) => {
    // TODO: Open page editor
    Alert.alert('עריכת עמוד', `פותח עמוד ${page.pageNumber} לעריכה...`);
  };

  const handleDeletePage = (page: AlbumPage) => {
    Alert.alert(
      'מחיקת עמוד',
      `האם למחוק את עמוד ${page.pageNumber}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחיקה',
          style: 'destructive',
          onPress: async () => {
            try {
              await PageService.deletePage(album.id, page.id);
              await loadPages();
            } catch (error) {
              console.error('Failed to delete page:', error);
              Alert.alert('שגיאה', 'מחיקת העמוד נכשלה');
            }
          },
        },
      ]
    );
  };

  const handleToggleEditMode = () => {
    setMenuVisible(false);
    setIsEditMode(!isEditMode);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {album.name}
        </Text>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setMenuVisible(true)}
        >
          <Text style={styles.menuDots}>•••</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>טוען עמודים...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {pages.map((page) => (
            <PageCard
              key={page.id}
              page={page}
              isEditMode={isEditMode}
              onPress={handlePagePress}
              onDelete={handleDeletePage}
            />
          ))}
          {isEditMode && (
            <TouchableOpacity style={styles.addPageButton} onPress={handleAddPage}>
              <Text style={styles.addPageIcon}>+</Text>
              <Text style={styles.addPageText}>הוספת עמוד</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{album.name}</Text>
            <TouchableOpacity
              style={styles.modalItem}
              onPress={handleToggleEditMode}
            >
              <Text style={styles.modalItemText}>
                {isEditMode ? 'מעבר למצב צפייה' : 'מעבר למצב עריכה'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalItem, styles.modalItemCancel]}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={styles.modalItemTextCancel}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#007AFF',
    fontWeight: '300',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuDots: {
    fontSize: 16,
    color: '#007AFF',
    letterSpacing: -1,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 12,
  },
  addPageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  addPageIcon: {
    fontSize: 24,
    color: '#999',
    marginRight: 8,
  },
  addPageText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 14,
    width: 280,
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  modalItem: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  modalItemText: {
    fontSize: 18,
    color: '#007AFF',
    textAlign: 'center',
  },
  modalItemCancel: {
    borderBottomWidth: 0,
    backgroundColor: '#f8f8f8',
  },
  modalItemTextCancel: {
    fontSize: 18,
    color: '#007AFF',
    textAlign: 'center',
    fontWeight: '600',
  },
});
