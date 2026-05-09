import React, { useRef, useState } from 'react';
import { PanResponder, PanResponderInstance, StyleSheet, Text, View } from 'react-native';
import { SketchText } from '../types/Album';

export interface ViewModeEmojiOverlayProps {
  emojis: SketchText[];
  selectedId: string | null;
  ratio: number;
  displayWidth: number;
  displayHeight: number;
  onSelect: (id: string | null) => void;
  onMoveEnd: (id: string, x: number, y: number) => void;
  onMoveOutOfBounds: (id: string) => void;
  onPinchRotateEnd: (id: string, fontSize: number, rotation: number) => void;
}

interface EmojiTransient {
  x?: number;
  y?: number;
  fontSize?: number;
  rotation?: number;
}

interface GestureEntry {
  dragStart?: { x: number; y: number; touchX: number; touchY: number };
  pinchBase?: { dist: number; angle: number; fontSize: number; rotation: number };
  isDragging: boolean;
}

function calcDist(t1: { pageX: number; pageY: number }, t2: { pageX: number; pageY: number }) {
  return Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
}

function calcAngle(t1: { pageX: number; pageY: number }, t2: { pageX: number; pageY: number }) {
  return Math.atan2(t2.pageY - t1.pageY, t2.pageX - t1.pageX) * (180 / Math.PI);
}

const TAP_SLOP = 8; // pixels — treat as tap if moved less than this

