import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Carousel from 'react-native-reanimated-carousel';
import { Album, AlbumPage } from '../types/Album';
import { AlbumService } from '../services/AlbumService';
import { PageService } from '../services/PageService';
import { PageCard } from '../components/PageCard';
import { PageEditorScreen } from './PageEditorScreen';
import { MyIcon } from '../common/icons';

interface AlbumScreenProps {
  album: Album;
  isFirstOpen: boolean;
  onBack: () => void;
}

export function AlbumScreen({ album, isFirstOpen, onBack }: AlbumScreenProps) {
  const insets = useSafeAreaInsets();
  const [pages, setPages] = useState<AlbumPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPage, setEditingPage] = useState<AlbumPage | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const carouselRef = useRef<any>(null);
  const hasAutoOpenedRef = useRef(false); // Track if we've auto-opened on first open

  // Track screen dimensions (updated on rotation)
  const [screenDimensions, setScreenDimensions] = useState(() => {
    const window = Dimensions.get('window');
    return { width: window.width, height: window.height };
  });

  // Listen for dimension changes (device rotation)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      console.log('[AlbumScreen] Dimensions changed:', window);
      setScreenDimensions({ width: window.width, height: window.height });
    });

    return () => {
      subscription?.remove();
    };
  }, []);

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

  // Open first page in editor on first open (only once)
  useEffect(() => {
    if (isFirstOpen && pages.length > 0 && !editingPage && !hasAutoOpenedRef.current) {
      console.log('[AlbumScreen] First open - opening first page in editor');
      setEditingPage(pages[0]);
      setIsEditMode(false); // Don't show edit mode UI, go straight to editor
      hasAutoOpenedRef.current = true; // Mark that we've auto-opened
    }
  }, [isFirstOpen, pages, editingPage]);

  const handlePagePress = (page: AlbumPage) => {
    // In view mode, open editor for this page
    if (!isEditMode) {
      handleEditPage(page);
    }
    // In edit mode, clicking does nothing (use menu for actions)
  };

  const handleEditPage = (page: AlbumPage) => {
    setEditingPage(page);
  };

  const handleEditorSave = async (updatedPage: AlbumPage, shouldExit: boolean = false) => {
    try {
      await PageService.updatePage(album.id, updatedPage);
      await loadPages();
    } catch (error) {
      console.error('Failed to save page:', error);
      Alert.alert('שגיאה', 'שמירת העמוד נכשלה');
    }
    // Only exit edit mode if explicitly requested
    if (shouldExit) {
      setEditingPage(null);
    }
  };

  const handleNavigatePage = async (pageId: string) => {
    // Find the new page to navigate to
    const newPage = pages.find(p => p.id === pageId);
    if (newPage) {
      // Stay in editor mode, just switch to the new page
      setEditingPage(newPage);
    }
  };

  const handleCreatePageFromEditor = async () => {
    try {
      const newPage = await PageService.createPage(album.id);
      await loadPages();
      // Navigate to the new page
      const refreshedPages = await PageService.getPages(album.id);
      const createdPage = refreshedPages.find(p => p.id === newPage.id);
      if (createdPage) {
        setEditingPage(createdPage);
      }
    } catch (error) {
      console.error('Failed to create page:', error);
      Alert.alert('שגיאה', 'יצירת העמוד נכשלה');
    }
  };

  const handleEditorDiscard = () => {
    setEditingPage(null);
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
    if (!isEditMode) {
      // Entering edit mode - open the current page in editor
      if (pages.length > 0) {
        handleEditPage(pages[currentPageIndex]);
      }
    } else {
      // Exiting edit mode
      setIsEditMode(false);
    }
  };

  // PanResponder is no longer needed - carousel handles gestures

  if (editingPage) {
    return (
      <PageEditorScreen
        page={editingPage}
        albumId={album.id}
        onSave={handleEditorSave}
        onDiscard={handleEditorDiscard}
        pages={pages}
        onNavigatePage={handleNavigatePage}
        onCreatePage={handleCreatePageFromEditor}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <MyIcon info={{ type: "Ionicons", name: "home-outline", size: 28, color: "#007AFF" }} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {album.name}
        </Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={handleToggleEditMode}
        >
          <Text style={styles.editButtonText}>{isEditMode ? 'סיום' : 'ערוך'}</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>טוען עמודים...</Text>
        </View>
      ) : pages.length > 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Carousel
            ref={carouselRef}
            loop={false}

            mode="parallax"
            modeConfig={{
              parallaxScrollingScale: .85,
              parallaxScrollingOffset: 110,
              parallaxAdjacentItemScale: .85
            }}
            width={screenDimensions.width} // Item width (screen - horizontal padding)
            height={screenDimensions.height - insets.top - 60}
            data={pages}

            renderItem={({ item, index }) => {
              console.log('[AlbumScreen] Rendering carousel item:', index, item.id);
              return (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    console.log('[AlbumScreen] Clicked on page:', index, 'current:', currentPageIndex);
                    // If clicking on a non-current page, slide to it
                    if (index !== currentPageIndex) {
                      console.log('[AlbumScreen] Scrolling to page:', index);
                      carouselRef.current?.scrollTo({ index, animated: true });
                    } else {
                      // If clicking on current page, use normal press handler
                      console.log('[AlbumScreen] Opening current page in editor');
                      handlePagePress(item);
                    }
                  }}
                  style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}
                >
                  <PageCard
                    page={item}
                    albumId={album.id}
                    isEditMode={isEditMode}
                    onPress={() => {}} // Disable PageCard's own press handler
                    onEdit={handleEditPage}
                    onDelete={handleDeletePage}
                    autoPlayAudio={currentPageIndex === index}
                  />
                </TouchableOpacity>
              );
            }}
            enabled={!isEditMode}
            onSnapToItem={(index) => {
              console.log('[AlbumScreen] Snapped to page:', index);
              setCurrentPageIndex(index);
            }}
            defaultIndex={currentPageIndex}
            windowSize={3}
          />
        </View>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>אין עמודים באלבום</Text>
        </View>
      )}
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
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
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
  pageContainer: {
    backgroundColor: "green",
    height: "100%",
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingVertical: 12,
  },
});
