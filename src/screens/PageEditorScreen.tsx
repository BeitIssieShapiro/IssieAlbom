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
  ScrollView,
  Image,
  Pressable,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PathCommand } from '@shopify/react-native-skia';
import { Canvas, Rect, Path } from '@shopify/react-native-skia';
import { launchImageLibrary } from 'react-native-image-picker';
import Sound from 'react-native-nitro-sound';
import RNFS from 'react-native-fs';
import EmojiPicker, { en, he } from 'rn-emoji-keyboard';
import type { EmojiType } from 'rn-emoji-keyboard';
import heKeywords from '../assets/emoji-keywords-he.json';
import arKeywords from '../assets/emoji-keywords-ar.json';
import { AlbumPage, AlbumPageV2, CurrentEdited, SketchPoint, SketchPath, SketchText, SketchImage, SketchAudio, SketchTiles, TileWord, WordTiming, BackgroundPattern, HEADER_HEIGHT, ElementTypes } from '../types/Album';
import { SketchElement, SketchElementAttributes, MoveTypes } from '../components/canvas/types';
import DoQueue from '../utils/DoQueue';
import CanvasComponent from '../components/canvas/canvas';
import { AudioElement } from '../components/AudioElement';
import { AudioWordMappingModal } from '../components/AudioWordMappingModal';
import { CameraModal } from '../components/CameraModal';
import { SearchImageModal } from '../components/SearchImageModal';
import { ImageEditModal } from '../components/ImageEditModal';
import { TilesModal } from '../components/TilesModal';
import { TilesElement } from '../components/TilesElement';
import { SearchSymbolModal } from '../components/SearchSymbolModal';
import { getId, compileQueueToElements } from '../utils/pageUtils';
import { PATTERN_PRESETS, SOLID_COLOR_PRESETS, BACKGROUND_IMAGE_PRESETS, BACKGROUND_IMAGE_SOURCES, generatePatternPaths } from '../utils/backgroundPatterns';
import { PageService } from '../services/PageService';
import { AttachmentService } from '../services/AttachmentService';
import { AlbumService } from '../services/AlbumService';
import { SymbolSearchService } from '../services/SymbolSearchService';
import { detectLanguageFromText } from '../utils/languageDetection';
import ImageLibrary from '../services/ImageLibrary';
import { MyIcon } from '../common/icons';
import { RTLAlert } from '../components/RTLAlert';
import { spacing, borderRadius } from '../theme/colors';
import Svg, { Rect as SvgRect, Path as SvgPath } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

const TOOLBAR_WIDTH = 90; // Default toolbar width (will be overridden responsively)
const CANVAS_MARGIN = 6; // Margin around canvas in edit mode (reduced for mobile)
const SUBTOOLBAR_WIDTH = 240; // Width of the second-level tool options panel
const MAX_TILE_SIZE_RATIO = 0.35; // Max tile size as percentage of page height

// Debug: Allow unlimited undo in development (set to false for production)
const ENABLE_UNLIMITED_UNDO = __DEV__ && true; // Change last 'true' to 'false' to disable


import Slider from '@react-native-community/slider';
import { findLast } from '../components/canvas/utils';

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

function IconTitle({ color = '#555', size = 24 }: { color?: string; size?: number }) {
  const s = size / 40;
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <SvgRect x="3" y="2" width="34" height="36" rx="4" fill="white" stroke={color} strokeWidth="2.2" />
      <SvgRect x="8" y="8" width="24" height="4" rx="2" fill={color} />
      <SvgRect x="8" y="17" width="24" height="2.5" rx="1.25" fill={color} opacity="0.35" />
      <SvgRect x="8" y="22" width="20" height="2.5" rx="1.25" fill={color} opacity="0.35" />
      <SvgRect x="8" y="27" width="22" height="2.5" rx="1.25" fill={color} opacity="0.35" />
    </Svg>
  );
}

function IconBody({ color = '#555', size = 24 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <SvgRect x="3" y="2" width="34" height="36" rx="4" fill="white" stroke={color} strokeWidth="2.2" />
      <SvgRect x="8" y="8" width="24" height="2.5" rx="1.25" fill={color} opacity="0.35" />
      <SvgRect x="8" y="16" width="24" height="3" rx="1.5" fill={color} />
      <SvgRect x="8" y="22" width="20" height="3" rx="1.5" fill={color} />
      <SvgRect x="8" y="28" width="22" height="3" rx="1.5" fill={color} />
    </Svg>
  );
}

function IconCells({ color = '#555', size = 24 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <SvgRect x="3" y="2" width="34" height="36" rx="4" fill="white" stroke={color} strokeWidth="2.2" />
      <SvgRect x="8" y="8" width="24" height="2.5" rx="1.25" fill={color} opacity="0.35" />
      <SvgRect x="8" y="13" width="18" height="2.5" rx="1.25" fill={color} opacity="0.35" />
      <SvgRect x="6" y="23" width="8" height="11" rx="2.5" fill="none" stroke={color} strokeWidth="1.8" />
      <SvgRect x="16" y="23" width="8" height="11" rx="2.5" fill="none" stroke={color} strokeWidth="1.8" />
      <SvgRect x="26" y="23" width="8" height="11" rx="2.5" fill="none" stroke={color} strokeWidth="1.8" />
    </Svg>
  );
}

