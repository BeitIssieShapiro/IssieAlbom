import React, { useMemo, useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import {
  Dimensions,
  ImageURISource,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  PixelRatio,
} from 'react-native';
import { AlbumPage, AlbumPageV2, ElementTypes, WordTiming } from '../types/Album';
import { SketchElement, SketchElementAttributes } from './canvas/types';
import { loadPageWithMigration, compileQueueToElements } from '../utils/pageUtils';
import { AttachmentService } from '../services/AttachmentService';
import Canvas from './canvas/canvas';
import { AudioElement } from './AudioElement';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

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

  // Track screen dimensions (updated on rotation)
  const [screenDimensions, setScreenDimensions] = useState(() => {
    const window = Dimensions.get('window');
    return { width: window.width, height: window.height };
  });

  // Listen for dimension changes (device rotation)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      console.log('[PageCard] Dimensions changed:', window);
      setScreenDimensions({ width: window.width, height: window.height });
    });

    return () => {
      subscription?.remove();
    };
  }, []);

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

  // Calculate display dimensions - recalculate on screen dimension changes
  // Using SAME logic as PageEditorScreen for consistency
  const { displayWidth, displayHeight, scale } = useMemo(() => {
    // Calculate available space (no toolbar in view mode, but account for carousel margins)
    const availableWidth = screenDimensions.width;
    // Match carousel height calculation: screenDimensions.height - insets.top - 60
    const availableHeight = screenDimensions.height - insets.top - 60;

    // Get original page dimensions (screen dimensions when page was created)
    const originalWidth = (v2Page as AlbumPageV2).canvasWidth || screenDimensions.width;
    const originalHeight = (v2Page as AlbumPageV2).canvasHeight || screenDimensions.height;

    // Calculate ratio (scale) to fit page dimensions into available space
    const ratioX = availableWidth / originalWidth;
    const ratioY = availableHeight / originalHeight;
    const scale = Math.min(ratioX, ratioY, 1); // Don't scale up, only down

    // Calculate actual canvas size (scaled dimensions) - round to nearest pixel
    const displayWidth = PixelRatio.roundToNearestPixel(originalWidth * scale);
    const displayHeight = PixelRatio.roundToNearestPixel(originalHeight * scale);

    console.log('[PageCard] Display calculations:', {
      screenWidth: screenDimensions.width,
      screenHeight: screenDimensions.height,
      availableWidth,
      availableHeight,
      originalWidth,
      originalHeight,
      scaleX: ratioX,
      scaleY: ratioY,
      finalScale: scale,
      displayWidth,
      displayHeight,
    });

    return { displayWidth, displayHeight, scale, originalWidth, originalHeight };
  }, [screenDimensions, insets, v2Page]);

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


  return (
    <View style={styles.container} pointerEvents={isEditMode ? "auto" : "box-none"}>
      <View
        style={[styles.pageContent]}
        pointerEvents={isEditMode ? "auto" : "box-none"}
      >
        <View
          pointerEvents="box-none"
          style={[styles.canvas]}
          ref={viewShotRef}
          collapsable={false}
        >
          <Canvas
            ref={canvasRef}
            style={{  }}
            offset={{ x: 0, y: 0 }}
            canvasWidth={displayWidth}
            canvasHeight={displayHeight}
            ratio={scale}
            canvasTop={0}
            zoom={1}
            onZoom={() => { }}
            onMoveCanvas={() => { }}
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
            onTextChanged={() => { }}
            onSketchStart={() => { }}
            onSketchStep={() => { }}
            onSketchEnd={() => { }}
            sketchColor="#333"
            sketchStrokeWidth={3}
            onCanvasClick={() => { }}
            onMoveElement={() => { }}
            onMoveEnd={() => { }}
            onDeleteElement={() => { }}

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


        <View style={styles.pageNumber}>
          <Text style={styles.pageNumberText}>{page.pageNumber}</Text>
        </View>
      </View>


    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8 ,
    boxShadow: '5px 5px 5px 0px rgba(0, 0, 0, 0.3)',
  },
  pageContent: {
    flex: 1,
    margin: 0,
    padding: 0,
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
