# Tiles Multi-Select Editing Redesign

**Date:** 2026-05-05  
**Status:** Approved

## Summary

Replace the per-tile floating action buttons (emoji, symbol, delete-symbol, merge, unmerge) with a checkbox-based multi-select system. All tile actions move to the toolbar, which enables/disables based on current selection.

---

## 1. Data Model Changes

### `TileWord` (src/types/Album.ts)

Add two optional per-tile color overrides:

```typescript
export interface TileWord {
  text: string;
  originalIndices: number[];
  symbol?: string;
  symbolType?: 'emoji' | 'image';
  backgroundColor?: string;  // per-tile override; falls back to SketchTiles.backgroundColor
  textColor?: string;         // per-tile override; falls back to SketchTiles.textColor
}
```

`SketchTiles.backgroundColor` and `SketchTiles.textColor` remain as global defaults. Backward compatible — existing tiles without per-tile colors render unchanged.

---

## 2. Selection State (PageEditorScreen)

New state:
```typescript
const [selectedTileIndices, setSelectedTileIndices] = useState<Set<number>>(new Set());
const selectedTileIndicesRef = useRef(selectedTileIndices);
// sync ref in useEffect as per project closure pattern
```

**Selection toggling:** Tapping a tile in edit mode calls `onTilePress(index)` → toggles index in/out of set.

**Selection clearing:** Clear to empty Set when:
- `setTilesSelected(false)` is called (user leaves tiles mode or switches toolbar section)
- User taps outside the tiles area on the canvas (same tap handler that deselects other elements)

Selection is NOT cleared after toolbar actions — user keeps selection to perform multiple operations without re-selecting.

---

## 3. TilesElement Changes (src/components/TilesElement.tsx)

### Props removed
- `onMergeTile`
- `onUnmergeTile`
- `onAddEmoji`
- `onAddSymbol`
- `onDeleteSymbol`

### Props added
```typescript
selectedIndices: Set<number>;
onTilePress: (index: number) => void;
```

### Rendering changes
- Remove all floating edit buttons (emoji, symbol, delete-symbol, merge, unmerge)
- Remove merge button from the gap between tiles; spacer is always a plain spacer
- Add a small checkbox on each tile, visible only in `editMode`:
  - Position: top-right corner (top-left for RTL)
  - Checked state: `selectedIndices.has(index)`
  - Tapping anywhere on the tile calls `onTilePress(index)`
- Per-tile color: `word.backgroundColor ?? tiles.backgroundColor` and `word.textColor ?? tiles.textColor`

---

## 4. Toolbar Buttons (PageEditorScreen tiles subtoolbar)

All shown when `tilesSelected`. Enabled/disabled rules:

| Button | Enabled when | Action |
|--------|-------------|--------|
| Select All / Deselect All | always | If any unselected tiles exist → select all; else → clear all |
| BG Color picker | ≥1 selected | Sets `backgroundColor` on each selected `TileWord` |
| Text Color picker | ≥1 selected | Sets `textColor` on each selected `TileWord` |
| Size picker | always | Sets `fontSize` on `SketchTiles` (applies to all tiles) |
| Merge | ≥2 selected | Merges all selected tiles into one (in index order), text concatenated with spaces. Regenerates audio word timings. |
| Unmerge | exactly 1 selected, `originalIndices.length > 1` | Splits tile back into individual word tiles. Regenerates audio word timings. |
| Add Emoji | exactly 1 selected | Opens emoji keyboard for that tile |
| Add Symbol | exactly 1 selected | Opens symbol search modal for that tile |
| Delete Symbol | exactly 1 selected AND tile has symbol | Removes symbol from that tile |
| Edit Text | always | Opens TilesModal to edit tile text |
| Delete Tiles | always | Confirmation then delete all tiles |

---

## 5. Merge Behavior

All selected tiles (regardless of adjacency) merge into one tile:
- Text: selected tiles' texts joined with spaces, in ascending index order
- `originalIndices`: union of all selected tiles' `originalIndices`
- Symbol/color: taken from the lowest-index selected tile (first tile wins)
- The merged tile is inserted at the position of the lowest-index selected tile
- All other selected tiles are removed

After merge, regenerate audio `wordTimings` using `generateInitialWordTimings` with the new word list and existing audio duration.

---

## 6. Unmerge Behavior

The single selected merged tile splits back into individual word tiles:
- One tile per entry in `originalIndices`
- Text split by whitespace, matching `originalIndices` count
- No symbol or per-tile color carried over to child tiles
- Inserted at the same position as the merged tile

After unmerge, regenerate audio `wordTimings` using `generateInitialWordTimings` with the new word list and existing audio duration.

---

## 7. Audio Word Timing Regeneration

Both merge and unmerge must regenerate `wordTimings` on the page audio element when audio exists, using the same logic as `handleTilesConfirm`:

```typescript
if (pageAudioFile && pageAudioWordTimings.length > 0) {
  const words = newTiles.words.map(w => w.text); // or split merged text
  const newWordTimings = generateInitialWordTimings(words, audioDuration);
  // push updated audio to queue
}
```

Use the existing audio duration lookup (queue scan → ref fallback → 10s fallback).

---

## Out of Scope

- Drag-to-reorder tiles
- Per-tile font size
- Undo/redo behavior changes (all queue operations unchanged)
