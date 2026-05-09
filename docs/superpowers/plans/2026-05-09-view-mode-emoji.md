# View-Mode Emoji Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to add, drag, resize, and rotate emojis directly in view mode; changes are persisted to the page JSON with undo/redo support.

**Architecture:** PageCard gains a local `DoQueue` seeded from `page.elements`; all view-mode emoji mutations flow through it. A new `ViewModeEmojiOverlay` component renders and handles gestures for `addedInView` emojis. Save fires on page navigation or entering edit mode.

**Tech Stack:** React Native, `rn-emoji-keyboard`, `react-native-gesture-handler` (Gesture API), existing `DoQueue` / `compileQueueToElements` utilities.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/Album.ts` | Modify | Add `addedInView?: boolean` to `SketchText` |
| `src/components/ViewModeEmojiOverlay.tsx` | Create | Render + gesture handling for view-mode emojis |
| `src/components/PageCard.tsx` | Modify | Local queue, emoji button, undo/redo, save trigger, mount overlay |
| `src/screens/AlbumScreen.tsx` | Modify | Pass `onSavePage`, expose `saveIfDirty` before edit |

---

### Task 1: Add `addedInView` flag to `SketchText`

**Files:**
- Modify: `src/types/Album.ts:70-89`

- [ ] **Add the flag**

In `src/types/Album.ts`, update `SketchText`:

```typescript
export interface SketchText extends ElementBase {
  text: string;
  fontSize: number;
  color: string;
  rtl: boolean;
  alignment: string;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  tableId?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  pendingPageHeightIncrease?: number;
  tempTop2CursorHeight?: number;
  isEmoji?: boolean;
  rotation?: number;
  addedInView?: boolean; // true = added in view mode; draggable/deletable in view mode only
}
```

- [ ] **Build check**

```bash
cd /Users/i022021/dev/Issie/IssieAlbom && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Commit**

```bash
git add src/types/Album.ts
git commit -m "feat(types): add addedInView flag to SketchText"
```

---

### Task 2: Create `ViewModeEmojiOverlay` component

**Files:**
- Create: `src/components/ViewModeEmojiOverlay.tsx`

This component receives the list of `addedInView` emojis, renders them as absolutely-positioned `Text` nodes, and handles all gestures (drag via PanResponder multi-touch, pinch+rotate via canvas-style multi-touch tracking). It reports final values back to `PageCard` via callbacks — no queue writes inside.

- [ ] **Create the file**