export function PageEditorScreen({ page, albumId, onSave, onDiscard, pages, onNavigatePage, onCreatePage, onDeletePage }: PageEditorScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, isRTL, language } = useLanguage();
  const canvasRef = useRef<any>(null);

  // Track screen dimensions (updated on rotation)
  const [screenDimensions, setScreenDimensions] = useState(() => {
    const window = Dimensions.get('window');
    return { width: window.width, height: window.height };
  });

  // Keyboard tracking for text editing offset
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardTop, setKeyboardTop] = useState(0);
  const keyboardHeightRef = useRef(0);
  const keyboardTopRef = useRef(0);

  // RTL Alert state
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title?: string;
    message?: string;
    buttons?: Array<{ text: string; onPress?: () => void }>;
  }>({
    visible: false,
  });

  // Canvas offset for scrolling/adjusting when keyboard appears
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const canvasOffsetRef = useRef({ x: 0, y: 0 });

  // Ref to hold the verify function so it can be called from keyboard listener
  const verifyCurrentEditTextIsVisibleRef = useRef<() => void>();

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

  // Listen for keyboard show/hide
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      const kbHeight = e.endCoordinates.height;
      const kbTop = e.endCoordinates.screenY - (HEADER_HEIGHT + insets.top);

      console.log('[PageEditorScreen] Keyboard shown:', { kbHeight, kbTop });
      setKeyboardHeight(kbHeight);
      setKeyboardTop(kbTop);
      keyboardHeightRef.current = kbHeight;
      keyboardTopRef.current = kbTop;

      // Check if edited text needs scrolling after a short delay to ensure layout is updated
      setTimeout(() => verifyCurrentEditTextIsVisibleRef.current?.(), 100);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      console.log('[PageEditorScreen] Keyboard hidden');
      setKeyboardHeight(0);
      setKeyboardTop(0);
      keyboardHeightRef.current = 0;
      keyboardTopRef.current = 0;

      // Reset canvas offset when keyboard hides
      setCanvasOffset({ x: 0, y: 0 });
      canvasOffsetRef.current = { x: 0, y: 0 };
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [insets.top]);

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

  // Track baseline queue length when page is loaded (for limiting undo to current session)
  const baselineQueueLength = useRef<number | undefined>(undefined);

  // Canvas state (external to Canvas component)
  const [paths, setPaths] = useState<SketchPath[]>([]);
  const [texts, setTexts] = useState<SketchText[]>([]);
  const [images, setImages] = useState<SketchImage[]>([]);
  const [audios, setAudios] = useState<SketchElement[]>([]);
  const [pageAudioFile, setPageAudioFile] = useState<string | undefined>(undefined);
  const [pageAudioDuration, setPageAudioDuration] = useState<number | undefined>(undefined);
  const [pageAudioWordTimings, setPageAudioWordTimings] = useState<WordTiming[]>([]);
  const [showWordMappingModal, setShowWordMappingModal] = useState(false);
  const [showEmojiKeyboard, setShowEmojiKeyboard] = useState(false);
  const [currentEmojiId, setCurrentEmojiId] = useState<string | null>(null); // Track selected emoji
  const [loadingImagePicker, setLoadingImagePicker] = useState(false); // Track image picker loading
  const [showCameraModal, setShowCameraModal] = useState(false); // Track camera modal
  const [showSearchImageModal, setShowSearchImageModal] = useState(false); // Track image search modal
  const [showImageEditModal, setShowImageEditModal] = useState(false); // Track image edit modal
  const [pendingImageUri, setPendingImageUri] = useState<string>(''); // Image waiting to be edited
  const [pendingImageSource, setPendingImageSource] = useState<'camera' | 'library' | 'background-camera' | 'background-library' | 'edit-existing'>('camera'); // Track source
  const [pendingImageId, setPendingImageId] = useState<string>(''); // Track which image is being edited

  // Tiles state
  const [showTilesModal, setShowTilesModal] = useState(false);
  const [tilesSelected, setTilesSelected] = useState(false); // Track if tiles are selected for editing styling
  const [tiles, setTiles] = useState<SketchTiles | null>(null);
  const tilesRef = useRef<SketchTiles | null>(null);
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null);
  const [selectedTileIndices, setSelectedTileIndices] = useState<Set<number>>(new Set());
  const selectedTileIndicesRef = useRef<Set<number>>(new Set());
  const [searchingSymbols, setSearchingSymbols] = useState(false); // Track symbol search loading
  const [searchingSymbolsMode, setSearchingSymbolsMode] = useState<'auto' | 'manual'>('auto'); // Track if auto-search or manual download
  const [showSearchSymbolModal, setShowSearchSymbolModal] = useState(false);

  // Tiles styling state (for subtoolbar controls)
  const [tilesBgColor, setTilesBgColor] = useState('#FFFDE7');
  const [tilesTextColor, setTilesTextColor] = useState('#333333');
  const [tilesSize, setTilesSize] = useState(0.12); // Default to M
  const [tilesScale, setTilesScale] = useState(1); // Tile dimension multiplier vs auto-calculated default

  const [emojiRotation, setEmojiRotation] = useState<number | undefined>(); // Temporary rotation while dragging
  const [emojiPinchSize, setEmojiPinchSize] = useState<number | undefined>(); // Temporary size during pinch
  const emojiPinchSizeRef = useRef<number | undefined>(undefined);
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
  const displayTextsRef = useRef<SketchText[]>([]);
  const currentEmojiIdRef = useRef<string | null>(null);
  const emojiRotationRef = useRef<number | undefined>(undefined);
  const emojiPinchBaseRef = useRef<{ rotation: number; fontSize: number } | null>(null);
  const sketchColorRef = useRef<string>('#333333');
  const sketchStrokeWidthRef = useRef<number>(3);
  const handleSketchEndRef = useRef<((commands?: PathCommand[]) => void) | null>(null);

  // Sync refs with state
  useEffect(() => {
    currentEditedRef.current = currentEdited;
  }, [currentEdited]);

  useEffect(() => {
    editingTextChangesRef.current = editingTextChanges;
    console.log('[editingTextChanges updated]', editingTextChanges);
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
    tilesRef.current = tiles;
  }, [tiles]);

  useEffect(() => {
    selectedTileIndicesRef.current = selectedTileIndices;
  }, [selectedTileIndices]);

  useEffect(() => {
    currentEmojiIdRef.current = currentEmojiId;
  }, [currentEmojiId]);

  useEffect(() => {
    emojiRotationRef.current = emojiRotation;
  }, [emojiRotation]);

  useEffect(() => {
    emojiPinchSizeRef.current = emojiPinchSize;
  }, [emojiPinchSize]);

  // Computed texts array that includes editing changes and move changes
  const displayTexts = useMemo(() => {
    console.log('displayTexts recomputing, emojiRotation:', emojiRotation, 'currentEmojiId:', currentEmojiId, 'editingTextChanges:', editingTextChanges);
    const result = texts.map(t => {
      // Apply editing changes (text, color, size, position, width, height)
      if (editingTextChanges?.id === t.id) {
        console.log('Applying editingTextChanges to', t.id, editingTextChanges);
        let merged = { ...t, ...editingTextChanges };
        // ALSO apply temporary rotation if this is a selected emoji
        if (t.isEmoji && t.id === currentEmojiId && emojiRotation !== undefined) {
          console.log('ALSO applying rotation to edited emoji:', emojiRotation);
          merged.rotation = emojiRotation;
        }
        return merged;
      }
      // Apply move changes (only for non-edited texts)
      if (movingElement?.type === 'text' && movingElement.id === t.id && !editingTextChanges) {
        return { ...t, x: movingElement.x, y: movingElement.y };
      }
      // Apply temporary rotation/size for selected emoji during pinch
      if (t.isEmoji && t.id === currentEmojiId) {
        let updated = { ...t };
        if (emojiRotation !== undefined) updated.rotation = emojiRotation;
        if (emojiPinchSize !== undefined) {
          updated.fontSize = emojiPinchSize;
          updated.width = emojiPinchSize / ratio;
          updated.height = emojiPinchSize / ratio;
        }
        return updated;
      }
      return t;
    });
    console.log("display text", result)

    // If editingTextChanges has a text not in the queue yet (brand new), add it
    if (editingTextChanges && !texts.find(t => t.id === editingTextChanges.id)) {
      result.push(editingTextChanges as SketchText);
    }


    return result;
  }, [texts, editingTextChanges, movingElement, currentEmojiId, emojiRotation, emojiPinchSize]);

  // Sync displayTexts to ref (contains canvas layout mutations like width/height)
  useEffect(() => {
    displayTextsRef.current = displayTexts;
  }, [displayTexts]);

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
  const [recordingMetering, setRecordingMetering] = useState<number>(0); // Audio level 0-1 during recording
  const [, forceUpdate] = useState(0); // For animating waveform bars
  const [queueVersion, setQueueVersion] = useState(0); // Triggers re-render when queue changes

  // Hardcoded element IDs
  const TITLE_TEXT_ID = 'page_title_text';
  const BODY_TEXT_ID = 'page_body_text';
  const PAGE_AUDIO_ID = 'page_audio';
  const TILES_ID = 'page_tiles';

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

  // Animate waveform bars while recording
  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      forceUpdate(prev => prev + 1); // Trigger re-render for animation
    }, 100); // Update 10 times per second

    return () => clearInterval(interval);
  }, [isRecording]);

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
      toValue: showToolOptions ? 0 : 240, // 0 = visible, 240 = hidden off-screen
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

  // Text size presets (XS/S/M/L/XL)
  const SIZE_LETTER = language === 'he' ? 'א' : language === 'ar' ? 'أ' : 'A';
  const SIZE_DISPLAY_PX = [10, 13, 16, 20, 26]; // visual letter sizes for XS→XL
  const TITLE_TEXT_SIZES = [
    { label: 'XS', value: 40 },
    { label: 'S', value: 52 },
    { label: 'M', value: 64 },
    { label: 'L', value: 80 },
    { label: 'XL', value: 100 },
  ];
  const BODY_TEXT_SIZES = [
    { label: 'XS', value: 20 },
    { label: 'S', value: 26 },
    { label: 'M', value: 32 },
    { label: 'L', value: 40 },
    { label: 'XL', value: 50 },
  ];
  const EMOJI_PRESET_SIZES = [70, 100, 130]; // Preset emoji sizes (S/M/L)
  const EMOJI_SIZE_STEP = 10; // Step for +/- adjustments

  // Tiles styling constants
  const TILES_BG_COLORS = ['#FFFFFF', '#2C3E50', '#F0F3F4', '#D5DBDB', '#717D7E', '#F1948A', '#ABEBC6', '#AED6F1', '#EDBB99', '#D7BDE2', '#FFC0CB', '#FFFACD', '#E0FFFF', '#F5F5DC', '#FFE4E1'];
  const TILES_TEXT_COLORS = ['#FFFFFF', '#000000', '#333333', '#666666', '#2C3E50', '#E74C3C', '#3498DB', '#2ECC71'];
  const TILES_SIZES = [
    { label: 'XS', value: 0.08 },
    { label: 'S', value: 0.10 },
    { label: 'M', value: 0.12 },
    { label: 'L', value: 0.15 },
    { label: 'XL', value: 0.18 },
  ];
  const TILES_SCALE_PRESETS = [0.8, 1.0, 1.25]; // Tile dimension multipliers (S/M/L)
  const TILES_SCALE_STEP = 0.1;
  const TILES_SCALE_MIN = 0.5;
  const TILES_SCALE_MAX = 2.0;

  // Detect mobile device (both portrait and landscape, but screen < 768 for mobile, not iPad)
  const isMobile = screenDimensions.width < 768 || screenDimensions.height < 768;
  const isMobileLandscape = isMobile && screenDimensions.width > screenDimensions.height;

  // Responsive toolbar sizing - only smaller on mobile landscape
  const toolbarWidth = isMobileLandscape ? 70 : 90;
  const toolbarButtonSize = isMobileLandscape ? 54 : 70;
  const toolbarGap = isMobileLandscape ? 8 : 12;
  const toolbarPaddingVertical = isMobileLandscape ? 4 : 8;

  // Calculate available space for canvas (subtracting toolbar width and subtoolbar when open)
  const subtoolbarOffset = showToolOptions ? SUBTOOLBAR_WIDTH : 0;
  const availableWidth = screenDimensions.width - toolbarWidth - subtoolbarOffset - CANVAS_MARGIN * 2 - insets.left - insets.right;
  const availableHeight = screenDimensions.height - HEADER_HEIGHT - CANVAS_MARGIN * 2 - insets.top - insets.bottom;

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

  // Calculate centering offset for canvas
  // Available width for canvas area (excluding toolbar)
  const canvasAreaWidth = screenDimensions.width - toolbarWidth - subtoolbarOffset - insets.left - insets.right;
  // Remaining horizontal space after placing canvas
  const horizontalSpace = canvasAreaWidth - canvasWidth;
  // Center the canvas within available space, with minimum margin
  const centeringOffset = Math.max(0, horizontalSpace / 2);

  // Canvas start margin: offset past subtoolbar (absolute positioned, so flex doesn't account for it) + centering
  // In both LTR and RTL, subtoolbar is on the "start" side, so marginStart needs the offset
  const canvasLeftMargin = subtoolbarOffset + centeringOffset;

  console.log('[PageEditorScreen] Canvas centering:', {
    language,
    screenWidth: screenDimensions.width,
    toolbarWidth: TOOLBAR_WIDTH,
    canvasAreaWidth,
    canvasWidth,
    horizontalSpace,
    centeringOffset,
    canvasLeftMargin,
  });

  // Absolute sideMargin for screen2Canvas calculation (absolute screen-left of canvas):
  // In LTR: canvas left = toolbar + subtoolbar + centeringOffset + insets.left
  // In RTL: canvas left = insets.left + centeringOffset (subtoolbar is on right, pushes canvas left)
  const sideMargin = language === 'en'
    ? toolbarWidth + subtoolbarOffset + centeringOffset + insets.left
    : insets.left + centeringOffset;

  console.log('[PageEditorScreen] sideMargin calculation:', {
    language,
    isLTR: language === 'en',
    toolbarWidth,
    subtoolbarOffset,
    canvasLeftMargin,
    centeringOffset,
    insetsLeft: insets.left,
    finalSideMargin: sideMargin,
  });

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

  // Helper function to show RTL-aware alerts
  const showAlert = (title: string, message: string, buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      buttons: buttons || [{ text: t('settings.ok') }],
    });
  };

  // Load initial page data into queue and state
  useEffect(() => {
    // Reset recording state when switching pages
    if (isRecording) {
      Sound.stopRecorder().catch(() => { });
      Sound.removeRecordBackListener();
      setIsRecording(false);
      setRecordingMetering(0);
    }

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

    // Set baseline queue length to limit undo to current editing session
    baselineQueueLength.current = queue.current.getQueueLength();
    console.log('[PageEditorScreen] Set baseline queue length:', baselineQueueLength.current);
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
      tiles: rebuiltTiles,
      backgroundPattern: rebuiltBackgroundPattern
    } = compileQueueToElements(queueElements);

    // Log emoji rotations
    console.log('rebuildStateFromQueue - rebuiltTexts emojis:', rebuiltTexts.filter(t => t.isEmoji).map(t => ({ id: t.id, rotation: t.rotation })));

    setPaths(rebuiltPaths);
    setTexts(rebuiltTexts);
    setImages(rebuiltImages);
    setTiles(rebuiltTiles || null);
    setBackgroundPattern(rebuiltBackgroundPattern);

    // Trigger re-render for undo/redo button states
    setQueueVersion(prev => prev + 1);

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
      updatedAt: Date.now(),
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

    // Save currently edited text before exiting — use refs to avoid stale closure
    const textToSave = currentEditedRef.current.textId || editingTextChangesRef.current?.id;
    if (textToSave) {
      handleTextEditEnd(textToSave);
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
      updatedAt: Date.now(),
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

    // Save pending text edits before navigating
    const textToSave = currentEditedRef.current.textId || editingTextChangesRef.current?.id;
    if (textToSave) {
      handleTextEditEnd(textToSave);
      setCurrentEdited({});
    }

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

    // Save pending text edits before navigating
    const textToSave = currentEditedRef.current.textId || editingTextChangesRef.current?.id;
    if (textToSave) {
      handleTextEditEnd(textToSave);
      setCurrentEdited({});
    }

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

    // Save pending text edits before creating new page
    const textToSave = currentEditedRef.current.textId || editingTextChangesRef.current?.id;
    if (textToSave) {
      handleTextEditEnd(textToSave);
      setCurrentEdited({});
    }

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

    // Collapse subtoolbar
    setShowToolOptions(false);

    onCreatePage();
  };

  const handleDeletePage = () => {
    if (!onDeletePage) return;

    // Show confirmation dialog
    showAlert(
      t('album.deletePageTitle'),
      t('album.deletePageMessage'),
      [
        {
          text: t('home.cancel'),
          style: 'cancel',
        },
        {
          text: t('home.delete'),
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
    // Save any pending text edits before undo — use refs to avoid stale closure
    const textToSave = currentEditedRef.current.textId || editingTextChangesRef.current?.id;
    if (textToSave) {
      handleTextEditEnd(textToSave);
      setCurrentEdited({});
    }

    if (queue.current.undo(ENABLE_UNLIMITED_UNDO ? undefined : baselineQueueLength.current)) {
      rebuildStateFromQueue();

      // If an emoji is selected, reload its rotation from the undone state
      const currentId = currentEmojiIdRef.current;
      if (currentId) {
        const emoji = textsRef.current.find(t => t.id === currentId);
        setEmojiRotation(emoji?.rotation);
      }

      // Trigger re-render for button states
      setQueueVersion(prev => prev + 1);

      // Auto-save after undo
      autoSave();
    }
  };

  const handleRedo = () => {
    // Save any pending text edits before redo — use refs to avoid stale closure
    const textToSave = currentEditedRef.current.textId || editingTextChangesRef.current?.id;
    if (textToSave) {
      handleTextEditEnd(textToSave);
      setCurrentEdited({});
    }

    if (queue.current.redo()) {
      rebuildStateFromQueue();

      // If an emoji is selected, reload its rotation from the redone state
      const currentId = currentEmojiIdRef.current;
      if (currentId) {
        const emoji = textsRef.current.find(t => t.id === currentId);
        setEmojiRotation(emoji?.rotation);
      }

      // Trigger re-render for button states
      setQueueVersion(prev => prev + 1);

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

  const handleTextLayout = (id: string, width: number, height: number) => {
    // Track text layout changes (width/height from canvas measurement)
    // Only update if this text is currently being edited
    console.log('handleTextLayout:', { id, width, height, currentEdited: currentEditedRef.current.textId });
    if (currentEditedRef.current.textId === id) {
      setEditingTextChanges(prev => prev?.id === id ? { ...prev, width, height } : { id, width, height });
    }
  };

  const handleTextEditEnd = (id: string) => {
    // Save all accumulated changes to queue when editing ends

    console.log('handleTextEditEnd START:', {
      id,
      changes: editingTextChangesRef.current
    });

    if (editingTextChangesRef.current?.id !== id) {
      console.log('No text changes to save for', id);
      return;
    }

    // Find the LATEST version of the text from the queue (iterate backwards)
    const queueElems = queue.current.getAll();
    let baseText: SketchText | undefined;
    let latestIsDelete = false;

    // Search backwards to get the latest version
    for (let i = queueElems.length - 1; i >= 0; i--) {
      const qe = queueElems[i];
      if (qe.type === 'textDelete' && qe.elem?.id === id) {
        // Most recent op for this id is a delete - don't resurrect it
        latestIsDelete = true;
        break;
      }
      if (qe.type === 'text' && qe.elem?.id === id) {
        baseText = qe.elem;
        console.log('Found latest text in queue at index', i, baseText);
        break;
      }
    }

    if (latestIsDelete) {
      // Only block if user didn't deliberately re-create (no text content + not actively editing this id)
      const changes = editingTextChangesRef.current;
      const hasContent = changes?.text && changes.text.trim().length > 0;
      const isActivelyEditing = currentEditedRef.current.textId === id;
      if (!hasContent && !isActivelyEditing) {
        console.log('Skipping save - text', id, 'was just deleted and no re-creation in progress');
        setEditingTextChanges(null);
        editingTextChangesRef.current = null;
        return;
      }
      console.log('Text', id, 'was deleted but user is re-creating it - allowing save');
      // Treat as fresh creation: ignore the deleted base
      baseText = undefined;
    }

    let textToSave: SketchText;

    // If not in queue, it's a brand new text - the changes ARE the complete text
    if (!baseText) {
      console.log('New text not in queue yet, using editingTextChanges as complete text');
      textToSave = editingTextChangesRef.current as SketchText;
    } else {
      // Merge changes with base text from queue
      console.log('Merging changes with base text from queue');
      textToSave = { ...baseText, ...editingTextChangesRef.current };

      // Check if anything actually changed
      const hasChanges = Object.keys(editingTextChangesRef.current).some(key => {
        if (key === 'id') return false; // Skip id field
        return editingTextChangesRef.current![key as keyof SketchText] !== baseText[key as keyof SketchText];
      });

      if (!hasChanges) {
        console.log('No actual changes detected, skipping push');
        setEditingTextChanges(null);
        return;
      }
    }

    console.log('handleTextEditEnd: saving text', {
      id,
      baseText,
      changes: editingTextChangesRef.current,
      textToSave
    });

    queue.current.pushText(textToSave);
    // Enforce mutual exclusion: if saving title, remove tiles
    if (id === TITLE_TEXT_ID && tilesRef.current) {
      queue.current.pushDeleteTiles();
    }

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

    // Auto-generate word timings if:
    // 1. This is the title text
    // 2. There's audio recorded with duration
    // 3. The title text is not empty
    // Always regenerate on title save so a freshly-typed title remaps audio
    // (e.g. tiles were deleted and replaced with a title — old tile timings are stale).
    if (id === TITLE_TEXT_ID && textToSave.text && textToSave.text.trim().length > 0) {
      // Check current audio state
      const currentAudio = audiosRef.current.find(a => a.id === 'page_audio');
      if (currentAudio?.duration && currentAudio.audioPath) {
        console.log('[handleTextEditEnd] Auto-mapping word timings for title text');
        const words = textToSave.text.split(/\s+/).filter(w => w.length > 0);
        const audioDurationInSeconds = currentAudio.duration / 1000; // Convert from ms to seconds
        const wordTimings = generateInitialWordTimings(words, audioDurationInSeconds);

        // Update the audio with word timings
        const updatedAudio: SketchAudio = {
          ...currentAudio,
          audioPath: currentAudio.audioPath,
          wordTimings
        };

        queue.current.pushAudio(updatedAudio);
        rebuildStateFromQueue();
        autoSave();

        console.log('[handleTextEditEnd] Auto-generated word timings:', wordTimings);
      }
    }
  };

  // Check if edited text is visible (not behind keyboard)
  const verifyCurrentEditTextIsVisible = useCallback(() => {
    if (keyboardTopRef.current === 0) return;

    // Check if a text is currently being edited
    const textId = currentEdited.textId;
    if (!textId) return;

    const textElem = texts.find(t => t.id === textId);
    if (!textElem) return;

    // Calculate text bottom position in screen coordinates
    const elemHeight = textElem.tempTop2CursorHeight || textElem.height || 20;
    const elemBottom = (textElem.y + elemHeight + canvasOffsetRef.current.y) * ratio;

    console.log('[verifyCurrentEditTextIsVisible]', {
      elemBottom,
      keyboardTop: keyboardTopRef.current,
      textY: textElem.y,
      elemHeight,
      canvasOffsetY: canvasOffsetRef.current.y,
      ratio
    });

    // If text bottom is below keyboard top, adjust canvas offset
    if (elemBottom > keyboardTopRef.current) {
      const dy = (keyboardTopRef.current - elemBottom) / ratio;
      console.log('[verifyCurrentEditTextIsVisible] Text behind keyboard, adjusting by:', dy);

      const newOffset = {
        x: canvasOffsetRef.current.x,
        y: canvasOffsetRef.current.y + dy - 10 // Extra 10px margin
      };

      setCanvasOffset(newOffset);
      canvasOffsetRef.current = newOffset;
    }
  }, [currentEdited.textId, texts, ratio]);

  // Assign to ref so keyboard listener can call it
  verifyCurrentEditTextIsVisibleRef.current = verifyCurrentEditTextIsVisible;

  // Handle canvas movement when keyboard is shown (allow manual scrolling)
  const handleCanvasMove = useCallback((newOffset: { x: number; y: number }) => {
    // Only allow vertical movement when keyboard is shown
    if (keyboardHeightRef.current > 0) {
      console.log('[handleCanvasMove] Updating canvas offset:', newOffset);
      // Keep x at 0 (no horizontal movement), only allow vertical (y) movement
      const restrictedOffset = {
        x: 0,
        y: newOffset.y
      };
      setCanvasOffset(restrictedOffset);
      canvasOffsetRef.current = restrictedOffset;
    } else {
      // When keyboard is hidden, reset to no offset
      setCanvasOffset({ x: 0, y: 0 });
      canvasOffsetRef.current = { x: 0, y: 0 };
    }
  }, []);

  const handleCanvasClick = (p: SketchPoint, elem: any) => {
    console.log('========== handleCanvasClick ==========');
    console.log('handleCanvasClick', { mode: currentElementTypeRef.current, p, elem: elem?.id, currentEditedBefore: currentEditedRef.current });
    console.log('currentEdited (ref):', currentEditedRef.current);
    console.log('editingTextChanges (ref):', editingTextChangesRef.current);

    // Check if clicked element is an image - handle it regardless of current mode
    if (elem && elem.type === 'image') {
      console.log('Clicked on image:', elem.id);
      handleImageClick(elem.id);
      return;
    }

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

    // Clear tile selection on background tap
    if (!elem) {
      setSelectedTileIndices(new Set());
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
    // Save currently edited text before switching modes
    const textToSave = currentEditedRef.current.textId || editingTextChangesRef.current?.id;
    if (textToSave) {
      handleTextEditEnd(textToSave);
      setCurrentEdited({});
    }

    setCurrentElementType(ElementTypes.Text);
    currentElementTypeRef.current = ElementTypes.Text;
    setShowToolOptions(true);
    setAudioMode(false); // Exit audio mode

    // Auto-enter tiles or title mode if one already exists
    if (tilesRef.current) {
      const existingTiles = tilesRef.current;
      setTilesBgColor(existingTiles.backgroundColor);
      setTilesTextColor(existingTiles.textColor);
      setTilesSize(existingTiles.fontSize && existingTiles.fontSize > 1 ? 0.12 : existingTiles.fontSize);
      setTilesScale(existingTiles.size ?? 1);
      setTilesSelected(true);
    } else if (textsRef.current.find(t => t.id === TITLE_TEXT_ID)) {
      handleEditTitle();
    }
  };

  const handleEditTitle = () => {
    // Save current text before switching — use refs to avoid stale closure
    const textToSave = currentEditedRef.current.textId || editingTextChangesRef.current?.id;
    if (textToSave) {
      handleTextEditEnd(textToSave);
    }

    // Clear editing text changes
    setEditingTextChanges(null);
    editingTextChangesRef.current = null;

    // Check if tiles exist - tiles and title are mutually exclusive
    if (tilesRef.current) {
      setAlertConfig({
        visible: true,
        title: t('editor.textTitle'),
        message: t('editor.tilesExistCannotAddTitle'),
        buttons: [{ text: t('settings.ok') }],
      });
      return;
    }

    // Deselect tiles only if no conflict
    setTilesSelected(false);
    setSelectedTileIndices(new Set());

    setTextMode('title');
    const existingTitle = textsRef.current.find(t => t.id === TITLE_TEXT_ID);

    if (existingTitle) {
      setCurrentEdited({ textId: TITLE_TEXT_ID });
      currentEditedRef.current = { textId: TITLE_TEXT_ID }; // Update ref immediately
      setTextSize(existingTitle.fontSize);
      setTextColor(existingTitle.color);
    } else {
      // Create new title after subtoolbar with margin
      // Note: title coords are in canvas space, so convert screen space (subtoolbar) to canvas space
      const TITLE_MARGIN = 10;
      const subtoolbarCanvasWidth = SUBTOOLBAR_WIDTH;
      const marginCanvasWidth = TITLE_MARGIN;
      const startX = isRTL
        ? (canvasWidth - subtoolbarCanvasWidth - marginCanvasWidth)
        : (subtoolbarCanvasWidth + marginCanvasWidth);
      const topY = 100;
      const defaultTitleSize = TITLE_TEXT_SIZES[2].value; // M size (48)

      const newTitle: SketchText = {
        id: TITLE_TEXT_ID,
        text: '',
        fontSize: defaultTitleSize,
        color: textColor,
        rtl: isRTL,
        alignment: isRTL ? 'Right' : 'Left',
        x: startX / ratio,
        y: topY,
        width: 200,
        height: 80,
      };

      setEditingTextChanges(newTitle);
      setCurrentEdited({ textId: TITLE_TEXT_ID });
      currentEditedRef.current = { textId: TITLE_TEXT_ID }; // Update ref immediately
      setTextSize(defaultTitleSize);
    }
  };

  const handleEditBody = () => {
    console.log('[handleEditBody] START - currentEdited:', currentEditedRef.current);

    // Save current text before switching — use refs to avoid stale closure
    const textToSave = currentEditedRef.current.textId || editingTextChangesRef.current?.id;
    if (textToSave) {
      console.log('[handleEditBody] Saving previous text:', textToSave);
      handleTextEditEnd(textToSave);
    }

    // Clear editing text changes
    setEditingTextChanges(null);
    editingTextChangesRef.current = null;

    // Deselect tiles
    setTilesSelected(false);
    setSelectedTileIndices(new Set());

    setTextMode('body');
    const existingBody = texts.find(t => t.id === BODY_TEXT_ID);

    if (existingBody) {
      // Edit existing body
      console.log('[handleEditBody] Editing existing body, size:', existingBody.fontSize);
      setCurrentEdited({ textId: BODY_TEXT_ID });
      currentEditedRef.current = { textId: BODY_TEXT_ID }; // Update ref immediately
      setTextSize(existingBody.fontSize);
      setTextColor(existingBody.color);
      console.log('[handleEditBody] Set currentEdited to BODY_TEXT_ID');
    } else {
      // Create new body text in center
      const defaultBodySize = BODY_TEXT_SIZES[2].value; // M size (22)
      const textWidth = 200;
      const textHeight = 100;
      // For RTL, x position is at the right edge, so add half width to center
      // For LTR, x position is at the left edge, so subtract half width to center
      const centerX = isRTL
        ? canvasWidth / 2 + textWidth / 2
        : (canvasWidth - textWidth) / 2;
      const centerY = (canvasHeight - textHeight) / 2;

      const newBody: SketchText = {
        id: BODY_TEXT_ID,
        text: '',
        fontSize: defaultBodySize,
        color: textColor,
        rtl: isRTL,
        alignment: isRTL ? 'Right' : 'Left',
        x: centerX,
        y: centerY,
        width: textWidth,
        height: textHeight,
      };

      setEditingTextChanges(newBody);
      setCurrentEdited({ textId: BODY_TEXT_ID });
      currentEditedRef.current = { textId: BODY_TEXT_ID }; // Update ref immediately
      setTextSize(defaultBodySize);
    }
  };

  const handleEditTiles = () => {
    // Save current text before switching — use refs to avoid stale closure
    const textToSave = currentEditedRef.current.textId || editingTextChangesRef.current?.id;
    if (textToSave) {
      handleTextEditEnd(textToSave);
    }

    // If tiles already exist, just select them (don't open modal)
    if (tilesRef.current) {
      const existingTiles = tilesRef.current;
      // Initialize styling state from existing tiles
      setTilesBgColor(existingTiles.backgroundColor);
      setTilesTextColor(existingTiles.textColor);
      setTilesSize(existingTiles.fontSize && existingTiles.fontSize > 1 ? 0.12 : existingTiles.fontSize);
      setTilesScale(existingTiles.size ?? 1);
      // Mark tiles as selected
      setTilesSelected(true);
      return;
    }

    // Check if title exists - tiles and title are mutually exclusive
    const existingTitle = textsRef.current.find(t => t.id === TITLE_TEXT_ID);
    if (existingTitle) {
      setAlertConfig({
        visible: true,
        title: t('editor.tilesTitle'),
        message: t('editor.titleExistsCannotAddTiles'),
        buttons: [{ text: t('settings.ok') }],
      });
      return;
    }

    // No tiles yet - open modal to create new tiles
    setTilesSelected(true);
    setShowTilesModal(true);
  };

  const handleEditTilesText = () => {
    // Open modal to edit tiles text only
    if (tiles) {
      setTilesBgColor(tiles.backgroundColor);
      setTilesTextColor(tiles.textColor);
      setTilesSize(tiles.fontSize && tiles.fontSize > 1 ? 0.12 : tiles.fontSize);
      setTilesScale(tiles.size ?? 1);
    }
    setShowTilesModal(true);
  };

  const handleTilesConfirm = async (text: string) => {
    // Split text into words
    const words = text.trim().split(/\s+/);

    // If editing existing tiles, try to preserve merge state and symbols
    let tileWords: TileWord[];

    if (tiles) {
      // Editing: try to preserve merges and symbols if word count matches
      const existingWordCount = tiles.words.reduce((sum, tile) => sum + tile.originalIndices.length, 0);
      if (existingWordCount === words.length) {
        // Same number of words, preserve merge structure and symbols
        let wordIndex = 0;
        tileWords = tiles.words.map((tile) => {
          const numWords = tile.originalIndices.length;
          const tileText = words.slice(wordIndex, wordIndex + numWords).join(' ');
          const originalIndices = Array.from({ length: numWords }, (_, i) => wordIndex + i);
          wordIndex += numWords;
          return {
            text: tileText,
            originalIndices,
            symbol: tile.symbol, // Preserve existing symbol
            symbolType: tile.symbolType, // Preserve symbolType (emoji vs image)
          };
        });
      } else {
        // Different word count, create new tiles (will search symbols below)
        tileWords = words.map((word, index) => ({
          text: word,
          originalIndices: [index],
        }));
      }
    } else {
      // Creating new: each word as a separate tile (will search symbols below)
      tileWords = words.map((word, index) => ({
        text: word,
        originalIndices: [index],
      }));
    }

    // Search for symbols for tiles that don't have one
    tileWords = await searchSymbolsForTiles(tileWords, text);

    // Calculate approximate tile size for positioning
    // TileSize formula: canvasWidth / (1.5 * numTiles + 0.5)
    // But cap at MAX_TILE_SIZE_RATIO of page height
    const numTiles = tileWords.length;
    const calculatedTileSize = pageWidth / (1.5 * numTiles + 0.5);
    const maxTileSize = pageHeight * MAX_TILE_SIZE_RATIO;
    const approxTileSize = Math.min(calculatedTileSize, maxTileSize);

    console.log('[handleTilesConfirm] Tile size calculation:', {
      numTiles,
      pageWidth,
      pageHeight,
      calculatedTileSize,
      maxTileSize,
      finalTileSize: approxTileSize,
      percentageOfHeight: ((approxTileSize / pageHeight) * 100).toFixed(1) + '%',
    });

    const newTiles: SketchTiles = {
      id: TILES_ID,
      words: tileWords,
      fontSize: tilesSize,
      backgroundColor: tilesBgColor,
      textColor: tilesTextColor,
      rtl: isRTL,
      y: pageHeight - approxTileSize * 1.5, // Position half tile-size from bottom
      size: tilesScale,
    };

    queue.current.pushTiles(newTiles);
    // Enforce mutual exclusion: remove title if it exists
    if (textsRef.current.find(t => t.id === TITLE_TEXT_ID)) {
      queue.current.pushTextDelete(TITLE_TEXT_ID);
    }
    rebuildStateFromQueue();

    // If there's audio with word timings, regenerate timings for new text
    if (pageAudioFile && pageAudioWordTimings.length > 0) {
      // Get audio duration - search for any audio element that has duration set
      const queueElements = queue.current.getAll();

      // Find any audio element with duration (search backwards for most recent)
      let durationMs: number | undefined;
      for (let i = queueElements.length - 1; i >= 0; i--) {
        const qe = queueElements[i];
        if ((qe.type === 'audio' || qe.type === 'audioAdd') &&
          qe.elem?.id === PAGE_AUDIO_ID &&
          qe.elem?.duration) {
          durationMs = qe.elem.duration;
          break;
        }
      }

      // Fallback to ref if not found in queue
      if (!durationMs && pageAudioDurationRef.current) {
        durationMs = pageAudioDurationRef.current * 1000;
      }

      // Final fallback
      if (!durationMs) {
        durationMs = 10000; // Default 10 seconds
      }

      const audioDuration = durationMs / 1000;

      console.log('[handleTilesConfirm] Audio duration for regeneration:', audioDuration, 'ms:', durationMs);

      // Use the same smart algorithm that's used for title text
      const newWordTimings = generateInitialWordTimings(words, audioDuration);

      // Update audio with new word timings, preserving duration
      const updatedAudio: SketchAudio = {
        id: PAGE_AUDIO_ID,
        audioPath: pageAudioFile,
        x: 0,
        y: 0,
        duration: durationMs, // Store in milliseconds
        wordTimings: newWordTimings,
      };

      queue.current.pushAudio(updatedAudio);
      rebuildStateFromQueue();

      console.log('[handleTilesConfirm] Regenerated word timings for tiles:', newWordTimings, 'duration preserved:', durationMs);
    }

    autoSave();
  };

  const regenerateAudioTimings = (newTileWords: TileWord[]) => {
    if (!pageAudioFile || pageAudioWordTimings.length === 0) return;

    const queueElements = queue.current.getAll();
    let durationMs: number | undefined;
    for (let i = queueElements.length - 1; i >= 0; i--) {
      const qe = queueElements[i];
      if ((qe.type === 'audio' || qe.type === 'audioAdd') &&
        qe.elem?.id === PAGE_AUDIO_ID &&
        qe.elem?.duration) {
        durationMs = qe.elem.duration;
        break;
      }
    }
    if (!durationMs && pageAudioDurationRef.current) {
      durationMs = pageAudioDurationRef.current * 1000;
    }
    if (!durationMs) durationMs = 10000;

    const audioDuration = durationMs / 1000;
    const words = newTileWords.map(w => w.text);
    const newWordTimings = generateInitialWordTimings(words, audioDuration);

    const updatedAudio: SketchAudio = {
      id: PAGE_AUDIO_ID,
      audioPath: pageAudioFile,
      x: 0,
      y: 0,
      duration: durationMs,
      wordTimings: newWordTimings,
    };
    queue.current.pushAudio(updatedAudio);
  };

  const searchSymbolsForTiles = async (tileWords: TileWord[], text: string): Promise<TileWord[]> => {
    const needsSymbolSearch = tileWords.some(tile => !tile.symbol);
    if (!needsSymbolSearch) return tileWords;
    setSearchingSymbols(true);
    setSearchingSymbolsMode('auto');
    const detectedLanguage = detectLanguageFromText(text);
    try {
      const wordsToSearch = tileWords.map(tile => tile.symbol ? null : tile.text);
      const searchResults = await Promise.all(
        wordsToSearch.map(async (word) => {
          if (word === null) return null;
          try {
            return await SymbolSearchService.searchSymbol(word, detectedLanguage, albumId);
          } catch (error) {
            console.error('[PageEditor] Symbol search failed for', word, error);
            return null;
          }
        })
      );
      return tileWords.map((tile, index) => ({
        ...tile,
        symbol: tile.symbol || searchResults[index] || undefined,
        symbolType: tile.symbolType || (searchResults[index] ? 'image' : undefined),
      }));
    } catch (error) {
      console.error('[PageEditor] Symbol search error:', error);
      return tileWords;
    } finally {
      setSearchingSymbols(false);
    }
  };

  const handleMergeTile = () => {
    if (!tiles) return;
    const selected = Array.from(selectedTileIndicesRef.current).sort((a, b) => a - b);
    if (selected.length < 2) return;

    const selectedTiles = selected.map(i => tiles.words[i]);
    const mergedText = selectedTiles.map(t => t.text).join(' ');
    const mergedIndices = selectedTiles.flatMap(t => t.originalIndices);
    const firstTile = selectedTiles[0];

    const mergedWord: TileWord = {
      text: mergedText,
      originalIndices: mergedIndices,
      symbol: firstTile.symbol,
      symbolType: firstTile.symbolType,
      backgroundColor: firstTile.backgroundColor,
      textColor: firstTile.textColor,
    };

    const selectedSet = new Set(selected);
    const newWords: TileWord[] = [];
    let mergedInserted = false;
    tiles.words.forEach((word, i) => {
      if (!selectedSet.has(i)) {
        newWords.push(word);
      } else if (!mergedInserted) {
        newWords.push(mergedWord);
        mergedInserted = true;
      }
    });

    const numTiles = newWords.length;
    const calculatedTileSize = pageWidth / (1.5 * numTiles + 0.5);
    const maxTileSize = pageHeight * MAX_TILE_SIZE_RATIO;
    const approxTileSize = Math.min(calculatedTileSize, maxTileSize);

    const updatedTiles: SketchTiles = {
      ...tiles,
      words: newWords,
      y: pageHeight - approxTileSize * 1.5,
    };

    queue.current.pushTiles(updatedTiles);
    regenerateAudioTimings(newWords);
    rebuildStateFromQueue();
    autoSave();

    // Select the merged tile (it lands at the position of the lowest selected index)
    const lowestSelected = selected[0];
    const mergedPosition = newWords.indexOf(mergedWord);
    setSelectedTileIndices(new Set([mergedPosition !== -1 ? mergedPosition : lowestSelected]));
  };

  const handleUnmergeTile = async () => {
    if (!tiles) return;
    const selected = Array.from(selectedTileIndicesRef.current);
    if (selected.length !== 1) return;
    const index = selected[0];
    if (tiles.words[index].originalIndices.length <= 1) return;

    const tileToUnmerge = tiles.words[index];
    const words = tileToUnmerge.text.split(/\s+/);

    let newTiles: TileWord[] = words.map((word, i) => ({
      text: word,
      originalIndices: [tileToUnmerge.originalIndices[i]],
      backgroundColor: tileToUnmerge.backgroundColor,
      textColor: tileToUnmerge.textColor,
    }));

    // Re-run symbol search for the unmerged tiles
    newTiles = await searchSymbolsForTiles(newTiles, tileToUnmerge.text);

    const newWords = [...tiles.words];
    newWords.splice(index, 1, ...newTiles);

    const numTiles = newWords.length;
    const calculatedTileSize = pageWidth / (1.5 * numTiles + 0.5);
    const maxTileSize = pageHeight * MAX_TILE_SIZE_RATIO;
    const approxTileSize = Math.min(calculatedTileSize, maxTileSize);

    const updatedTiles: SketchTiles = {
      ...tiles,
      words: newWords,
      y: pageHeight - approxTileSize * 1.5,
    };

    queue.current.pushTiles(updatedTiles);
    regenerateAudioTimings(newWords);
    rebuildStateFromQueue();
    autoSave();

    // Select all the newly split tiles
    const newIndices = new Set(Array.from({ length: words.length }, (_, i) => index + i));
    setSelectedTileIndices(newIndices);
  };

  const handleAddEmoji = () => {
    if (!tiles) return;
    const selected = Array.from(selectedTileIndicesRef.current);
    if (selected.length !== 1) return;
    setSelectedTileIndex(selected[0]);
    setShowEmojiKeyboard(true);
  };

  const handleAddSymbol = () => {
    if (!tiles) return;
    const selected = Array.from(selectedTileIndicesRef.current);
    if (selected.length !== 1) return;
    setSelectedTileIndex(selected[0]);
    setShowSearchSymbolModal(true);
  };

  const handleDeleteSymbol = () => {
    if (!tiles) return;
    const selected = Array.from(selectedTileIndicesRef.current);
    if (selected.length !== 1) return;
    const index = selected[0];

    const newWords = [...tiles.words];
    newWords[index] = {
      ...newWords[index],
      symbol: undefined,
      symbolType: undefined,
    };

    const updatedTiles: SketchTiles = {
      ...tiles,
      words: newWords,
    };

    queue.current.pushTiles(updatedTiles);
    rebuildStateFromQueue();
    autoSave();
  };

  const handleTilesBgColorChange = (color: string) => {
    setTilesBgColor(color);
    if (!tiles) return;
    const selected = selectedTileIndicesRef.current;
    if (selected.size === 0) return;

    const newWords = tiles.words.map((word, i) =>
      selected.has(i) ? { ...word, backgroundColor: color } : word
    );
    const updatedTiles: SketchTiles = { ...tiles, words: newWords };
    queue.current.pushTiles(updatedTiles);
    rebuildStateFromQueue();
    autoSave();
  };

  const handleTilesTextColorChange = (color: string) => {
    setTilesTextColor(color);
    if (!tiles) return;
    const selected = selectedTileIndicesRef.current;
    if (selected.size === 0) return;

    const newWords = tiles.words.map((word, i) =>
      selected.has(i) ? { ...word, textColor: color } : word
    );
    const updatedTiles: SketchTiles = { ...tiles, words: newWords };
    queue.current.pushTiles(updatedTiles);
    rebuildStateFromQueue();
    autoSave();
  };

  const handleTilePress = (index: number) => {
    setSelectedTileIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSymbolSelectFromWeb = async (symbolId: string) => {
    if (!tiles || selectedTileIndex === null) return;

    // Download the symbol
    setSearchingSymbols(true);
    setSearchingSymbolsMode('manual');
    setShowSearchSymbolModal(false);

    try {
      const timestamp = Date.now();
      const fileName = `symbol_${symbolId}_${timestamp}.png`;
      const symbolsDir = `${RNFS.DocumentDirectoryPath}/albums/${albumId}/attachments`;

      // Ensure directory exists
      await RNFS.mkdir(symbolsDir);

      const localPath = `${symbolsDir}/${fileName}`;
      const symbolUrl = `${ImageLibrary.BASE_URL}/pictograms/${symbolId}?download=false`;

      // Download the image
      await RNFS.downloadFile({
        fromUrl: symbolUrl,
        toFile: localPath,
      }).promise;

      // Store relative path
      const relativePath = `attachments/${fileName}`;

      // Update tile
      const newWords = [...tiles.words];
      newWords[selectedTileIndex] = {
        ...newWords[selectedTileIndex],
        symbol: relativePath,
        symbolType: 'image',
      };

      const updatedTiles: SketchTiles = {
        ...tiles,
        words: newWords,
      };

      queue.current.pushTiles(updatedTiles);
      rebuildStateFromQueue();
      autoSave();
    } catch (error) {
      console.error('[PageEditor] Failed to download symbol:', error);
      showAlert(t('home.error'), t('editor.errorSaveImage'));
    } finally {
      setSearchingSymbols(false);
      setSelectedTileIndex(null);
    }
  };

  const handleSymbolSelect = (emoji: EmojiType) => {
    if (!tiles || selectedTileIndex === null) return;

    const newWords = [...tiles.words];
    newWords[selectedTileIndex] = {
      ...newWords[selectedTileIndex],
      symbol: emoji.emoji,
      symbolType: 'emoji',
    };

    const updatedTiles: SketchTiles = {
      ...tiles,
      words: newWords,
    };

    queue.current.pushTiles(updatedTiles);
    rebuildStateFromQueue();
    autoSave();

    setShowEmojiKeyboard(false);
    setSelectedTileIndex(null);
  };

  const handleTilesSetScale = (newScale: number) => {
    const clamped = Math.max(TILES_SCALE_MIN, Math.min(TILES_SCALE_MAX, newScale));
    setTilesScale(clamped);
    if (tiles) {
      const updatedTiles: SketchTiles = { ...tiles, size: clamped };
      queue.current.pushTiles(updatedTiles);
      rebuildStateFromQueue();
      autoSave();
    }
  };

  const handleTilesAdjustScale = (delta: number) => {
    const current = tiles?.size ?? tilesScale;
    handleTilesSetScale(current + delta);
  };

  const handleDeleteTiles = () => {
    showAlert(
      t('editor.tilesTitle'),
      t('editor.deleteTilesConfirm'),
      [
        { text: t('home.cancel'), style: 'cancel' },
        {
          text: t('home.delete'),
          style: 'destructive',
          onPress: () => {
            queue.current.pushDeleteTiles();
            // Clear word timings on the audio - source text is gone
            const currentAudio = audiosRef.current.find(a => a.id === PAGE_AUDIO_ID) as SketchAudio | undefined;
            if (currentAudio?.audioPath && currentAudio.wordTimings && currentAudio.wordTimings.length > 0) {
              const updatedAudio: SketchAudio = { ...currentAudio, wordTimings: [] };
              queue.current.pushAudio(updatedAudio);
            }
            rebuildStateFromQueue();
            autoSave();
          },
        },
      ]
    );
  };

  const handleDeleteTitle = () => {
    showAlert(
      t('editor.textTitle'),
      t('editor.deleteTitleConfirm'),
      [
        { text: t('home.cancel'), style: 'cancel' },
        {
          text: t('home.delete'),
          style: 'destructive',
          onPress: () => {
            queue.current.pushTextDelete(TITLE_TEXT_ID);
            // Clear in-flight edit state so handleCanvasClick doesn't resurrect the title
            if (currentEditedRef.current.textId === TITLE_TEXT_ID) {
              currentEditedRef.current = {};
              setCurrentEdited({});
            }
            if (editingTextChangesRef.current?.id === TITLE_TEXT_ID) {
              editingTextChangesRef.current = null;
              setEditingTextChanges(null);
            }
            // Clear word timings on the audio - source text is gone
            const currentAudio = audiosRef.current.find(a => a.id === PAGE_AUDIO_ID) as SketchAudio | undefined;
            if (currentAudio?.audioPath && currentAudio.wordTimings && currentAudio.wordTimings.length > 0) {
              const updatedAudio: SketchAudio = { ...currentAudio, wordTimings: [] };
              queue.current.pushAudio(updatedAudio);
            }
            rebuildStateFromQueue();
            autoSave();
          },
        },
      ]
    );
  };

  const handleSetSketchMode = () => {
    // Save currently edited text before switching modes
    const textToSave = currentEditedRef.current.textId || editingTextChangesRef.current?.id;
    if (textToSave) {
      handleTextEditEnd(textToSave);
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
    const textToSave = currentEditedRef.current.textId || editingTextChangesRef.current?.id;
    if (textToSave) {
      handleTextEditEnd(textToSave);
      setCurrentEdited({});
    }

    setCurrentElementType(ElementTypes.Image);
    currentElementTypeRef.current = ElementTypes.Image;
    setShowToolOptions(true);
    setAudioMode(false); // Exit audio mode
  };

  const handleSetEmojiMode = () => {
    // Save currently edited text before switching modes
    const textToSave = currentEditedRef.current.textId || editingTextChangesRef.current?.id;
    if (textToSave) {
      handleTextEditEnd(textToSave);
      setCurrentEdited({});
    }

    console.log('[handleSetEmojiMode] Setting emoji mode, currentElementType:', ElementTypes.Emoji);
    setCurrentElementType(ElementTypes.Emoji);
    currentElementTypeRef.current = ElementTypes.Emoji;
    setShowToolOptions(true);
    setAudioMode(false); // Exit audio mode

    // Open emoji keyboard immediately
    setShowEmojiKeyboard(true);
  };

  const handleSetAudioMode = () => {
    // Save currently edited text before switching modes
    const textToSave = currentEditedRef.current.textId || editingTextChangesRef.current?.id;
    if (textToSave) {
      handleTextEditEnd(textToSave);
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
    const textToSave = currentEditedRef.current.textId || editingTextChangesRef.current?.id;
    if (textToSave) {
      handleTextEditEnd(textToSave);
      setCurrentEdited({});
    }

    console.log('[handleSetBackgroundMode] Setting background mode, currentElementType:', ElementTypes.Background);
    setCurrentElementType(ElementTypes.Background);
    currentElementTypeRef.current = ElementTypes.Background;
    setShowToolOptions(true);
    setAudioMode(false); // Exit audio mode
  };

  const checkAudioPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        // On Android 13+ (API 33+), WRITE_EXTERNAL_STORAGE is not needed for app-specific directories
        // We only need RECORD_AUDIO permission
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);

        if (grants['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED) {
          return true;
        } else {
          showAlert(t('editor.permissions'), t('editor.permissionsMessage'));
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
    console.log('[handleStartRecording] Called, current isRecording state:', isRecording);

    // Prevent starting if already recording
    if (isRecording) {
      console.log('[handleStartRecording] Already recording, ignoring');
      return;
    }

    const hasPermission = await checkAudioPermissions();
    if (!hasPermission) {
      console.log('[handleStartRecording] No permission, aborting');
      return;
    }

    try {
      console.log('[handleStartRecording] Starting recorder with voice recognition config...');
      // Use VOICE_RECOGNITION audio source for better voice capture on Android
      const audioConfig = {
        AudioSourceAndroid: 6, // VOICE_RECOGNITION - optimized for voice with noise cancellation
        OutputFormatAndroid: 2, // MPEG_4
        AudioEncoderAndroid: 3, // AAC
      };
      const result = await Sound.startRecorder(undefined, audioConfig, true); // Enable metering
      console.log('[handleStartRecording] startRecorder result:', result);
      Sound.addRecordBackListener((e) => {
        console.log('Recording progress:', e.currentPosition, 'metering:', e.currentMetering);
        // currentMetering is in dB (typically -160 to 0)
        // Convert to 0-1 range for visualization with adjustable sensitivity
        if (e.currentMetering !== undefined && e.currentMetering !== null) {
          // Normalize: -60dB (quiet) to 0dB (loud) → 0 to 1
          // Adjust sensitivity by changing the dB range
          const MIN_DB = -50; // More sensitive (lower = more sensitive)
          const MAX_DB = 0;
          const normalized = Math.max(0, Math.min(1, (e.currentMetering - MIN_DB) / (MAX_DB - MIN_DB)));
          console.log('[handleStartRecording] normalized metering:', normalized);
          setRecordingMetering(normalized);
        }
      });
      setIsRecording(true);
      console.log('[handleStartRecording] Recording started successfully, isRecording set to true');
    } catch (error) {
      console.error('[handleStartRecording] Failed to start recording:', error);
      setIsRecording(false); // Ensure state is correct on error
      showAlert(t('home.error'), t('editor.errorRecording'));
    }
  };

  const handleStopRecording = async () => {
    if (!isRecording) return;

    try {
      const result = await Sound.stopRecorder();
      Sound.removeRecordBackListener();
      setIsRecording(false);
      setRecordingMetering(0); // Reset metering
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
      setIsRecording(false); // Ensure state is correct on error
      showAlert(t('home.error'), t('editor.errorStopRecording'));
    }
  };

  const handlePlayAudio = async () => {
    // Use refs to avoid stale closure
    const currentFile = pageAudioFileRef.current;
    if (!currentFile) {
      console.log('[handlePlayAudio] No audio file to play');
      return;
    }

    try {
      // Convert relative path to absolute
      const absolutePath = AttachmentService.getAbsolutePath(albumId, currentFile);
      const filePath = `file://${absolutePath}`;
      console.log('[handlePlayAudio] Playing audio from toolbar:', filePath);
      console.log('[handlePlayAudio] Absolute path:', absolutePath);

      const result = await Sound.startPlayer(filePath);
      console.log('[handlePlayAudio] startPlayer result:', result);

      Sound.addPlayBackListener((e) => {
        console.log('[handlePlayAudio] Playback progress:', e.currentPosition, '/', e.duration);
        if (e.currentPosition >= e.duration && e.duration > 0) {
          console.log('[handlePlayAudio] Playback complete, stopping');
          Sound.stopPlayer().catch(console.error);
          Sound.removePlayBackListener();
        }
      });
    } catch (error) {
      console.error('[handlePlayAudio] Failed to play audio:', error);
      showAlert(t('home.error'), t('editor.errorPlayRecording'));
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
      showAlert(t('home.error'), t('editor.errorSaveRecording'));
    }
  };

  const handleOpenWordMapping = () => {
    // Flush any in-progress text edit so modal reads the latest title
    const textToSave = currentEditedRef.current.textId || editingTextChangesRef.current?.id;
    if (textToSave) {
      handleTextEditEnd(textToSave);
      setCurrentEdited({});
    }
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

    showAlert(
      t('editor.audio'),
      t('editor.deleteAudioConfirm'),
      [
        { text: t('home.cancel'), style: 'cancel' },
        {
          text: t('home.delete'),
          style: 'destructive',
          onPress: async () => {
            // Delete the audio from queue
            queue.current.pushDeleteAudio({ id: PAGE_AUDIO_ID });
            rebuildStateFromQueue();

            // Auto-save to disk
            await autoSave();

            // Close modal
            setShowWordMappingModal(false);
          },
        },
      ]
    );
  };

  const handleReRecordFromWordMapping = async () => {
    setShowWordMappingModal(false);
    // Clear current audio and start recording
    await handleClearPageAudio();
    await handleStartRecording();
  };

  const handleClearPageAudio = async () => {
    console.log('[handleClearPageAudio] Called, isRecording:', isRecording);

    // Stop recording if in progress
    if (isRecording) {
      console.log('[handleClearPageAudio] Stopping active recording');
      try {
        await Sound.stopRecorder();
        Sound.removeRecordBackListener();
        setIsRecording(false);
        setRecordingMetering(0);
        console.log('[handleClearPageAudio] Recording stopped, isRecording set to false');
      } catch (error) {
        console.error('[handleClearPageAudio] Failed to stop recording:', error);
        // Force reset state even if stop fails
        setIsRecording(false);
        setRecordingMetering(0);
      }
    }

    // Stop any playing audio
    try {
      await Sound.stopPlayer();
      Sound.removePlayBackListener();
    } catch (error) {
      // Ignore if not playing
      console.log('[handleClearPageAudio] No audio playing to stop');
    }

    // Remove from queue
    queue.current.pushDeleteAudio({ id: PAGE_AUDIO_ID });

    // Rebuild state from queue (this will clear pageAudioFile)
    rebuildStateFromQueue();

    // Auto-save to disk
    await autoSave();
    console.log('[handleClearPageAudio] Completed');
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
    // Check if we're editing a tile symbol
    if (selectedTileIndex !== null) {
      handleSymbolSelect(emojiObject);
      return;
    }

    // Create emoji as a text element with large font size
    const emojiId = getId('text'); // Use 'text' prefix so canvas treats it as text
    const emojiSize = 100; // Default emoji size (M)

    const newEmoji: SketchText = {
      id: emojiId,
      text: emojiObject.emoji,
      fontSize: emojiSize,
      color: '#000000', // Color doesn't matter for emojis
      rtl: isRTL,
      alignment: isRTL ? 'Right' : 'Left',
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
      setCurrentEdited({});
      setCurrentEmojiId(emojiId);
      // Load current rotation from the base texts array (which comes from queue)
      // Use ref to avoid stale closure after emoji moves
      const emoji = textsRef.current.find(t => t.id === emojiId);
      setEmojiRotation(emoji?.rotation);
    }
  };

  const handleImageClick = (imageId: string) => {
    // Switch to image mode when clicking an image
    setCurrentElementType(ElementTypes.Image);
    currentElementTypeRef.current = ElementTypes.Image;
    setShowToolOptions(true);
    setAudioMode(false);

    // Select the image
    setCurrentEdited({ imageId: imageId });
    setCurrentEmojiId(null);
  };

  const handleEmojiRotationChange = (rotation: number) => {
    // Update temporary rotation state for preview
    console.log("rotation slider change", rotation)
    setEmojiRotation(rotation);
  };

  const handleEmojiPinch = (scaleDelta: number, angleDelta: number) => {
    const currentId = currentEmojiIdRef.current;
    if (!currentId) return;

    const emoji = textsRef.current.find(t => t.id === currentId);
    if (!emoji) return;

    // Capture base state on first pinch event
    if (!emojiPinchBaseRef.current) {
      emojiPinchBaseRef.current = {
        rotation: emoji.rotation ?? 0,
        fontSize: emoji.fontSize,
      };
    }

    const base = emojiPinchBaseRef.current;
    const newRotation = ((base.rotation + angleDelta) % 360 + 360) % 360;
    const newSize = Math.max(20, Math.round(base.fontSize * scaleDelta));

    // Live preview only via state — no queue write during gesture
    setEmojiRotation(newRotation);
    setEmojiPinchSize(newSize);
  };

  const handleEmojiPinchEnd = () => {
    const currentId = currentEmojiIdRef.current;
    const rotation = emojiRotationRef.current;
    const newSize = emojiPinchSizeRef.current;

    emojiPinchBaseRef.current = null;
    setEmojiPinchSize(undefined);

    if (!currentId) return;
    const emoji = textsRef.current.find(t => t.id === currentId);
    if (!emoji) return;

    const updatedEmoji = {
      ...emoji,
      rotation: rotation ?? emoji.rotation ?? 0,
      fontSize: newSize ?? emoji.fontSize,
      width: (newSize ?? emoji.fontSize) / ratio,
      height: (newSize ?? emoji.fontSize) / ratio,
    };
    queue.current.pushText(updatedEmoji);
    rebuildStateFromQueue();
    autoSave();
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
      width: newSize / ratio, // Update width for hit detection
      height: newSize / ratio // Update height for hit detection
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
    const updatedEmoji = {
      ...emoji,
      fontSize: newSize,
      width: newSize / ratio, // Update width for hit detection
      height: newSize / ratio, // Update height for hit detection
    };

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
        selectionLimit: 10, // Allow multiple selection (up to 10 images)
      });

      if (result.assets && result.assets.length > 0) {
        // Check if multiple images selected
        if (result.assets.length > 1) {
          // Ask user what to do with multiple images
          showAlert(
            t('editor.multipleImagesSelected').replace('{count}', result.assets.length.toString()),
            t('editor.multipleImagesPrompt'),
            [
              {
                text: t('editor.addToCurrentPage'),
                onPress: () => handleAddMultipleImagesToCurrentPage(result.assets!),
              },
              {
                text: t('editor.createNewPages'),
                onPress: () => handleAddMultipleImagesToNewPages(result.assets!),
              },
              {
                text: t('home.cancel'),
                style: 'cancel',
              },
            ]
          );
        } else {
          // Single image - existing behavior
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

            // Select the image for editing (shows handles and subtoolbar)
            setCurrentEdited({ imageId: imageId });
            setCurrentElementType(ElementTypes.Image);
            setShowToolOptions(true);
          } catch (error) {
            console.error('Failed to save image attachment:', error);
            showAlert(t('home.error'), t('editor.errorSaveImage'));
          }
        }
      }
    } finally {
      setLoadingImagePicker(false);
    }
  };

  const handleAddMultipleImagesToCurrentPage = async (assets: any[]) => {
    try {
      const imageSize = canvasWidth * 0.35; // Slightly smaller for multiple images
      const gridCols = Math.ceil(Math.sqrt(assets.length));
      const spacing = 20;

      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        if (!asset.uri) continue;

        try {
          // Save image to attachments directory
          const relativePath = await AttachmentService.saveImageAttachment(albumId, asset.uri);

          const imageId = getId('image');
          const aspectRatio = (asset.width && asset.height) ? asset.width / asset.height : 1;

          // Calculate staggered position
          const col = i % gridCols;
          const row = Math.floor(i / gridCols);

          const imageWidth = imageSize;
          const imageHeight = imageSize / aspectRatio;

          // Stagger positions so they're visible but overlapping
          const offsetX = col * (imageWidth * 0.3 + spacing);
          const offsetY = row * (imageHeight * 0.3 + spacing);

          const newImage: SketchImage = {
            id: imageId,
            imagePath: relativePath,
            x: (canvasWidth / 2 - (gridCols * imageWidth * 0.3) / 2) + offsetX,
            y: (canvasHeight / 2 - imageHeight / 2) + offsetY,
            width: imageWidth,
            height: imageHeight,
            aspectRatio: aspectRatio,
          };

          queue.current.pushImage(newImage);
        } catch (error) {
          console.error('Failed to save image:', error);
        }
      }

      rebuildStateFromQueue();
      await autoSave();
    } catch (error) {
      console.error('Failed to add multiple images:', error);
      showAlert(t('home.error'), t('editor.errorSaveImage'));
    }
  };

  const handleAddMultipleImagesToNewPages = async (assets: any[]) => {
    try {
      // Add first image to current page
      if (assets[0] && assets[0].uri) {
        const relativePath = await AttachmentService.saveImageAttachment(albumId, assets[0].uri);
        const imageId = getId('image');
        const aspectRatio = (assets[0].width && assets[0].height) ? assets[0].width / assets[0].height : 1;
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

        queue.current.pushImage(newImage);
        rebuildStateFromQueue();
        await autoSave();
      }

      // Create new pages for remaining images
      for (let i = 1; i < assets.length; i++) {
        const asset = assets[i];
        if (!asset.uri) continue;

        try {
          // Save image attachment
          const relativePath = await AttachmentService.saveImageAttachment(albumId, asset.uri);

          // Create new page with same dimensions
          const pageId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const pages = await PageService.getPages(albumId);
          const nextPageNumber = pages.length + 1;

          const imageId = getId('image');
          const aspectRatio = (asset.width && asset.height) ? asset.width / asset.height : 1;
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

          // Create page with image
          const newPage: AlbumPageV2 = {
            id: pageId,
            pageNumber: nextPageNumber,
            backgroundPath: null,
            version: '2.0',
            elements: [
              {
                elem: newImage,
                type: 'image',
              },
            ],
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,
          };

          // Save the new page
          await PageService.updatePage(albumId, newPage);
          await PageService.updateAlbumPageCount(albumId, nextPageNumber);

          // Small delay to ensure unique timestamps
          await new Promise(resolve => setTimeout(resolve, 10));
        } catch (error) {
          console.error('Failed to create page for image:', error);
        }
      }

      // Notify parent to reload pages by saving current page again
      // This triggers loadPages() in the parent without creating a new page
      const savedPage: AlbumPageV2 = {
        id: page.id,
        pageNumber: page.pageNumber,
        backgroundPath: page.backgroundPath,
        version: '2.0',
        elements: queue.current.getAll(),
        canvasWidth: pageWidth,
        canvasHeight: pageHeight,
      };
      onSave(savedPage, false); // Don't exit editor
    } catch (error) {
      console.error('Failed to add images to new pages:', error);
      showAlert(t('home.error'), t('editor.errorSaveImage'));
    }
  };

  const handleCameraCapture = async (uri: string) => {
    try {
      setShowCameraModal(false);

      // Show image edit modal instead of immediately adding
      setPendingImageUri(uri);
      setShowImageEditModal(true);
    } catch (error) {
      console.error('Failed to handle camera capture:', error);
      showAlert(t('home.error'), t('editor.errorSaveImage'));
    }
  };

  const handleImageEditApply = async (editedUri: string, rotation: number) => {
    try {
      setShowImageEditModal(false);

      const source = pendingImageSource;

      // Save the edited image to attachments directory (regardless of source)
      const relativePath = await AttachmentService.saveImageAttachment(albumId, editedUri);
      console.log('Saved edited image to:', relativePath);

      // For background images
      if (source === 'background-camera' || source === 'background-library') {
        // Use queue to add background element with the saved relative path
        const backgroundElement: BackgroundPattern = {
          type: 'image',
          imageName: relativePath, // Use the relative path (e.g., "attachments/image_123.jpg")
        };

        handleApplyBackground(backgroundElement);

        console.log('Background image applied:', relativePath);
      } else if (source === 'edit-existing') {
        // Editing an existing image - replace it with the edited version
        const imageId = pendingImageId;
        const existingImage = imagesRef.current.find(img => img.id === imageId);

        if (existingImage) {
          // Update the image with new relative path (edited version)
          const updatedImage: SketchImage = {
            ...existingImage,
            imagePath: relativePath, // New edited image path
          };

          queue.current.pushImage(updatedImage);
          rebuildStateFromQueue();
          await autoSave();

          // Keep the image selected
          setCurrentEdited({ imageId: imageId });
        }
      } else {
        // For regular images (camera/library) - this is now only for camera
        // Get image dimensions (we'll use a default aspect ratio)
        const aspectRatio = 4 / 3;

        const imageId = getId('image');

        // Set image to 45% of canvas width
        const imageWidth = canvasWidth * 0.45;
        const imageHeight = imageWidth / aspectRatio;

        // Add image to center of canvas
        const newImage: SketchImage = {
          id: imageId,
          imagePath: relativePath,
          x: canvasWidth / 2 - imageWidth / 2,
          y: canvasHeight / 2 - imageHeight / 2,
          width: imageWidth,
          height: imageHeight,
          aspectRatio: aspectRatio,
        };

        console.log('Adding image to queue:', { id: imageId, imagePath: relativePath });

        // Commit full image to queue
        queue.current.pushImage(newImage);

        rebuildStateFromQueue();

        // Auto-save to disk without closing editor
        await autoSave();

        // Set as currently edited to show handles
        setCurrentEdited({ imageId: imageId });
      }

      // Reset pending state
      setPendingImageUri('');
      setPendingImageSource('camera');
      setPendingImageId('');
    } catch (error) {
      console.error('Failed to save edited image:', error);
      showAlert(t('home.error'), t('editor.errorSaveImage'));
    }
  };

  const handleImageEditCancel = () => {
    setShowImageEditModal(false);
    setPendingImageUri('');
    setPendingImageSource('camera');
  };

  const handleEditExistingImage = () => {
    // Get the currently selected image — use refs to avoid stale closure
    const imageId = currentEditedRef.current.imageId;
    if (!imageId) return;

    const image = imagesRef.current.find(img => img.id === imageId);
    if (!image) return;

    // Build the full path to the image
    // Use AttachmentService.getAbsolutePath which correctly handles the relative path
    const fullPath = AttachmentService.getAbsolutePath(albumId, image.imagePath);

    console.log('[handleEditExistingImage] Opening edit modal with image:', fullPath);

    // Open the edit modal with the existing image
    setPendingImageUri(`file://${fullPath}`);
    setPendingImageSource('edit-existing');
    setPendingImageId(imageId); // Track which image we're editing
    setShowImageEditModal(true);
  };

  const handleDeleteImage = () => {
    // Use refs to avoid stale closure
    const imageId = currentEditedRef.current.imageId;
    if (!imageId) return;

    // Find the image to delete
    const image = imagesRef.current.find(img => img.id === imageId);
    if (!image) return;

    showAlert(
      t('editor.deleteImage'),
      t('editor.deleteImageConfirm'),
      [
        { text: t('home.cancel'), style: 'cancel' },
        {
          text: t('home.delete'),
          style: 'destructive',
          onPress: () => {
            queue.current.pushDeleteImage(image);
            rebuildStateFromQueue();
            autoSave();
            setCurrentEdited({});
          },
        },
      ]
    );
  };

  const handleSearchImageSelect = async (filePath: string) => {
    try {
      setShowSearchImageModal(false);

      // Save image to attachments directory and get relative path
      // The filePath is the temporary downloaded file, we need to save it properly
      const relativePath = await AttachmentService.saveImageAttachment(albumId, filePath);

      // Get image dimensions (we'll use a square aspect ratio for search images)
      const aspectRatio = 1; // Square

      const imageId = getId('image');

      // Set image to 45% of canvas width
      const imageWidth = canvasWidth * 0.45;
      const imageHeight = imageWidth / aspectRatio;

      // Add image to center of canvas
      const newImage: SketchImage = {
        id: imageId,
        imagePath: relativePath,
        x: canvasWidth / 2 - imageWidth / 2,
        y: canvasHeight / 2 - imageHeight / 2,
        width: imageWidth,
        height: imageHeight,
        aspectRatio: aspectRatio,
      };

      console.log('Adding search image to queue:', { id: imageId, imagePath: relativePath });

      // Commit full image to queue
      queue.current.pushImage(newImage);

      rebuildStateFromQueue();

      // Auto-save to disk without closing editor
      await autoSave();

      // Set as currently edited to show handles
      setCurrentEdited({ imageId: imageId });
    } catch (error) {
      console.error('Failed to add search image:', error);
      showAlert(t('home.error'), t('editor.errorSaveImage'));
    }
  };


  const handleMoveElement = (type: any, id: string, p: SketchPoint) => {
    console.log('handleMoveElement:', { type, id, p });

    // For text elements, always accumulate in editingTextChanges and update ref
    if (type === MoveTypes.TextMove) {
      // Get the current text element to preserve width/height that canvas may have updated
      const newChanges = {
        id,
        x: p[0],
        y: p[1],
      };
      console.log('Moving text', newChanges);

      setEditingTextChanges(prev => prev?.id === id ? { ...prev, ...newChanges } : newChanges);
      editingTextChangesRef.current = newChanges; // Update ref immediately for handleMoveEnd

    } else if (type === MoveTypes.ImageMove || type === MoveTypes.ImageResize) {
      // For images, track move/resize separately
      console.log('Moving/resizing image, using movingElement, images:', imagesRef.current.map(i => ({ id: i.id, x: i.x, y: i.y })));

      // Get the base image to calculate size for resize operations
      const baseImage = imagesRef.current.find(i => i.id === id);
      console.log('Found baseImage:', baseImage ? { id: baseImage.id, x: baseImage.x, y: baseImage.y, width: baseImage.width, height: baseImage.height } : 'NOT FOUND');

      if (!baseImage) {
        console.log("Move/Resize image - not found");
        return
      }

      let moveData;
      if (type === MoveTypes.ImageResize) {
        // For resize, p contains the new bottom-right corner
        const width = p[0] - baseImage.x;
        const height = p[1] - baseImage.y;
        moveData = { id, type, x: baseImage.x, y: baseImage.y, width, height };
      } else {
        // For move, p contains the new position — clamp so 20% of image stays on canvas
        const minVisible = 0.2;
        const clampedX = Math.max(
          -(baseImage.width! * (1 - minVisible)),
          Math.min(p[0], pageWidth - baseImage.width! * minVisible)
        );
        const clampedY = Math.max(
          -(baseImage.height! * (1 - minVisible)),
          Math.min(p[1], pageHeight - baseImage.height! * minVisible)
        );
        moveData = { id, type, x: clampedX, y: clampedY, width: baseImage.width, height: baseImage.height };
      }
      console.log('Setting movingElement:', moveData);
      setMovingElement(moveData);
      movingElementRef.current = moveData; // Set ref immediately to avoid timing issues
      console.log('movingElementRef.current after set:', movingElementRef.current);
    } else if (type === MoveTypes.ElementMove) {
      // For audio elements (generic elements)
      console.log('Moving audio element');
      const audio = audiosRef.current.find(a => a.id === id);
      if (audio) {
        setAudios(prev => prev.map(a => a.id === id ? { ...a, x: p[0], y: p[1] } : a));
      }
    }
  };

  const handleMoveEnd = async (type: MoveTypes, id: string) => {
    console.log('handleMoveEnd:', { type, id });

    // For text, save the position from editingTextChanges (use ref to avoid stale closure)
    if (type === MoveTypes.TextMove) {
      const textChanges = editingTextChangesRef.current;
      console.log('Text moved, saving from editingTextChanges:', textChanges);

      if (textChanges && textChanges.id === id) {
        if (currentEditedRef.current.textId === id) {
          // Text is currently being edited — keep editingTextChanges so position
          // persists visually and gets merged when handleTextEditEnd runs
          console.log('Text in edit mode, keeping editingTextChanges for later save');
          return;
        }
        // Use displayTextsRef which has canvas layout mutations (width/height)
        const textElem = findLast(displayTextsRef.current, (t => t.id === id));
        if (textElem) {
          console.log('Saving text changes after move:', textChanges);
          queue.current.pushText({
            ...textElem,
            ...textChanges
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

      if (movingElementRef.current && movingElementRef.current.id === id) {
        // Use the tracked changes from movingElement
        positionData = {
          id: movingElementRef.current.id,
          x: movingElementRef.current.x,
          y: movingElementRef.current.y,
          width: movingElementRef.current.width!,
          height: movingElementRef.current.height!,
        };
        console.log('Using movingElementRef data:', positionData);
      }
      // else {
      //   // Fallback: find in displayImages
      //   console.log('movingElementRef not available, falling back to displayImages');
      //   const img = displayImages.find(i => i.id === id);
      //   if (!img) {
      //     console.error('Image not found in displayImages:', id);
      //     return;
      //   }
      //   positionData = {
      //     id: img.id,
      //     x: img.x,
      //     y: img.y,
      //     width: img.width,
      //     height: img.height,
      //   };
      // }

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
      // For audio elements — use ref to avoid stale closure
      const audio = audiosRef.current.find(a => a.id === id);
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
    console.log('[handleDeleteElement] Deleting element:', { type, id });

    showAlert(
      t('home.delete'),
      t('editor.deleteElementConfirm'),
      [
        { text: t('home.cancel'), style: 'cancel' },
        {
          text: t('home.delete'),
          style: 'destructive',
          onPress: () => {
            // Add delete operation to queue
            if (type === ElementTypes.Text) {
              queue.current.pushTextDelete(id);
            } else if (type === ElementTypes.Image) {
              // Find the image to get its full data for the delete operation — use ref to avoid stale closure
              const image = imagesRef.current.find(img => img.id === id);
              if (image) {
                queue.current.pushDeleteImage(image);
              } else {
                console.error('[handleDeleteElement] Image not found:', id);
              }
            } else if (type === ElementTypes.Sketch) {
              // For paths, we need to find the path and delete it
              const path = paths.find(p => p.id === id);
              if (path) {
                queue.current.pushDeletePath(path);
              } else {
                console.error('[handleDeleteElement] Path not found:', id);
              }
            }

            // Rebuild state from queue (this will reflect the deletion)
            rebuildStateFromQueue();

            // Auto-save
            autoSave();

            console.log('[handleDeleteElement] Element deleted, queue length:', queue.current.getAll().length);
          },
        },
      ]
    );
  };

  // Render callback for custom elements
  const handleRenderElements = (elem: SketchElement) => {
    if (elem.type === 'tiles') {
      const tilesElem = elem as unknown as SketchTiles;
      return (
        <TilesElement
          tiles={tilesElem}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          ratio={ratio}
          editMode={tilesSelected}
          selectedIndices={selectedTileIndices}
          onTilePress={handleTilePress}
          highlightedWordIndex={undefined}
          albumId={albumId}
          themeColor={colors.primary}
        />
      );
    }
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
        {/* Start side: Done button (Left in LTR, Right in RTL) */}
        <TouchableOpacity style={[styles.doneButton, { backgroundColor: colors.primary }]} onPress={handleBack} accessibilityLabel={t('album.done')}>
          <Text allowFontScaling={false} style={[styles.doneButtonText, { color: colors.cardBackground }]}>{t('album.done')}</Text>
        </TouchableOpacity>

        {/* Center: Page Navigation and Title */}
        <View style={styles.titleContainer}>
          {/* Previous Page Button */}
          {pages && pages.length > 1 && (
            <TouchableOpacity
              style={[styles.iconButton, !hasPrevPage && styles.iconButtonDisabled]}
              onPress={handlePrevPage}
              disabled={!hasPrevPage}
              accessibilityLabel="עמוד קודם"
            >
              <MyIcon info={{ name: isRTL ? "chevron-right" : "chevron-left", size: 32, color: hasPrevPage ? '#007AFF' : '#ccc', type: "MDI" }} />
            </TouchableOpacity>
          )}

          {/* Title */}
          <Text allowFontScaling={false} style={styles.title}>
            {t('editor.page')} {page.pageNumber} {pages && pages.length > 1 ? `${t('editor.of')} ${pages.length}` : ''}
          </Text>

          {/* Next Page Button */}
          {pages && pages.length > 1 && (
            <TouchableOpacity
              style={[styles.iconButton, !hasNextPage && styles.iconButtonDisabled]}
              onPress={handleNextPage}
              disabled={!hasNextPage}
              accessibilityLabel="עמוד הבא"
            >
              <MyIcon info={{ name: isRTL ? "chevron-left" : "chevron-right", size: 32, color: hasNextPage ? '#007AFF' : '#ccc', type: "MDI" }} />
            </TouchableOpacity>
          )}
        </View>

        {/* End side: Undo/Redo (Right in LTR, Left in RTL) */}
        <View style={styles.headerLeft}>
          {/* Undo/Redo */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.iconButton, !queue.current.canUndo(ENABLE_UNLIMITED_UNDO ? undefined : baselineQueueLength.current) && styles.iconButtonDisabled]}
              onPress={handleUndo}
              disabled={!queue.current.canUndo(ENABLE_UNLIMITED_UNDO ? undefined : baselineQueueLength.current)}
              accessibilityLabel="ביטול פעולה אחרונה"
            >
              <MyIcon info={{ name: "undo", size: 24, color: queue.current.canUndo(ENABLE_UNLIMITED_UNDO ? undefined : baselineQueueLength.current) ? '#007AFF' : '#ccc', type: "MI" }} />
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
      </View>

      {/* Editor Container: Toolbar on start side, Canvas on end side */}
      <View style={[styles.editorContainer, { direction: isRTL ? 'rtl' : 'ltr' }]}>
        {/* Toolbar Level 1 - Start Side (Left in LTR, Right in RTL due to direction property) */}
        <ScrollView
          style={[styles.toolbar, {
            width: toolbarWidth,
            flexGrow: 0,
            flexShrink: 0,
            borderEndWidth: 1,
            borderEndColor: '#e0e0e0'
          }]}
          contentContainerStyle={[styles.toolbarContent, {
            paddingVertical: toolbarPaddingVertical,
            gap: toolbarGap,
          }]}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={[styles.mainToolButton, {
              width: toolbarButtonSize,
              height: toolbarButtonSize,
              borderRadius: toolbarButtonSize / 2,
            }, currentElementType === ElementTypes.Text && styles.mainToolButtonActive]}
            onPress={handleSetTextMode}
          >
            <MyIcon info={{ name: "format-text", size: isMobileLandscape ? 32 : 38, color: currentElementType === ElementTypes.Text ? '#007AFF' : '#555', type: "MDI" }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainToolButton, {
              width: toolbarButtonSize,
              height: toolbarButtonSize,
              borderRadius: toolbarButtonSize / 2,
            }, currentElementType === ElementTypes.Image && styles.mainToolButtonActive]}
            onPress={handleSetImageMode}
          >
            <MyIcon info={{ name: "image", size: isMobileLandscape ? 32 : 38, color: currentElementType === ElementTypes.Image ? '#007AFF' : '#555', type: "MDI" }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainToolButton, {
              width: toolbarButtonSize,
              height: toolbarButtonSize,
              borderRadius: toolbarButtonSize / 2,
            }, audioMode && styles.mainToolButtonActive]}
            onPress={handleSetAudioMode}
          >
            <MyIcon info={{ name: "microphone", size: isMobileLandscape ? 32 : 38, color: audioMode ? '#007AFF' : '#555', type: "MDI" }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainToolButton, {
              width: toolbarButtonSize,
              height: toolbarButtonSize,
              borderRadius: toolbarButtonSize / 2,
            }, currentElementType === ElementTypes.Sketch && styles.mainToolButtonActive]}
            onPress={() => {
              handleSetSketchMode();
              setIsEraser(false);
            }}
          >
            <MyIcon info={{ name: "pencil", size: isMobileLandscape ? 32 : 38, color: currentElementType === ElementTypes.Sketch ? '#007AFF' : '#555', type: "MDI" }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainToolButton, {
              width: toolbarButtonSize,
              height: toolbarButtonSize,
              borderRadius: toolbarButtonSize / 2,
            }, currentElementType === ElementTypes.Background && styles.mainToolButtonActive]}
            onPress={handleSetBackgroundMode}
          >
            <MyIcon info={{ name: "format-color-fill", size: isMobileLandscape ? 32 : 38, color: currentElementType === ElementTypes.Background ? '#007AFF' : '#555', type: "MDI" }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.mainToolButton, {
              width: toolbarButtonSize,
              height: toolbarButtonSize,
              borderRadius: toolbarButtonSize / 2,
            }, currentElementType === ElementTypes.Emoji && styles.mainToolButtonActive]}
            onPress={handleSetEmojiMode}
          >
            <MyIcon info={{ name: "emoticon-happy-outline", size: isMobileLandscape ? 32 : 38, color: currentElementType === ElementTypes.Emoji ? '#007AFF' : '#555', type: "MDI" }} />
          </TouchableOpacity>

          {/* New Page Button */}
          {onCreatePage && (
            <TouchableOpacity
              style={styles.newPageButton}
              onPress={handleNewPage}
              accessibilityLabel="עמוד חדש"
            >
              <MyIcon info={{ name: "plus", size: 32, color: '#007AFF', type: "MDI" }} />
            </TouchableOpacity>
          )}

          {/* Delete Page Button */}
          {onDeletePage && pages && pages.length > 1 && (
            <TouchableOpacity
              style={styles.deletePageButton}
              onPress={handleDeletePage}
              accessibilityLabel="מחק עמוד"
            >
              <MyIcon info={{ name: "delete", size: 32, color: '#FF3B30', type: "MDI" }} />
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Canvas Container - End Side (Right in LTR, Left in RTL due to direction property) */}
        <View style={styles.canvasContainer}>
          <View style={[styles.canvas, { marginStart: canvasLeftMargin, marginEnd: CANVAS_MARGIN }]}>
            <CanvasComponent
              ref={canvasRef}
              style={{
                width: canvasWidth,
                height: canvasHeight,
              }}
              offset={canvasOffset}
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              ratio={ratio}
              canvasTop={canvasTop}

              zoom={1}
              onZoom={() => { }} // Lock zoom - prevents pinch gesture
              onMoveCanvas={handleCanvasMove} // Allow canvas movement when keyboard is shown
              allowPanning={currentEdited.textId != undefined} // Allow panning when keyboard is shown
              sideMargin={sideMargin}


              // Element arrays
              paths={paths}
              texts={displayTexts}
              images={displayImages}
              lines={[]} // Not using lines
              tables={[]} // Not using tables
              elements={tiles ? [{ ...tiles, type: 'tiles', x: 0, y: tiles.y }] : []}
              renderElements={handleRenderElements}
              elementsAttr={handleElementsAttr}

              currentEdited={currentEdited}
              onTextChanged={handleTextChanged}
              onTextLayout={handleTextLayout}

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
              albumId={albumId}

              currentElementType={currentElementType}

              // Emoji selection
              currentEmojiId={currentEmojiId}
              onEmojiClick={handleEmojiClick}
              onEmojiPinch={handleEmojiPinch}
              onEmojiPinchEnd={handleEmojiPinchEnd}

              // Image selection
              onImageClick={handleImageClick}
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

        {/* Toolbar Level 2 - Tool Options - Next to Main Toolbar */}
        {showToolOptions && (
          <Animated.View
            style={[
              styles.toolOptionsPanel,
              isRTL ? {
                right: toolbarWidth, // In RTL: toolbar is on right, sub-toolbar next to it on left
                left: undefined,
                borderLeftWidth: 1,
                borderLeftColor: '#e0e0e0',
                borderRightWidth: 0,
                shadowOffset: { width: -2, height: 0 },
                transform: [{
                  translateX: slideAnim.interpolate({
                    inputRange: [0, 240],
                    outputRange: [0, 240], // Slide RIGHT to hide (positive)
                  })
                }],
              } : {
                left: toolbarWidth, // In LTR: toolbar is on left, sub-toolbar next to it on right
                right: undefined,
                borderRightWidth: 1,
                borderRightColor: '#e0e0e0',
                borderLeftWidth: 0,
                shadowOffset: { width: 2, height: 0 },
                transform: [{
                  translateX: slideAnim.interpolate({
                    inputRange: [0, 240],
                    outputRange: [0, -240], // Slide LEFT to hide (negative)
                  })
                }],
              }
            ]}
            pointerEvents="box-none"
          >
            {/* Fixed header with title and close button */}
            <View style={[styles.toolbarTitleSection, { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }]} pointerEvents="auto">
              <Text allowFontScaling={false} style={styles.toolbarTitle}>
                {audioMode
                  ? t('editor.audio')
                  : currentElementType === ElementTypes.Sketch ? t('editor.pen')
                  : currentElementType === ElementTypes.Text ? t('editor.textInput')
                  : currentElementType === ElementTypes.Image ? t('editor.addImage')
                  : currentElementType === ElementTypes.Emoji ? t('editor.emojis')
                  : currentElementType === ElementTypes.Background ? t('editor.background')
                  : ''}
              </Text>
              <TouchableOpacity
                style={styles.toolbarCloseButton}
                onPress={() => {
                  console.log('[Close toolbar] Closing tool options');
                  // Save text before closing — use refs to avoid stale closure
                  const textToSave = currentEditedRef.current.textId || editingTextChangesRef.current?.id;
                  if (textToSave) {
                    handleTextEditEnd(textToSave);
                    setCurrentEdited({});
                  }
                  setShowToolOptions(false);
                }}
              >
                <MyIcon info={{ name: "close", size: 24, color: '#666', type: "MI" }} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1, backgroundColor: '#fff' }}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={true}
              pointerEvents="auto"
            >

              {!audioMode && currentElementType === ElementTypes.Sketch && (
                <>
                  {/* Color Picker with Eraser */}
                  <View style={styles.optionsSection}>
                    <Text allowFontScaling={false} style={styles.sectionLabel}>{t('editor.color')}</Text>
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
                    <Text allowFontScaling={false} style={styles.sectionLabel}>{t('editor.thickness')}</Text>
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
                          <Text allowFontScaling={false} style={[styles.sizeText, sketchStrokeWidth === size && styles.sizeTextActive]}>{size}</Text>
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
                      style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }, textMode === 'title' && currentEdited.textId && styles.optionButtonActive]}
                      onPress={handleEditTitle}
                    >
                      <IconTitle color={textMode === 'title' && currentEdited.textId ? '#007AFF' : '#555'} size={24} />
                      <Text allowFontScaling={false} style={[styles.optionLabel, textMode === 'title' && currentEdited.textId && styles.optionLabelActive]}>{t('editor.textTitle')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }, textMode === 'body' && currentEdited.textId && styles.optionButtonActive]}
                      onPress={handleEditBody}
                    >
                      <IconBody color={textMode === 'body' && currentEdited.textId ? '#007AFF' : '#555'} size={24} />
                      <Text allowFontScaling={false} style={[styles.optionLabel, textMode === 'body' && currentEdited.textId && styles.optionLabelActive]}>{t('editor.textBody')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }, tilesSelected && styles.optionButtonActive]}
                      onPress={handleEditTiles}
                    >
                      <IconCells color={tilesSelected ? '#007AFF' : '#555'} size={24} />
                      <Text allowFontScaling={false} style={[styles.optionLabel, tilesSelected && styles.optionLabelActive]}>{t('editor.tilesTitle')}</Text>
                    </TouchableOpacity>

                    {/* Delete title button */}
                    {texts.find(t => t.id === TITLE_TEXT_ID) && (
                      <TouchableOpacity
                        style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }]}
                        onPress={handleDeleteTitle}
                      >
                        <MyIcon info={{ name: "delete", size: 24, color: '#FF5722', type: "MDI" }} />
                        <Text allowFontScaling={false} style={[styles.optionLabel, { color: '#FF5722' }]}>Delete Title</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Tiles multi-select toolbar — shown when tiles mode is active */}
                  {tilesSelected && tiles && (() => {
                    const numSelected = selectedTileIndices.size;
                    const allSelected = selectedTileIndices.size === tiles.words.length;
                    const canMerge = numSelected >= 2;
                    const selectedArr = Array.from(selectedTileIndices);
                    const canUnmerge = numSelected === 1 &&
                      (tiles.words[selectedArr[0]]?.originalIndices.length ?? 0) > 1;
                    const canSingleAction = numSelected === 1;
                    const selectedHasSymbol = canSingleAction && !!tiles.words[selectedArr[0]]?.symbol;
                    return (
                      <>
                        <View style={styles.optionsSection}>
                          {/* Select All / Deselect All */}
                          <TouchableOpacity
                            style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }]}
                            onPress={() => {
                              if (allSelected) {
                                setSelectedTileIndices(new Set());
                              } else {
                                setSelectedTileIndices(new Set(tiles.words.map((_, i) => i)));
                              }
                            }}
                          >
                            <MyIcon info={{ name: allSelected ? "checkbox-multiple-marked" : "checkbox-multiple-blank-outline", size: 24, color: '#007AFF', type: "MDI" }} />
                            <Text allowFontScaling={false} style={[styles.optionLabel, { color: '#007AFF' }]}>
                              {allSelected ? t('editor.tilesDeselectAll') : t('editor.tilesSelectAll')}
                            </Text>
                          </TouchableOpacity>

                          {/* Merge */}
                          <TouchableOpacity
                            style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }, !canMerge && styles.optionButtonDisabled]}
                            onPress={canMerge ? handleMergeTile : undefined}
                            disabled={!canMerge}
                          >
                            <MyIcon info={{ name: "merge", size: 24, color: canMerge ? '#007AFF' : '#ccc', type: "MDI" }} />
                            <Text allowFontScaling={false} style={[styles.optionLabel, !canMerge && styles.optionLabelDisabled]}>{t('editor.tilesMerge')}</Text>
                          </TouchableOpacity>

                          {/* Unmerge */}
                          <TouchableOpacity
                            style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }, !canUnmerge && styles.optionButtonDisabled]}
                            onPress={canUnmerge ? handleUnmergeTile : undefined}
                            disabled={!canUnmerge}
                          >
                            <MyIcon info={{ name: "call-split", size: 24, color: canUnmerge ? '#007AFF' : '#ccc', type: "MDI" }} />
                            <Text allowFontScaling={false} style={[styles.optionLabel, !canUnmerge && styles.optionLabelDisabled]}>{t('editor.tilesUnmerge')}</Text>
                          </TouchableOpacity>

                          {/* Add Emoji */}
                          <TouchableOpacity
                            style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }, !canSingleAction && styles.optionButtonDisabled]}
                            onPress={canSingleAction ? handleAddEmoji : undefined}
                            disabled={!canSingleAction}
                          >
                            <MyIcon info={{ name: "emoticon-outline", size: 24, color: canSingleAction ? '#007AFF' : '#ccc', type: "MDI" }} />
                            <Text allowFontScaling={false} style={[styles.optionLabel, !canSingleAction && styles.optionLabelDisabled]}>{t('editor.tilesAddEmoji')}</Text>
                          </TouchableOpacity>

                          {/* Add Symbol */}
                          <TouchableOpacity
                            style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }, !canSingleAction && styles.optionButtonDisabled]}
                            onPress={canSingleAction ? handleAddSymbol : undefined}
                            disabled={!canSingleAction}
                          >
                            <MyIcon info={{ name: "image-search-outline", size: 24, color: canSingleAction ? '#007AFF' : '#ccc', type: "MDI" }} />
                            <Text allowFontScaling={false} style={[styles.optionLabel, !canSingleAction && styles.optionLabelDisabled]}>{t('editor.tilesAddSymbol')}</Text>
                          </TouchableOpacity>

                          {/* Delete Symbol */}
                          <TouchableOpacity
                            style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }, !selectedHasSymbol && styles.optionButtonDisabled]}
                            onPress={selectedHasSymbol ? handleDeleteSymbol : undefined}
                            disabled={!selectedHasSymbol}
                          >
                            <MyIcon info={{ name: "image-remove", size: 24, color: selectedHasSymbol ? '#F44336' : '#ccc', type: "MDI" }} />
                            <Text allowFontScaling={false} style={[styles.optionLabel, !selectedHasSymbol && styles.optionLabelDisabled]}>{t('editor.tilesDeleteSymbol')}</Text>
                          </TouchableOpacity>

                          {/* Edit Text */}
                          <TouchableOpacity
                            style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }]}
                            onPress={handleEditTilesText}
                          >
                            <MyIcon info={{ name: "pencil", size: 24, color: '#007AFF', type: "MDI" }} />
                            <Text allowFontScaling={false} style={[styles.optionLabel, { color: '#007AFF' }]}>{t('editor.tilesEditText')}</Text>
                          </TouchableOpacity>

                          {/* Delete Tiles */}
                          <TouchableOpacity
                            style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }]}
                            onPress={handleDeleteTiles}
                          >
                            <MyIcon info={{ name: "delete", size: 24, color: '#FF5722', type: "MDI" }} />
                            <Text allowFontScaling={false} style={[styles.optionLabel, { color: '#FF5722' }]}>{t('editor.tilesDelete')}</Text>
                          </TouchableOpacity>
                        </View>

                        {/* BG Color picker — applies to selected tiles */}
                        <View style={[styles.optionsSection, { marginTop: 8 }]}>
                          <Text allowFontScaling={false} style={styles.sectionLabel}>{t('editor.tilesBackgroundColor')}</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.colorGrid}>
                              {TILES_BG_COLORS.map(color => (
                                <TouchableOpacity
                                  key={color}
                                  style={[
                                    styles.colorSwatch,
                                    { backgroundColor: color },
                                    tilesBgColor === color && styles.colorSwatchActive,
                                    numSelected === 0 && styles.colorSwatchDisabled,
                                  ]}
                                  onPress={numSelected > 0 ? () => handleTilesBgColorChange(color) : undefined}
                                  disabled={numSelected === 0}
                                />
                              ))}
                            </View>
                          </ScrollView>
                        </View>

                        {/* Text Color picker — applies to selected tiles */}
                        <View style={[styles.optionsSection, { marginTop: 8 }]}>
                          <Text allowFontScaling={false} style={styles.sectionLabel}>{t('editor.tilesTextColor')}</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.colorGrid}>
                              {TILES_TEXT_COLORS.map(color => (
                                <TouchableOpacity
                                  key={color}
                                  style={[
                                    styles.colorSwatch,
                                    { backgroundColor: color },
                                    tilesTextColor === color && styles.colorSwatchActive,
                                    numSelected === 0 && styles.colorSwatchDisabled,
                                  ]}
                                  onPress={numSelected > 0 ? () => handleTilesTextColorChange(color) : undefined}
                                  disabled={numSelected === 0}
                                />
                              ))}
                            </View>
                          </ScrollView>
                        </View>

                        {/* Size picker — applies to all tiles */}
                        <View style={[styles.optionsSection, { marginTop: 8 }]}>
                          <Text allowFontScaling={false} style={styles.sectionLabel}>{t('editor.size')}</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.sizeGrid}>
                              {TILES_SIZES.map((s, i) => (
                                <TouchableOpacity
                                  key={s.label}
                                  style={[styles.sizeButton, tilesSize === s.value && styles.sizeButtonActive]}
                                  onPress={() => {
                                    setTilesSize(s.value);
                                    if (tiles) {
                                      const updatedTiles: SketchTiles = { ...tiles, fontSize: s.value };
                                      queue.current.pushTiles(updatedTiles);
                                      rebuildStateFromQueue();
                                      autoSave();
                                    }
                                  }}
                                >
                                  <Text allowFontScaling={false} style={[styles.sizeText, tilesSize === s.value && styles.sizeTextActive, { fontSize: SIZE_DISPLAY_PX[i] }]}>{SIZE_LETTER}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </ScrollView>
                        </View>

                        {/* Tile dimension scale: [-] S M L [+] — applies to all tiles at once */}
                        <View style={[styles.optionsSection, { marginTop: 8 }]}>
                          <Text allowFontScaling={false} style={styles.sectionLabel}>{t('editor.tilesScale') || 'Tile Size'}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <TouchableOpacity
                              style={styles.adjustButton}
                              onPress={() => handleTilesAdjustScale(-TILES_SCALE_STEP)}
                            >
                              <MyIcon info={{ name: "minus", size: 20, color: '#007AFF', type: "MDI" }} />
                            </TouchableOpacity>

                            <View style={styles.sizeGrid}>
                              {TILES_SCALE_PRESETS.map((preset, idx) => {
                                const labels = ['S', 'M', 'L'];
                                const isActive = Math.abs(tilesScale - preset) < 0.01;
                                return (
                                  <TouchableOpacity
                                    key={preset}
                                    style={[styles.sizeButton, isActive && styles.sizeButtonActive]}
                                    onPress={() => handleTilesSetScale(preset)}
                                  >
                                    <Text allowFontScaling={false} style={[styles.sizeText, isActive && styles.sizeTextActive]}>{labels[idx]}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>

                            <TouchableOpacity
                              style={styles.adjustButton}
                              onPress={() => handleTilesAdjustScale(TILES_SCALE_STEP)}
                            >
                              <MyIcon info={{ name: "plus", size: 20, color: '#007AFF', type: "MDI" }} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </>
                    );
                  })()}

                  {/* Text Color Picker - shown when editing text (not tiles) */}
                  {currentEdited.textId && !tilesSelected && (
                    <View style={[styles.optionsSection, { marginTop: 8 }]}>
                      <Text allowFontScaling={false} style={styles.sectionLabel}>{t('editor.color')}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.colorGrid}>
                          {COLORS.map(color => (
                            <TouchableOpacity
                              key={color}
                              style={[
                                styles.colorSwatch,
                                { backgroundColor: color },
                                textColor === color && styles.colorSwatchActive
                              ]}
                              onPress={() => {
                                const textId = textMode === 'title' ? TITLE_TEXT_ID : BODY_TEXT_ID;
                                setTextColor(color);
                                if (textId) {
                                  setEditingTextChanges(prev => prev ? { ...prev, color } : { id: textId, color });
                                }
                              }}
                            />
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  )}

                  {/* Size Picker - shown when editing text (not tiles) */}
                  {currentEdited.textId && !tilesSelected && (
                    <View style={[styles.optionsSection, { marginTop: 8 }]}>
                      <Text allowFontScaling={false} style={styles.sectionLabel}>{t('editor.size')}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.sizeGrid}>
                          {(textMode === 'title' ? TITLE_TEXT_SIZES : BODY_TEXT_SIZES).map((s, i) => (
                            <TouchableOpacity
                              key={s.label}
                              style={[styles.sizeButton, textSize === s.value && styles.sizeButtonActive]}
                              onPress={() => {
                                const textId = textMode === 'title' ? TITLE_TEXT_ID : BODY_TEXT_ID;
                                setTextSize(s.value);
                                if (textId) {
                                  setEditingTextChanges(prev => prev ? { ...prev, fontSize: s.value } : { id: textId, fontSize: s.value });
                                }
                              }}
                            >
                              <Text allowFontScaling={false} style={[styles.sizeText, textSize === s.value && styles.sizeTextActive, { fontSize: SIZE_DISPLAY_PX[i] }]}>{SIZE_LETTER}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  )}
                </>
              )}

              {!audioMode && currentElementType === ElementTypes.Image && (
                <>
                  <View style={styles.optionsSection}>
                    <TouchableOpacity
                      style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }]}
                      onPress={handleAddImage}
                      disabled={loadingImagePicker}
                    >
                      {loadingImagePicker ? (
                        <ActivityIndicator size="small" color="#007AFF" />
                      ) : (
                        <MyIcon info={{ name: "image-plus", size: 24, color: '#007AFF', type: "MDI" }} />
                      )}
                      <Text allowFontScaling={false} style={styles.optionLabel}>{t('editor.fromGallery')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }]}
                      onPress={() => setShowCameraModal(true)}
                    >
                      <MyIcon info={{ name: "camera", size: 24, color: '#007AFF', type: "MDI" }} />
                      <Text allowFontScaling={false} style={styles.optionLabel}>{t('editor.camera')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }]}
                      onPress={() => setShowSearchImageModal(true)}
                    >
                      <MyIcon info={{ name: "image-search", size: 24, color: '#007AFF', type: "MDI" }} />
                      <Text allowFontScaling={false} style={styles.optionLabel}>{t('imageSearch.title')}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Edit existing image options */}
                  {currentEdited.imageId && (
                    <View style={styles.optionsSection}>
                      <Text allowFontScaling={false} style={styles.sectionLabel}>{t('editor.addImage')}</Text>

                      <TouchableOpacity
                        style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }]}
                        onPress={handleEditExistingImage}
                      >
                        <MyIcon info={{ name: "image-edit", size: 24, color: '#007AFF', type: "MDI" }} />
                        <Text allowFontScaling={false} style={styles.optionLabel}>{t('editor.editImage')}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }, styles.optionButtonDestructive]}
                        onPress={handleDeleteImage}
                      >
                        <MyIcon info={{ name: "delete", size: 24, color: '#FF3B30', type: "MDI" }} />
                        <Text allowFontScaling={false} style={styles.optionLabel}>{t('editor.deleteImage')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              {audioMode && (
                <>
                  <View style={styles.optionsSection}>
                    <Text allowFontScaling={false} style={styles.sectionLabel}>{t('editor.addAudio')}</Text>

                    <Pressable
                      style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }, isRecording && styles.optionButtonActive]}
                      onPress={isRecording ? handleStopRecording : handleStartRecording}
                    >
                      <MyIcon info={{ name: isRecording ? 'stop' : 'record', size: 24, color: isRecording ? '#fff' : '#FF0000', type: "MDI" }} />
                      <Text allowFontScaling={false} style={[styles.optionLabel, isRecording && styles.optionLabelActive]}>{isRecording ? t('editor.stopRecording') : t('editor.startRecording')}</Text>
                    </Pressable>

                    {/* Live recording waveform indicator */}
                    {isRecording && (
                      <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 40 }}>
                          {/* Generate 20 bars */}
                          {Array.from({ length: 20 }).map((_, i) => {
                            // Animate bars with slight offset for wave effect
                            const barHeight = Math.max(4, recordingMetering * 36 + Math.sin(Date.now() / 100 + i) * 4);
                            return (
                              <View
                                key={i}
                                style={{
                                  flex: 1,
                                  height: barHeight,
                                  backgroundColor: '#FF0000',
                                  borderRadius: 2,
                                  opacity: 0.7 + recordingMetering * 0.3,
                                }}
                              />
                            );
                          })}
                        </View>
                      </View>
                    )}

                    <Pressable
                      style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }, !pageAudioFile && styles.optionButtonDisabled]}
                      onPress={handlePlayAudio}
                      disabled={!pageAudioFile}
                    >
                      <MyIcon info={{ name: "play", size: 24, color: pageAudioFile ? '#007AFF' : '#ccc', type: "MDI" }} />
                      <Text allowFontScaling={false} style={[styles.optionLabel, !pageAudioFile && styles.optionLabelDisabled]}>{t('editor.play')}</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }, !pageAudioFile && styles.optionButtonDisabled]}
                      onPress={handleOpenWordMapping}
                      disabled={!pageAudioFile}
                    >
                      <MyIcon info={{ name: "text-box", size: 24, color: pageAudioFile ? '#007AFF' : '#ccc', type: "MDI" }} />
                      <Text allowFontScaling={false} style={[styles.optionLabel, !pageAudioFile && styles.optionLabelDisabled]}>{t('editor.wordMapping')}</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }, styles.optionButtonDestructive, !pageAudioFile && styles.optionButtonDisabled]}
                      onPress={handleClearPageAudio}
                      disabled={!pageAudioFile}
                    >
                      <MyIcon info={{ name: "delete", size: 24, color: pageAudioFile ? '#FF3B30' : '#ccc', type: "MDI" }} />
                      <Text allowFontScaling={false} style={[styles.optionLabel, !pageAudioFile && styles.optionLabelDisabled]}>{t('editor.deleteRecording')}</Text>
                    </Pressable>
                  </View>
                </>
              )}

              {/* Emoji Mode Options */}
              {!audioMode && currentElementType === ElementTypes.Emoji && (
                <>
                  {console.log('[RENDER] Showing Emoji toolbar options, currentElementType:', currentElementType)}
                  {/* Pick Emoji Button */}
                  <View style={styles.optionsSection}>
                    <TouchableOpacity
                      style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }]}
                      onPress={handleOpenEmojiKeyboard}
                    >
                      <MyIcon info={{ name: "emoticon-happy-outline", size: 24, color: '#007AFF', type: "MDI" }} />
                      <Text allowFontScaling={false} style={styles.optionLabel}>{t('editor.selectEmoji')}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Emoji Options - shown when emoji is selected */}
                  {currentEmojiId && (
                    <>
                      <View style={styles.optionsSection}>
                        <Text allowFontScaling={false} style={styles.sectionLabel}>{t('editor.emojiSize')}</Text>

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
                                  <Text allowFontScaling={false} style={[styles.sizeText, isActive && styles.sizeTextActive]}>{labels[index]}</Text>
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
                        <Text allowFontScaling={false} style={styles.sectionLabel}>
                          {t('editor.rotation')}: {(() => {
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
                          style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }, styles.optionButtonDestructive]}
                          onPress={handleEmojiDelete}
                        >
                          <MyIcon info={{ name: "delete", size: 24, color: '#FF3B30', type: "MDI" }} />
                          <Text allowFontScaling={false} style={styles.optionLabel}>{t('editor.deleteEmoji')}</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </>
              )}

              {/* Background Mode Options */}
              {!audioMode && currentElementType === ElementTypes.Background && (
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  {/* Solid Colors */}
                  <View style={styles.optionsSection}>
                    <Text allowFontScaling={false} style={styles.sectionLabel}>{t('editor.solidColor')}</Text>
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
                    <Text allowFontScaling={false} style={styles.sectionLabel}>{t('background.patterns')}</Text>
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
                    <Text allowFontScaling={false} style={styles.sectionLabel}>{t('background.image')}</Text>
                    <View style={styles.colorGrid}>
                      {/* Camera button */}
                      <TouchableOpacity
                        key="camera"
                        style={styles.backgroundSwatch}
                        onPress={() => {
                          setPendingImageSource('background-camera');
                          setShowCameraModal(true);
                        }}
                      >
                        <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 4 }}>
                          <MyIcon info={{ type: 'Ionicons', name: 'camera', size: 32, color: '#666' }} />
                        </View>
                      </TouchableOpacity>

                      {/* Library button */}
                      <TouchableOpacity
                        key="library"
                        style={styles.backgroundSwatch}
                        onPress={() => {
                          setPendingImageSource('background-library');
                          launchImageLibrary(
                            {
                              mediaType: 'photo',
                              selectionLimit: 1,
                            },
                            (response) => {
                              if (response.didCancel) {
                                console.log('User cancelled image picker');
                              } else if (response.errorCode) {
                                console.error('ImagePicker Error:', response.errorMessage);
                                showAlert(t('home.error'), response.errorMessage || 'Failed to pick image');
                              } else if (response.assets && response.assets[0].uri) {
                                setPendingImageUri(response.assets[0].uri);
                                setShowImageEditModal(true);
                              }
                            }
                          );
                        }}
                      >
                        <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 4 }}>
                          <MyIcon info={{ type: 'Ionicons', name: 'images', size: 32, color: '#666' }} />
                        </View>
                      </TouchableOpacity>

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
            </ScrollView>
          </Animated.View>
        )}
      </View>

      {/* Audio Word Mapping Modal */}
      {showWordMappingModal && pageAudioFile && (() => {
        // Get title text from compiled queue state (latest version wins)
        const queueElements = queue.current.getAll();
        const compiled = compileQueueToElements(queueElements);
        let titleText = '';

        // Tiles take precedence over title text
        if (compiled.tiles && compiled.tiles.words?.length > 0) {
          titleText = compiled.tiles.words.map((w: TileWord) => w.text).join(' ');
        } else {
          const titleTextElem = compiled.texts.find(t => t.id === TITLE_TEXT_ID);
          if (titleTextElem) {
            titleText = titleTextElem.text || '';
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
      {/* Image Edit Modal */}
      <ImageEditModal
        visible={showImageEditModal}
        imageUri={pendingImageUri}
        pageAspectRatio={canvasWidth / canvasHeight}
        onApply={handleImageEditApply}
        onCancel={handleImageEditCancel}
        allowAspectRatioChange={pendingImageSource !== 'background-camera' && pendingImageSource !== 'background-library'}
      />

      {/* Camera Modal */}
      <CameraModal
        visible={showCameraModal}
        onCapture={handleCameraCapture}
        onCancel={() => setShowCameraModal(false)}
      />

      {/* Image Search Modal */}
      <SearchImageModal
        visible={showSearchImageModal}
        onSelectImage={handleSearchImageSelect}
        onClose={() => setShowSearchImageModal(false)}
      />

      {/* Tiles Modal */}
      <TilesModal
        visible={showTilesModal}
        onClose={() => setShowTilesModal(false)}
        onConfirm={handleTilesConfirm}
        initialText={tiles?.words.map(w => w.text).join(' ') || ''}
        isEditing={tiles != null}
      />

      {/* Search Symbol Modal */}
      <SearchSymbolModal
        visible={showSearchSymbolModal}
        onSelectSymbol={handleSymbolSelectFromWeb}
        onClose={() => {
          setShowSearchSymbolModal(false);
          setSelectedTileIndex(null);
        }}
        initialKeyword={selectedTileIndex !== null && tiles ? tiles.words[selectedTileIndex].text : ''}
      />

      {/* Symbol Search Loading Overlay */}
      {searchingSymbols && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text allowFontScaling={false} style={styles.loadingText}>
              {searchingSymbolsMode === 'auto' ? t('editor.findingSymbols') : t('editor.searchingSymbols')}
            </Text>
          </View>
        </View>
      )}

      {/* Emoji Picker */}
      <View style={{ direction: 'ltr' }}>
        <EmojiPicker
          onEmojiSelected={handleEmojiPick}
          open={showEmojiKeyboard}
          onClose={() => {
            setShowEmojiKeyboard(false);
            setSelectedTileIndex(null); // Clear tile selection when closing
          }}
          allowMultipleSelections={false}
          emojiSize={48}
          defaultHeight={isMobileLandscape ? "70%" : "50%"}
          enableSearchBar={true}
          enableSearchAnimation={true}
          translation={language === 'en' ? en : he}
          customKeywords={language === 'ar' ? arKeywords : (language === 'he' ? heKeywords : undefined)}
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

      {/* RTL-aware Alert */}
      <RTLAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onDismiss={() => setAlertConfig({ visible: false })}
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
    borderRadius: borderRadius.round,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  pageNavigation: { flexDirection: 'row', gap: 4 },
  iconButton: {
    fontSize: 35,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
  },
  iconButtonDisabled: { opacity: 0.3 },
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
    backgroundColor: '#fff',
    borderRadius: 8,
    boxShadow: '5px 5px 5px 0px rgba(0, 0, 0, 0.3)',
    overflow: 'hidden',
  },
  toolbar: {
    backgroundColor: '#fff',
    flexShrink: 0, // Prevent toolbar from shrinking
  },
  toolbarContent: {
    alignItems: 'center',
  },
  toolbarTitleSection: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    width: '100%',
    height: 40,
    justifyContent: "flex-start",
  },
  toolbarTitle: {
    fontSize: 16,
    lineHeight: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'left',
    height: "100%",
  },
  mainToolButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  mainToolButtonActive: {
    backgroundColor: '#E8F0FE',
  },
  newPageButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8F0FE',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  deletePageButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    borderWidth: 2,
    borderColor: '#FF3B30',
    marginTop: 8,
  },
  toolOptionsPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 240,
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1000,
  },
  closeButton: {
    position: 'absolute',
    top: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1001,
  },
  toolbarCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsSection: {
    marginBottom: 15,
    marginTop: 50, // Leave room for close button (button is at top: 12 with height 32 = 44px)
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
  colorSwatchDisabled: {
    opacity: 0.35,
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
  loadingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  loadingText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
});
