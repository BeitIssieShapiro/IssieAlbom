import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  ImageURISource,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PathCommand } from '@shopify/react-native-skia';
import { launchImageLibrary } from 'react-native-image-picker';
import { AlbumPage, AlbumPageV2, ElementTypes, CurrentEdited, SketchPoint, SketchPath, SketchText, SketchImage, SketchAudio } from '../types/Album';
import { SketchElement, SketchElementAttributes } from '../components/canvas/types';
import DoQueue from '../utils/DoQueue';
import Canvas from '../components/canvas/canvas';
import { AudioElement } from '../components/AudioElement';
import { getId, compileQueueToElements } from '../utils/pageUtils';
import { PageService } from '../services/PageService';
import { MyIcon } from '../common/icons';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const HEADER_HEIGHT = 60;
const TOOLBAR_HEIGHT = 80;

interface PageEditorScreenProps {
  page: AlbumPage;
  albumId: string;
  onSave: (updatedPage: AlbumPageV2) => void;
}

export function PageEditorScreen({ page, albumId, onSave }: PageEditorScreenProps) {
  const insets = useSafeAreaInsets();
  const canvasRef = useRef<any>(null);

  // Queue for undo/redo
  const queue = useRef(new DoQueue());

  // Canvas state (external to Canvas component)
  const [paths, setPaths] = useState<SketchPath[]>([]);
  const [texts, setTexts] = useState<SketchText[]>([]);
  const [images, setImages] = useState<SketchImage[]>([]);
  const [audios, setAudios] = useState<SketchElement[]>([]);
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

  // Computed texts array that includes editing changes and move changes
  const displayTexts = React.useMemo(() => {
    const result = texts.map(t => {
      // Apply editing changes (text, color, size, position)
      if (editingTextChanges?.id === t.id) {
        return { ...t, ...editingTextChanges };
      }
      // Apply move changes (only for non-edited texts)
      if (movingElement?.type === 'text' && movingElement.id === t.id && !editingTextChanges) {
        return { ...t, x: movingElement.x, y: movingElement.y };
      }
      return t;
    });

    // If editingTextChanges has a text not in the queue yet (brand new), add it
    if (editingTextChanges && !texts.find(t => t.id === editingTextChanges.id)) {
      result.push(editingTextChanges as SketchText);
    }

    return result;
  }, [texts, editingTextChanges, movingElement]);

  // Computed images array that includes move/resize changes
  const displayImages = React.useMemo(() => {
    return images.map(img => {
      if (movingElement && (movingElement.type === 'image-move' || movingElement.type === 'image-resize') && movingElement.id === img.id) {
        return {
          ...img,
          x: movingElement.x,
          y: movingElement.y,
          ...(movingElement.width !== undefined && { width: movingElement.width }),
          ...(movingElement.height !== undefined && { height: movingElement.height }),
        };
      }
      return img;
    });
  }, [images, movingElement]);

  // Use ref to avoid closure issues in callbacks
  const currentElementTypeRef = useRef<ElementTypes>(ElementTypes.Sketch);

  // Drawing settings
  const [sketchColor, setSketchColor] = useState('#333333');
  const [sketchStrokeWidth, setSketchStrokeWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false); // Track if pen is in eraser mode
  const [textColor, setTextColor] = useState('#333333');
  const [textSize, setTextSize] = useState(20);

  // Sync isEraser ref (must be after isEraser state declaration)
  useEffect(() => {
    isEraserRef.current = isEraser;
    console.log('isEraser state changed:', isEraser, 'ref updated to:', isEraserRef.current);
  }, [isEraser]);

  // Color presets
  const COLORS = ['#000000', '#333333', '#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#FF00FF', '#00FFFF'];
  const PEN_SIZES = [2, 3, 5, 8];
  const TEXT_SIZES = [16, 20, 28, 36];

  // Calculate available space for canvas
  const availableWidth = SCREEN_WIDTH;
  const availableHeight = SCREEN_HEIGHT - (HEADER_HEIGHT + insets.top) - (TOOLBAR_HEIGHT + insets.bottom);

  // Get original page dimensions (screen dimensions when page was created)
  const v2Page = page as AlbumPageV2;
  const pageWidth = v2Page.canvasWidth || SCREEN_WIDTH;
  const pageHeight = v2Page.canvasHeight || SCREEN_HEIGHT;

  // Calculate ratio (scale) to fit page dimensions into available space
  const ratioX = availableWidth / pageWidth;
  const ratioY = availableHeight / pageHeight;
  const ratio = Math.min(ratioX, ratioY);

  // Calculate actual canvas size (scaled dimensions)
  const canvasWidth = pageWidth * ratio;
  const canvasHeight = pageHeight * ratio;

  // Calculate side margin to center horizontally
  const sideMargin = (availableWidth - canvasWidth) / 2;

  // Calculate canvas top position
  const canvasTop = HEADER_HEIGHT + insets.top;

  console.log('Render calculations:', {
    availableWidth,
    availableHeight,
    pageWidth,
    pageHeight,
    ratio,
    canvasWidth,
    canvasHeight,
    sideMargin,
    canvasTop
  });

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

      // Build state from queue
      rebuildStateFromQueue();
    } else {
      // Initialize with background if needed
      if (page.backgroundPath) {
        queue.current.add({ type: 'background', elem: { path: page.backgroundPath } });
      }
    }
  }, [page.id]);

  // Rebuild paths/texts/images/audios arrays from queue using shared utility
  const rebuildStateFromQueue = () => {
    const queueElements = queue.current.getAll();
    console.log('rebuildStateFromQueue: processing', queueElements.length, 'queue elements');

    const { paths: rebuiltPaths, texts: rebuiltTexts, images: rebuiltImages, audios: rebuiltAudios } = compileQueueToElements(queueElements);

    console.log('Rebuilt from queue:', { paths: rebuiltPaths.length, texts: rebuiltTexts.length, images: rebuiltImages.length, audios: rebuiltAudios.length });
    console.log('Rebuilt images:', rebuiltImages.map(i => ({ id: i.id, x: i.x, y: i.y, width: i.width, height: i.height })));

    setPaths(rebuiltPaths);
    setTexts(rebuiltTexts);
    setImages(rebuiltImages);
    // Convert SketchAudio to SketchElement
    setAudios(rebuiltAudios.map(a => ({ ...a, type: 'audio' })));
  };

  // Auto-save to disk without closing editor (for during-edit saves like image moves)
  const autoSave = async () => {
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

  const handleBack = () => {
    // Save currently edited text before exiting
    if (currentEdited.textId) {
      const text = displayTexts.find(t => t.id === currentEdited.textId);
      if (text) {
        queue.current.pushText(text);
      }
    }

    // Auto-save on exit - changes are saved on every action
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
    }
  };

  // Canvas callbacks
  const handleSketchEnd = (commands?: PathCommand[]) => {
    if (commands && commands.length > 0) {
      const isEraserMode = isEraserRef.current;
      const pathElem: SketchPath = {
        id: getId('path'),
        points: commands,
        color: isEraserMode ? '#00000000' : sketchColor, // Transparent for eraser
        strokeWidth: isEraserMode ? 20 : sketchStrokeWidth, // Wider stroke for eraser
        isMarker: isEraserMode,
      };

      console.log('Saving path to queue:', { isEraser: isEraserMode, color: pathElem.color, strokeWidth: pathElem.strokeWidth });

      queue.current.pushPath(pathElem);
      rebuildStateFromQueue();
    }
  };

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
        // Create new text at click position - don't commit to queue yet
        const newTextId = getId('text');
        const newText: SketchText = {
          id: newTextId,
          text: '',
          fontSize: textSize,
          color: textColor,
          rtl: false,
          alignment: 'Left',
          x: p[0],
          y: p[1],
          width: 60,
          height: 28,
        };

        console.log('Creating new text (not adding to queue yet):', newTextId);

        // Add to temporary editing state so it's visible
        setEditingTextChanges(newText);

        // Mark as currently edited
        setCurrentEdited({ textId: newTextId });
      } else if (elem.id) {
        // Edit existing text
        console.log('Editing existing text:', elem.id);
        setCurrentEdited({ textId: elem.id });
      }
    } else if (currentElementTypeRef.current === ElementTypes.Image && elem) {
      const newCurrEdited = { ...currentEditedRef.current, imageId: elem.id }
      currentEditedRef.current = newCurrEdited
      setCurrentEdited(newCurrEdited);
    } else if (currentElementTypeRef.current === ElementTypes.Audio) {
      if (!elem) {
        // Create new audio at click position
        const newAudioId = getId('audio');
        const newAudio: SketchElement = {
          id: newAudioId,
          x: p[0],
          y: p[1],
          type: 'audio',
          editMode: true, // Start in record mode
        };

        // Add to state temporarily (will be persisted when recording finishes)
        setAudios(prev => {
          const updated = [...prev, newAudio];
          console.log('setAudios called, new length:', updated.length);
          return updated;
        });
        console.log('Created new audio for recording:', newAudioId);
      }
    }
  };

  // When switching to text mode, create first text element if none exist
  const handleSetTextMode = () => {
    setCurrentElementType(ElementTypes.Text);
    currentElementTypeRef.current = ElementTypes.Text;

    // If no texts exist, create one in the center (using canvas dimensions)
    if (texts.length === 0 && !editingTextChanges) {
      const centerX = canvasWidth / 2 - 30;
      const centerY = canvasHeight / 2 - 14;

      const newTextId = getId('text');
      const newText: SketchText = {
        id: newTextId,
        text: '',
        fontSize: textSize,
        color: textColor,
        rtl: false,
        alignment: 'Left',
        x: centerX,
        y: centerY,
        width: 60,
        height: 28,
      };

      console.log('Creating initial text in text mode (not adding to queue yet):', newTextId);

      // Add to temporary editing state so it's visible
      setEditingTextChanges(newText);
      setCurrentEdited({ textId: newTextId });
    }
  };

  const handleSetSketchMode = () => {
    // Save currently edited text before switching modes
    if (currentEdited.textId) {
      handleTextEditEnd(currentEdited.textId);
    }

    setCurrentElementType(ElementTypes.Sketch);
    currentElementTypeRef.current = ElementTypes.Sketch;
    setCurrentEdited({});
  };

  const handleSetImageMode = () => {
    // Save currently edited text before switching modes
    if (currentEdited.textId) {
      handleTextEditEnd(currentEdited.textId);
      setCurrentEdited({});
    }

    setCurrentElementType(ElementTypes.Image);
    currentElementTypeRef.current = ElementTypes.Image;
  };

  const handleSetAudioMode = () => {
    // Save currently edited text before switching modes
    if (currentEdited.textId) {
      handleTextEditEnd(currentEdited.textId);
      setCurrentEdited({});
    }

    setCurrentElementType(ElementTypes.Audio);
    currentElementTypeRef.current = ElementTypes.Audio;
  };

  const handleUpdateAudioFile = async (audioId: string, filePath: string) => {
    console.log('handleUpdateAudioFile:', { audioId, filePath });

    // Find the audio in state
    const audio = audios.find(a => a.id === audioId);
    if (audio) {
      // Update audio with file path
      const updatedAudio: SketchAudio = {
        ...audio,
        file: filePath,
        editMode: false, // No longer in edit mode
      };

      // Save to queue
      queue.current.pushAudio(updatedAudio);
      rebuildStateFromQueue();

      // Auto-save to disk
      await autoSave();

      console.log('Audio saved:', updatedAudio);
    }
  };

  const handleAddImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });

    if (result.assets && result.assets[0]) {
      const asset = result.assets[0];
      const imageId = getId('image');

      const newImage: SketchImage = {
        id: imageId,
        src: { uri: asset.uri },
        x: canvasWidth / 2 - 75, // Center horizontally
        y: canvasHeight / 2 - 75, // Center vertically
        width: 150,
        height: 150,
        aspectRatio: (asset.width && asset.height) ? asset.width / asset.height : 1,
      };

      console.log('Adding new image to queue:', { id: imageId, x: newImage.x, y: newImage.y, width: newImage.width, height: newImage.height });

      // Commit full image to queue
      queue.current.pushImage(newImage);

      console.log('Queue after pushImage:', queue.current.getAll().length, 'elements');

      rebuildStateFromQueue();

      // Auto-save to disk without closing editor
      await autoSave();

      // Set as currently edited to show handles
      setCurrentEdited({ imageId: imageId });
    }
  };

  const handleMoveElement = (type: any, id: string, p: SketchPoint) => {
    const currentImages = imagesRef.current;
    console.log('handleMoveElement:', { type, id, p, imagesCount: currentImages.length });

    // For text elements, always accumulate in editing changes (even if not currently focused)
    if (type === 'text') {
      console.log('Moving text, accumulating in editingTextChanges');
      setEditingTextChanges(prev => prev?.id === id ? { ...prev, x: p[0], y: p[1] } : { id, x: p[0], y: p[1] });
    } else if (type === 'image-move' || type === 'image-resize') {
      // For images, track move/resize separately
      console.log('Moving/resizing image, using movingElement, images:', currentImages.map(i => ({ id: i.id, x: i.x, y: i.y })));

      // Get the base image to calculate size for resize operations
      const baseImage = currentImages.find(i => i.id === id);
      console.log('Found baseImage:', baseImage ? { id: baseImage.id, x: baseImage.x, y: baseImage.y, width: baseImage.width, height: baseImage.height } : 'NOT FOUND');

      if (baseImage) {
        let moveData;
        if (type === 'image-resize') {
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
      } else {
        console.error('Base image not found in images array!');
      }
    } else if (type === 'elem-move') {
      // For audio elements (generic elements)
      console.log('Moving audio element');
      const audio = audios.find(a => a.id === id);
      if (audio) {
        setAudios(prev => prev.map(a => a.id === id ? { ...a, x: p[0], y: p[1] } : a));
      }
    }
  };

  const handleMoveEnd = async (type: any, id: string) => {
    const movingElem = movingElementRef.current;
    console.log('handleMoveEnd:', { type, id, movingElement: movingElem, displayImagesCount: displayImages.length, displayImages: displayImages.map(i => ({ id: i.id, x: i.x, y: i.y })) });

    // For text, don't save - just mark it as needing to be edited/saved
    if (type === 'text') {
      console.log('Text moved, changes will be saved when explicitly committed');
      // If not currently being edited, mark it as edited so changes are visible
      if (!currentEdited.textId) {
        setCurrentEdited({ textId: id });
      }
      return;
    }

    // For images, save only position/size (lightweight) after move/resize
    if (type === 'image-move' || type === 'image-resize') {
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
    } else if (type === 'elem-move') {
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
    } else if (type === ElementTypes.Audio) {
      setAudios(prev => prev.filter(a => a.id !== id));
      queue.current.pushDeleteAudio({ id });
      rebuildStateFromQueue();
      autoSave();
    }

    // Remove from queue
    const queueElems = queue.current.getAll();
    const idx = queueElems.findIndex(qe => qe.elem?.id === id);
    if (idx >= 0) {
      queueElems.splice(idx, 1);
    }
  };

  // Render callback for custom elements (audio)
  const handleRenderElements = (elem: SketchElement) => {
    if (elem.type === 'audio') {
      return (
        <AudioElement
          audioFile={elem.file}
          editMode={elem.editMode}
          onUpdateAudioFile={(filePath) => handleUpdateAudioFile(elem.id, filePath)}
          width={80}
          height={80}
        />
      );
    }
  };

  // Attributes callback for custom elements (audio)
  const handleElementsAttr = (elem: SketchElement): SketchElementAttributes | undefined => {
    if (elem.type === 'audio' && currentElementType === ElementTypes.Audio) {
      return { showDelete: true };
    }
  };

  const backgroundImage: ImageURISource | undefined = page.backgroundPath
    ? { uri: `file://${page.backgroundPath}` }
    : undefined;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} accessibilityLabel="חזרה לאלבום">
          <MyIcon info={{ size: 28, color: "#007AFF", name: "arrow-right", type: "MDI" }} />
        </TouchableOpacity>
        <Text style={styles.title}>עמוד {page.pageNumber}</Text>
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

      {/* Canvas */}
      <View style={styles.canvasContainer}>
        {(() => {
          console.log('Canvas positioning:', { sideMargin, canvasWidth, canvasHeight, availableWidth });
          return null;
        })()}
        <Canvas
          ref={canvasRef}
          style={{
            marginLeft: sideMargin,
            width: canvasWidth,
            height: canvasHeight,
            borderWidth: 2,
            borderColor: 'red'
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
          onSketchEnd={handleSketchEnd}
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

          currentElementType={currentElementType}
        />
      </View>

      {/* Toolbar */}
      <View style={[styles.toolbar, { paddingBottom: insets.bottom || 12 }]}>
        {/* Tool Selection */}
        <View style={styles.toolsRow}>
          <TouchableOpacity
            style={[styles.toolButton, currentElementType === ElementTypes.Sketch && !isEraser && styles.toolButtonActive]}
            onPress={() => {
              handleSetSketchMode();
              setIsEraser(false);
            }}
          >
            <MyIcon info={{ name: "pencil", size: 28, color: currentElementType === ElementTypes.Sketch && !isEraser ? '#007AFF' : '#555', type: "MDI" }} />
            <Text style={[styles.toolLabel, currentElementType === ElementTypes.Sketch && !isEraser && styles.toolLabelActive]}>עט</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, currentElementType === ElementTypes.Sketch && isEraser && styles.toolButtonActive]}
            onPress={() => {
              console.log('Eraser button clicked, setting isEraser to true');
              handleSetSketchMode();
              setIsEraser(true);
            }}
          >
            <MyIcon info={{ name: "eraser", size: 28, color: currentElementType === ElementTypes.Sketch && isEraser ? '#007AFF' : '#555', type: "MDI" }} />
            <Text style={[styles.toolLabel, currentElementType === ElementTypes.Sketch && isEraser && styles.toolLabelActive]}>מחק</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, currentElementType === ElementTypes.Text && styles.toolButtonActive]}
            onPress={handleSetTextMode}
          >
            <MyIcon info={{ name: "format-text", size: 28, color: currentElementType === ElementTypes.Text ? '#007AFF' : '#555', type: "MDI" }} />
            <Text style={[styles.toolLabel, currentElementType === ElementTypes.Text && styles.toolLabelActive]}>טקסט</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, currentElementType === ElementTypes.Image && styles.toolButtonActive]}
            onPress={handleSetImageMode}
          >
            <MyIcon info={{ name: "image", size: 28, color: currentElementType === ElementTypes.Image ? '#007AFF' : '#555', type: "MDI" }} />
            <Text style={[styles.toolLabel, currentElementType === ElementTypes.Image && styles.toolLabelActive]}>תמונה</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolButton, currentElementType === ElementTypes.Audio && styles.toolButtonActive]}
            onPress={handleSetAudioMode}
          >
            <MyIcon info={{ name: "microphone", size: 28, color: currentElementType === ElementTypes.Audio ? '#007AFF' : '#555', type: "MDI" }} />
            <Text style={[styles.toolLabel, currentElementType === ElementTypes.Audio && styles.toolLabelActive]}>הקלטה</Text>
          </TouchableOpacity>
        </View>

        {/* Mode-specific controls */}
        {currentElementType === ElementTypes.Sketch && (
          <>
            {/* Color Picker for Pen/Eraser */}
            <View style={styles.colorRow}>
              {COLORS.map(color => {
                const isActive = sketchColor === color;
                return (
                  <TouchableOpacity
                    key={color}
                    style={[styles.colorSwatch, { backgroundColor: color }, isActive && styles.colorSwatchActive]}
                    onPress={() => setSketchColor(color)}
                  />
                );
              })}
            </View>

            {/* Size Picker for Pen */}
            <View style={styles.sizeRow}>
              {PEN_SIZES.map(size => {
                const isActive = sketchStrokeWidth === size;
                return (
                  <TouchableOpacity
                    key={size}
                    style={[styles.sizeButton, isActive && styles.sizeButtonActive]}
                    onPress={() => setSketchStrokeWidth(size)}
                  >
                    <Text style={[styles.sizeText, isActive && styles.sizeTextActive]}>{size}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {currentElementType === ElementTypes.Text && (
          <>
            {/* Color Picker for Text */}
            <View style={styles.colorRow}>
              {COLORS.map(color => {
                const isActive = textColor === color;
                return (
                  <TouchableOpacity
                    key={color}
                    style={[styles.colorSwatch, { backgroundColor: color }, isActive && styles.colorSwatchActive]}
                    onPress={() => {
                      setTextColor(color);
                      // Update currently edited text if any - accumulate in editing changes
                      if (currentEdited.textId) {
                        setEditingTextChanges(prev =>
                          prev?.id === currentEdited.textId
                            ? { ...prev, color }
                            : { id: currentEdited.textId!, color }
                        );
                      }
                    }}
                  />
                );
              })}
            </View>

            {/* Size Picker for Text */}
            <View style={styles.sizeRow}>
              {TEXT_SIZES.map(size => {
                const isActive = textSize === size;
                return (
                  <TouchableOpacity
                    key={size}
                    style={[styles.sizeButton, isActive && styles.sizeButtonActive]}
                    onPress={() => {
                      setTextSize(size);
                      // Update currently edited text if any - accumulate in editing changes
                      if (currentEdited.textId) {
                        setEditingTextChanges(prev =>
                          prev?.id === currentEdited.textId
                            ? { ...prev, fontSize: size }
                            : { id: currentEdited.textId!, fontSize: size }
                        );
                      }
                    }}
                  >
                    <Text style={[styles.sizeText, isActive && styles.sizeTextActive]}>{size}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {currentElementType === ElementTypes.Image && (
          <>
            {/* Image actions */}
            <View style={styles.imageActionsRow}>
              <TouchableOpacity
                style={styles.imageActionButton}
                onPress={handleAddImage}
              >
                <MyIcon info={{ name: "image-plus", size: 24, color: '#007AFF', type: "MDI" }} />
                <Text style={styles.imageActionText}>מגלריה</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.imageActionButton}
                onPress={() => {/* TODO: Camera */ }}
              >
                <MyIcon info={{ name: "camera", size: 24, color: '#007AFF', type: "MDI" }} />
                <Text style={styles.imageActionText}>מצלמה</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  title: { flex: 1, fontSize: 18, fontWeight: '600', color: '#333', textAlign: 'center' },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  iconButtonDisabled: { opacity: 0.3 },
  canvasContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    backgroundColor: '#f5f5f5',
  },
  canvas: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  toolbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
    paddingHorizontal: 12,
    minHeight: 80,
    zIndex: 999
  },
  toolsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  toolButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    minHeight: 60,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  toolButtonActive: { backgroundColor: '#E8F0FE' },
  toolLabel: { fontSize: 13, color: '#555', marginTop: 4, fontWeight: '500' },
  toolLabelActive: { color: '#007AFF' },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  colorSwatchActive: {
    borderColor: '#007AFF',
    borderWidth: 3,
  },
  sizeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sizeButton: {
    minWidth: 40,
    height: 32,
    paddingHorizontal: 10,
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
  imageActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginVertical: 8,
  },
  imageActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#E8F0FE',
    borderRadius: 8,
  },
  imageActionText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
});
