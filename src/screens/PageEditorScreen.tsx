import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import Svg, { Defs, G, Mask, Path as SvgPath, Rect as SvgRect } from 'react-native-svg';
import { AlbumPage, PageElement } from '../types/Album';

type ToolType = 'text' | 'image' | 'recording' | 'pen' | 'eraser';

interface Tool {
  type: ToolType;
  label: string;
  icon: string;
  accessibilityLabel: string;
}

const TOOLS: Tool[] = [
  { type: 'text', label: 'טקסט', icon: 'format-text', accessibilityLabel: 'הוספת טקסט' },
  { type: 'image', label: 'תמונה', icon: 'image-plus', accessibilityLabel: 'הוספת תמונה' },
  { type: 'recording', label: 'הקלטה', icon: 'microphone', accessibilityLabel: 'הוספת הקלטה' },
  { type: 'pen', label: 'עט', icon: 'pencil', accessibilityLabel: 'כלי עט לציור' },
  { type: 'eraser', label: 'מחק', icon: 'eraser', accessibilityLabel: 'כלי מחיקה' },
];

const IMAGE_DEFAULT_SIZE = 150;
const TAP_THRESHOLD = 5;

const TEXT_DEFAULT_FONT_SIZE = 20;
const TEXT_DEFAULT_COLOR = '#333';
const FONT_SIZE_PRESETS = [16, 20, 28, 36, 48];

const PEN_COLOR = '#333333';
const PEN_STROKE_WIDTH = 3;
const ERASER_MASK_COLOR = '#000000';
const ERASER_PREVIEW_COLOR = 'rgba(200,200,200,0.5)';
const ERASER_STROKE_WIDTH = 20;

const PRESET_COLORS = [
  '#000000', '#555555', '#FF3B30', '#FF9500',
  '#FFCC00', '#34C759', '#007AFF', '#AF52DE',
];

const SLIDER_MIN = 1;
const SLIDER_MAX = 20;

const COLOR_PICKER_COLORS = [
  '#FF3B30', '#FF6961', '#FF2D55', '#E91E63', '#FF69B4', '#FFB6C1',
  '#FF9500', '#FF6600', '#FFCC00', '#FFD700', '#FFF176', '#FFEB3B',
  '#34C759', '#4CAF50', '#8BC34A', '#00BCD4', '#009688', '#2E7D32',
  '#007AFF', '#2196F3', '#3F51B5', '#5856D6', '#AF52DE', '#9C27B0',
  '#000000', '#555555', '#888888', '#BBBBBB', '#FFFFFF', '#8D6E63',
];

interface PageEditorScreenProps {
  page: AlbumPage;
  onSave: (updatedPage: AlbumPage) => void;
  onDiscard: () => void;
}

interface HandleCtx {
  type: 'element-move' | 'image-resize';
  id: string;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  aspectRatio?: number;
}

export interface DrawingData {
  path: string;
  color: string;
  strokeWidth: number;
  isEraser?: boolean;
}

export interface DrawingLayer {
  penPaths: DrawingData[];
  eraserPaths: DrawingData[];
}

export function computeDrawingLayers(drawingElements: PageElement[]): DrawingLayer[] {
  const layers: DrawingLayer[] = [];
  let currentPens: DrawingData[] = [];

  for (const el of drawingElements) {
    const data: DrawingData = JSON.parse(el.content);
    if (data.isEraser) {
      // Eraser: push current pens as a layer, then add this eraser to all preceding layers
      if (currentPens.length > 0) {
        layers.push({ penPaths: currentPens, eraserPaths: [] });
        currentPens = [];
      }
      // Add eraser to all existing layers' masks
      for (const layer of layers) {
        layer.eraserPaths.push(data);
      }
    } else {
      currentPens.push(data);
    }
  }
  // Remaining pen strokes form the final layer (no erasers affect them)
  if (currentPens.length > 0) {
    layers.push({ penPaths: currentPens, eraserPaths: [] });
  }
  return layers;
}

