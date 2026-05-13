import React, { useMemo, useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import {
  Dimensions,
  ImageURISource,
  Modal,
  StyleSheet,
  Text,
  View,
  PixelRatio,
} from 'react-native';
import { AlbumPage, AlbumPageV2, ElementTypes, HEADER_HEIGHT, SketchText, WordTiming } from '../types/Album';
import { SketchElement, SketchElementAttributes } from './canvas/types';
import { loadPageWithMigration, compileQueueToElements, getId } from '../utils/pageUtils';
import DoQueue from '../utils/DoQueue';
import EmojiPicker, { en } from 'rn-emoji-keyboard';
import type { EmojiType } from 'rn-emoji-keyboard';
import { ViewModeEmojiOverlay } from './ViewModeEmojiOverlay';
import { useLanguage } from '../contexts/LanguageContext';
import { AttachmentService } from '../services/AttachmentService';
import Canvas from './canvas/canvas';
import { AudioElement } from './AudioElement';
import { TilesElement } from './TilesElement';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

const PAGE_MARGIN = 16;
const PAGE_TITLE_ID = 'page_title_text';

export interface PageCardRef {
  captureScreenshot: () => Promise<string>;
  saveIfDirty: () => Promise<boolean>;
  openEmojiKeyboard: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  undo: () => void;
  redo: () => void;
  isDirty: () => boolean;
  deleteSelectedEmoji: () => void;
  clearEmojiSelection: () => void;
}

interface PageCardProps {
  page: AlbumPage;
  albumId: string; // Album ID for path conversion
  isEditMode: boolean;
  onPress: (page: AlbumPage) => void;
  onEdit?: (page: AlbumPage) => void;
  onDelete?: (page: AlbumPage) => void;
  autoPlayAudio?: boolean; // Auto-play audio when card is shown
  highlightedWordIndex?: number; // For video export - externally controlled highlight
  onSavePage?: (updatedPage: AlbumPage, shouldExit?: boolean) => void;
  onDirtyChange?: (dirty: boolean, canUndo: boolean, canRedo: boolean) => void;
  onEmojiSelected?: (selected: boolean) => void;
}

export const PageCard = forwardRef<PageCardRef, PageCardProps>(function PageCard(
  { page, albumId, isEditMode, onPress, onEdit, onDelete, autoPlayAudio = false, highlightedWordIndex, onSavePage, onDirtyChange, onEmojiSelected },
  ref
) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [triggerAudioPlay, setTriggerAudioPlay] = useState(0);
  const [seekToTime, setSeekToTime] = useState<{ time: number; seq: number } | undefined>(undefined);
  const canvasRef = useRef<any>(null);
  const viewShotRef = useRef<View>(null);
  const pageContentRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const { language, isRTL } = useLanguage();
  const [showEmojiKeyboard, setShowEmojiKeyboard] = useState(false);
  const [selectedEmojiId, setSelectedEmojiId] = useState<string | null>(null);

  // Local queue seeded from page elements — tracks view-mode mutations
  const viewQueue = useRef<DoQueue>(new DoQueue());
  const [queueVersion, setQueueVersion] = useState(0);
  const baselineLength = useRef(0);
  const isDirty = useRef(false);

  // Seed queue when page prop changes
  useEffect(() => {
    const q = new DoQueue();
    const v2 = loadPageWithMigration(page);
    v2.elements.forEach(qe => q.add(qe));
    baselineLength.current = q.getQueueLength();
    viewQueue.current = q;
    isDirty.current = false;
    setQueueVersion(v => v + 1);
  }, [page.id]);

  useEffect(() => {
    onEmojiSelected?.(selectedEmojiId !== null);
  }, [selectedEmojiId]);

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

  // Expose captureScreenshot + saveIfDirty + emoji controls via ref
  useImperativeHandle(ref, () => ({
    captureScreenshot: async () => {
      if (!pageContentRef.current) {
        throw new Error('ViewShot ref not available');
      }
      const uri = await captureRef(pageContentRef, {
        format: 'jpg',
        quality: 0.6,
      });
      console.log('[PageCard] Captured screenshot:', uri);
      return uri;
    },
    saveIfDirty: async () => {
      console.log('[PageCard] saveIfDirty called, isDirty:', isDirty.current, 'hasOnSavePage:', !!onSavePage);
      if (!isDirty.current || !onSavePage) return false;
      const v2 = loadPageWithMigration(page);
      const updatedPage: AlbumPageV2 = { ...v2, elements: viewQueue.current.getAll() };
      console.log('[PageCard] calling onSavePage with', updatedPage.elements.length, 'elements');
      await onSavePage(updatedPage as AlbumPage);
      isDirty.current = false;
      return true;
    },
    openEmojiKeyboard: () => setShowEmojiKeyboard(true),
    canUndo: () => viewQueue.current.canUndo(baselineLength.current),
    canRedo: () => viewQueue.current.canRedo(),
    undo: () => { viewQueue.current.undo(baselineLength.current); rebuildFromQueue(); },
    redo: () => { viewQueue.current.redo(); rebuildFromQueue(); },
    isDirty: () => isDirty.current,
    deleteSelectedEmoji: () => {
      const id = selectedEmojiId;
      if (!id) return;
      viewQueue.current.pushTextDelete(id);
      isDirty.current = true;
      setSelectedEmojiId(null);
      rebuildFromQueue();
    },
    clearEmojiSelection: () => setSelectedEmojiId(null),
  }));

  // Save on unmount if dirty
  useEffect(() => {
    return () => {
      if (isDirty.current && onSavePage) {
        const v2 = loadPageWithMigration(page);
        const updatedPage: AlbumPageV2 = { ...v2, elements: viewQueue.current.getAll() };
        onSavePage(updatedPage as AlbumPage);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const availableHeight = screenDimensions.height - HEADER_HEIGHT;

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
  // Re-runs on queueVersion bump (view-mode mutations) or albumId change
  const { paths, texts, images, audios, tiles, backgroundPattern } = useMemo(() => {
    const elements = viewQueue.current.getAll();
    const result = compileQueueToElements(elements);

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
      tiles: result.tiles,
      backgroundPattern: result.backgroundPattern
    });

    return {
      ...result,
      images: imagesWithUris,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueVersion, albumId]);

  // Extract page-level audio
  const pageAudio = useMemo(() => {
    return audios.find(a => a.id === PAGE_AUDIO_ID);
  }, [audios]);

  // View-mode emoji helpers
  const viewModeEmojis = useMemo(
    () => texts.filter(t => t.isEmoji && t.addedInView),
    [texts]
  );

  const canUndo = viewQueue.current.canUndo(baselineLength.current);
  const canRedo = viewQueue.current.canRedo();
  const showUndoRedo = isDirty.current || canRedo;

  function rebuildFromQueue() {
    const newDirty = viewQueue.current.getQueueLength() > baselineLength.current
      || viewQueue.current.canRedo();
    isDirty.current = newDirty;
    onDirtyChange?.(newDirty, viewQueue.current.canUndo(baselineLength.current), viewQueue.current.canRedo());
    setQueueVersion(v => v + 1);
  }

  function handleEmojiPick(emojiObject: EmojiType) {
    const emojiSize = 100;
    const safeScale = scale || 1;
    const newEmoji: SketchText = {
      id: getId('text'),
      text: emojiObject.emoji,
      fontSize: emojiSize,
      color: '#000000',
      rtl: isRTL,
      alignment: isRTL ? 'Right' : 'Left',
      x: (displayWidth / safeScale) / 2 - emojiSize / safeScale / 2,
      y: (displayHeight / safeScale) / 2 - emojiSize / safeScale / 2,
      isEmoji: true,
      addedInView: true,
      width: emojiSize * 1.2,
      height: emojiSize * 1.2,
    };
    viewQueue.current.pushText(newEmoji);
    isDirty.current = true;
    setSelectedEmojiId(newEmoji.id);
    setShowEmojiKeyboard(false);
    rebuildFromQueue();
  }

  function handleEmojiMoveEnd(id: string, x: number, y: number) {
    const elem = texts.find(t => t.id === id);
    if (!elem) return;
    viewQueue.current.pushText({ ...elem, x, y });
    isDirty.current = true;
    rebuildFromQueue();
  }

  function handleEmojiMoveOutOfBounds(id: string) {
    viewQueue.current.pushTextDelete(id);
    isDirty.current = true;
    setSelectedEmojiId(null);
    rebuildFromQueue();
  }

  function handleEmojiPinchRotateEnd(id: string, fontSize: number, rotation: number) {
    const elem = texts.find(t => t.id === id);
    if (!elem) return;
    viewQueue.current.pushText({ ...elem, fontSize, rotation, width: fontSize * 1.2, height: fontSize * 1.2 });
    isDirty.current = true;
    rebuildFromQueue();
  }

  function handleUndo() {
    viewQueue.current.undo(baselineLength.current);
    rebuildFromQueue();
  }

  function handleRedo() {
    viewQueue.current.redo();
    rebuildFromQueue();
  }

  // No longer using audio elements on canvas
  const audioElements: SketchElement[] = [];

  function handleTilePress(originalIndices: number[]) {
    if (!pageAudio?.audioPath) return;
    const timings = pageAudio.wordTimings;
    let startTime = 0;
    let stopAt: number | undefined = undefined;
    if (timings && timings.length > 0) {
      const matchedIndices = originalIndices.filter(i => i < timings.length);
      if (matchedIndices.length > 0) {
        const maxIndex = Math.max(...matchedIndices);
        startTime = timings[Math.min(...matchedIndices)].startTime;
        // stopAt = next word's startTime after the tile's last word
        if (maxIndex + 1 < timings.length) {
          stopAt = timings[maxIndex + 1].startTime;
        }
      }
    }
    setSeekToTime(prev => ({ time: startTime, stopAt, seq: (prev?.seq ?? 0) + 1 }));
  }

  // Render callback for custom elements
  const handleRenderElements = (elem: SketchElement) => {
    if (elem.type === 'tiles') {
      const tilesElem = elem as any; // Cast to tiles type
      return (
        <TilesElement
          tiles={tilesElem}
          canvasWidth={displayWidth}
          canvasHeight={displayHeight}
          ratio={scale}
          editMode={false}
          highlightedWordIndex={highlightedWordIndex !== undefined ? highlightedWordIndex : (currentWordIndex !== null ? currentWordIndex : undefined)}
          albumId={albumId}
          onTilePressViewMode={pageAudio?.audioPath ? handleTilePress : undefined}
        />
      );
    }
    return null;
  };

  const backgroundImage: ImageURISource | undefined = page.backgroundPath
    ? { uri: `file://${page.backgroundPath}` }
    : undefined;


  return (
    <View style={styles.container} pointerEvents={isEditMode ? "auto" : "box-none"}>
      <View
        style={[styles.pageContent, { width: displayWidth, height: displayHeight }]}
        pointerEvents={isEditMode ? "auto" : (viewModeEmojis.length > 0 ? "auto" : "box-none")}
        ref={pageContentRef}
        collapsable={false}
      >
        <View
          pointerEvents="box-none"
          style={[styles.canvas]}
          ref={viewShotRef}
          collapsable={false}
        >
          <Canvas
            ref={canvasRef}
            style={{ width: displayWidth, height: displayHeight }}
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
            texts={isEditMode ? texts : texts.filter(t => !t.addedInView)}
            images={images}
            lines={[]}
            tables={[]}
            elements={tiles ? [{ ...tiles, type: 'tiles', x: 0, y: tiles.y }] : []}
            renderElements={handleRenderElements}

            currentEdited={{}} // No editing in card view
            onTextChanged={() => { }}
            onSketchStart={() => { }}
            onSketchStep={() => { }}
            onSketchEnd={() => { }}
            sketchColor="#333"
            sketchStrokeWidth={3}
            onCanvasClick={(p, elem) => {
              // Tap on title text triggers audio replay
              if (pageAudio?.audioPath && (elem as any)?.id === PAGE_TITLE_ID) {
                setTriggerAudioPlay(n => n + 1);
              }
            }}
            onMoveElement={() => { }}
            onMoveEnd={() => { }}
            onDeleteElement={() => { }}

            // Background
            imageSource={backgroundImage}
            background={page.backgroundPath ? 0 : undefined}
            backgroundPattern={backgroundPattern}
            albumId={albumId}

            currentElementType={ElementTypes.Sketch}

            // Word highlighting for audio playback
            currentWordIndex={currentWordIndex}
            wordTimings={pageAudio?.wordTimings}

            // View mode - no editing/moving UI
            isViewMode={true}
          />
        </View>

        {/* Page Audio - hidden off-screen, plays on autoPlay or external trigger */}
        {pageAudio?.audioPath && (
          <View style={{ position: 'absolute', left: -10000, top: -10000, width: 1, height: 1 }}>
            <AudioElement
              audioFile={pageAudio.audioPath}
              albumId={albumId}
              editMode={false}
              autoPlay={autoPlayAudio && !tiles}
              triggerPlay={triggerAudioPlay}
              seekToTime={seekToTime}
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

        {/* Overlay for view-mode emojis */}
        {!isEditMode && viewModeEmojis.length > 0 && (
          <ViewModeEmojiOverlay
            emojis={viewModeEmojis}
            selectedId={selectedEmojiId}
            ratio={scale}
            displayWidth={displayWidth}
            displayHeight={displayHeight}
            onSelect={(id) => setSelectedEmojiId(id)}
            onMoveEnd={handleEmojiMoveEnd}
            onMoveOutOfBounds={handleEmojiMoveOutOfBounds}
            onPinchRotateEnd={handleEmojiPinchRotateEnd}
          />
        )}

        {/* Emoji keyboard */}
        {!isEditMode && (
          <View style={{ direction: 'ltr' }}>
            <EmojiPicker
              onEmojiSelected={handleEmojiPick}
              open={showEmojiKeyboard}
              onClose={() => setShowEmojiKeyboard(false)}
              allowMultipleSelections={false}
              emojiSize={48}
              defaultHeight="50%"
              enableSearchBar={true}
              translation={en}
            />
          </View>
        )}


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
  viewModeControls: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    gap: 6,
    zIndex: 1001,
  },
  viewModeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewModeButtonDisabled: {
    opacity: 0.35,
  },
  viewModeButtonText: {
    fontSize: 18,
  },
});
