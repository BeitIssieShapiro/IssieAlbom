import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ImageURISource,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Platform,
  PermissionsAndroid,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PathCommand } from '@shopify/react-native-skia';
import { Canvas, Rect, Path } from '@shopify/react-native-skia';
import { launchImageLibrary } from 'react-native-image-picker';
import Sound from 'react-native-nitro-sound';
import EmojiPicker from 'rn-emoji-keyboard';
import type { EmojiType } from 'rn-emoji-keyboard';
import { AlbumPage, AlbumPageV2, ElementTypes, CurrentEdited, SketchPoint, SketchPath, SketchText, SketchImage, SketchAudio, WordTiming, BackgroundPattern, HEADER_HEIGHT } from '../types/Album';
import { SketchElement, SketchElementAttributes, MoveTypes } from '../components/canvas/types';
import DoQueue from '../utils/DoQueue';
import CanvasComponent from '../components/canvas/canvas';
import { AudioElement } from '../components/AudioElement';
import { AudioWordMappingModal } from '../components/AudioWordMappingModal';
import { BackgroundSettingsModal } from '../components/BackgroundSettingsModal';
import { CameraModal } from '../components/CameraModal';
import { getId, compileQueueToElements } from '../utils/pageUtils';
import { PATTERN_PRESETS, SOLID_COLOR_PRESETS, BACKGROUND_IMAGE_PRESETS, BACKGROUND_IMAGE_SOURCES, generatePatternPaths } from '../utils/backgroundPatterns';
import { PageService } from '../services/PageService';
import { AttachmentService } from '../services/AttachmentService';
import { AlbumService } from '../services/AlbumService';
import { MyIcon } from '../common/icons';
import { colors, spacing, borderRadius } from '../theme/colors';

const TOOLBAR_WIDTH = 90;
const CANVAS_MARGIN = 12; // Margin around canvas in edit mode


import Slider from '@react-native-community/slider';

// Rotation Slider Component
interface RotationSliderProps {
  value: number; // 0-360 (internal storage format)
  onChange: (value: number) => void;
  onRelease: () => void;
}

function RotationSlider({ value, onChange, onRelease }: RotationSliderProps) {
  // Convert 0-360 to -180 to +180 for display (0 in middle)
  const normalizeToDisplay = (deg: number) => {
    // 0-180 stays as positive, 181-360 becomes -179 to -1
    return deg > 180 ? deg - 360 : deg;
  };

  // Convert -180 to +180 back to 0-360 for storage
  const normalizeToStorage = (deg: number) => {
    return deg < 0 ? deg + 360 : deg;
  };

  const displayValue = normalizeToDisplay(value);

  return (
    <View style={styles.rotationSliderContainer}>
      <Slider
        style={{ width: 200, height: 60 }}
        minimumValue={-180}
        maximumValue={180}
        value={displayValue}
        onValueChange={(val) => onChange(normalizeToStorage(Math.round(val)))}
        onSlidingComplete={() => onRelease()}
        minimumTrackTintColor="#007AFF"
        maximumTrackTintColor="#E0E0E0"
        thumbTintColor="#007AFF"
        step={1}
      />
    </View>
  );
}

// Simple word timing heuristics - distributes words evenly across audio duration
function generateInitialWordTimings(words: string[], duration: number): WordTiming[] {
  const SPEECH_START_DELAY = 0.5; // Start first word at 0.5s
  const effectiveDuration = Math.max(duration - SPEECH_START_DELAY, 1);

  return words.map((word, index) => ({
    word,
    startTime: SPEECH_START_DELAY + (index / words.length) * effectiveDuration,
  }));
}

interface PageEditorScreenProps {
  page: AlbumPage;
  albumId: string;
  onSave: (updatedPage: AlbumPageV2, shouldExit?: boolean) => void;
  onDiscard: () => void;
  pages?: AlbumPage[];
  onNavigatePage?: (pageId: string) => void;
  onCreatePage?: () => void;
  onDeletePage?: () => void;
}

