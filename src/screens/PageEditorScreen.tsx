import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  LayoutChangeEvent,
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

const TEXT_DEFAULT_WIDTH = 200;
const TEXT_DEFAULT_HEIGHT = 40;
const IMAGE_DEFAULT_SIZE = 150;
const TAP_THRESHOLD = 5;

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

  // Refs so PanResponder closures can access current state
  const activeToolRef = useRef(activeTool);
  const elementsRef = useRef(elements);
  const editingTextIdRef = useRef(editingTextId);
  const canvasRef = useRef<View>(null);
  const canvasSize = useRef({ width: 0, height: 0 });
  const canvasOffset = useRef({ x: 0, y: 0 });
  const isMoving = useRef(false);
  const handleCtx = useRef<HandleCtx | null>(null);

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { elementsRef.current = elements; }, [elements]);
  useEffect(() => { editingTextIdRef.current = editingTextId; }, [editingTextId]);

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
      } else {
        const { width: cw, height: ch } = canvasSize.current;
        const x = Math.max(0, Math.min(cx - TEXT_DEFAULT_WIDTH / 2, cw - TEXT_DEFAULT_WIDTH));
        const y = Math.max(0, Math.min(cy - TEXT_DEFAULT_HEIGHT / 2, ch - TEXT_DEFAULT_HEIGHT));
        const newEl: PageElement = {
          id: generateId(), type: 'text', x, y,
          width: TEXT_DEFAULT_WIDTH, height: TEXT_DEFAULT_HEIGHT, content: '',
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
        const elem = findElementAt(cx, cy);
        startRef.current = { cx, cy, elem, initialX: elem?.x, initialY: elem?.y };
      },

      onPanResponderMove: (_, gs) => {
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

          {elements.map(element => (
            <View
              key={element.id}
              style={[
                styles.element,
                {
                  left: element.x,
                  top: element.y,
                  width: element.width,
                  height: element.height,
                },
                selectedId === element.id && styles.elementSelected,
              ]}
            >
              {/* --- Text element --- */}
              {element.type === 'text' && editingTextId === element.id ? (
                <TextInput
                  style={styles.textInput}
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
                <Text style={styles.elementText}>{element.content}</Text>
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
  elementSelected: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  elementText: {
    fontSize: 14,
    color: '#333',
  },
  textInput: {
    fontSize: 14,
    color: '#333',
    padding: 0,
    margin: 0,
    flex: 1,
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
});