function generateId(): string {
  return `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function hitTest(el: PageElement, x: number, y: number): boolean {
  return x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height;
}

export function PageEditorScreen({ page, onSave, onDiscard }: PageEditorScreenProps) {
  const insets = useSafeAreaInsets();
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
  const [elements, setElements] = useState<PageElement[]>(() =>
    page.elements.map(e => ({ ...e })),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [currentDrawingPath, setCurrentDrawingPath] = useState<string | null>(null);
  const [penColor, setPenColor] = useState(PEN_COLOR);
  const [penStrokeWidth, setPenStrokeWidth] = useState(PEN_STROKE_WIDTH);
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [textColor, setTextColor] = useState(TEXT_DEFAULT_COLOR);
  const [textFontSize, setTextFontSize] = useState(TEXT_DEFAULT_FONT_SIZE);
  const [colorPickerTarget, setColorPickerTarget] = useState<'pen' | 'text'>('pen');

  // Refs so PanResponder closures can access current state
  const activeToolRef = useRef(activeTool);
  const penColorRef = useRef(penColor);
  const penStrokeWidthRef = useRef(penStrokeWidth);
  const elementsRef = useRef(elements);
  const editingTextIdRef = useRef(editingTextId);
  const canvasRef = useRef<View>(null);
  const canvasSize = useRef({ width: 0, height: 0 });
  const canvasOffset = useRef({ x: 0, y: 0 });
  const isMoving = useRef(false);
  const handleCtx = useRef<HandleCtx | null>(null);
  const drawingPathRef = useRef<string | null>(null);
  const drawingToolRef = useRef<ToolType | null>(null);
  const sliderRef = useRef<View>(null);
  const sliderLayoutRef = useRef({ pageX: 0, width: 0 });

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { elementsRef.current = elements; }, [elements]);
  useEffect(() => { editingTextIdRef.current = editingTextId; }, [editingTextId]);
  const textColorRef = useRef(textColor);
  const textFontSizeRef = useRef(textFontSize);

  useEffect(() => { penColorRef.current = penColor; }, [penColor]);
  useEffect(() => { penStrokeWidthRef.current = penStrokeWidth; }, [penStrokeWidth]);
  useEffect(() => { textColorRef.current = textColor; }, [textColor]);
  useEffect(() => { textFontSizeRef.current = textFontSize; }, [textFontSize]);

  const handleSliderTouch = (pageX: number) => {
    const { pageX: sx, width } = sliderLayoutRef.current;
    if (width === 0) { return; }
    const relX = Math.max(0, Math.min(pageX - sx, width));
    const value = Math.round(SLIDER_MIN + (relX / width) * (SLIDER_MAX - SLIDER_MIN));
    setPenStrokeWidth(value);
  };

  const drawingElements = useMemo(() => elements.filter(el => el.type === 'drawing'), [elements]);
  const drawingLayers = useMemo(() => computeDrawingLayers(drawingElements), [drawingElements]);

  // --- Coordinate conversion ---
  const screen2Canvas = (sx: number, sy: number): [number, number] => {
    return [sx - canvasOffset.current.x, sy - canvasOffset.current.y];
  };

  // --- Element search (topmost first, filtered by active tool) ---
  const findElementAt = (cx: number, cy: number): PageElement | undefined => {
    const tool = activeToolRef.current;
    const elems = elementsRef.current;
    for (let i = elems.length - 1; i >= 0; i--) {
      const el = elems[i];
      if (!hitTest(el, cx, cy)) { continue; }
      if (tool === 'text' && el.type === 'text') { return el; }
      if (tool === 'image' && (el.type === 'image' || el.type === 'sticker')) { return el; }
    }
    return undefined;
  };

  // --- Finalize text editing (remove empty) ---
  const finalizeTextEditing = () => {
    const editId = editingTextIdRef.current;
    if (!editId) { return; }
    setEditingTextId(null);
    setElements(prev =>
      prev.filter(el => !(el.id === editId && el.type === 'text' && el.content.trim() === '')),
    );
  };

  // --- Image picker ---
  const pickImage = async (cx: number, cy: number) => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
      if (!result.assets?.[0]?.uri) { return; }
      const asset = result.assets[0];
      const uri = asset.uri!;
      const aspectRatio = asset.width && asset.height ? asset.width / asset.height : 1;
      const imgW = IMAGE_DEFAULT_SIZE;
      const imgH = imgW / aspectRatio;
      const { width: cw, height: ch } = canvasSize.current;
      const x = Math.max(0, Math.min(cx - imgW / 2, cw - imgW));
      const y = Math.max(0, Math.min(cy - imgH / 2, ch - imgH));
      const content = uri.startsWith('file://') ? uri.slice(7) : uri;
      const newEl: PageElement = {
        id: generateId(), type: 'image', x, y, width: imgW, height: imgH, content,
      };
      setElements(prev => [...prev, newEl]);
      setSelectedId(newEl.id);
    } catch (error) {
      console.error('Image pick failed:', error);
    }
  };

  // --- Canvas click handler ---
  const handleCanvasClick = (cx: number, cy: number) => {
    const tool = activeToolRef.current;
    const tapped = findElementAt(cx, cy);

    if (tool === 'text') {
      finalizeTextEditing();
      if (tapped) {
        setSelectedId(tapped.id);
        setEditingTextId(tapped.id);
        setTextColor(tapped.color || TEXT_DEFAULT_COLOR);
        setTextFontSize(tapped.fontSize || TEXT_DEFAULT_FONT_SIZE);
      } else {
        const x = Math.max(0, cx);
        const y = Math.max(0, cy);
        const newEl: PageElement = {
          id: generateId(), type: 'text', x, y,
          width: 60, height: 28, content: '',
          fontSize: textFontSizeRef.current, color: textColorRef.current,
        };
        setElements(prev => [...prev, newEl]);
        setSelectedId(newEl.id);
        setEditingTextId(newEl.id);
      }
    } else if (tool === 'image') {
      finalizeTextEditing();
      if (tapped) {
        setSelectedId(tapped.id);
      } else {
        pickImage(cx, cy);
      }
    } else {
      finalizeTextEditing();
      setSelectedId(null);
    }
  };

  // --- Save handler (uses ref for latest elements) ---
  const doSave = () => {
    const finalElements = elementsRef.current.filter(
      el => !(el.type === 'text' && el.content.trim() === ''),
    );
    onSave({ ...page, elements: finalElements });
  };

  const handleBack = () => {
    Alert.alert(
      'יציאה מעריכה',
      'מה ברצונך לעשות?',
      [
        { text: 'המשך עריכה', style: 'cancel' },
        { text: 'שמירה ויציאה', onPress: doSave },
        { text: 'יציאה ללא שמירה', style: 'destructive', onPress: onDiscard },
      ],
    );
  };

  // ============================================================
  // Canvas PanResponder — taps + image dragging
  // (Following IssieDocs sketchResponder pattern)
  // ============================================================
  const startRef = useRef<{
    cx: number; cy: number;
    elem?: PageElement;
    initialX?: number; initialY?: number;
  } | null>(null);

  const canvasResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isMoving.current,
      onMoveShouldSetPanResponder: (_, gs) =>
        !isMoving.current && (Math.abs(gs.dx) > 3 || Math.abs(gs.dy) > 3),

      onPanResponderGrant: (_, gs) => {
        const [cx, cy] = screen2Canvas(gs.x0, gs.y0);
        if (activeToolRef.current === 'pen' || activeToolRef.current === 'eraser') {
          drawingToolRef.current = activeToolRef.current;
          const halfSW = (activeToolRef.current === 'eraser' ? ERASER_STROKE_WIDTH : penStrokeWidthRef.current) / 2;
          const clampedX = Math.max(halfSW, Math.min(cx, canvasSize.current.width - halfSW));
          const clampedY = Math.max(halfSW, Math.min(cy, canvasSize.current.height - halfSW));
          drawingPathRef.current = `M${clampedX.toFixed(1)} ${clampedY.toFixed(1)}`;
          setCurrentDrawingPath(drawingPathRef.current);
          return;
        }
        const elem = findElementAt(cx, cy);
        startRef.current = { cx, cy, elem, initialX: elem?.x, initialY: elem?.y };
      },

      onPanResponderMove: (_, gs) => {
        if ((activeToolRef.current === 'pen' || activeToolRef.current === 'eraser')
            && drawingPathRef.current !== null) {
          const [cx, cy] = screen2Canvas(gs.moveX, gs.moveY);
          const halfSW = (drawingToolRef.current === 'eraser' ? ERASER_STROKE_WIDTH : penStrokeWidthRef.current) / 2;
          const clampedX = Math.max(halfSW, Math.min(cx, canvasSize.current.width - halfSW));
          const clampedY = Math.max(halfSW, Math.min(cy, canvasSize.current.height - halfSW));
          drawingPathRef.current += ` L${clampedX.toFixed(1)} ${clampedY.toFixed(1)}`;
          setCurrentDrawingPath(drawingPathRef.current);
          return;
        }
        if (!startRef.current) { return; }
        if (Math.abs(gs.dx) < 3 && Math.abs(gs.dy) < 3) { return; }
        const { elem, initialX, initialY } = startRef.current;
        // Only move non-text elements by direct drag (text uses move handle)
        if (elem && initialX !== undefined && initialY !== undefined
            && activeToolRef.current !== 'text') {
          isMoving.current = true;
          setElements(prev => prev.map(el =>
            el.id === elem.id ? { ...el, x: initialX + gs.dx, y: initialY + gs.dy } : el,
          ));
        }
      },

      onPanResponderRelease: (_, gs) => {
        if ((activeToolRef.current === 'pen' || activeToolRef.current === 'eraser')
            && drawingPathRef.current !== null) {
          if (Math.abs(gs.dx) >= TAP_THRESHOLD || Math.abs(gs.dy) >= TAP_THRESHOLD) {
            const isEraser = drawingToolRef.current === 'eraser';
            const drawingData: DrawingData = {
              path: drawingPathRef.current!,
              color: isEraser ? ERASER_MASK_COLOR : penColorRef.current,
              strokeWidth: isEraser ? ERASER_STROKE_WIDTH : penStrokeWidthRef.current,
              ...(isEraser ? { isEraser: true } : {}),
            };
            const content = JSON.stringify(drawingData);
            const newEl: PageElement = {
              id: generateId(), type: 'drawing', x: 0, y: 0,
              width: 0, height: 0, content,
            };
            setElements(prev => [...prev, newEl]);
          }
          drawingPathRef.current = null;
          drawingToolRef.current = null;
          setCurrentDrawingPath(null);
          return;
        }
        if (!startRef.current) { return; }
        if (Math.abs(gs.dx) < TAP_THRESHOLD && Math.abs(gs.dy) < TAP_THRESHOLD) {
          // Tap
          handleCanvasClick(startRef.current.cx, startRef.current.cy);
        } else if (isMoving.current && startRef.current.elem) {
          // Clamp after drag
          const id = startRef.current.elem.id;
          const { width: cw, height: ch } = canvasSize.current;
          setElements(prev => prev.map(el => {
            if (el.id !== id) { return el; }
            return {
              ...el,
              x: Math.max(0, Math.min(el.x, cw - el.width)),
              y: Math.max(0, Math.min(el.y, ch - el.height)),
            };
          }));
        }
        startRef.current = null;
        isMoving.current = false;
      },
    }),
  ).current;

  // ============================================================
  // Move/Resize PanResponder — shared by all handles
  // (Following IssieDocs moveResponder pattern)
  // ============================================================
  const moveResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        isMoving.current = true;
        return true;
      },
      onMoveShouldSetPanResponder: () => true,

      onPanResponderMove: (_, gs) => {
        const ctx = handleCtx.current;
        if (!ctx) { return; }
        if (ctx.type === 'element-move') {
          setElements(prev => prev.map(el =>
            el.id === ctx.id
              ? { ...el, x: ctx.startX + gs.dx, y: ctx.startY + gs.dy }
              : el,
          ));
        } else if (ctx.type === 'image-resize') {
          const newW = Math.max(40, ctx.startW + gs.dx);
          const newH = ctx.aspectRatio
            ? newW / ctx.aspectRatio
            : Math.max(40, ctx.startH + gs.dy);
          setElements(prev => prev.map(el =>
            el.id === ctx.id ? { ...el, width: newW, height: newH } : el,
          ));
        }
      },

      onPanResponderRelease: () => {
        isMoving.current = false;
        const ctx = handleCtx.current;
        if (ctx) {
          const { width: cw, height: ch } = canvasSize.current;
          setElements(prev => prev.map(el => {
            if (el.id !== ctx.id) { return el; }
            return {
              ...el,
              x: Math.max(0, Math.min(el.x, cw - el.width)),
              y: Math.max(0, Math.min(el.y, ch - el.height)),
            };
          }));
          handleCtx.current = null;
        }
      },
    }),
  ).current;

  // --- Canvas layout measurement ---
  const handleCanvasLayout = (_e: LayoutChangeEvent) => {
    setTimeout(() => {
      canvasRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
        canvasSize.current = { width, height };
        canvasOffset.current = { x: pageX, y: pageY };
      });
    }, 50);
  };

  // --- Render ---
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityLabel="חזרה לאלבום"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="arrow-right" size={28} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>עמוד {page.pageNumber}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Canvas */}
      <View style={styles.canvasContainer}>
        <View
          ref={canvasRef}
          style={styles.canvas}
          onLayout={handleCanvasLayout}
          {...canvasResponder.panHandlers}
        >
          {page.backgroundPath ? (
            <Image
              source={{ uri: `file://${page.backgroundPath}` }}
              style={styles.background}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.emptyPage} />
          )}

          {/* Drawing layer (SVG with eraser masking) */}
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              {drawingLayers.map((layer, i) => (
                <Mask id={`eraser-mask-${i}`} key={`mask-${i}`} maskType="luminance"
                  maskUnits="userSpaceOnUse" x="0" y="0" width="9999" height="9999">
                  <SvgRect x="0" y="0" width="9999" height="9999" fill="white" />
                  {layer.eraserPaths.map((ep, j) => (
                    <SvgPath
                      key={`e-${i}-${j}`}
                      d={ep.path}
                      stroke="black"
                      strokeWidth={ep.strokeWidth}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                  {currentDrawingPath && drawingToolRef.current === 'eraser' && (
                    <SvgPath
                      d={currentDrawingPath}
                      stroke="black"
                      strokeWidth={ERASER_STROKE_WIDTH}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </Mask>
              ))}
            </Defs>

            {drawingLayers.map((layer, i) => (
              <G key={`layer-${i}`} mask={`url(#eraser-mask-${i})`}>
                {layer.penPaths.map((pp, j) => (
                  <SvgPath
                    key={`p-${i}-${j}`}
                    d={pp.path}
                    stroke={pp.color}
                    strokeWidth={pp.strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </G>
            ))}

            {/* In-progress pen path (unmasked, newest drawing) */}
            {currentDrawingPath && drawingToolRef.current === 'pen' && (
              <SvgPath
                d={currentDrawingPath}
                stroke={penColor}
                strokeWidth={penStrokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {/* In-progress eraser preview (semi-transparent visual feedback) */}
            {currentDrawingPath && drawingToolRef.current === 'eraser' && (
              <SvgPath
                d={currentDrawingPath}
                stroke={ERASER_PREVIEW_COLOR}
                strokeWidth={ERASER_STROKE_WIDTH}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.3}
              />
            )}
          </Svg>

          {elements.filter(el => el.type !== 'drawing').map(element => (
            <View
              key={element.id}
              style={[
                styles.element,
                {
                  left: element.x,
                  top: element.y,
                  ...(element.type !== 'text' && { width: element.width, height: element.height }),
                },
                element.type === 'text' && styles.textElementAuto,
                selectedId === element.id && styles.elementSelected,
              ]}
              onLayout={element.type === 'text' ? (e) => {
                const { width, height } = e.nativeEvent.layout;
                const cur = elementsRef.current.find(el => el.id === element.id);
                if (cur && (Math.abs(width - cur.width) > 1 || Math.abs(height - cur.height) > 1)) {
                  setElements(prev => prev.map(el =>
                    el.id === element.id ? { ...el, width, height } : el,
                  ));
                }
              } : undefined}
            >
              {/* --- Text element --- */}
              {element.type === 'text' && editingTextId === element.id ? (
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      fontSize: element.fontSize || TEXT_DEFAULT_FONT_SIZE,
                      color: element.color || TEXT_DEFAULT_COLOR,
                    },
                  ]}
                  autoFocus
                  multiline
                  value={element.content}
                  onChangeText={text =>
                    setElements(prev =>
                      prev.map(el =>
                        el.id === element.id ? { ...el, content: text } : el,
                      ),
                    )
                  }
                />
              ) : element.type === 'text' ? (
                <Text style={[
                  styles.elementText,
                  {
                    fontSize: element.fontSize || TEXT_DEFAULT_FONT_SIZE,
                    color: element.color || TEXT_DEFAULT_COLOR,
                  },
                ]}>{element.content}</Text>
              ) : null}

              {/* --- Image element --- */}
              {(element.type === 'image' || element.type === 'sticker') && (
                <Image
                  source={{ uri: `file://${element.content}` }}
                  style={styles.elementImage}
                  resizeMode="contain"
                />
              )}

              {/* --- Move handle (text elements, when selected) --- */}
              {element.type === 'text' && selectedId === element.id && (
                <View
                  style={styles.moveHandle}
                  {...moveResponder.panHandlers}
                  onStartShouldSetResponder={e => {
                    handleCtx.current = {
                      type: 'element-move', id: element.id,
                      startX: element.x, startY: element.y,
                      startW: element.width, startH: element.height,
                    };
                    return moveResponder.panHandlers.onStartShouldSetResponder?.(e) ?? false;
                  }}
                >
                  <MaterialCommunityIcons name="cursor-move" size={20} color="#007AFF" />
                </View>
              )}

              {/* --- Resize handle (image elements, when selected) --- */}
              {(element.type === 'image' || element.type === 'sticker')
                && selectedId === element.id && (
                <View
                  style={styles.resizeHandle}
                  {...moveResponder.panHandlers}
                  onStartShouldSetResponder={e => {
                    handleCtx.current = {
                      type: 'image-resize', id: element.id,
                      startX: element.x, startY: element.y,
                      startW: element.width, startH: element.height,
                      aspectRatio: element.width / element.height,
                    };
                    return moveResponder.panHandlers.onStartShouldSetResponder?.(e) ?? false;
                  }}
                >
                  <MaterialCommunityIcons name="resize-bottom-right" size={20} color="#007AFF" />
                </View>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Pen options panel */}
      {activeTool === 'pen' && (
        <View style={styles.penOptions}>
          {/* Color row */}
          <View style={styles.colorRow}>
            {PRESET_COLORS.map(color => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: color },
                  penColor === color && styles.colorSwatchSelected,
                ]}
                onPress={() => setPenColor(color)}
                accessibilityLabel={`צבע ${color}`}
              />
            ))}
            <TouchableOpacity
              style={styles.paletteButton}
              onPress={() => {
                setColorPickerTarget('pen');
                setColorPickerVisible(true);
              }}
              accessibilityLabel="בחירת צבע מותאם"
            >
              <MaterialCommunityIcons name="palette" size={24} color="#555" />
            </TouchableOpacity>
          </View>

          {/* Stroke width slider */}
          <View style={styles.widthRow}>
            <View
              ref={sliderRef}
              style={styles.sliderTrack}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={(e) => handleSliderTouch(e.nativeEvent.pageX)}
              onResponderMove={(e) => handleSliderTouch(e.nativeEvent.pageX)}
              onLayout={() => {
                sliderRef.current?.measure((_x, _y, width, _h, pageX) => {
                  sliderLayoutRef.current = { pageX, width };
                });
              }}
            >
              <View
                style={[
                  styles.sliderFill,
                  {
                    width: `${((penStrokeWidth - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100}%`,
                    backgroundColor: penColor,
                  },
                ]}
              />
              <View
                style={[
                  styles.sliderThumb,
                  {
                    left: `${((penStrokeWidth - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100}%`,
                  },
                ]}
              />
            </View>
            {/* Live preview */}
            <View style={styles.widthPreview}>
              <View
                style={{
                  width: Math.max(penStrokeWidth, 4),
                  height: Math.max(penStrokeWidth, 4),
                  borderRadius: penStrokeWidth / 2,
                  backgroundColor: penColor,
                }}
              />
            </View>
          </View>
        </View>
      )}

      {/* Text options panel */}
      {(activeTool === 'text' || (selectedId && elements.find(el => el.id === selectedId)?.type === 'text')) && (
        <View style={styles.penOptions}>
          {/* Color row */}
          <View style={styles.colorRow}>
            {PRESET_COLORS.map(color => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: color },
                  textColor === color && styles.colorSwatchSelected,
                ]}
                onPress={() => {
                  setTextColor(color);
                  if (selectedId) {
                    setElements(prev => prev.map(el =>
                      el.id === selectedId ? { ...el, color } : el,
                    ));
                  }
                }}
                accessibilityLabel={`צבע טקסט ${color}`}
              />
            ))}
            <TouchableOpacity
              style={styles.paletteButton}
              onPress={() => {
                setColorPickerTarget('text');
                setColorPickerVisible(true);
              }}
              accessibilityLabel="בחירת צבע טקסט מותאם"
            >
              <MaterialCommunityIcons name="palette" size={24} color="#555" />
            </TouchableOpacity>
          </View>

          {/* Font size row */}
          <View style={styles.fontSizeRow}>
            {FONT_SIZE_PRESETS.map(size => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.fontSizeChip,
                  textFontSize === size && styles.fontSizeChipSelected,
                ]}
                onPress={() => {
                  setTextFontSize(size);
                  if (selectedId) {
                    setElements(prev => prev.map(el =>
                      el.id === selectedId ? { ...el, fontSize: size } : el,
                    ));
                  }
                }}
                accessibilityLabel={`גודל גופן ${size}`}
              >
                <Text style={[
                  styles.fontSizeChipText,
                  textFontSize === size && styles.fontSizeChipTextSelected,
                ]}>{size}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Color picker modal */}
      <Modal
        visible={colorPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setColorPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.colorPickerOverlay}
          activeOpacity={1}
          onPress={() => setColorPickerVisible(false)}
        >
          <View style={styles.colorPickerContainer}>
            <Text style={styles.colorPickerTitle}>בחירת צבע</Text>
            <View style={styles.colorPickerGrid}>
              {COLOR_PICKER_COLORS.map(color => {
                const isSelected = colorPickerTarget === 'pen' ? penColor === color : textColor === color;
                return (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorPickerSwatch,
                      { backgroundColor: color },
                      color === '#FFFFFF' && styles.colorPickerSwatchWhite,
                      isSelected && styles.colorSwatchSelected,
                    ]}
                    onPress={() => {
                      if (colorPickerTarget === 'pen') {
                        setPenColor(color);
                      } else {
                        setTextColor(color);
                        if (selectedId) {
                          setElements(prev => prev.map(el =>
                            el.id === selectedId ? { ...el, color } : el,
                          ));
                        }
                      }
                      setColorPickerVisible(false);
                    }}
                  />
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Toolbar */}
      <View style={[styles.toolbar, { paddingBottom: insets.bottom || 12 }]}>
        {TOOLS.map(tool => {
          const isActive = activeTool === tool.type;
          return (
            <TouchableOpacity
              key={tool.type}
              style={[styles.toolButton, isActive && styles.toolButtonActive]}
              onPress={() => {
                finalizeTextEditing();
                setSelectedId(null);
                setActiveTool(isActive ? null : tool.type);
              }}
              accessibilityLabel={tool.accessibilityLabel}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <MaterialCommunityIcons
                name={tool.icon}
                size={32}
                color={isActive ? '#007AFF' : '#555'}
              />
              <Text style={[styles.toolLabel, isActive && styles.toolLabelActive]}>
                {tool.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
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
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  canvasContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  canvas: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  emptyPage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fafafa',
  },
  element: {
    position: 'absolute',
  },
  textElementAuto: {
    minWidth: 60,
    minHeight: 28,
  },
  elementSelected: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  elementText: {
  },
  textInput: {
    padding: 0,
    margin: 0,
    minWidth: 60,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  elementImage: {
    width: '100%',
    height: '100%',
  },
  moveHandle: {
    position: 'absolute',
    left: -28,
    top: 0,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  resizeHandle: {
    position: 'absolute',
    right: -12,
    bottom: -12,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
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
  toolButtonActive: {
    backgroundColor: '#E8F0FE',
  },
  toolLabel: {
    fontSize: 13,
    color: '#555',
    marginTop: 4,
    fontWeight: '500',
  },
  toolLabelActive: {
    color: '#007AFF',
  },
  penOptions: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  paletteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  widthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sliderTrack: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
    opacity: 0.3,
  },
  sliderThumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#007AFF',
    marginLeft: -11,
    top: 3,
  },
  widthPreview: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fontSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fontSizeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    minWidth: 40,
    alignItems: 'center',
  },
  fontSizeChipSelected: {
    backgroundColor: '#007AFF',
  },
  fontSizeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  fontSizeChipTextSelected: {
    color: '#fff',
  },
  colorPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: 280,
  },
  colorPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  colorPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  colorPickerSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  colorPickerSwatchWhite: {
    borderColor: '#ccc',
    borderWidth: 2,
  },
});