export function PageEditorScreen({ page, albumId, onSave, onDiscard, pages, onNavigatePage, onCreatePage, onDeletePage }: PageEditorScreenProps) {
  const insets = useSafeAreaInsets();
  const canvasRef = useRef<any>(null);

  // Track screen dimensions (updated on rotation)
  const [screenDimensions, setScreenDimensions] = useState(() => {
    const window = Dimensions.get('window');
    return { width: window.width, height: window.height };
  });

  // Listen for dimension changes (device rotation)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      console.log('[PageEditorScreen] Dimensions changed:', window);
      setScreenDimensions({ width: window.width, height: window.height });
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  // Queue for undo/redo with attachment cleanup
  const queue = useRef(new DoQueue(async (relativePath: string) => {
    console.log('[PageEditorScreen] Deleting evicted attachment:', relativePath);
    try {
      await AttachmentService.deleteAttachment(albumId, relativePath);
    } catch (error) {
      console.error('[PageEditorScreen] Failed to delete attachment:', error);
    }
  }));

  // Track if page was modified (for thumbnail generation)
  const pageModifiedRef = useRef(false);

  // Canvas state (external to Canvas component)
  const [paths, setPaths] = useState<SketchPath[]>([]);
  const [texts, setTexts] = useState<SketchText[]>([]);
  const [images, setImages] = useState<SketchImage[]>([]);
  const [audios, setAudios] = useState<SketchElement[]>([]);
  const [pageAudioFile, setPageAudioFile] = useState<string | undefined>(undefined);
  const [pageAudioDuration, setPageAudioDuration] = useState<number | undefined>(undefined);
  const [pageAudioWordTimings, setPageAudioWordTimings] = useState<WordTiming[]>([]);
  const [showWordMappingModal, setShowWordMappingModal] = useState(false);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [showEmojiKeyboard, setShowEmojiKeyboard] = useState(false);
  const [currentEmojiId, setCurrentEmojiId] = useState<string | null>(null); // Track selected emoji
  const [loadingImagePicker, setLoadingImagePicker] = useState(false); // Track image picker loading
  const [showCameraModal, setShowCameraModal] = useState(false); // Track camera modal

  const [emojiRotation, setEmojiRotation] = useState<number | undefined>(); // Temporary rotation while dragging
  const [backgroundPattern, setBackgroundPattern] = useState<BackgroundPattern | undefined>(undefined);
  const [currentEdited, setCurrentEdited] = useState<CurrentEdited>({});
  const [currentElementType, setCurrentElementType] = useState<ElementTypes>(ElementTypes.Sketch);

  // Track text being edited (all temporary changes not yet in queue)
  const [editingTextChanges, setEditingTextChanges] = useState<Partial<SketchText> & { id: string } | null>(null);

  // Track element being moved (for non-text elements or when not editing)
  const [movingElement, setMovingElement] = useState<{ id: string; type: string; x: number; y: number; width?: number; height?: number } | null>(null);

  // Refs to avoid closure issues
  const currentEditedRef = useRef<CurrentEdited>({});
  const editingTextChangesRef = useRef<Partial<SketchText> & { id: string } | null>(null);
  const isEraserRef = useRef<boolean>(false);
  const movingElementRef = useRef<{ id: string; type: string; x: number; y: number; width?: number; height?: number } | null>(null);
  const imagesRef = useRef<SketchImage[]>([]);
  const audiosRef = useRef<SketchElement[]>([]);
  const pageAudioFileRef = useRef<string | undefined>(undefined);
  const pageAudioDurationRef = useRef<number | undefined>(undefined);
  const pageAudioWordTimingsRef = useRef<WordTiming[]>([]);
  const textsRef = useRef<SketchText[]>([]);
  const currentEmojiIdRef = useRef<string | null>(null);
  const emojiRotationRef = useRef<number | undefined>(undefined);
  const sketchColorRef = useRef<string>('#333333');
  const sketchStrokeWidthRef = useRef<number>(3);
  const handleSketchEndRef = useRef<((commands?: PathCommand[]) => void) | null>(null);

  // Sync refs with state
  useEffect(() => {
    currentEditedRef.current = currentEdited;
  }, [currentEdited]);

  useEffect(() => {
    editingTextChangesRef.current = editingTextChanges;
  }, [editingTextChanges]);

  useEffect(() => {
    movingElementRef.current = movingElement;
  }, [movingElement]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    audiosRef.current = audios;
  }, [audios]);

  useEffect(() => {
    pageAudioFileRef.current = pageAudioFile;
  }, [pageAudioFile]);

  useEffect(() => {
    pageAudioDurationRef.current = pageAudioDuration;
  }, [pageAudioDuration]);

  useEffect(() => {
    pageAudioWordTimingsRef.current = pageAudioWordTimings;
  }, [pageAudioWordTimings]);

  useEffect(() => {
    textsRef.current = texts;
  }, [texts]);

  useEffect(() => {
    currentEmojiIdRef.current = currentEmojiId;
  }, [currentEmojiId]);

  useEffect(() => {
    emojiRotationRef.current = emojiRotation;
  }, [emojiRotation]);

  // Computed texts array that includes editing changes and move changes
  const displayTexts = useMemo(() => {
    console.log('displayTexts recomputing, emojiRotation:', emojiRotation, 'currentEmojiId:', currentEmojiId, 'editingTextChanges:', editingTextChanges);
    const result = texts.map(t => {
      // Apply editing changes (text, color, size, position)
      if (editingTextChanges?.id === t.id) {
        console.log('Applying editingTextChanges to', t.id, editingTextChanges);
        const changes = { ...t, ...editingTextChanges };
        // ALSO apply temporary rotation if this is a selected emoji
        if (t.isEmoji && t.id === currentEmojiId && emojiRotation !== undefined) {
          console.log('ALSO applying rotation to edited emoji:', emojiRotation);
          changes.rotation = emojiRotation;
        }
        return changes;
      }
      // Apply move changes (only for non-edited texts)
      if (movingElement?.type === 'text' && movingElement.id === t.id && !editingTextChanges) {
        return { ...t, x: movingElement.x, y: movingElement.y };
      }
      // Apply temporary rotation for selected emoji ONLY
      console.log("rotation change?", t.id, t.isEmoji, currentEmojiId, emojiRotation)
      if (t.isEmoji && t.id === currentEmojiId && emojiRotation != undefined) {
        console.log("rotation change!", emojiRotation)
        return { ...t, rotation: emojiRotation };
      }
      return t;
    });

    // If editingTextChanges has a text not in the queue yet (brand new), add it
    if (editingTextChanges && !texts.find(t => t.id === editingTextChanges.id)) {
      result.push(editingTextChanges as SketchText);
    }

    return result;
  }, [texts, editingTextChanges, movingElement, currentEmojiId, emojiRotation]);

  // Computed images array that includes move/resize changes
  // Also converts relative imagePath to absolute URI for rendering
  const displayImages = useMemo(() => {
    return images.map(img => {
      // Convert relative path to absolute file URI
      const absolutePath = AttachmentService.getAbsolutePath(albumId, img.imagePath);
      const imageUri = `file://${absolutePath}`;

      if (movingElement && (movingElement.type === 'image-move' || movingElement.type === 'image-resize') && movingElement.id === img.id) {
        return {
          ...img,
          imageUri, // Add URI for rendering
          x: movingElement.x,
          y: movingElement.y,
          ...(movingElement.width !== undefined && { width: movingElement.width }),
          ...(movingElement.height !== undefined && { height: movingElement.height }),
        };
      }
      return {
        ...img,
        imageUri, // Add URI for rendering
      };
    });
  }, [images, movingElement, albumId]);

  // Use ref to avoid closure issues in callbacks
  const currentElementTypeRef = useRef<ElementTypes>(ElementTypes.Sketch);

  // Drawing settings
  const [sketchColor, setSketchColor] = useState('#333333');
  const [sketchStrokeWidth, setSketchStrokeWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false); // Track if pen is in eraser mode
  const [textColor, setTextColor] = useState('#333333');
  const [textSize, setTextSize] = useState(20);
  const [showToolOptions, setShowToolOptions] = useState(false); // Track if tool options panel is visible
  const [textMode, setTextMode] = useState<'title' | 'body'>('body'); // Track if editing title or body
  const [audioMode, setAudioMode] = useState(false); // Track if audio mode is active
  const [isRecording, setIsRecording] = useState(false); // Track if currently recording audio

  // Hardcoded element IDs
  const TITLE_TEXT_ID = 'page_title_text';
  const BODY_TEXT_ID = 'page_body_text';
  const PAGE_AUDIO_ID = 'page_audio';

  // Animation for sliding panel
  const slideAnim = useRef(new Animated.Value(240)).current; // Start off-screen (width + offset)

  // Sync isEraser ref (must be after isEraser state declaration)
  useEffect(() => {
    isEraserRef.current = isEraser;
    console.log('isEraser state changed:', isEraser, 'ref updated to:', isEraserRef.current);
  }, [isEraser]);

  // Sync sketch color and stroke width refs (must be after state declarations)
  useEffect(() => {
    console.log('[Ref sync] sketchColor changed to:', sketchColor);
    sketchColorRef.current = sketchColor;
  }, [sketchColor]);

  useEffect(() => {
    console.log('[Ref sync] sketchStrokeWidth changed to:', sketchStrokeWidth);
    sketchStrokeWidthRef.current = sketchStrokeWidth;
  }, [sketchStrokeWidth]);

  // Cleanup audio on unmount only
  useEffect(() => {
    return () => {
      // Only cleanup if component is unmounting, not on every isRecording change
      Sound.stopRecorder().catch(() => { }); // Ignore errors if no recorder
      Sound.removeRecordBackListener();
      Sound.stopPlayer().catch(() => { }); // Ignore errors if no player
      Sound.removePlayBackListener();
    };
  }, []); // Empty deps - only run on mount/unmount

  // Animate tool options panel
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: showToolOptions ? 0 : 240,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [showToolOptions, slideAnim]);

  // Auto-open tool options when emoji is selected
  useEffect(() => {
    if (currentEmojiId) {
      setShowToolOptions(true);
    }
  }, [currentEmojiId]);

  // Color presets
  const COLORS = ['#000000', '#333333', '#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#FF00FF', '#00FFFF'];
  const ERASER_COLOR = '#ERASER'; // Special marker for eraser
  const PEN_SIZES = [2, 3, 5, 8];
  const TITLE_TEXT_SIZES = [28, 36, 48, 64];
  const BODY_TEXT_SIZES = [16, 20, 24, 28];
  const EMOJI_PRESET_SIZES = [70, 100, 130]; // Preset emoji sizes (S/M/L)
  const EMOJI_SIZE_STEP = 10; // Step for +/- adjustments

  // Calculate available space for canvas (subtracting toolbar width from the right and margins)
  const availableWidth = screenDimensions.width - TOOLBAR_WIDTH - CANVAS_MARGIN * 2;
  const availableHeight = screenDimensions.height - HEADER_HEIGHT - CANVAS_MARGIN * 2;

  // Get original page dimensions (screen dimensions when page was created)
  const v2Page = page as AlbumPageV2;
  const pageWidth = v2Page.canvasWidth || screenDimensions.width;
  const pageHeight = v2Page.canvasHeight || screenDimensions.height;

  // Calculate ratio (scale) to fit page dimensions into available space
  const ratioX = availableWidth / pageWidth;
  const ratioY = availableHeight / pageHeight;
  const ratio = Math.min(ratioX, ratioY, 1); // Don't scale up, only down

  console.log('[PageEditorScreen] Ratio calculation:', {
    screenWidth: screenDimensions.width,
    screenHeight: screenDimensions.height,
    availableWidth,
    availableHeight,
    pageWidth,
    pageHeight,
    ratioX,
    ratioY,
    finalRatio: ratio,
  });

  // Calculate actual canvas size (scaled dimensions)
  const canvasWidth = pageWidth * ratio;
  const canvasHeight = pageHeight * ratio;



  // Absolute sideMargin for screen2Canvas calculation:
  // TOOLBAR_WIDTH + container padding + canvas marginLeft
  const sideMargin = CANVAS_MARGIN + insets.left;

  // Canvas top position: header + safe area + container padding
  const canvasTop = HEADER_HEIGHT + CANVAS_MARGIN + insets.top;

  // console.log('Render calculations:', {
  //   screenWidth: SCREEN_WIDTH,
  //   screenHeight: SCREEN_HEIGHT,
  //   toolbarWidth: TOOLBAR_WIDTH,
  //   headerHeight: HEADER_HEIGHT,
  //   insetsBottom: insets.bottom,
  //   availableWidth,
  //   availableHeight,
  //   pageWidth,
  //   pageHeight,
  //   ratio,
  //   canvasWidth,
  //   canvasHeight,
  //   sideMargin,
  //   canvasTop
  // });

  // Keep offset stable - use ref to prevent re-renders
  const canvasOffsetRef = useRef({ x: 0, y: 0 });

  // Load initial page data into queue and state
  useEffect(() => {
    queue.current.clear();
    const v2Page = page as AlbumPageV2;

    if (v2Page.version === '2.0' && v2Page.elements) {
      // Load from queue
      for (const elem of v2Page.elements) {
        queue.current.add(elem);
      }

      // Build state from queue (including background pattern)
      rebuildStateFromQueue();
    } else {
      // Initialize with background if needed
      if (page.backgroundPath) {
        queue.current.add({ type: 'background', elem: { path: page.backgroundPath } });
      }
      setBackgroundPattern(undefined);
    }
  }, [page.id]);

  // Rebuild paths/texts/images/audios arrays from queue using shared utility
  const rebuildStateFromQueue = () => {
    const queueElements = queue.current.getAll();
    console.log('rebuildStateFromQueue - raw queue:', JSON.stringify(queueElements, null, 2));

    const {
      paths: rebuiltPaths,
      texts: rebuiltTexts,
      images: rebuiltImages,
      audios: rebuiltAudios,
      backgroundPattern: rebuiltBackgroundPattern
    } = compileQueueToElements(queueElements);

    // Log emoji rotations
    console.log('rebuildStateFromQueue - rebuiltTexts emojis:', rebuiltTexts.filter(t => t.isEmoji).map(t => ({ id: t.id, rotation: t.rotation })));

    setPaths(rebuiltPaths);
    setTexts(rebuiltTexts);
    setImages(rebuiltImages);
    setBackgroundPattern(rebuiltBackgroundPattern);

    // Extract page-level audio (hardcoded ID)
    const pageAudio = rebuiltAudios.find(a => a.id === PAGE_AUDIO_ID);
    setPageAudioFile(pageAudio?.audioPath);
    setPageAudioWordTimings(pageAudio?.wordTimings || []);

    // Extract and convert duration from milliseconds to seconds
    if (pageAudio?.duration !== undefined) {
      setPageAudioDuration(pageAudio.duration / 1000);
    } else {
      setPageAudioDuration(undefined);
    }

    // Other audios are not used anymore (we only have one page audio)
    setAudios([]);
  };

  // Auto-save to disk without closing editor (for during-edit saves like image moves)
  const autoSave = async () => {
    // Mark page as modified for thumbnail generation
    pageModifiedRef.current = true;
    console.log('[PageEditorScreen] autoSave called, pageModifiedRef set to true');

    const savedPage: AlbumPageV2 = {
      id: page.id,
      pageNumber: page.pageNumber,
      backgroundPath: page.backgroundPath,
      version: '2.0',
      elements: queue.current.getAll(),
      canvasWidth: pageWidth,
      canvasHeight: pageHeight,
    };

    try {
      await PageService.updatePage(albumId, savedPage);
      console.log('Auto-saved page to disk');
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  const handleBack = async () => {
    console.log('[PageEditorScreen] handleBack called');
    console.log('[PageEditorScreen] page.pageNumber:', page.pageNumber);
    console.log('[PageEditorScreen] pageModifiedRef.current:', pageModifiedRef.current);

    // Save currently edited text before exiting
    if (currentEdited.textId) {
      const text = displayTexts.find(t => t.id === currentEdited.textId);
      if (text) {
        queue.current.pushText(text);
      }
    }

    // Clear undo queue to delete unreachable attachments
    await queue.current.clearUndo();

    // Build saved page data
    const savedPage: AlbumPageV2 = {
      id: page.id,
      pageNumber: page.pageNumber,
      backgroundPath: page.backgroundPath,
      version: '2.0',
      elements: queue.current.getAll(),
      canvasWidth: pageWidth,
      canvasHeight: pageHeight,
    };

    // Now save and exit (thumbnail will be generated by AlbumScreen)
    onSave(savedPage, true);
  };

  // Page navigation helpers
  const currentPageIndex = pages ? pages.findIndex(p => p.id === page.id) : -1;
  const hasPrevPage = currentPageIndex > 0;
  const hasNextPage = pages && currentPageIndex < pages.length - 1;

  const handlePrevPage = () => {
    if (!pages || !onNavigatePage || !hasPrevPage) return;

    // Clear undo queue to delete unreachable attachments
    queue.current.clearUndo();

    // Save current page before navigating
    const savedPage: AlbumPageV2 = {
      id: page.id,
      pageNumber: page.pageNumber,
      backgroundPath: page.backgroundPath,
      version: '2.0',
      elements: queue.current.getAll(),
      canvasWidth: pageWidth,
      canvasHeight: pageHeight,
    };
    onSave(savedPage);

    onNavigatePage(pages[currentPageIndex - 1].id);
  };

  const handleNextPage = () => {
    if (!pages || !onNavigatePage || !hasNextPage) return;

    // Clear undo queue to delete unreachable attachments
    queue.current.clearUndo();

    // Save current page before navigating
    const savedPage: AlbumPageV2 = {
      id: page.id,
      pageNumber: page.pageNumber,
      backgroundPath: page.backgroundPath,
      version: '2.0',
      elements: queue.current.getAll(),
      canvasWidth: pageWidth,
      canvasHeight: pageHeight,
    };
    onSave(savedPage);

    onNavigatePage(pages[currentPageIndex + 1].id);
  };

  const handleNewPage = () => {
    if (!onCreatePage) return;

    // Clear undo queue to delete unreachable attachments
    queue.current.clearUndo();

    // Save current page before creating new one
    const savedPage: AlbumPageV2 = {
      id: page.id,
      pageNumber: page.pageNumber,
      backgroundPath: page.backgroundPath,
      version: '2.0',
      elements: queue.current.getAll(),
      canvasWidth: pageWidth,
      canvasHeight: pageHeight,
    };
    onSave(savedPage);

    onCreatePage();
  };

  const handleDeletePage = () => {
    if (!onDeletePage) return;

    // Show confirmation dialog
    Alert.alert(
      'מחיקת עמוד',
      'האם אתה בטוח שברצונך למחוק את העמוד? פעולה זו לא ניתנת לביטול.',
      [
        {
          text: 'ביטול',
          style: 'cancel',
        },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: () => {
            // Call the delete handler
            onDeletePage();
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleUndo = () => {
    // Save any pending text edits before undo
    if (currentEdited.textId || editingTextChanges) {
      const textId = currentEdited.textId || editingTextChanges?.id;
      if (textId) {
        handleTextEditEnd(textId);
        setCurrentEdited({});
      }
    }

    if (queue.current.undo()) {
      rebuildStateFromQueue();

      // If an emoji is selected, reload its rotation from the undone state
      const currentId = currentEmojiIdRef.current;
      if (currentId) {
        const emoji = textsRef.current.find(t => t.id === currentId);
        setEmojiRotation(emoji?.rotation);
      }

      // Auto-save after undo
      autoSave();
    }
  };

  const handleRedo = () => {
    // Save any pending text edits before redo
    if (currentEdited.textId || editingTextChanges) {
      const textId = currentEdited.textId || editingTextChanges?.id;
      if (textId) {
        handleTextEditEnd(textId);
        setCurrentEdited({});
      }
    }

    if (queue.current.redo()) {
      rebuildStateFromQueue();

      // If an emoji is selected, reload its rotation from the redone state
      const currentId = currentEmojiIdRef.current;
      if (currentId) {
        const emoji = textsRef.current.find(t => t.id === currentId);
        setEmojiRotation(emoji?.rotation);
      }

      // Auto-save after redo
      autoSave();
    }
  };

  // Canvas callbacks
  const handleSketchEnd = (commands?: PathCommand[]) => {
    if (commands && commands.length > 0) {
      const isEraserMode = isEraserRef.current;
      const currentColor = sketchColorRef.current;
      const currentStrokeWidth = sketchStrokeWidthRef.current;

      console.log('[handleSketchEnd] Path received:', {
        commandsCount: commands.length,
        firstCommand: commands[0],
        lastCommand: commands[commands.length - 1],
        ratio,
        pageWidth,
        pageHeight,
        canvasWidth,
        canvasHeight,
      });

      console.log('[handleSketchEnd] Current values:', {
        isEraserMode,
        currentColor,
        currentStrokeWidth,
        sketchColorState: sketchColor,
        sketchStrokeWidthState: sketchStrokeWidth,
      });

      const pathElem: SketchPath = {
        id: getId('path'),
        points: commands,
        color: isEraserMode ? '#00000000' : currentColor, // Transparent for eraser
        strokeWidth: isEraserMode ? 20 : currentStrokeWidth, // Wider stroke for eraser
        isMarker: isEraserMode,
      };

      console.log('Saving path to queue:', { isEraser: isEraserMode, color: pathElem.color, strokeWidth: pathElem.strokeWidth, pointsCount: commands.length });

      queue.current.pushPath(pathElem);
      rebuildStateFromQueue();
      autoSave();
    }
  };

  // Update ref whenever function changes
  handleSketchEndRef.current = handleSketchEnd;

  // Stable callback that calls through the ref
  const handleSketchEndStable = useCallback((commands?: PathCommand[]) => {
    handleSketchEndRef.current?.(commands);
  }, []);

  const handleTextChanged = (id: string, newText: string) => {
    // Track text content change
    console.log('handleTextChanged:', { id, newText });
    setEditingTextChanges(prev => prev?.id === id ? { ...prev, text: newText } : { id, text: newText });
  };

  const handleTextEditEnd = (id: string) => {
    // Save all accumulated changes to queue when editing ends
    const currentChanges = editingTextChangesRef.current;

    console.log('handleTextEditEnd START:', {
      id,
      currentChanges
    });

    if (!currentChanges || currentChanges.id !== id) {
      console.log('No changes to save for', id);
      return;
    }

    // Find the LATEST version of the text from the queue (iterate backwards)
    const queueElems = queue.current.getAll();
    let baseText: SketchText | undefined;

    // Search backwards to get the latest version
    for (let i = queueElems.length - 1; i >= 0; i--) {
      if (queueElems[i].type === 'text' && queueElems[i].elem?.id === id) {
        baseText = queueElems[i].elem;
        console.log('Found latest text in queue at index', i, baseText);
        break;
      }
    }

    let textToSave: SketchText;

    // If not in queue, it's a brand new text - the changes ARE the complete text
    if (!baseText) {
      console.log('New text not in queue yet, using editingTextChanges as complete text');
      textToSave = currentChanges as SketchText;
    } else {
      // Merge changes with base text from queue
      console.log('Merging changes with base text from queue');
      textToSave = { ...baseText, ...currentChanges };
    }

    // Enforce center alignment for title
    if (id === TITLE_TEXT_ID) {
      textToSave.alignment = 'Center';
    }

    console.log('handleTextEditEnd: saving text', {
      id,
      baseText,
      changes: currentChanges,
      textToSave
    });

    queue.current.pushText(textToSave);

    console.log('QUEUE AFTER PUSH:', {
      totalElements: queue.current.getAll().length,
      queue: queue.current.getAll().map((qe, idx) => ({
        index: idx,
        type: qe.type,
        id: qe.elem?.id,
        text: qe.type === 'text' ? qe.elem?.text : undefined
      }))
    });

    setEditingTextChanges(null);
    rebuildStateFromQueue();
  };

  const handleCanvasClick = (p: SketchPoint, elem: any) => {
    console.log('========== handleCanvasClick ==========');
    console.log('handleCanvasClick', { mode: currentElementTypeRef.current, p, elem: elem?.id, currentEditedBefore: currentEditedRef.current });
    console.log('currentEdited (ref):', currentEditedRef.current);
    console.log('editingTextChanges (ref):', editingTextChangesRef.current);

    // Save currently edited text before any action (regardless of mode)
    // Use refs to avoid closure issues
    const textToSave = currentEditedRef.current.textId || editingTextChangesRef.current?.id;
    if (textToSave) {
      console.log('Calling handleTextEditEnd for:', textToSave);
      handleTextEditEnd(textToSave);
      // Only clear currentEdited if we're not in image mode
      // In image mode, we want to preserve the image selection
      if (currentElementTypeRef.current !== ElementTypes.Image) {
        setCurrentEdited({});
      }
    }

    if (currentElementTypeRef.current === ElementTypes.Text) {
      if (!elem) {
        // In new text flow, clicking canvas does nothing
        // User must click Title or Body button in toolbar
        return;
      } else if (elem.id === TITLE_TEXT_ID || elem.id === BODY_TEXT_ID) {
        // Edit existing title or body text
        console.log('Editing existing text:', elem.id);
        setCurrentEdited({ textId: elem.id });
        setTextMode(elem.id === TITLE_TEXT_ID ? 'title' : 'body');
      }
    } else if (currentElementTypeRef.current === ElementTypes.Image && elem) {
      const newCurrEdited = { ...currentEditedRef.current, imageId: elem.id }
      currentEditedRef.current = newCurrEdited
      setCurrentEdited(newCurrEdited);
    }
  };

  // When switching to text mode, create first text element if none exist
  const handleSetTextMode = () => {
    setCurrentElementType(ElementTypes.Text);
    currentElementTypeRef.current = ElementTypes.Text;
    setShowToolOptions(true);
    setAudioMode(false); // Exit audio mode

    // Don't auto-create text when switching to text mode
    // Text will be created/edited when user clicks title or body button in options
  };

  const handleEditTitle = () => {
    // Save current text before switching
    if (currentEdited.textId) {
      handleTextEditEnd(currentEdited.textId);
    }

    setTextMode('title');
    const existingTitle = texts.find(t => t.id === TITLE_TEXT_ID);

    if (existingTitle) {
      // Edit existing title - ensure it has center alignment
      // Update alignment if needed
      if (existingTitle.alignment !== 'Center') {
        setEditingTextChanges({
          id: TITLE_TEXT_ID,
          alignment: 'Center',
        });
      }
      setCurrentEdited({ textId: TITLE_TEXT_ID });
      setTextSize(existingTitle.fontSize);
      setTextColor(existingTitle.color);
    } else {
      // Create new title at top center
      const centerX = canvasWidth / 2 - 100;
      const topY = 50;
      const defaultTitleSize = 72;

      const newTitle: SketchText = {
        id: TITLE_TEXT_ID,
        text: '',
        fontSize: defaultTitleSize,
        color: textColor,
        rtl: false,
        alignment: 'Center',
        x: centerX,
        y: topY,
        width: 200,
        height: 80,
      };

      setEditingTextChanges(newTitle);
      setCurrentEdited({ textId: TITLE_TEXT_ID });
      setTextSize(defaultTitleSize);
    }
  };

  const handleEditBody = () => {
    // Save current text before switching
    if (currentEdited.textId) {
      handleTextEditEnd(currentEdited.textId);
    }

    setTextMode('body');
    const existingBody = texts.find(t => t.id === BODY_TEXT_ID);

    if (existingBody) {
      // Edit existing body
      setCurrentEdited({ textId: BODY_TEXT_ID });
      setTextSize(existingBody.fontSize);
      setTextColor(existingBody.color);
    } else {
      // Create new body text in center
      const centerX = canvasWidth / 2 - 100;
      const centerY = canvasHeight / 2 - 50;
      const defaultBodySize = 20;

      const newBody: SketchText = {
        id: BODY_TEXT_ID,
        text: '',
        fontSize: defaultBodySize,
        color: textColor,
        rtl: false,
        alignment: 'Left',
        x: centerX,
        y: centerY,
        width: 200,
        height: 100,
      };

      setEditingTextChanges(newBody);
      setCurrentEdited({ textId: BODY_TEXT_ID });
      setTextSize(defaultBodySize);
    }
  };

  const handleSetSketchMode = () => {
    // Save currently edited text before switching modes
    if (currentEdited.textId) {
      handleTextEditEnd(currentEdited.textId);
      setCurrentEdited({});
    }

    console.log('[handleSetSketchMode] Setting sketch mode, showToolOptions will be:', true);
    setCurrentElementType(ElementTypes.Sketch);
    currentElementTypeRef.current = ElementTypes.Sketch;
    setShowToolOptions(true);
    setAudioMode(false); // Exit audio mode
  };

  const handleSetImageMode = () => {
    // Save currently edited text before switching modes
    if (currentEdited.textId) {
      handleTextEditEnd(currentEdited.textId);
      setCurrentEdited({});
    }

    setCurrentElementType(ElementTypes.Image);
    currentElementTypeRef.current = ElementTypes.Image;
    setShowToolOptions(true);
    setAudioMode(false); // Exit audio mode
  };

  const handleSetEmojiMode = () => {
    // Save currently edited text before switching modes
    if (currentEdited.textId) {
      handleTextEditEnd(currentEdited.textId);
      setCurrentEdited({});
    }

    setCurrentElementType(ElementTypes.Emoji);
    currentElementTypeRef.current = ElementTypes.Emoji;
    setShowToolOptions(true);
    setAudioMode(false); // Exit audio mode

    // Open emoji keyboard immediately
    setShowEmojiKeyboard(true);
  };

  const handleSetAudioMode = () => {
    // Save currently edited text before switching modes
    if (currentEdited.textId) {
      handleTextEditEnd(currentEdited.textId);
      setCurrentEdited({});
    }

    // Show audio options in toolbar
    setAudioMode(true);
    setShowToolOptions(true);

    // Clear current element type so no other tool appears active
    setCurrentElementType(ElementTypes.Text); // Use Text as neutral since it won't show options in audio mode
    currentElementTypeRef.current = ElementTypes.Text;
  };

  const handleSetBackgroundMode = () => {
    // Save currently edited text before switching modes
    if (currentEdited.textId) {
      handleTextEditEnd(currentEdited.textId);
      setCurrentEdited({});
    }

    setCurrentElementType(ElementTypes.Background);
    currentElementTypeRef.current = ElementTypes.Background;
    setShowToolOptions(true);
    setAudioMode(false); // Exit audio mode
  };

  const checkAudioPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        ]);

        if (
          grants['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED &&
          grants['android.permission.WRITE_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED &&
          grants['android.permission.READ_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED
        ) {
          return true;
        } else {
          Alert.alert('הרשאות', 'יש לאפשר הרשאות הקלטה ושמירת קבצים');
          return false;
        }
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const handleStartRecording = async () => {
    const hasPermission = await checkAudioPermissions();
    if (!hasPermission) return;

    try {
      const audioConfig = {
        AudioSamplingRate: 44100,
        AudioEncodingBitRate: 128000,
        AudioChannels: 1,
      };

      await Sound.startRecorder(undefined, audioConfig, true);
      Sound.addRecordBackListener((e) => {
        console.log('Recording progress:', e.currentPosition);
      });
      setIsRecording(true);
      console.log('Recording started from toolbar');
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('שגיאה', 'ההקלטה נכשלה');
    }
  };

  const handleStopRecording = async () => {
    if (!isRecording) return;

    try {
      const result = await Sound.stopRecorder();
      Sound.removeRecordBackListener();
      setIsRecording(false);
      console.log('Recording stopped, file:', result);

      // Get audio duration by playing it briefly
      let duration: number | undefined;
      try {
        console.log('[handleStopRecording] Attempting to get audio duration from file:', result);
        const filePath = result.startsWith('file://') ? result : `file://${result}`;

        // Add small delay to ensure recorder is fully stopped
        await new Promise<void>(resolve => setTimeout(() => resolve(), 200));

        await Sound.startPlayer(filePath);

        // Wait for duration info
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.log('[handleStopRecording] Timeout reached, duration not obtained');
            resolve();
          }, 2000); // Increase timeout to 2 seconds

          Sound.addPlayBackListener((e) => {
            if (e.duration > 0) {
              duration = e.duration / 1000; // Convert to seconds
              console.log('[handleStopRecording] Duration obtained:', duration, 'seconds');
              clearTimeout(timeout);
              resolve();
            }
          });
        });

        await Sound.stopPlayer();
        Sound.removePlayBackListener();
      } catch (error) {
        console.error('Failed to get audio duration:', error);
      }

      console.log('[handleStopRecording] Final duration value:', duration);

      // Auto-generate word mapping heuristics if there's title text
      // Use ref to avoid stale closure
      const titleText = textsRef.current.find(t => t.id === TITLE_TEXT_ID);
      let wordTimings: WordTiming[] | undefined;

      if (titleText && titleText.text && duration) {
        console.log('[handleStopRecording] Auto-generating word mappings for title text');
        const words = titleText.text.split(/\s+/).filter(w => w.length > 0);
        wordTimings = generateInitialWordTimings(words, duration);
        console.log('[handleStopRecording] Auto-generated word mappings:', wordTimings);
      }

      // Save the audio file with duration and word timings
      await handleUpdatePageAudio(result, duration, wordTimings);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('שגיאה', 'עצירת ההקלטה נכשלה');
    }
  };

  const handlePlayAudio = async () => {
    // Use refs to avoid stale closure
    const currentFile = pageAudioFileRef.current;
    if (!currentFile) return;

    try {
      // Convert relative path to absolute
      const absolutePath = AttachmentService.getAbsolutePath(albumId, currentFile);
      const filePath = `file://${absolutePath}`;
      console.log('Playing audio from toolbar:', filePath);
      await Sound.startPlayer(filePath);
      Sound.addPlayBackListener((e) => {
        if (e.currentPosition >= e.duration && e.duration > 0) {
          Sound.stopPlayer().catch(console.error);
          Sound.removePlayBackListener();
        }
      });
    } catch (error) {
      console.error('Failed to play audio:', error);
      Alert.alert('שגיאה', 'הפעלת ההקלטה נכשלה');
    }
  };

  const handleUpdatePageAudio = async (filePath: string, duration?: number, wordTimings?: WordTiming[]) => {
    console.log('handleUpdatePageAudio - source file:', filePath, 'duration:', duration, 'wordTimings:', wordTimings?.length);

    try {
      // Save audio to attachments directory and get relative path
      const relativePath = await AttachmentService.saveAudioAttachment(albumId, filePath);
      console.log('Audio saved to:', relativePath);

      // Update page audio file and duration with relative path
      setPageAudioFile(relativePath);
      if (duration !== undefined) {
        setPageAudioDuration(duration);
      }

      // Use provided word timings or current ones from ref
      const timingsToUse = wordTimings || pageAudioWordTimingsRef.current;

      // Save to queue with hardcoded ID and relative path
      const pageAudio: SketchAudio = {
        id: PAGE_AUDIO_ID,
        audioPath: relativePath, // Store relative path
        x: 0, // Position doesn't matter for page audio
        y: 0,
        duration: duration !== undefined ? duration * 1000 : undefined, // Store in milliseconds
        wordTimings: timingsToUse.length > 0 ? timingsToUse : undefined,
      };

      queue.current.pushAudio(pageAudio);
      rebuildStateFromQueue();

      // Auto-save to disk
      await autoSave();

      console.log('Page audio saved to queue:', pageAudio);
    } catch (error) {
      console.error('Failed to save audio attachment:', error);
      Alert.alert('שגיאה', 'שמירת ההקלטה נכשלה');
    }
  };

  const handleOpenWordMapping = () => {
    setShowWordMappingModal(true);
  };

  const handleWordTimingsChange = async (wordTimings: WordTiming[]) => {
    console.log('handleWordTimingsChange:', wordTimings);

    // Use refs to avoid closure trap
    const currentFile = pageAudioFileRef.current;
    const currentDuration = pageAudioDurationRef.current;

    if (!currentFile) {
      console.error('No audio file to update');
      return;
    }

    // Update the audio in queue with word timings (currentFile is already relative path)
    const pageAudio: SketchAudio = {
      id: PAGE_AUDIO_ID,
      audioPath: currentFile, // Already a relative path
      x: 0,
      y: 0,
      duration: currentDuration !== undefined ? currentDuration * 1000 : undefined, // Store in milliseconds
      wordTimings,
    };

    queue.current.pushAudio(pageAudio);
    rebuildStateFromQueue();

    // Auto-save to disk
    await autoSave();
  };

  const handleDeletePageAudio = async () => {
    console.log('handleDeletePageAudio');

    // Delete the audio from queue
    queue.current.pushDeleteAudio({ id: PAGE_AUDIO_ID });
    rebuildStateFromQueue();

    // Auto-save to disk
    await autoSave();

    // Close modal
    setShowWordMappingModal(false);
  };

  const handleReRecordFromWordMapping = async () => {
    setShowWordMappingModal(false);
    // Clear current audio and start recording
    await handleClearPageAudio();
    await handleStartRecording();
  };

  const handleClearPageAudio = async () => {
    // Stop any playing audio first
    try {
      await Sound.stopPlayer();
      Sound.removePlayBackListener();
    } catch (error) {
      // Ignore if not playing
      console.log('No audio playing to stop');
    }

    // Remove from queue
    queue.current.pushDeleteAudio({ id: PAGE_AUDIO_ID });

    // Rebuild state from queue (this will clear pageAudioFile)
    rebuildStateFromQueue();

    // Auto-save to disk
    await autoSave();
  };

  const handleApplyBackground = async (pattern: BackgroundPattern | undefined) => {
    // Push background pattern to queue (undefined to clear)
    queue.current.pushBackgroundPattern({ pattern });

    // Rebuild state from queue (this will update backgroundPattern state)
    rebuildStateFromQueue();

    // Auto-save to disk
    await autoSave();
  };

  const handleEmojiPick = (emojiObject: EmojiType) => {
    // Create emoji as a text element with large font size
    const emojiId = getId('text'); // Use 'text' prefix so canvas treats it as text
    const emojiSize = 100; // Default emoji size (M)

    const newEmoji: SketchText = {
      id: emojiId,
      text: emojiObject.emoji,
      fontSize: emojiSize,
      color: '#000000', // Color doesn't matter for emojis
      rtl: false,
      alignment: 'Left',
      x: canvasWidth / 2 - 50, // Center horizontally
      y: canvasHeight / 2 - 50, // Center vertically
      isEmoji: true, // Mark as emoji for special handling
      width: emojiSize * 1.2, // Set width for hit detection (emojis are ~1.2x fontSize)
      height: emojiSize * 1.2, // Set height for hit detection
    };

    // Add to queue
    queue.current.pushText(newEmoji);
    rebuildStateFromQueue();

    // Auto-save
    autoSave();

    // Close emoji keyboard
    setShowEmojiKeyboard(false);
  };

  const handleOpenEmojiKeyboard = () => {
    setShowEmojiKeyboard(true);
  };

  const handleEmojiClick = (emojiId: string) => {
    // Switch to emoji mode when clicking an emoji
    setCurrentElementType(ElementTypes.Emoji);
    currentElementTypeRef.current = ElementTypes.Emoji;
    setShowToolOptions(true);
    setAudioMode(false);

    // Toggle selection - use ref to avoid stale closure
    if (currentEmojiIdRef.current === emojiId) {
      setCurrentEmojiId(null);
    } else {
      setCurrentEmojiId(emojiId);
      // Load current rotation from the base texts array (which comes from queue)
      // Use ref to avoid stale closure after emoji moves
      const emoji = textsRef.current.find(t => t.id === emojiId);
      setEmojiRotation(emoji?.rotation);
    }
  };

  const handleEmojiRotationChange = (rotation: number) => {
    // Update temporary rotation state for preview
    console.log("rotation slider change", rotation)
    setEmojiRotation(rotation);
  };

  const handleEmojiRotationEnd = () => {
    // Save rotation to queue when user releases slider
    const currentId = currentEmojiIdRef.current;
    const rotation = emojiRotationRef.current;

    if (!currentId) return;

    // Get the base emoji from texts (not displayTexts) to preserve all original properties
    const emoji = textsRef.current.find(t => t.id === currentId);
    if (!emoji) return;

    console.log('handleEmojiRotationEnd - saving emoji:', emoji.id, 'old rotation:', emoji.rotation, 'new rotation:', rotation);
    const updatedEmoji = { ...emoji, rotation };
    console.log('handleEmojiRotationEnd - updatedEmoji:', JSON.stringify(updatedEmoji, null, 2));
    queue.current.pushText(updatedEmoji);
    rebuildStateFromQueue();

    // Check what we got after rebuild
    const rebuiltEmoji = textsRef.current.find(t => t.id === currentId);
    console.log('handleEmojiRotationEnd - after rebuild, emoji rotation:', rebuiltEmoji?.rotation);

    autoSave();

    // IMPORTANT: Clear temporary rotation state after committing to queue
    // The queue now owns the rotation value, not the component state
    // This ensures undo/redo works correctly
    //setEmojiRotation(0);
  };

  const handleEmojiDelete = () => {
    const currentId = currentEmojiIdRef.current;
    if (!currentId) return;

    // Push delete action to queue (undoable)
    queue.current.pushTextDelete(currentId);
    rebuildStateFromQueue();
    setCurrentEmojiId(null);
    autoSave();
  };

  const handleEmojiResize = (newSize: number) => {
    const currentId = currentEmojiIdRef.current;
    if (!currentId) return;

    const emoji = textsRef.current.find(t => t.id === currentId);
    if (!emoji) return;

    const updatedEmoji = {
      ...emoji,
      fontSize: newSize,
      width: newSize * 1.2, // Update width for hit detection
      height: newSize * 1.2, // Update height for hit detection
    };

    queue.current.pushText(updatedEmoji);
    rebuildStateFromQueue();
    autoSave();
  };

  const handleEmojiAdjustSize = (delta: number) => {
    const currentId = currentEmojiIdRef.current;
    if (!currentId) return;

    const emoji = textsRef.current.find(t => t.id === currentId);
    if (!emoji) return;

    // Adjust size with min bound (10), no max bound
    const newSize = Math.max(10, emoji.fontSize + delta);
    const updatedEmoji = { ...emoji, fontSize: newSize };

    queue.current.pushText(updatedEmoji);
    rebuildStateFromQueue();
    autoSave();
  };


  const handleAddImage = async () => {
    try {
      setLoadingImagePicker(true);
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
      });

      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];

        if (!asset.uri) {
          console.error('No URI in asset');
          return;
        }

        try {
          // Save image to attachments directory and get relative path
          const relativePath = await AttachmentService.saveImageAttachment(albumId, asset.uri);

          const imageId = getId('image');
          const aspectRatio = (asset.width && asset.height) ? asset.width / asset.height : 1;

          // Set image to 45% of canvas width
          const imageWidth = canvasWidth * 0.45;
          const imageHeight = imageWidth / aspectRatio;

          const newImage: SketchImage = {
            id: imageId,
            imagePath: relativePath, // Store relative path
            x: canvasWidth / 2 - imageWidth / 2,
            y: canvasHeight / 2 - imageHeight / 2,
            width: imageWidth,
            height: imageHeight,
            aspectRatio: aspectRatio,
          };

          console.log('Adding new image to queue:', { id: imageId, imagePath: relativePath });

          // Commit full image to queue
          queue.current.pushImage(newImage);

          console.log('Queue after pushImage:', queue.current.getAll().length, 'elements');

          rebuildStateFromQueue();

          // Auto-save to disk without closing editor
          await autoSave();

          // Set as currently edited to show handles
          setCurrentEdited({ imageId: imageId });
        } catch (error) {
          console.error('Failed to save image attachment:', error);
          Alert.alert('שגיאה', 'שמירת התמונה נכשלה');
        }
      }
    } finally {
      setLoadingImagePicker(false);
    }
  };

  const handleCameraCapture = async (uri: string) => {
    try {
      setShowCameraModal(false);

      // Save image to attachments directory and get relative path
      const relativePath = await AttachmentService.saveImageAttachment(albumId, uri);

      // Get image dimensions (we'll use a default aspect ratio for camera photos)
      const aspectRatio = 4 / 3; // Standard camera aspect ratio

      const imageId = getId('image');

      // Set image to 45% of canvas width
      const imageWidth = canvasWidth * 0.45;
      const imageHeight = imageWidth / aspectRatio;

      const newImage: SketchImage = {
        id: imageId,
        imagePath: relativePath,
        x: canvasWidth / 2 - imageWidth / 2,
        y: canvasHeight / 2 - imageHeight / 2,
        width: imageWidth,
        height: imageHeight,
        aspectRatio: aspectRatio,
      };

      console.log('Adding camera image to queue:', { id: imageId, imagePath: relativePath });

      // Commit full image to queue
      queue.current.pushImage(newImage);

      rebuildStateFromQueue();

      // Auto-save to disk without closing editor
      await autoSave();

      // Set as currently edited to show handles
      setCurrentEdited({ imageId: imageId });
    } catch (error) {
      console.error('Failed to save camera image:', error);
      Alert.alert('שגיאה', 'שמירת התמונה נכשלה');
    }
  };

  const handleMoveElement = (type: any, id: string, p: SketchPoint) => {
    const currentImages = imagesRef.current;
    console.log('handleMoveElement:', { type, id, p, imagesCount: currentImages.length });

    // For text elements, always accumulate in editingTextChanges and update ref
    if (type === MoveTypes.TextMove) {
      console.log('Moving text, accumulating in editingTextChanges');
      const newChanges = { id, x: p[0], y: p[1] };
      setEditingTextChanges(prev => prev?.id === id ? { ...prev, ...newChanges } : newChanges);
      editingTextChangesRef.current = newChanges; // Update ref immediately for handleMoveEnd
    } else if (type === MoveTypes.ImageMove || type === MoveTypes.ImageResize) {
      // For images, track move/resize separately
      console.log('Moving/resizing image, using movingElement, images:', currentImages.map(i => ({ id: i.id, x: i.x, y: i.y })));

      // Get the base image to calculate size for resize operations
      const baseImage = currentImages.find(i => i.id === id);
      console.log('Found baseImage:', baseImage ? { id: baseImage.id, x: baseImage.x, y: baseImage.y, width: baseImage.width, height: baseImage.height } : 'NOT FOUND');

      if (!baseImage) {
        console.error('Base image not found in images array for id:', id);
        // Check if this is actually a text element (like an old emoji with wrong ID)
        const textElem = texts.find(t => t.id === id);
        if (textElem) {
          console.log('Found as text element instead, treating as text');
          setEditingTextChanges(prev => prev?.id === id ? { ...prev, x: p[0], y: p[1] } : { id, x: p[0], y: p[1] });
        }
        return;
      }

      let moveData;
      if (type === MoveTypes.ImageResize) {
        // For resize, p contains the new bottom-right corner
        const width = p[0] - baseImage.x;
        const height = p[1] - baseImage.y;
        moveData = { id, type, x: baseImage.x, y: baseImage.y, width, height };
      } else {
        // For move, p contains the new position
        moveData = { id, type, x: p[0], y: p[1], width: baseImage.width, height: baseImage.height };
      }
      console.log('Setting movingElement:', moveData);
      setMovingElement(moveData);
      movingElementRef.current = moveData; // Set ref immediately to avoid timing issues
      console.log('movingElementRef.current after set:', movingElementRef.current);
    } else if (type === MoveTypes.ElementMove) {
      // For audio elements (generic elements)
      console.log('Moving audio element');
      const audio = audios.find(a => a.id === id);
      if (audio) {
        setAudios(prev => prev.map(a => a.id === id ? { ...a, x: p[0], y: p[1] } : a));
      }
    }
  };

  const handleMoveEnd = async (type: MoveTypes, id: string) => {
    const movingElem = movingElementRef.current;
    console.log('handleMoveEnd:', { type, id, movingElement: movingElem, displayImagesCount: displayImages.length, displayImages: displayImages.map(i => ({ id: i.id, x: i.x, y: i.y })) });

    // For text, save the position from editingTextChanges (use ref to avoid stale closure)
    if (type === MoveTypes.TextMove) {
      const textChanges = editingTextChangesRef.current;
      console.log('Text moved, saving from editingTextChanges:', textChanges);

      if (textChanges && textChanges.id === id) {
        const currentTexts = textsRef.current;
        const textElem = currentTexts.find(t => t.id === id);
        if (textElem) {
          console.log('Saving text position:', textChanges.x, textChanges.y);
          queue.current.pushText({
            ...textElem,
            x: textChanges.x,
            y: textChanges.y
          });
          rebuildStateFromQueue();
          await autoSave();
        }
      }

      // Clear editingTextChanges after saving
      setEditingTextChanges(null);
      return;
    }

    // For images, save only position/size (lightweight) after move/resize
    if (type === MoveTypes.ImageMove || type === MoveTypes.ImageResize) {
      // Use movingElementRef if it matches, otherwise fall back to finding in displayImages
      let positionData;

      if (movingElem && movingElem.id === id) {
        // Use the tracked changes from movingElement
        positionData = {
          id: movingElem.id,
          x: movingElem.x,
          y: movingElem.y,
          width: movingElem.width!,
          height: movingElem.height!,
        };
        console.log('Using movingElementRef data:', positionData);
      } else {
        // Fallback: find in displayImages
        console.log('movingElementRef not available, falling back to displayImages');
        const img = displayImages.find(i => i.id === id);
        if (!img) {
          console.error('Image not found in displayImages:', id);
          return;
        }
        positionData = {
          id: img.id,
          x: img.x,
          y: img.y,
          width: img.width,
          height: img.height,
        };
      }

      console.log('Saving image position:', positionData);

      // Save only position/size data, not the full image
      queue.current.pushImagePosition(positionData);
      setMovingElement(null);
      movingElementRef.current = null; // Clear ref too
      rebuildStateFromQueue();

      // Auto-save to disk without closing editor
      await autoSave();

      // Keep image as currentEdited so handles remain visible
      const newCurrentEdited = { imageId: id };
      setCurrentEdited(newCurrentEdited);
      currentEditedRef.current = newCurrentEdited; // Update ref immediately too
      console.log('Set currentEdited after move:', newCurrentEdited);
    } else if (type === MoveTypes.ElementMove) {
      // For audio elements
      const audio = audios.find(a => a.id === id);
      if (audio && !audio.editMode) {
        // Only save position if audio is not in edit mode (recording)
        const positionData = {
          id: audio.id,
          x: audio.x,
          y: audio.y,
        };
        queue.current.pushAudioPosition(positionData);
        rebuildStateFromQueue();
        await autoSave();
        console.log('Saved audio position:', positionData);
      }
    }
  };

  const handleDeleteElement = (type: ElementTypes, id: string) => {
    // Remove from state
    if (type === ElementTypes.Text) {
      setTexts(prev => prev.filter(t => t.id !== id));
    } else if (type === ElementTypes.Image) {
      setImages(prev => prev.filter(img => img.id !== id));
    } else if (type === ElementTypes.Sketch) {
      setPaths(prev => prev.filter(p => p.id !== id));
    }

    // Remove from queue
    const queueElems = queue.current.getAll();
    const idx = queueElems.findIndex(qe => qe.elem?.id === id);
    if (idx >= 0) {
      queueElems.splice(idx, 1);
    }
  };

  // Render callback for custom elements - not used anymore
  const handleRenderElements = (elem: SketchElement) => {
    return null;
  };

  // Attributes callback for custom elements - not used anymore
  const handleElementsAttr = (elem: SketchElement): SketchElementAttributes | undefined => {
    return undefined;
  };

  const backgroundImage: ImageURISource | undefined = page.backgroundPath
    ? { uri: `file://${page.backgroundPath}` }
    : undefined;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* Left side: Page Navigation and Undo/Redo */}
        <View style={styles.headerLeft}>
          {/* Page Navigation Controls */}
          {pages && pages.length > 0 && (
            <View style={styles.pageNavigation}>
              <TouchableOpacity
                style={[styles.iconButton, !hasPrevPage && styles.iconButtonDisabled]}
                onPress={handlePrevPage}
                disabled={!hasPrevPage}
                accessibilityLabel="עמוד קודם"
              >
                <MyIcon info={{ name: "chevron-left", size: 32, color: hasPrevPage ? '#007AFF' : '#ccc', type: "MDI" }} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, !hasNextPage && styles.iconButtonDisabled]}
                onPress={handleNextPage}
                disabled={!hasNextPage}
                accessibilityLabel="עמוד הבא"
              >
                <MyIcon info={{ name: "chevron-right", size: 32, color: hasNextPage ? '#007AFF' : '#ccc', type: "MDI" }} />
              </TouchableOpacity>
            </View>
          )}

          {/* Undo/Redo */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.iconButton, !queue.current.canUndo() && styles.iconButtonDisabled]}
              onPress={handleUndo}
              disabled={!queue.current.canUndo()}
              accessibilityLabel="ביטול פעולה אחרונה"
            >
              <MyIcon info={{ name: "undo", size: 24, color: queue.current.canUndo() ? '#007AFF' : '#ccc', type: "MI" }} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, !queue.current.canRedo() && styles.iconButtonDisabled]}
              onPress={handleRedo}
              disabled={!queue.current.canRedo()}
              accessibilityLabel="ביצוע פעולה מחדש"
            >
              <MyIcon info={{ name: "redo", size: 24, color: queue.current.canRedo() ? '#007AFF' : '#ccc', type: "MI" }} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Center: Title */}
        <Text style={styles.title}>עמוד {page.pageNumber}</Text>

        {/* Right side: Done button */}
        <TouchableOpacity style={styles.doneButton} onPress={handleBack} accessibilityLabel="סיום עריכה">
          <Text style={styles.doneButtonText}>סיום</Text>
        </TouchableOpacity>
      </View>

      {/* Canvas */}
      <View style={styles.editorContainer}>
        <View style={styles.canvasContainer}>
          {(() => {
            //console.log('Canvas positioning:', { sideMargin, canvasWidth, canvasHeight, availableWidth });
            return null;
          })()}
          <View style={styles.canvas}>
            <CanvasComponent
              ref={canvasRef}
              style={{
                width: canvasWidth,
                height: canvasHeight,
              }}
              offset={canvasOffsetRef.current}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              ratio={ratio}
              canvasTop={canvasTop}

              zoom={1}
              onZoom={() => { }} // Lock zoom - prevents pinch gesture
              onMoveCanvas={() => { }} // Lock canvas position - prevents pan
              sideMargin={sideMargin}


              // Element arrays
              paths={paths}
              texts={displayTexts}
              images={displayImages}
              lines={[]} // Not using lines
              tables={[]} // Not using tables
              elements={audios}
              renderElements={handleRenderElements}
              elementsAttr={handleElementsAttr}

              currentEdited={currentEdited}
              onTextChanged={handleTextChanged}

              // Sketch/drawing handlers
              onSketchStart={() => { }}
              onSketchStep={() => { }}
              onSketchEnd={handleSketchEndStable}
              sketchColor={isEraser ? '#00000000' : sketchColor}
              sketchStrokeWidth={isEraser ? 20 : sketchStrokeWidth}

              // Click and move handlers
              onCanvasClick={handleCanvasClick}
              onMoveElement={handleMoveElement}
              onMoveEnd={handleMoveEnd}
              onDeleteElement={handleDeleteElement}

              // Background
              imageSource={backgroundImage}
              background={page.backgroundPath ? 0 : undefined}
              backgroundPattern={backgroundPattern}

              currentElementType={currentElementType}

              // Emoji selection
              currentEmojiId={currentEmojiId}
              onEmojiClick={handleEmojiClick}
            />
          </View>

          {/* Page Audio Indicator - render to the left of title text */}
          {pageAudioFile && (() => {
            // Find title text element
            const titleText = displayTexts.find(t => t.id === TITLE_TEXT_ID);
            if (!titleText) return null;

            // Calculate position in screen coordinates
            // titleText.x/y are in canvas coordinates (unscaled)
            // Scale by ratio and add canvas offset
            const screenX = titleText.x * ratio;
            const screenY = (titleText.y + 15) * ratio;

            // Position audio icon to the left of the text start
            // Offset by 50px to the left and up a bit for visual centering
            return (
              <View style={[styles.pageAudioContainer, {
                left: screenX - 50,
                top: screenY - 5,
              }]}>
                <AudioElement
                  audioFile={pageAudioFile}
                  albumId={albumId}
                  editMode={false}
                  width={40}
                  height={40}
                />
              </View>
            );
          })()}
        </View>

        {/* Toolbar Level 1 - Right Side - Always Visible */}
        <View style={styles.toolbar}>
          <TouchableOpacity
            style={[styles.mainToolButton, currentElementType === ElementTypes.Text && styles.mainToolButtonActive]}
            onPress={handleSetTextMode}
          >
            <MyIcon info={{ name: "format-text", size: 42, color: currentElementType === ElementTypes.Text ? '#007AFF' : '#555', type: "MDI" }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainToolButton, currentElementType === ElementTypes.Image && styles.mainToolButtonActive]}
            onPress={handleSetImageMode}
          >
            <MyIcon info={{ name: "image", size: 42, color: currentElementType === ElementTypes.Image ? '#007AFF' : '#555', type: "MDI" }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainToolButton, audioMode && styles.mainToolButtonActive]}
            onPress={handleSetAudioMode}
          >
            <MyIcon info={{ name: "microphone", size: 42, color: audioMode ? '#007AFF' : '#555', type: "MDI" }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainToolButton, currentElementType === ElementTypes.Sketch && styles.mainToolButtonActive]}
            onPress={() => {
              handleSetSketchMode();
              setIsEraser(false);
            }}
          >
            <MyIcon info={{ name: "pencil", size: 42, color: currentElementType === ElementTypes.Sketch ? '#007AFF' : '#555', type: "MDI" }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainToolButton, currentElementType === ElementTypes.Background && styles.mainToolButtonActive]}
            onPress={handleSetBackgroundMode}
          >
            <MyIcon info={{ name: "format-color-fill", size: 42, color: currentElementType === ElementTypes.Background ? '#007AFF' : '#555', type: "MDI" }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainToolButton, currentElementType === ElementTypes.Emoji && styles.mainToolButtonActive]}
            onPress={handleSetEmojiMode}
          >
            <MyIcon info={{ name: "emoticon-happy-outline", size: 42, color: currentElementType === ElementTypes.Emoji ? '#007AFF' : '#555', type: "MDI" }} />
          </TouchableOpacity>

          {/* Spacer to push new page button to bottom */}
          <View style={{ flex: 1 }} />

          {/* New Page Button */}
          {onCreatePage && (
            <TouchableOpacity
              style={styles.newPageButton}
              onPress={handleNewPage}
              accessibilityLabel="עמוד חדש"
            >
              <MyIcon info={{ name: "plus", size: 36, color: '#007AFF', type: "MDI" }} />
            </TouchableOpacity>
          )}

          {/* Delete Page Button */}
          {onDeletePage && pages && pages.length > 1 && (
            <TouchableOpacity
              style={styles.deletePageButton}
              onPress={handleDeletePage}
              accessibilityLabel="מחק עמוד"
            >
              <MyIcon info={{ name: "delete", size: 36, color: '#FF3B30', type: "MDI" }} />
            </TouchableOpacity>
          )}
        </View>

        {/* Toolbar Level 2 - Tool Options - Slides Over Canvas */}
        {showToolOptions && (
          <Animated.View
            style={[
              styles.toolOptionsPanel,
              {
                transform: [{ translateX: slideAnim }],
              }
            ]}
            pointerEvents="box-none"
          >
            <View style={{ flex: 1, backgroundColor: '#fff' }} pointerEvents="auto">
              {/* Close Button */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  console.log('[Close toolbar] Closing tool options');
                  // Save text before closing
                  if (currentEdited.textId) {
                    handleTextEditEnd(currentEdited.textId);
                    setCurrentEdited({});
                  }
                  setShowToolOptions(false);
                }}
              >
                <MyIcon info={{ name: "close", size: 24, color: '#666', type: "MI" }} />
              </TouchableOpacity>

              {!audioMode && currentElementType === ElementTypes.Sketch && (
                <>
                  {/* Color Picker with Eraser */}
                  <View style={styles.optionsSection}>
                    <Text style={styles.sectionLabel}>צבע</Text>
                    <View style={styles.colorGrid}>
                      {/* Eraser as first color option */}
                      <TouchableOpacity
                        style={[
                          styles.colorSwatch,
                          styles.eraserSwatch,
                          isEraser && styles.colorSwatchActive
                        ]}
                        onPress={() => setIsEraser(true)}
                      >
                        <MyIcon info={{ name: "eraser", size: 16, color: '#666', type: "MDI" }} />
                      </TouchableOpacity>

                      {/* Regular colors */}
                      {COLORS.map(color => (
                        <TouchableOpacity
                          key={color}
                          style={[
                            styles.colorSwatch,
                            { backgroundColor: color },
                            !isEraser && sketchColor === color && styles.colorSwatchActive
                          ]}
                          onPress={() => {
                            console.log('[Color change] Setting color to:', color);
                            setIsEraser(false);
                            setSketchColor(color);
                          }}
                        />
                      ))}
                    </View>
                  </View>

                  {/* Size Picker */}
                  <View style={styles.optionsSection}>
                    <Text style={styles.sectionLabel}>עובי</Text>
                    <View style={styles.sizeGrid}>
                      {PEN_SIZES.map(size => (
                        <TouchableOpacity
                          key={size}
                          style={[styles.sizeButton, sketchStrokeWidth === size && styles.sizeButtonActive]}
                          onPress={() => {
                            console.log('[Size change] Setting stroke width to:', size);
                            setSketchStrokeWidth(size);
                          }}
                        >
                          <Text style={[styles.sizeText, sketchStrokeWidth === size && styles.sizeTextActive]}>{size}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              )}

              {!audioMode && currentElementType === ElementTypes.Text && (
                <>
                  {/* Title/Body Buttons */}
                  <View style={styles.optionsSection}>
                    <TouchableOpacity
                      style={[styles.optionButton, textMode === 'title' && currentEdited.textId && styles.optionButtonActive]}
                      onPress={handleEditTitle}
                    >
                      <MyIcon info={{ name: "format-header-1", size: 24, color: textMode === 'title' && currentEdited.textId ? '#007AFF' : '#555', type: "MDI" }} />
                      <Text style={[styles.optionLabel, textMode === 'title' && currentEdited.textId && styles.optionLabelActive]}>כותרת</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.optionButton, textMode === 'body' && currentEdited.textId && styles.optionButtonActive]}
                      onPress={handleEditBody}
                    >
                      <MyIcon info={{ name: "format-text", size: 24, color: textMode === 'body' && currentEdited.textId ? '#007AFF' : '#555', type: "MDI" }} />
                      <Text style={[styles.optionLabel, textMode === 'body' && currentEdited.textId && styles.optionLabelActive]}>גוף</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Color Picker - Only shown when editing */}
                  {currentEdited.textId && (
                    <>
                      <View style={styles.optionsSection}>
                        <Text style={styles.sectionLabel}>צבע</Text>
                        <View style={styles.colorGrid}>
                          {COLORS.map(color => (
                            <TouchableOpacity
                              key={color}
                              style={[styles.colorSwatch, { backgroundColor: color }, textColor === color && styles.colorSwatchActive]}
                              onPress={() => {
                                setTextColor(color);
                                if (currentEdited.textId) {
                                  setEditingTextChanges(prev => prev ? { ...prev, color } : { id: currentEdited.textId!, color });
                                }
                              }}
                            />
                          ))}
                        </View>
                      </View>

                      {/* Size Picker */}
                      <View style={styles.optionsSection}>
                        <Text style={styles.sectionLabel}>גודל</Text>
                        <View style={styles.sizeGrid}>
                          {(textMode === 'title' ? TITLE_TEXT_SIZES : BODY_TEXT_SIZES).map(size => (
                            <TouchableOpacity
                              key={size}
                              style={[styles.sizeButton, textSize === size && styles.sizeButtonActive]}
                              onPress={() => {
                                setTextSize(size);
                                if (currentEdited.textId) {
                                  setEditingTextChanges(prev => prev ? { ...prev, fontSize: size } : { id: currentEdited.textId!, fontSize: size });
                                }
                              }}
                            >
                              <Text style={[styles.sizeText, textSize === size && styles.sizeTextActive]}>{size}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </>
                  )}
                </>
              )}

              {!audioMode && currentElementType === ElementTypes.Image && (
                <View style={styles.optionsSection}>
                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={handleAddImage}
                    disabled={loadingImagePicker}
                  >
                    {loadingImagePicker ? (
                      <ActivityIndicator size="small" color="#007AFF" />
                    ) : (
                      <MyIcon info={{ name: "image-plus", size: 24, color: '#007AFF', type: "MDI" }} />
                    )}
                    <Text style={styles.optionLabel}>מגלריה</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.optionButton}
                    onPress={() => setShowCameraModal(true)}
                  >
                    <MyIcon info={{ name: "camera", size: 24, color: '#007AFF', type: "MDI" }} />
                    <Text style={styles.optionLabel}>מצלמה</Text>
                  </TouchableOpacity>
                </View>
              )}

              {audioMode && (
                <View style={styles.optionsSection}>
                  <Text style={styles.sectionLabel}>הקלטה</Text>

                  <TouchableOpacity
                    style={[styles.optionButton, isRecording && styles.optionButtonActive]}
                    onPress={isRecording ? handleStopRecording : handleStartRecording}
                  >
                    <MyIcon info={{ name: isRecording ? 'stop' : 'record', size: 24, color: isRecording ? '#fff' : '#FF0000', type: "MDI" }} />
                    <Text style={[styles.optionLabel, isRecording && styles.optionLabelActive]}>{isRecording ? 'עצור הקלטה' : 'התחל הקלטה'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.optionButton, !pageAudioFile && styles.optionButtonDisabled]}
                    onPress={handlePlayAudio}
                    disabled={!pageAudioFile}
                  >
                    <MyIcon info={{ name: "play", size: 24, color: pageAudioFile ? '#007AFF' : '#ccc', type: "MDI" }} />
                    <Text style={[styles.optionLabel, !pageAudioFile && styles.optionLabelDisabled]}>השמע</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.optionButton, !pageAudioFile && styles.optionButtonDisabled]}
                    onPress={handleOpenWordMapping}
                    disabled={!pageAudioFile}
                  >
                    <MyIcon info={{ name: "text-box", size: 24, color: pageAudioFile ? '#007AFF' : '#ccc', type: "MDI" }} />
                    <Text style={[styles.optionLabel, !pageAudioFile && styles.optionLabelDisabled]}>מיפוי מילים</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.optionButton, styles.optionButtonDestructive, !pageAudioFile && styles.optionButtonDisabled]}
                    onPress={handleClearPageAudio}
                    disabled={!pageAudioFile}
                  >
                    <MyIcon info={{ name: "delete", size: 24, color: pageAudioFile ? '#FF3B30' : '#ccc', type: "MDI" }} />
                    <Text style={[styles.optionLabel, !pageAudioFile && styles.optionLabelDisabled]}>מחק הקלטה</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Emoji Mode Options */}
              {!audioMode && currentElementType === ElementTypes.Emoji && (
                <>
                  {/* Pick Emoji Button */}
                  <View style={styles.optionsSection}>
                    <TouchableOpacity
                      style={styles.optionButton}
                      onPress={handleOpenEmojiKeyboard}
                    >
                      <MyIcon info={{ name: "emoticon-happy-outline", size: 24, color: '#007AFF', type: "MDI" }} />
                      <Text style={styles.optionLabel}>בחר אימוג'י</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Emoji Options - shown when emoji is selected */}
                  {currentEmojiId && (
                    <>
                      <View style={styles.optionsSection}>
                        <Text style={styles.sectionLabel}>גודל אימוג'י</Text>

                        {/* Size adjustment row: (-) presets (+) */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {/* Minus button */}
                          <TouchableOpacity
                            style={styles.adjustButton}
                            onPress={() => handleEmojiAdjustSize(-EMOJI_SIZE_STEP)}
                          >
                            <MyIcon info={{ name: "minus", size: 20, color: '#007AFF', type: "MDI" }} />
                          </TouchableOpacity>

                          {/* Preset sizes */}
                          <View style={styles.sizeGrid}>
                            {EMOJI_PRESET_SIZES.map((size, index) => {
                              const currentEmoji = displayTexts.find(t => t.id === currentEmojiId);
                              const isActive = currentEmoji?.fontSize === size;
                              const labels = ['S', 'M', 'L'];
                              return (
                                <TouchableOpacity
                                  key={size}
                                  style={[styles.sizeButton, isActive && styles.sizeButtonActive]}
                                  onPress={() => handleEmojiResize(size)}
                                >
                                  <Text style={[styles.sizeText, isActive && styles.sizeTextActive]}>{labels[index]}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>

                          {/* Plus button */}
                          <TouchableOpacity
                            style={styles.adjustButton}
                            onPress={() => handleEmojiAdjustSize(EMOJI_SIZE_STEP)}
                          >
                            <MyIcon info={{ name: "plus", size: 20, color: '#007AFF', type: "MDI" }} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Rotation Control */}
                      <View style={styles.optionsSection}>
                        <Text style={styles.sectionLabel}>
                          סיבוב: {(() => {
                            const deg = Math.round(emojiRotation ?? 0);
                            const display = deg > 180 ? deg - 360 : deg;
                            return display;
                          })()}°
                        </Text>
                        <RotationSlider
                          value={emojiRotation ?? 0}
                          onChange={handleEmojiRotationChange}
                          onRelease={handleEmojiRotationEnd}
                        />
                      </View>

                      {/* Delete Button */}
                      <View style={styles.optionsSection}>
                        <TouchableOpacity
                          style={[styles.optionButton, styles.optionButtonDestructive]}
                          onPress={handleEmojiDelete}
                        >
                          <MyIcon info={{ name: "delete", size: 24, color: '#FF3B30', type: "MDI" }} />
                          <Text style={styles.optionLabel}>מחק אימוג'י</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </>
              )}

              {/* Background Mode Options */}
              {!audioMode && currentElementType === ElementTypes.Background && (
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  {/* Clear Background Button */}
                  <View style={styles.optionsSection}>
                    <TouchableOpacity
                      style={[styles.optionButton, { position: "absolute", left: 5, top: 0 }, !backgroundPattern && styles.optionButtonActive]}
                      onPress={() => handleApplyBackground(undefined)}
                    >
                      <MyIcon info={{ name: "delete", size: 24, color: !backgroundPattern ? '#007AFF' : '#555', type: "MDI" }} />
                      <Text style={[styles.optionLabel, !backgroundPattern && styles.optionLabelActive]}>ללא רקע</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Solid Colors */}
                  <View style={[styles.optionsSection, { marginTop: 35 }]}>
                    <Text style={styles.sectionLabel}>צבע אחיד</Text>
                    <View style={styles.colorGrid}>
                      {SOLID_COLOR_PRESETS.map((preset) => {
                        const isActive = backgroundPattern?.type === 'solid' && backgroundPattern.color === preset.color;
                        return (
                          <TouchableOpacity
                            key={preset.color}
                            style={[
                              styles.backgroundSwatch,
                              { backgroundColor: preset.color },
                              isActive && styles.backgroundSwatchActive
                            ]}
                            onPress={() => handleApplyBackground({ type: 'solid', color: preset.color })}
                          />
                        );
                      })}
                    </View>
                  </View>

                  {/* Patterns */}
                  <View style={styles.optionsSection}>
                    <Text style={styles.sectionLabel}>דפוסים</Text>
                    <View style={styles.colorGrid}>
                      {Object.keys(PATTERN_PRESETS).map((patternKey) => {
                        const patternType = patternKey as keyof typeof PATTERN_PRESETS;
                        const preset = PATTERN_PRESETS[patternType];
                        const isActive = backgroundPattern?.type === 'pattern' && backgroundPattern.patternType === patternType;
                        return (
                          <TouchableOpacity
                            key={patternKey}
                            style={[
                              styles.backgroundSwatch,
                              { backgroundColor: preset.defaultBgColor },
                              isActive && styles.backgroundSwatchActive
                            ]}
                            onPress={() => handleApplyBackground({
                              type: 'pattern',
                              patternType,
                              patternColor: preset.defaultColor,
                              backgroundColor: preset.defaultBgColor,
                              patternScale: 1.0,
                            })}
                          >
                            <View style={{ width: '100%', height: '100%', opacity: 0.6 }}>
                              <Canvas style={{ flex: 1 }}>
                                <Rect x={0} y={0} width={60} height={60} color={preset.defaultBgColor} />
                                {generatePatternPaths({
                                  type: 'pattern',
                                  patternType,
                                  patternColor: preset.defaultColor,
                                  backgroundColor: preset.defaultBgColor,
                                  patternScale: 0.5,
                                }, 60, 60).map((path, idx) => (
                                  <Path key={idx} path={path} color={preset.defaultColor} style="stroke" strokeWidth={1} />
                                ))}
                              </Canvas>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Background Images */}
                  <View style={styles.optionsSection}>
                    <Text style={styles.sectionLabel}>תמונות רקע</Text>
                    <View style={styles.colorGrid}>
                      {BACKGROUND_IMAGE_PRESETS.map((preset) => {
                        const isActive = backgroundPattern?.type === 'image' && backgroundPattern.imageName === preset.fileName;
                        return (
                          <TouchableOpacity
                            key={preset.fileName}
                            style={[
                              styles.backgroundSwatch,
                              isActive && styles.backgroundSwatchActive
                            ]}
                            onPress={() => handleApplyBackground({
                              type: 'image',
                              imageName: preset.fileName,
                            })}
                          >
                            <Image
                              source={BACKGROUND_IMAGE_SOURCES[preset.fileName]}
                              style={{ width: '100%', height: '100%', borderRadius: 4 }}
                              resizeMode="cover"
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </ScrollView>
              )}
            </View>
          </Animated.View>
        )}
      </View>

      {/* Audio Word Mapping Modal */}
      {showWordMappingModal && pageAudioFile && (() => {
        // Get title text from queue directly
        const queueElements = queue.current.getAll();
        let titleText = '';

        for (const qe of queueElements) {
          if ((qe.type === 'textAdd' || qe.type === 'text') && qe.elem?.id === 'page_title_text') {
            titleText = qe.elem.text || '';
            break;
          }
        }

        return (
          <AudioWordMappingModal
            visible={showWordMappingModal}
            audioFile={pageAudioFile}
            albumId={albumId}
            titleText={titleText}
            audioDuration={pageAudioDuration}
            initialWordTimings={pageAudioWordTimings}
            onClose={(wordTimings) => {
              handleWordTimingsChange(wordTimings);
              setShowWordMappingModal(false);
            }}
            onReRecord={handleReRecordFromWordMapping}
            onDelete={handleDeletePageAudio}
          />
        );
      })()}

      {/* Background Settings Modal */}
      <BackgroundSettingsModal
        visible={showBackgroundModal}
        currentPattern={backgroundPattern}
        onApply={handleApplyBackground}
        onClose={() => setShowBackgroundModal(false)}
      />

      {/* Camera Modal */}
      <CameraModal
        visible={showCameraModal}
        onCapture={handleCameraCapture}
        onCancel={() => setShowCameraModal(false)}
      />

      {/* Emoji Picker */}
      <EmojiPicker
        onEmojiSelected={handleEmojiPick}
        open={showEmojiKeyboard}
        onClose={() => setShowEmojiKeyboard(false)}
        allowMultipleSelections={false}
        emojiSize={48}
        defaultHeight="50%"
        enableSearchBar={true}
        enableSearchAnimation={true}
        styles={{
          category: {
            icon: { width: 50 }, // Larger emoji icons for categories
            container: {
              padding: 10,
              minWidth: "50%",
              minHeight: 25,
            },
          },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: HEADER_HEIGHT,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  doneButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.cardBackground,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '600', color: '#333', textAlign: 'center' },
  headerActions: { flexDirection: 'row', gap: 8 },
  pageNavigation: { flexDirection: 'row', gap: 4 },
  iconButton: { fontSize: 35, width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  iconButtonDisabled: { opacity: 0.9 },
  editorContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  canvasContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    backgroundColor: '#f5f5f5',
  },
  pageAudioContainer: {
    position: 'absolute',
    zIndex: 1000,
  },
  canvas: {
    marginTop: CANVAS_MARGIN,
    marginLeft: CANVAS_MARGIN,
    backgroundColor: '#fff',
    borderRadius: 8,
    boxShadow: '5px 5px 5px 0px rgba(0, 0, 0, 0.3)',
    overflow: 'hidden',
  },
  toolbar: {
    width: 90,
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderLeftColor: '#e0e0e0',
    paddingVertical: 12,
    alignItems: 'center',
    gap: 20,
  },
  mainToolButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  mainToolButtonActive: {
    backgroundColor: '#E8F0FE',
  },
  newPageButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8F0FE',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  deletePageButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    borderWidth: 2,
    borderColor: '#FF3B30',
    marginTop: 12,
  },
  toolOptionsPanel: {
    position: 'absolute',
    right: 90,
    top: 0,
    bottom: 0,
    width: 240,
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderLeftColor: '#e0e0e0',
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1000,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001,
  },
  optionsSection: {
    marginBottom: 15,
    marginTop: 15, // Leave room for close button
  },
  sectionLabel: {
    fontSize: 16,

    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
    gap: 8,
  },
  optionButtonActive: {
    backgroundColor: '#FF0000',
  },
  optionLabel: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  optionLabelActive: {
    color: '#fff',
  },
  optionButtonDestructive: {
    backgroundColor: '#FFE5E5',
  },
  optionButtonDisabled: {
    opacity: 0.4,
  },
  optionLabelDisabled: {
    color: '#ccc',
  },
  audioHint: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontStyle: 'italic',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eraserSwatch: {
    backgroundColor: '#f5f5f5',
  },
  colorSwatchActive: {
    borderColor: '#007AFF',
    borderWidth: 3,
  },
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  sizeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sizeButtonActive: {
    backgroundColor: '#E8F0FE',
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  sizeText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  sizeTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  adjustButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  rotationSliderContainer: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  backgroundSwatch: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  backgroundSwatchActive: {
    borderColor: '#007AFF',
    borderWidth: 3,
  },
});