export function ViewModeEmojiOverlay({
  emojis,
  selectedId,
  ratio,
  displayWidth,
  displayHeight,
  onSelect,
  onMoveEnd,
  onMoveOutOfBounds,
  onPinchRotateEnd,
}: ViewModeEmojiOverlayProps) {
  const [transient, setTransient] = useState<Record<string, EmojiTransient>>({});

  // Stable refs — avoids stale closure in PanResponder handlers
  const emojisRef = useRef(emojis);
  emojisRef.current = emojis;
  const transientRef = useRef(transient);
  transientRef.current = transient;
  const ratioRef = useRef(ratio);
  ratioRef.current = ratio;
  const displayWidthRef = useRef(displayWidth);
  displayWidthRef.current = displayWidth;
  const displayHeightRef = useRef(displayHeight);
  displayHeightRef.current = displayHeight;
  const onMoveEndRef = useRef(onMoveEnd);
  onMoveEndRef.current = onMoveEnd;
  const onMoveOutOfBoundsRef = useRef(onMoveOutOfBounds);
  onMoveOutOfBoundsRef.current = onMoveOutOfBounds;
  const onPinchRotateEndRef = useRef(onPinchRotateEnd);
  onPinchRotateEndRef.current = onPinchRotateEnd;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  // Per-emoji gesture state
  const gestureStateRef = useRef<Record<string, GestureEntry>>({});

  // PanResponder cache — one per emoji, recreated when selection changes
  const panResponderCacheRef = useRef<Record<string, PanResponderInstance>>({});

  function getOrCreatePanResponder(emojiId: string): PanResponderInstance {
    if (panResponderCacheRef.current[emojiId]) {
      return panResponderCacheRef.current[emojiId];
    }

    const gs = (): GestureEntry => {
      if (!gestureStateRef.current[emojiId]) {
        gestureStateRef.current[emojiId] = { isDragging: false };
      }
      return gestureStateRef.current[emojiId];
    };

    const pr = PanResponder.create({
      // Always claim the touch — don't let carousel steal it
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,

      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        const g = gs();
        const emoji = emojisRef.current.find(e => e.id === emojiId);
        if (!emoji) return;
        const t = transientRef.current[emojiId] ?? {};
        const curX = t.x ?? emoji.x ?? 0;
        const curY = t.y ?? emoji.y ?? 0;
        const curFontSize = t.fontSize ?? emoji.fontSize ?? 100;
        const curRotation = t.rotation ?? emoji.rotation ?? 0;
        g.isDragging = false;

        if (touches.length >= 2) {
          g.dragStart = undefined;
          g.pinchBase = {
            dist: calcDist(touches[0], touches[1]),
            angle: calcAngle(touches[0], touches[1]),
            fontSize: curFontSize,
            rotation: curRotation,
          };
        } else {
          g.pinchBase = undefined;
          g.dragStart = {
            x: curX,
            y: curY,
            touchX: touches[0].pageX,
            touchY: touches[0].pageY,
          };
        }
      },

      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        const g = gs();

        if (touches.length >= 2) {
          // Initialize pinchBase on first 2-finger move (second finger arrived after grant)
          if (!g.pinchBase) {
            const emoji = emojisRef.current.find(e => e.id === emojiId);
            if (!emoji) return;
            const t = transientRef.current[emojiId] ?? {};
            g.dragStart = undefined;
            g.pinchBase = {
              dist: calcDist(touches[0], touches[1]),
              angle: calcAngle(touches[0], touches[1]),
              fontSize: t.fontSize ?? emoji.fontSize,
              rotation: t.rotation ?? emoji.rotation ?? 0,
            };
            return;
          }
          g.isDragging = true;
          const newDist = calcDist(touches[0], touches[1]);
          const newAngle = calcAngle(touches[0], touches[1]);
          const scale = newDist / g.pinchBase.dist;
          const angleDelta = newAngle - g.pinchBase.angle;
          const capturedFontSize = Math.max(30, Math.min(300, Math.round(g.pinchBase.fontSize * scale)));
          const capturedRotation = ((g.pinchBase.rotation + angleDelta) % 360 + 360) % 360;
          setTransient(prev => {
            const next = { ...prev, [emojiId]: { ...prev[emojiId], fontSize: capturedFontSize, rotation: capturedRotation } };
            transientRef.current = next;
            return next;
          });
        } else if (touches.length === 1 && g.dragStart) {
          const dx = touches[0].pageX - g.dragStart.touchX;
          const dy = touches[0].pageY - g.dragStart.touchY;
          if (!g.isDragging && Math.hypot(dx, dy) < TAP_SLOP) return;
          g.isDragging = true;
          const r = ratioRef.current;
          const baseX = g.dragStart.x;
          const baseY = g.dragStart.y;
          setTransient(prev => {
            const next = { ...prev, [emojiId]: { ...prev[emojiId], x: baseX + dx / r, y: baseY + dy / r } };
            transientRef.current = next;
            return next;
          });
        }
      },

      onPanResponderRelease: (evt) => {
        const g = gs();
        const emoji = emojisRef.current.find(e => e.id === emojiId);
        if (!emoji) return;

        if (!g.isDragging && !g.pinchBase) {
          // tap — toggle selection
          onSelectRef.current(selectedIdRef.current === emojiId ? null : emojiId);
          g.dragStart = undefined;
          return;
        }

        const t = transientRef.current[emojiId] ?? {};
        const finalX = t.x ?? emoji.x ?? 0;
        const finalY = t.y ?? emoji.y ?? 0;
        const finalFontSize = t.fontSize ?? emoji.fontSize ?? 100;
        const finalRotation = t.rotation ?? emoji.rotation ?? 0;
        const r = ratioRef.current;

        if (g.dragStart && g.isDragging) {
          const canvasX = finalX * r;
          const canvasY = finalY * r;
          const w = displayWidthRef.current;
          const h = displayHeightRef.current;
          setTransient(prev => { const n = { ...prev }; delete n[emojiId]; transientRef.current = n; return n; });
          if (canvasX < 0 || canvasX > w || canvasY < 0 || canvasY > h) {
            onMoveOutOfBoundsRef.current(emojiId);
          } else {
            onMoveEndRef.current(emojiId, finalX, finalY);
          }
        } else if (g.pinchBase) {
          setTransient(prev => { const n = { ...prev }; delete n[emojiId]; transientRef.current = n; return n; });
          onPinchRotateEndRef.current(emojiId, finalFontSize, finalRotation);
        }

        g.dragStart = undefined;
        g.pinchBase = undefined;
        g.isDragging = false;
      },

      onPanResponderTerminate: () => {
        // Another responder took over — clear state but don't save
        const g = gs();
        if (g.isDragging) {
          setTransient(prev => { const n = { ...prev }; delete n[emojiId]; transientRef.current = n; return n; });
        }
        g.dragStart = undefined;
        g.pinchBase = undefined;
        g.isDragging = false;
      },
    });

    panResponderCacheRef.current[emojiId] = pr;
    return pr;
  }

  // Canvas-wide responder — handles pinch/rotate anywhere when emoji is selected
  const canvasGestureRef = useRef<{ pinchBase?: { dist: number; angle: number; fontSize: number; rotation: number }; tapped: boolean }>({ tapped: false });

  const canvasPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: (evt) => {
      // Only claim if emoji selected AND 2 fingers
      return selectedIdRef.current !== null && evt.nativeEvent.touches.length >= 2;
    },
    onStartShouldSetPanResponderCapture: (evt) => {
      return selectedIdRef.current !== null && evt.nativeEvent.touches.length >= 2;
    },
    onMoveShouldSetPanResponder: (evt) => {
      return selectedIdRef.current !== null && evt.nativeEvent.touches.length >= 2;
    },
    onMoveShouldSetPanResponderCapture: (evt) => {
      return selectedIdRef.current !== null && evt.nativeEvent.touches.length >= 2;
    },

    onPanResponderGrant: (evt) => {
      const touches = evt.nativeEvent.touches;
      const emojiId = selectedIdRef.current;
      if (!emojiId || touches.length < 2) return;
      const emoji = emojisRef.current.find(e => e.id === emojiId);
      if (!emoji) return;
      const t = transientRef.current[emojiId] ?? {};
      canvasGestureRef.current.pinchBase = {
        dist: calcDist(touches[0], touches[1]),
        angle: calcAngle(touches[0], touches[1]),
        fontSize: t.fontSize ?? emoji.fontSize,
        rotation: t.rotation ?? emoji.rotation ?? 0,
      };
    },

    onPanResponderMove: (evt) => {
      const touches = evt.nativeEvent.touches;
      const emojiId = selectedIdRef.current;
      if (!emojiId || touches.length < 2) return;
      const pb = canvasGestureRef.current.pinchBase;
      if (!pb) return;
      const scale = calcDist(touches[0], touches[1]) / pb.dist;
      const angleDelta = calcAngle(touches[0], touches[1]) - pb.angle;
      const capturedFontSize = Math.max(30, Math.min(300, Math.round(pb.fontSize * scale)));
      const capturedRotation = ((pb.rotation + angleDelta) % 360 + 360) % 360;
      setTransient(prev => {
        const next = { ...prev, [emojiId]: { ...prev[emojiId], fontSize: capturedFontSize, rotation: capturedRotation } };
        transientRef.current = next;
        return next;
      });
    },

    onPanResponderRelease: () => {
      const emojiId = selectedIdRef.current;
      if (!emojiId) return;
      const pb = canvasGestureRef.current.pinchBase;
      if (pb) {
        const t = transientRef.current[emojiId] ?? {};
        const emoji = emojisRef.current.find(e => e.id === emojiId);
        if (emoji) {
          onPinchRotateEndRef.current(emojiId, t.fontSize ?? emoji.fontSize, t.rotation ?? emoji.rotation ?? 0);
          setTransient(prev => { const n = { ...prev }; delete n[emojiId]; transientRef.current = n; return n; });
        }
      }
      canvasGestureRef.current.pinchBase = undefined;
    },

    onPanResponderTerminate: () => {
      canvasGestureRef.current.pinchBase = undefined;
    },
  })).current;

  // Bust PanResponder cache when selection changes so refs stay current
  const prevSelectedRef = useRef(selectedId);
  if (prevSelectedRef.current !== selectedId) {
    panResponderCacheRef.current = {};
    prevSelectedRef.current = selectedId;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Canvas-wide pinch/rotate capture when emoji is selected */}
      {selectedId !== null && (
        <View
          style={StyleSheet.absoluteFill}
          {...canvasPanResponder.panHandlers}
        />
      )}
      {emojis.map((emoji) => {
        const t = transient[emoji.id] ?? {};
        const x = (t.x ?? emoji.x) * ratio;
        const y = (t.y ?? emoji.y) * ratio;
        const fontSize = (t.fontSize ?? emoji.fontSize) * ratio;
        const rotation = t.rotation ?? emoji.rotation ?? 0;
        const isSelected = selectedId === emoji.id;
        const panHandlers = getOrCreatePanResponder(emoji.id).panHandlers;

        return (
          <View
            key={emoji.id}
            style={[
              styles.emojiWrapper,
              {
                left: x,
                top: y,
                width: fontSize * 1.2,
                height: fontSize * 1.2,
                transform: [{ rotate: `${rotation}deg` }],
                borderWidth: isSelected ? 3 : 0,
                borderColor: '#007AFF',
                borderRadius: 8,
              },
            ]}
            {...panHandlers}
          >
            <Text style={{ fontSize, lineHeight: fontSize * 1.2 }}>{emoji.text}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  emojiWrapper: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
