import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  Alert,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const [displayPageIndex, setDisplayPageIndex] = useState(0);
  const [screenWidth, setScreenWidth] = useState(() => Dimensions.get('window').width);
  const translateX = useRef(new Animated.Value(0)).current;
  const hasAutoOpenedRef = useRef(false); // Track if we've auto-opened on first open

  // Refs for handler functions to avoid stale closures in PanResponder
  const handlePrevPageRef = useRef<() => void>();
  const handleNextPageRef = useRef<() => void>();

  // Listen for dimension changes (device rotation)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      console.log('[AlbumScreen] Dimensions changed:', window.width);
      setScreenWidth(window.width);
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  // Reset translateX when screen width changes (device rotation)
  useEffect(() => {
    console.log('[AlbumScreen] Resetting translateX to 0 due to screen width change');
    translateX.setValue(0);
  }, [screenWidth, translateX]);

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

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setDisplayPageIndex(currentPageIndex - 1);
      translateX.setValue(0);
      Animated.timing(translateX, {
        toValue: screenWidth,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setCurrentPageIndex(currentPageIndex - 1);
        translateX.setValue(0);
      });
    }
  };
  handlePrevPageRef.current = handlePrevPage;

  const handleNextPage = () => {
    if (currentPageIndex < pages.length - 1) {
      setDisplayPageIndex(currentPageIndex + 1);
      translateX.setValue(0);
      Animated.timing(translateX, {
        toValue: -screenWidth,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setCurrentPageIndex(currentPageIndex + 1);
        translateX.setValue(0);
      });
    }
  };
  handleNextPageRef.current = handleNextPage;

  // PanResponder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isEditMode,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return !isEditMode && Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        const swipeThreshold = 50;

        if (gestureState.dx > swipeThreshold) {
          handlePrevPageRef.current?.();
        } else if (gestureState.dx < -swipeThreshold) {
          handleNextPageRef.current?.();
        }
      },
    })
  ).current;

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
        <View style={styles.carouselContainer} {...panResponder.panHandlers}>
          <Animated.View
            style={[
              styles.carouselRow,
              {
                transform: [{ translateX }],
              },
            ]}
          >
            {/* Previous page peek (on left edge) */}
            {displayPageIndex > 0 && (
              <TouchableOpacity
                style={styles.peekPage}
                onPress={handlePrevPage}
                activeOpacity={0.7}
              >
                <View pointerEvents="none" style={{ width: '100%', height: '100%' }}>
                  <PageCard
                    page={pages[displayPageIndex - 1]}
                    albumId={album.id}
                    isEditMode={false}
                    onPress={() => {}}
                    autoPlayAudio={false}
                  />
                </View>
              </TouchableOpacity>
            )}

            {/* Current page (centered with full view) */}
            <View style={styles.currentPage}>
              <PageCard
                page={pages[displayPageIndex]}
                albumId={album.id}
                isEditMode={isEditMode}
                onPress={handlePagePress}
                onEdit={handleEditPage}
                onDelete={handleDeletePage}
                autoPlayAudio={currentPageIndex === displayPageIndex}
              />
            </View>

            {/* Next page peek (on right edge) */}
            {displayPageIndex < pages.length - 1 && (
              <TouchableOpacity
                style={styles.peekPage}
                onPress={handleNextPage}
                activeOpacity={0.7}
              >
                <View pointerEvents="none" style={{ width: '100%', height: '100%' }}>
                  <PageCard
                    page={pages[displayPageIndex + 1]}
                    albumId={album.id}
                    isEditMode={false}
                    onPress={() => {}}
                    autoPlayAudio={false}
                  />
                </View>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>
      ) : null}
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
  carouselContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '90%',
    width: '100%',
  },
  peekPage: {
    width: 50,
    height: '100%',
    overflow: 'hidden',
  },
  currentPage: {
    flex: 1,
    height: '100%',
    marginHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingVertical: 12,
  },
});
