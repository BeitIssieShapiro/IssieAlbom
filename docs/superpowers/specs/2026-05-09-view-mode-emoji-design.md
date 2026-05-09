# View-Mode Emoji Feature Design

## Overview

Allow users to add, position, resize, and rotate emojis directly from view mode (carousel). Emojis added in view mode are persisted to the page JSON and tagged `addedInView: true` so view mode can distinguish them from edit-mode elements. Undo/redo buttons appear when the page has unsaved changes.

## Data Model

### SketchText extension

Add optional flag to `SketchText` in `src/types/Album.ts`:

```typescript
addedInView?: boolean; // true = added in view mode, draggable/deletable in view mode
```

No other type changes needed. View-mode emojis are full `SketchText` elements with `isEmoji: true` and `addedInView: true`.

## PageCard Changes

### New props

```typescript
onSavePage?: (updatedPage: AlbumPage) => void;
```

Called when the card is dirty and the user navigates away or enters edit mode. AlbumScreen passes `handleEditorSave` here.

### Local queue

PageCard instantiates a local `DoQueue` seeded from `page.elements`. All view-mode emoji mutations (add, move, resize, rotate, delete) go through this queue. `isDirty` = queue has any view-mode ops since last seed.

### State

```typescript
const [viewQueue, setViewQueue] = useState<DoQueue>(() => new DoQueue(page.elements));
const [isDirty, setIsDirty] = useState(false);
const [selectedEmojiId, setSelectedEmojiId] = useState<string | null>(null);
```

Derived `texts` come from compiling the local queue, replacing the existing `useMemo` derivation.

### Save trigger

- `useEffect` with cleanup: on unmount, if dirty, call `onSavePage`
- AlbumScreen `onSnapToItem`: before changing index, save current page if dirty (pass dirty flag / save callback up)
- On entering edit mode (`handleEditPage`): save first if dirty

## UI Elements

### Emoji button (top-left of page)

```
position: absolute, top: 8, left: 8, zIndex: 1001
```

Small circular button with 😊 icon (or smiley Ionicon). Visible only when `!isEditMode`. Tapping opens `rn-emoji-keyboard`.

### Undo/Redo buttons

Visible only when `isDirty`. Appear to the right of the emoji button, same row:

```
[😊] [↩] [↪]
```

Tap ↩ → `queue.undo()`, rebuild state, `isDirty` recalculated.  
Tap ↪ → `queue.redo()`, rebuild state.

### Emoji keyboard

Reuse `EmojiPicker` from `rn-emoji-keyboard` (already a dependency). Same locale handling as PageEditorScreen.

## Emoji Lifecycle

### Add

1. User taps emoji button → keyboard opens
2. On pick: create `SketchText` with `isEmoji: true`, `addedInView: true`, centered at `(displayWidth/2 - fontSize/2, displayHeight/2 - fontSize/2)`
3. Push to local queue → rebuild texts → auto-select new emoji
4. `isDirty = true`

### Select

- Tap on an `addedInView` emoji → `selectedEmojiId = emoji.id`
- Tap anywhere else → deselect
- Non-`addedInView` emojis are not tappable in view mode (pass-through)

### Visual selection indicator

Selected emoji: render a thick rounded border ring around it (absolute-positioned `View` overlay, not inside Canvas).

### Drag (PanResponder)

Only active when `selectedEmojiId` is set and the touched element has `addedInView: true`.

- `onStartShouldSetPanResponderCapture: true` to steal from carousel
- `onPanResponderMove`: update emoji `x, y` in a transient ref (no queue push mid-drag)
- `onPanResponderRelease`:
  - If outside page bounds → delete from queue
  - Otherwise → push UPDATE to queue with final position
- Rebuild state, mark dirty

Out-of-bounds = finger release point is outside `[0, displayWidth] x [0, displayHeight]`.

### Pinch + Rotate (react-native-gesture-handler)

Use `PinchGestureHandler` and `RotationGestureHandler` composed with `simultaneousHandlers`.

- Pinch scale → update `fontSize` proportionally (clamp: min 30, max 300)
- Rotation → update `rotation` (degrees)
- On gesture end → push UPDATE to queue
- During gesture → apply transient values to display (same pattern as PageEditorScreen's `emojiPinchSize` / `emojiRotation` refs)

## ViewModeEmojiOverlay Component

Extract emoji interaction into `src/components/ViewModeEmojiOverlay.tsx`:

```typescript
interface ViewModeEmojiOverlayProps {
  emojis: SketchText[];           // only addedInView emojis
  selectedId: string | null;
  ratio: number;
  displayWidth: number;
  displayHeight: number;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onMoveOutOfBounds: (id: string) => void;
  onPinchRotateEnd: (id: string, fontSize: number, rotation: number) => void;
}
```

Renders each emoji as a `Text` node positioned absolutely. Handles all gesture logic internally. Reports final values back to PageCard via callbacks.

## AlbumScreen Changes

- Pass `onSavePage={handleEditorSave}` to all `PageCard` instances
- On `handleEditPage`: check if current PageCard is dirty; if so, trigger save before opening editor (can use a ref to PageCard exposing `saveIfDirty()`)

## Out of Scope

- Emojis added in edit mode remain non-interactive in view mode
- No label or tooltip on the emoji button
- No animation on add/delete