```typescript
// src/components/ViewModeEmojiOverlay.tsx
import React, { useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
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
  x: number;
  y: number;
  fontSize: number;
  rotation: number;
}

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
  // Transient display state during gesture (avoids queue writes mid-gesture)
  const [transient, setTransient] = useState<Record<string, Partial<EmojiTransient>>>({});

  // Per-emoji gesture state refs (stable across renders)
  const gestureState = useRef<Record<string, {
    dragStart?: { x: number; y: number; touchX: number; touchY: number };
    pinchBase?: { dist: number; angle: number; fontSize: number; rotation: number };
  }>>({});

  function getOrCreateGestureState(id: string) {
    if (!gestureState.current[id]) gestureState.current[id] = {};
    return gestureState.current[id];
  }

  function dist(t1: { pageX: number; pageY: number }, t2: { pageX: number; pageY: number }) {
    return Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
  }

  function angle(t1: { pageX: number; pageY: number }, t2: { pageX: number; pageY: number }) {
    return Math.atan2(t2.pageY - t1.pageY, t2.pageX - t1.pageX) * (180 / Math.PI);
  }

  function makePanResponder(emoji: SketchText) {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => selectedId === emoji.id,
      onMoveShouldSetPanResponder: () => selectedId === emoji.id,
      onMoveShouldSetPanResponderCapture: () => selectedId === emoji.id,

      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        const gs = getOrCreateGestureState(emoji.id);
        const cur = { ...emoji, ...transient[emoji.id] };

        if (touches.length === 1) {
          gs.dragStart = {
            x: cur.x,
            y: cur.y,
            touchX: touches[0].pageX,
            touchY: touches[0].pageY,
          };
          gs.pinchBase = undefined;
        } else if (touches.length === 2) {
          gs.dragStart = undefined;
          gs.pinchBase = {
            dist: dist(touches[0], touches[1]),
            angle: angle(touches[0], touches[1]),
            fontSize: cur.fontSize,
            rotation: cur.rotation ?? 0,
          };
        }
      },

      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        const gs = getOrCreateGestureState(emoji.id);

        if (touches.length === 1 && gs.dragStart) {
          const dx = touches[0].pageX - gs.dragStart.touchX;
          const dy = touches[0].pageY - gs.dragStart.touchY;
          setTransient(prev => ({
            ...prev,
            [emoji.id]: { x: gs.dragStart!.x + dx / ratio, y: gs.dragStart!.y + dy / ratio },
          }));
        } else if (touches.length === 2 && gs.pinchBase) {
          const newDist = dist(touches[0], touches[1]);
          const newAngle = angle(touches[0], touches[1]);
          const scale = newDist / gs.pinchBase.dist;
          const angleDelta = newAngle - gs.pinchBase.angle;
          const newFontSize = Math.max(30, Math.min(300, Math.round(gs.pinchBase.fontSize * scale)));
          const newRotation = ((gs.pinchBase.rotation + angleDelta) % 360 + 360) % 360;
          setTransient(prev => ({
            ...prev,
            [emoji.id]: { fontSize: newFontSize, rotation: newRotation },
          }));
        }
      },

      onPanResponderRelease: (evt) => {
        const gs = getOrCreateGestureState(emoji.id);
        const cur = { ...emoji, ...transient[emoji.id] };

        if (gs.dragStart) {
          // Check bounds (coords are in canvas-space, i.e. pre-ratio)
          const canvasX = cur.x * ratio;
          const canvasY = cur.y * ratio;
          if (canvasX < 0 || canvasX > displayWidth || canvasY < 0 || canvasY > displayHeight) {
            setTransient(prev => { const n = { ...prev }; delete n[emoji.id]; return n; });
            onMoveOutOfBounds(emoji.id);
          } else {
            onMoveEnd(emoji.id, cur.x, cur.y);
            setTransient(prev => { const n = { ...prev }; delete n[emoji.id]; return n; });
          }
        } else if (gs.pinchBase) {
          onPinchRotateEnd(emoji.id, cur.fontSize, cur.rotation ?? 0);
          setTransient(prev => { const n = { ...prev }; delete n[emoji.id]; return n; });
        }

        gs.dragStart = undefined;
        gs.pinchBase = undefined;
      },
    });
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {emojis.map((emoji) => {
        const cur = { ...emoji, ...transient[emoji.id] };
        const isSelected = selectedId === emoji.id;
        const panHandlers = makePanResponder(emoji).panHandlers;
        const size = cur.fontSize * ratio;

        return (
          <View
            key={emoji.id}
            style={[
              styles.emojiWrapper,
              {
                left: cur.x * ratio,
                top: cur.y * ratio,
                width: size * 1.2,
                height: size * 1.2,
                transform: [{ rotate: `${cur.rotation ?? 0}deg` }],
                borderWidth: isSelected ? 3 : 0,
                borderColor: isSelected ? '#007AFF' : 'transparent',
                borderRadius: 8,
              },
            ]}
            {...panHandlers}
            onTouchEnd={(e) => {
              e.stopPropagation();
              onSelect(isSelected ? null : emoji.id);
            }}
          >
            <Text style={{ fontSize: size, lineHeight: size * 1.2 }}>{emoji.text}</Text>
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
```

- [ ] **Build check**

```bash
cd /Users/i022021/dev/Issie/IssieAlbom && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Commit**

```bash
git add src/components/ViewModeEmojiOverlay.tsx
git commit -m "feat(view-emoji): add ViewModeEmojiOverlay component with drag+pinch+rotate"
```

---

### Task 3: Update `PageCard` — local queue + derived texts

**Files:**
- Modify: `src/components/PageCard.tsx`

Replace the existing `useMemo`-only texts derivation with a local `DoQueue` instance so view-mode mutations can be tracked.

- [ ] **Add imports at top of PageCard.tsx**

After the existing imports, add:

```typescript
import DoQueue from '../utils/DoQueue';
import { getId } from '../utils/pageUtils';
import EmojiPicker, { en, he } from 'rn-emoji-keyboard';
import type { EmojiType } from 'rn-emoji-keyboard';
import { ViewModeEmojiOverlay } from './ViewModeEmojiOverlay';
import { useLanguage } from '../contexts/LanguageContext';
```

- [ ] **Add `onSavePage` to PageCardProps and `saveIfDirty` to PageCardRef**

Replace the `PageCardProps` and `PageCardRef` interfaces:

```typescript
export interface PageCardRef {
  captureScreenshot: () => Promise<string>;
  saveIfDirty: () => void;
}

interface PageCardProps {
  page: AlbumPage;
  albumId: string;
  isEditMode: boolean;
  onPress: (page: AlbumPage) => void;
  onEdit?: (page: AlbumPage) => void;
  onDelete?: (page: AlbumPage) => void;
  autoPlayAudio?: boolean;
  highlightedWordIndex?: number;
  onSavePage?: (updatedPage: AlbumPage, shouldExit?: boolean) => void;
}
```

- [ ] **Add new state inside PageCard function (after existing state declarations)**

Add after the existing `const insets = ...` line:

```typescript
const { language, isRTL } = useLanguage();
const [showEmojiKeyboard, setShowEmojiKeyboard] = useState(false);
const [selectedEmojiId, setSelectedEmojiId] = useState<string | null>(null);

