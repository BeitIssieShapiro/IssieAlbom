import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Carousel from 'react-native-reanimated-carousel';
import { Album, AlbumPage, HEADER_HEIGHT } from '../types/Album';
import { AlbumService } from '../services/AlbumService';
import { PageService } from '../services/PageService';
import { PageCard, PageCardRef } from '../components/PageCard';
import { PageEditorScreen } from './PageEditorScreen';
import { MyIcon } from '../common/icons';
import { spacing, borderRadius } from '../theme/colors';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';


interface AlbumScreenProps {
  album: Album;
  isFirstOpen: boolean;
  onBack: () => void;
}

export function AlbumScreen({ album, isFirstOpen, onBack }: AlbumScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, isRTL } = useLanguage();
  const [pages, setPages] = useState<AlbumPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPage, setEditingPage] = useState<AlbumPage | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isDeletingPage, setIsDeletingPage] = useState(false);
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const carouselRef = useRef<any>(null);
  const hasAutoOpenedRef = useRef(false); // Track if we've auto-opened on first open

  // Thumbnail generation state
  const [thumbnailPage, setThumbnailPage] = useState<AlbumPage | null>(null);
  const [capturingThumbnail, setCapturingThumbnail] = useState(false);
  const [readyToCapture, setReadyToCapture] = useState(false);
  const thumbnailCardRef = useRef<PageCardRef>(null);

  // Track screen dimensions (updated on rotation)
  const [screenDimensions, setScreenDimensions] = useState(() => {
    const window = Dimensions.get('window');
    return { width: window.width, height: window.height };
  });

  // Helper functions for RTL carousel index conversion
  // In RTL, carousel data is reversed, so we need to convert between visual and actual indices
  const toCarouselIndex = useCallback((pageIndex: number) => {
    return isRTL ? pages.length - 1 - pageIndex : pageIndex;
  }, [isRTL, pages.length]);

  const fromCarouselIndex = useCallback((carouselIndex: number) => {
    return isRTL ? pages.length - 1 - carouselIndex : carouselIndex;
  }, [isRTL, pages.length]);

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

  // useEffect: Load page for thumbnail capture
  useEffect(() => {
    if (!capturingThumbnail || !thumbnailPage) return;

    const loadPageForThumbnail = async () => {
      try {
        console.log('[AlbumScreen] Page loaded for thumbnail, signaling ready to capture');
        // Signal that page is rendered and ready to capture
        // Small delay to ensure React has finished rendering
        setTimeout(() => {
          setReadyToCapture(true);
        }, 100);
      } catch (error) {
        console.error('[AlbumScreen] Failed to prepare page for thumbnail:', error);
        setCapturingThumbnail(false);
        setThumbnailPage(null);
      }
    };

    loadPageForThumbnail();
  }, [capturingThumbnail, thumbnailPage]);

  // useEffect: Capture thumbnail when ready
  useEffect(() => {
    if (!readyToCapture) return;

    const captureThumbnail = async () => {
      try {
        if (thumbnailCardRef.current) {
          console.log('[AlbumScreen] Capturing thumbnail screenshot...');
          const screenshotUri = await thumbnailCardRef.current.captureScreenshot();
          console.log('[AlbumScreen] Screenshot captured:', screenshotUri);
          await AlbumService.generateThumbnail(album.id, screenshotUri);
          console.log('[AlbumScreen] Thumbnail saved successfully');
        } else {
          console.warn('[AlbumScreen] thumbnailCardRef is null, skipping capture');
        }
      } catch (error) {
        console.error('[AlbumScreen] Failed to generate thumbnail:', error);
        // Don't show error to user - thumbnail generation is non-critical
      } finally {
        setReadyToCapture(false);
        setCapturingThumbnail(false);
        setThumbnailPage(null);
      }
    };

    captureThumbnail();
  }, [readyToCapture, album.id]);

  // Trigger thumbnail generation
  const generateThumbnail = (page: AlbumPage) => {
    console.log('[AlbumScreen] Starting thumbnail generation for page:', page.pageNumber);
    setThumbnailPage(page);
    setCapturingThumbnail(true);
  };

  const loadPages = useCallback(async () => {
    try {
      const loadedPages = await PageService.getPages(album.id);
      setPages(loadedPages);
    } catch (error) {
      console.error('Failed to load pages:', error);
      Alert.alert(t('home.error'), t('album.errorLoadPages'));
    }
  }, [album.id, t]);

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
    // In view mode, clicking does nothing
    // In edit mode, clicking also does nothing (use menu for actions)
  };

  const handleEditPage = (page: AlbumPage) => {
    setEditingPage(page);
  };

  const handleEditorSave = async (updatedPage: AlbumPage, shouldExit: boolean = false) => {
    const wasFirstPage = updatedPage.pageNumber === 1;

    try {
      await PageService.updatePage(album.id, updatedPage);
      await loadPages();
    } catch (error) {
      console.error('Failed to save page:', error);
      Alert.alert(t('home.error'), t('album.errorSavePage'));
    }

    // Only exit edit mode if explicitly requested
    if (shouldExit) {
      setEditingPage(null);

      // If we saved the first page and are exiting, generate thumbnail asynchronously
      if (wasFirstPage) {
        console.log('[AlbumScreen] First page saved, will generate thumbnail');
        // Don't await - let it happen in the background
        generateThumbnail(updatedPage);
      }
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
    setIsCreatingPage(true);
    const startTime = Date.now();
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
      Alert.alert(t('home.error'), t('album.errorCreatePage'));
    } finally {
      // Ensure at least 1 second has elapsed
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 1000 - elapsed);
      await new Promise(resolve => setTimeout(resolve, remainingTime));
      setIsCreatingPage(false);
    }
  };

  const handleEditorDiscard = () => {
    setEditingPage(null);
  };

  const handleDeletePage = (page: AlbumPage) => {
    Alert.alert(
      t('album.deletePageTitle'),
      t('album.deletePageMessage'),
      [
        { text: t('home.cancel'), style: 'cancel' },
        {
          text: t('home.delete'),
          style: 'destructive',
          onPress: async () => {
            setIsDeletingPage(true);
            try {
              await PageService.deletePage(album.id, page.id);
              await loadPages();
            } catch (error) {
              console.error('Failed to delete page:', error);
              Alert.alert(t('home.error'), t('album.errorDeletePage'));
            } finally {
              setIsDeletingPage(false);
            }
          },
        },
      ]
    );
  };

  const handleDeletePageFromEditor = async () => {
    if (!editingPage) return;

    setIsDeletingPage(true);
    const startTime = Date.now();
    try {
      const currentPageIndex = pages.findIndex(p => p.id === editingPage.id);
      await PageService.deletePage(album.id, editingPage.id);
      const refreshedPages = await PageService.getPages(album.id);

      // Stay in edit mode - navigate to another page
      if (refreshedPages.length > 0) {
        // Try to stay at the same index, or go to previous if we deleted the last page
        const newIndex = Math.min(currentPageIndex, refreshedPages.length - 1);
        setEditingPage(refreshedPages[newIndex]);
      } else {
        // No pages left, exit edit mode
        setEditingPage(null);
      }

      // Update pages state
      await loadPages();
    } catch (error) {
      console.error('Failed to delete page:', error);
      Alert.alert(t('home.error'), t('album.errorDeletePage'));
    } finally {
      // Ensure at least 1 second has elapsed
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 1000 - elapsed);
      await new Promise(resolve => setTimeout(resolve, remainingTime));
      setIsDeletingPage(false);
    }
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

  // If editing a page, show the editor instead of the album view
  if (editingPage) {
    return (
      <>
        <PageEditorScreen
          page={editingPage}
          albumId={album.id}
          onSave={handleEditorSave}
          onDiscard={handleEditorDiscard}
          pages={pages}
          onNavigatePage={handleNavigatePage}
          onCreatePage={handleCreatePageFromEditor}
          onDeletePage={handleDeletePageFromEditor}
        />
        {/* Loading overlay for page operations */}
        {isDeletingPage && (
          <View style={styles.loadingOverlay}>
            <View style={styles.overlayContent}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.overlayText}>{t('album.deletingPage')}</Text>
            </View>
          </View>
        )}
        {isCreatingPage && (
          <View style={styles.loadingOverlay}>
            <View style={styles.overlayContent}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.overlayText}>{t('album.creatingPage')}</Text>
            </View>
          </View>
        )}
      </>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        {/* Edit/Done button - Start side (Left in LTR, Right in RTL) */}
        <TouchableOpacity
          style={[styles.editButton, { backgroundColor: colors.primary }]}
          onPress={handleToggleEditMode}
        >
          <Text style={[styles.editButtonText, { color: colors.cardBackground }]}>{isEditMode ? t('album.done') : t('album.edit')}</Text>
        </TouchableOpacity>

        {/* Album title - Center */}
        <Text style={[styles.title, { color: colors.primary }]} numberOfLines={1}>
          {album.name}
        </Text>

        {/* Home button - End side (Right in LTR, Left in RTL) */}
        <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.cardBackground }]} onPress={onBack}>
          <MyIcon info={{ type: "Ionicons", name: "home-outline", size: 28, color: colors.primary }} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('home.loading')}</Text>
        </View>
      ) : pages.length > 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Carousel
            ref={carouselRef}
            loop={false}
            vertical={false}
            style={{ width: screenDimensions.width }}

            mode="parallax"
            modeConfig={{
              parallaxScrollingScale: .85,
              parallaxScrollingOffset: 110,
              parallaxAdjacentItemScale: .85
            }}
            width={screenDimensions.width} // Item width (screen - horizontal padding)
            height={screenDimensions.height - HEADER_HEIGHT}
            data={isRTL ? [...pages].reverse() : pages}

            renderItem={({ item, index }) => {
              const actualPageIndex = fromCarouselIndex(index);
              console.log('[AlbumScreen] Rendering carousel item:', index, 'actual page:', actualPageIndex, item.id);
              return (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    console.log('[AlbumScreen] Clicked on carousel index:', index, 'actual page:', actualPageIndex, 'current:', currentPageIndex);
                    // If clicking on a non-current page, slide to it
                    if (actualPageIndex !== currentPageIndex) {
                      console.log('[AlbumScreen] Scrolling to carousel index:', index);
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
                    onPress={() => { }} // Disable PageCard's own press handler
                    onEdit={handleEditPage}
                    onDelete={handleDeletePage}
                    autoPlayAudio={currentPageIndex === actualPageIndex}
                  />
                </TouchableOpacity>
              );
            }}
            enabled={!isEditMode}
            onSnapToItem={(index) => {
              const actualPageIndex = fromCarouselIndex(index);
              console.log('[AlbumScreen] Snapped to carousel index:', index, 'actual page:', actualPageIndex);
              setCurrentPageIndex(actualPageIndex);
            }}
            defaultIndex={toCarouselIndex(currentPageIndex)}
            windowSize={3}
          />

          {/* Navigation buttons */}
          {pages.length > 1 && (
            <>
              {/* Previous button - Start side (Left in LTR, Right in RTL) */}
              {currentPageIndex > 0 && (
                <TouchableOpacity
                  style={[
                    styles.navButton,
                    styles.navButtonPrev,
                    isRTL ? { right: 20 } : { left: 20 },
                    { backgroundColor: colors.primary }
                  ]}
                  onPress={() => {
                    const newIndex = currentPageIndex - 1;
                    carouselRef.current?.scrollTo({ index: toCarouselIndex(newIndex), animated: true });
                  }}
                >
                  <MyIcon info={{
                    type: "Ionicons",
                    name: isRTL ? "chevron-forward" : "chevron-back",
                    size: 36,
                    color: colors.cardBackground
                  }} />
                </TouchableOpacity>
              )}

              {/* Next button - End side (Right in LTR, Left in RTL) */}
              <TouchableOpacity
                style={[
                  styles.navButton,
                  styles.navButtonNext,
                  isRTL ? { left: 20 } : { right: 20 },
                  { backgroundColor: colors.primary },
                  currentPageIndex === pages.length - 1 && styles.navButtonDisabled
                ]}
                onPress={() => {
                  if (currentPageIndex < pages.length - 1) {
                    const newIndex = currentPageIndex + 1;
                    carouselRef.current?.scrollTo({ index: toCarouselIndex(newIndex), animated: true });
                  }
                }}
                disabled={currentPageIndex === pages.length - 1}
              >
                <MyIcon info={{
                  type: "Ionicons",
                  name: isRTL ? "chevron-back" : "chevron-forward",
                  size: 36,
                  color: colors.cardBackground,
                }} style={{ opacity: currentPageIndex === pages.length - 1 ? 0.3 : 1 }} />
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('album.noPages')}</Text>
        </View>
      )}

      {/* Off-screen PageCard for thumbnail generation */}
      {capturingThumbnail && thumbnailPage && (
        <View style={{ position: 'absolute', left: -10000, top: -10000 }}>
          <PageCard
            ref={thumbnailCardRef}
            page={thumbnailPage}
            albumId={album.id}
            isEditMode={false}
            onPress={() => { }}
            autoPlayAudio={false}
          />
        </View>
      )}

      {/* Loading overlays for page operations */}
      {isDeletingPage && (
        <View style={styles.loadingOverlay}>
          <View style={[styles.overlayContent, {
            backgroundColor: colors.cardBackground,
            shadowColor: colors.primary,
          }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.overlayText, { color: colors.textPrimary }]}>{t('album.deletingPage')}</Text>
          </View>
        </View>
      )}

      {isCreatingPage && (
        <View style={styles.loadingOverlay}>
          <View style={[styles.overlayContent, {
            backgroundColor: colors.cardBackground,
            shadowColor: colors.primary,
          }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.overlayText, { color: colors.textPrimary }]}>{t('album.creatingPage')}</Text>
          </View>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 0,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.round,
  },
  editButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
  },
  pageContainer: {
    backgroundColor: "green",
    height: "100%",
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingVertical: spacing.md,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  overlayContent: {
    borderRadius: borderRadius.large,
    padding: spacing.xxl,
    alignItems: 'center',
    minWidth: 200,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  overlayText: {
    fontSize: 18,
    marginTop: spacing.md,
    fontWeight: '600',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -30,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
  },
  navButtonPrev: {},
  navButtonNext: {},
  navButtonDisabled: {
    opacity: 0.4,
  },
});
