import React, { useMemo, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  Dimensions,
  ImageURISource,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AlbumPage, AlbumPageV2, ElementTypes, WordTiming } from '../types/Album';
import { SketchElement, SketchElementAttributes } from './canvas/types';
import { loadPageWithMigration, compileQueueToElements } from '../utils/pageUtils';
import { AttachmentService } from '../services/AttachmentService';
import Canvas from './canvas/canvas';
import { AudioElement } from './AudioElement';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const PAGE_MARGIN = 16;

export interface PageCardRef {
  captureScreenshot: () => Promise<string>;
}

interface PageCardProps {
  page: AlbumPage;
  albumId: string; // Album ID for path conversion
  isEditMode: boolean;
  onPress: (page: AlbumPage) => void;
  onEdit?: (page: AlbumPage) => void;
  onDelete?: (page: AlbumPage) => void;
  autoPlayAudio?: boolean; // Auto-play audio when card is shown
}

export const PageCard = forwardRef<PageCardRef, PageCardProps>(function PageCard(
  { page, albumId, isEditMode, onPress, onEdit, onDelete, autoPlayAudio = false },
  ref
) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const canvasRef = useRef<any>(null);
  const viewShotRef = useRef<View>(null);
  const insets = useSafeAreaInsets();

  // Expose captureScreenshot method via ref
  useImperativeHandle(ref, () => ({
    captureScreenshot: async () => {
      if (!viewShotRef.current) {
        throw new Error('ViewShot ref not available');
      }
      const uri = await captureRef(viewShotRef, {
        format: 'jpg',
        quality: 0.6,
      });
      console.log('[PageCard] Captured screenshot:', uri);
      return uri;
    },
  }));

  // Hardcoded audio ID
  const PAGE_AUDIO_ID = 'page_audio';

  // Load page with migration and convert to V2 format
  const v2Page = useMemo(() => loadPageWithMigration(page), [page]);

  // Calculate available height (screen height minus header, page number overlay, margins)
  const HEADER_HEIGHT = 60 + insets.top; // header + top inset
  const PAGE_NUMBER_HEIGHT = 40; // space for page number at bottom
  const AVAILABLE_HEIGHT = SCREEN_HEIGHT - HEADER_HEIGHT - PAGE_NUMBER_HEIGHT - PAGE_MARGIN * 2;
  const AVAILABLE_WIDTH = SCREEN_WIDTH - PAGE_MARGIN * 2;

  // Get original canvas dimensions or use screen dimensions as fallback
  const originalWidth = (v2Page as AlbumPageV2).canvasWidth || SCREEN_WIDTH;
  const originalHeight = (v2Page as AlbumPageV2).canvasHeight || SCREEN_HEIGHT;

  // Calculate scale to fit original dimensions into available space
  const scaleX = AVAILABLE_WIDTH / originalWidth;
  const scaleY = AVAILABLE_HEIGHT / originalHeight;
  const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

  const displayWidth = originalWidth * scale;
  const displayHeight = originalHeight * scale;

  // Calculate left margin to center the page
  const leftMargin = (AVAILABLE_WIDTH - displayWidth) / 2;

  // Compile queue elements into final arrays using shared utility
  // Also convert relative paths to absolute URIs
  const { paths, texts, images, audios, backgroundPattern } = useMemo(() => {
    const result = compileQueueToElements(v2Page.elements);

    // Convert image relative paths to absolute URIs
    const imagesWithUris = result.images.map(img => ({
      ...img,
      imageUri: `file://${AttachmentService.getAbsolutePath(albumId, img.imagePath)}`,
    }));

    console.log('PageCard - compileQueueToElements result:', {
      paths: result.paths.length,
      texts: result.texts.length,
      images: imagesWithUris.length,
      audios: result.audios.length,
      audiosDetail: result.audios.map(a => ({ id: a.id, audioPath: a.audioPath, x: a.x, y: a.y })),
      backgroundPattern: result.backgroundPattern
    });

    return {
      ...result,
      images: imagesWithUris,
    };
  }, [v2Page.elements, albumId]);

  // Extract page-level audio
  const pageAudio = useMemo(() => {
    return audios.find(a => a.id === PAGE_AUDIO_ID);
  }, [audios]);

  // No longer using audio elements on canvas
  const audioElements: SketchElement[] = [];

  // Render callback for custom elements - not used anymore
  const handleRenderElements = (elem: SketchElement) => {
    return null;
  };

  const backgroundImage: ImageURISource | undefined = page.backgroundPath
    ? { uri: `file://${page.backgroundPath}` }
    : undefined;

  const handleMenuOption = (action: 'delete' | 'edit') => {
    setMenuVisible(false);
    if (action === 'delete') {
      onDelete?.(page);
    } else if (action === 'edit') {
      onEdit?.(page);
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(page)}
      activeOpacity={0.9}
    >
      <View
        ref={viewShotRef}
        style={[styles.pageContent, {
          width: displayWidth,
          height: displayHeight,
        }]}
      >
        <View pointerEvents="box-none" style={styles.canvas}>
          <Canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%' }}
            offset={{ x: 0, y: 0 }}
            canvasWidth={originalWidth}
            canvasHeight={originalHeight}
            ratio={scale}
            canvasTop={0}
            zoom={1}
            onZoom={() => {}}
            onMoveCanvas={() => {}}
            sideMargin={0}

            // Element arrays
            paths={paths}
            texts={texts}
            images={images}
            lines={[]}
            tables={[]}
            elements={audioElements}
            renderElements={handleRenderElements}

            currentEdited={{}} // No editing in card view
            onTextChanged={() => {}}
            onSketchStart={() => {}}
            onSketchStep={() => {}}
            onSketchEnd={() => {}}
            sketchColor="#333"
            sketchStrokeWidth={3}
            onCanvasClick={() => {}}
            onMoveElement={() => {}}
            onMoveEnd={() => {}}
            onDeleteElement={() => {}}

            // Background
            imageSource={backgroundImage}
            background={page.backgroundPath ? 0 : undefined}
            backgroundPattern={backgroundPattern}

            currentElementType={ElementTypes.Sketch}

            // Word highlighting for audio playback
            currentWordIndex={currentWordIndex}
            wordTimings={pageAudio?.wordTimings}

            // View mode - no editing/moving UI
            isViewMode={true}
          />
        </View>

        {/* Page Audio - hidden in view, only plays audio */}
        {pageAudio?.audioPath && autoPlayAudio && (
          <View style={{ width: 0, height: 0, overflow: 'hidden' }}>
            <AudioElement
              audioFile={pageAudio.audioPath}
              albumId={albumId}
              editMode={false}
              autoPlay={autoPlayAudio}
              width={1}
              height={1}
              wordTimings={pageAudio.wordTimings}
              onWordChange={setCurrentWordIndex}
            />
          </View>
        )}

        {isEditMode && (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setMenuVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.menuDots}>•••</Text>
          </TouchableOpacity>
        )}

        <View style={styles.pageNumber}>
          <Text style={styles.pageNumberText}>{page.pageNumber}</Text>
        </View>
      </View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>עמוד {page.pageNumber}</Text>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuOption('edit')}
            >
              <Text style={styles.menuItemText}>עריכת עמוד</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDestructive]}
              onPress={() => handleMenuOption('delete')}
            >
              <Text style={styles.menuItemTextDestructive}>מחיקת עמוד</Text>
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
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  canvas: {
    width: '100%',
    height: '100%',
  },
  pageAudioContainer: {
    position: 'absolute',
    zIndex: 999,
  },
  menuButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 1000,
  },
  menuDots: {
    fontSize: 12,
    color: '#666',
    letterSpacing: -1,
  },
  editButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 1000,
  },
  editButtonText: {
    fontSize: 18,
    color: '#007AFF',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 1000,
  },
  pageNumberText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 14,
    width: 280,
    overflow: 'hidden',
  },
  menuTitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  menuItem: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  menuItemText: {
    fontSize: 18,
    color: '#007AFF',
    textAlign: 'center',
  },
  menuItemDestructive: {},
  menuItemTextDestructive: {
    fontSize: 18,
    color: '#FF3B30',
    textAlign: 'center',
  },
  menuItemCancel: {
    borderBottomWidth: 0,
    backgroundColor: '#f8f8f8',
  },
  menuItemTextCancel: {
    fontSize: 18,
    color: '#007AFF',
    textAlign: 'center',
    fontWeight: '600',
  },
});