// Local queue seeded from page elements — tracks view-mode mutations
const viewQueue = useRef<DoQueue>(new DoQueue());
const [queueVersion, setQueueVersion] = useState(0); // bump to trigger re-derive
const baselineLength = useRef(0); // length of queue after seeding from page
const isDirty = useRef(false);

// Seed queue once when page prop changes
useEffect(() => {
  const q = new DoQueue();
  const v2 = loadPageWithMigration(page);
  v2.elements.forEach(qe => q.add(qe));
  baselineLength.current = q.getQueueLength();
  viewQueue.current = q;
  isDirty.current = false;
  setQueueVersion(v => v + 1);
}, [page.id]);
```

- [ ] **Expose `saveIfDirty` via ref**

Replace the existing `useImperativeHandle` block:

```typescript
useImperativeHandle(ref, () => ({
  captureScreenshot: async () => {
    if (!viewShotRef.current) throw new Error('ViewShot ref not available');
    const uri = await captureRef(viewShotRef, { format: 'jpg', quality: 0.6 });
    return uri;
  },
  saveIfDirty: () => {
    if (!isDirty.current || !onSavePage) return;
    const v2 = loadPageWithMigration(page);
    const updatedPage: AlbumPageV2 = {
      ...v2,
      elements: viewQueue.current.getAll(),
    };
    onSavePage(updatedPage as AlbumPage);
    isDirty.current = false;
  },
}));
```

- [ ] **Save on unmount**

Add after the `useImperativeHandle` block:

```typescript
useEffect(() => {
  return () => {
    if (isDirty.current && onSavePage) {
      const v2 = loadPageWithMigration(page);
      const updatedPage: AlbumPageV2 = {
        ...v2,
        elements: viewQueue.current.getAll(),
      };
      onSavePage(updatedPage as AlbumPage);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Derive texts from local queue**

Replace the `const { paths, texts, images, ... } = useMemo(...)` block so it re-runs when `queueVersion` changes. Change its dependency array to include `queueVersion`:

```typescript
const { paths, texts, images, audios, tiles, backgroundPattern } = useMemo(() => {
  const elements = viewQueue.current.getAll();
  const result = compileQueueToElements(elements);
  const imagesWithUris = result.images.map(img => ({
    ...img,
    imageUri: `file://${AttachmentService.getAbsolutePath(albumId, img.imagePath)}`,
  }));
  return { ...result, images: imagesWithUris };
  // queueVersion is the trigger — viewQueue.current is stable ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [queueVersion, albumId]);
```

- [ ] **Build check**

```bash
cd /Users/i022021/dev/Issie/IssieAlbom && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Commit**

```bash
git add src/components/PageCard.tsx
git commit -m "feat(view-emoji): PageCard gains local queue and saveIfDirty"
```

---

### Task 4: Wire emoji button, keyboard, and queue mutations into PageCard

**Files:**
- Modify: `src/components/PageCard.tsx`

- [ ] **Add queue mutation helpers inside PageCard (after the saveIfDirty effect)**

```typescript
function rebuildFromQueue() {
  isDirty.current = viewQueue.current.getQueueLength() > baselineLength.current
    || viewQueue.current.canRedo();
  setQueueVersion(v => v + 1);
}

function handleEmojiPick(emojiObject: EmojiType) {
  const emojiSize = 100;
  const newEmoji: SketchText = {
    id: getId('text'),
    text: emojiObject.emoji,
    fontSize: emojiSize,
    color: '#000000',
    rtl: isRTL,
    alignment: isRTL ? 'Right' : 'Left',
    x: (displayWidth / ratio) / 2 - emojiSize / 2 / ratio,
    y: (displayHeight / ratio) / 2 - emojiSize / 2 / ratio,
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
```

- [ ] **Compute viewModeEmojis and dirty state for render**

Add after the `pageAudio` memo:

```typescript
const viewModeEmojis = useMemo(
  () => texts.filter(t => t.isEmoji && t.addedInView),
  [texts]
);

const canUndo = viewQueue.current.canUndo(baselineLength.current);
const canRedo = viewQueue.current.canRedo();
const showUndoRedo = isDirty.current || canRedo;
```

- [ ] **Add emoji button, undo/redo, overlay, and keyboard to the JSX**

Inside the `return (...)` of PageCard, after the closing `</View>` of the `<View ref={viewShotRef} ...>` block (i.e. as siblings inside `<View style={styles.pageContent} ...>`), add:

```tsx
{/* Emoji button + undo/redo — only in view mode */}
{!isEditMode && (
  <View style={styles.viewModeControls} pointerEvents="box-none">
    <TouchableOpacity
      style={styles.viewModeButton}
      onPress={() => setShowEmojiKeyboard(true)}
    >
      <Text style={styles.viewModeButtonText}>😊</Text>
    </TouchableOpacity>
    {showUndoRedo && (
      <>
        <TouchableOpacity
          style={[styles.viewModeButton, !canUndo && styles.viewModeButtonDisabled]}
          onPress={handleUndo}
          disabled={!canUndo}
        >
          <Text style={styles.viewModeButtonText}>↩</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, !canRedo && styles.viewModeButtonDisabled]}
          onPress={handleRedo}
          disabled={!canRedo}
        >
          <Text style={styles.viewModeButtonText}>↪</Text>
        </TouchableOpacity>
      </>
    )}
  </View>
)}

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
      translation={language === 'en' ? en : he}
    />
  </View>
)}
```

- [ ] **Add styles for the new controls**

In the `StyleSheet.create({...})` at the bottom of PageCard.tsx, add:

```typescript
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
```

- [ ] **Build check**

```bash
cd /Users/i022021/dev/Issie/IssieAlbom && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Commit**

```bash
git add src/components/PageCard.tsx
git commit -m "feat(view-emoji): emoji button, keyboard, overlay, undo/redo wired into PageCard"
```

---

### Task 5: Update AlbumScreen to pass `onSavePage` and call `saveIfDirty` before edit

**Files:**
- Modify: `src/screens/AlbumScreen.tsx`

- [ ] **Update carousel PageCard render to pass `onSavePage`**

In `AlbumScreen.tsx`, the carousel `renderItem` renders `<PageCard ...>`. Add a ref map and `onSavePage`:

First, add a ref map near the top of `AlbumScreen` (after `carouselRef`):

```typescript
const pageCardRefs = useRef<Map<string, React.RefObject<PageCardRef>>>(new Map());

function getPageCardRef(pageId: string): React.RefObject<PageCardRef> {
  if (!pageCardRefs.current.has(pageId)) {
    pageCardRefs.current.set(pageId, React.createRef<PageCardRef>());
  }
  return pageCardRefs.current.get(pageId)!;
}
```

- [ ] **Pass `ref` and `onSavePage` to PageCard inside renderItem**

In the carousel `renderItem`, replace `<PageCard ...>` with:

```tsx
<PageCard
  ref={getPageCardRef(item.id)}
  page={item}
  albumId={album.id}
  isEditMode={isEditMode}
  onPress={() => { }}
  onEdit={handleEditPage}
  onDelete={handleDeletePage}
  autoPlayAudio={currentPageIndex === actualPageIndex}
  onSavePage={(updatedPage) => handleEditorSave(updatedPage, false)}
/>
```

- [ ] **Call `saveIfDirty` before entering edit mode**

Replace `handleEditPage`:

```typescript
const handleEditPage = (page: AlbumPage) => {
  // Save any pending view-mode changes before opening editor
  const ref = pageCardRefs.current.get(page.id);
  ref?.current?.saveIfDirty();
  setEditingPage(page);
};
```

- [ ] **Also pass `onSavePage` to the off-screen thumbnail PageCard**

Find the thumbnail `<PageCard ref={thumbnailCardRef} ...>` (around line 550) and add:

```tsx
onSavePage={undefined}
```

(explicit no-op — thumbnail card never needs to save)

- [ ] **Build check**

```bash
cd /Users/i022021/dev/Issie/IssieAlbom && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Commit**

```bash
git add src/screens/AlbumScreen.tsx
git commit -m "feat(view-emoji): AlbumScreen saves dirty PageCard before edit"
```

---

## Manual Test Checklist

After all tasks:

- [ ] Tap emoji button (top-left of current page) → emoji keyboard opens
- [ ] Pick emoji → appears centered on page, auto-selected (blue border)
- [ ] Drag selected emoji → moves with finger
- [ ] Drag emoji outside page bounds → emoji deleted
- [ ] Two-finger pinch → emoji grows/shrinks
- [ ] Two-finger rotate → emoji rotates
- [ ] Undo button appears after adding emoji; tapping removes it
- [ ] Redo button appears after undo; tapping restores emoji
- [ ] Navigate to next page → previous page saves (confirm by going back)
- [ ] Open editor on page with view-mode emoji → emoji appears in editor
- [ ] Old emojis (added in edit mode) show normally; cannot be dragged in view mode
- [ ] Portrait + landscape: button and overlay positions correct
