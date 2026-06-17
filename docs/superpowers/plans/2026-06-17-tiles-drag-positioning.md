# Tiles Drag Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the user to freely drag the tiles row (all cells together) to any X/Y position on the page while in edit mode, with clamping to page bounds.

**Architecture:** Add optional `x` to `SketchTiles` for backward compatibility. Reuse the existing `ElementMove` path in `PageEditorScreen` — the same path used for audio elements — to handle live drag updates and save on drag end. Canvas is not touched.

**Tech Stack:** React Native, TypeScript

## Global Constraints

- No changes to canvas component (`src/components/canvas/canvas.tsx` or related canvas files)
- `x` is optional in `SketchTiles` — defaults to `0` for all existing pages
- Tiles are clamped to page bounds on all four edges (cannot drag outside canvas)
- Tile row width does not change when position changes
- No git commits — user commits manually

---

### Task 1: Add `x` to `SketchTiles` type and wire it to canvas element

**Files:**
- Modify: `src/types/Album.ts` — add `x?: number` to `SketchTiles`
- Modify: `src/screens/PageEditorScreen.tsx` — pass `tiles.x ?? 0` instead of `0`

**Interfaces:**
- Produces: `SketchTiles.x?: number` — used by Tasks 2 and 3

- [ ] **Step 1: Add `x` to `SketchTiles`**

In `src/types/Album.ts`, find `SketchTiles` (around line 102) and add `x`:

```typescript
export interface SketchTiles extends ElementBase {
  words: TileWord[];
  fontSize: number;
  backgroundColor: string;
  textColor: string;
  rtl: boolean;
  y: number;
  x?: number; // horizontal offset from left edge; 0 = default
  size?: number;
}
```

- [ ] **Step 2: Pass `tiles.x ?? 0` to canvas elements prop**

In `src/screens/PageEditorScreen.tsx`, find the line (around 3585):
```typescript
elements={tiles ? [{ ...tiles, type: 'tiles', x: 0, y: tiles.y }] : []}
```

Change to:
```typescript
elements={tiles ? [{ ...tiles, type: 'tiles', x: tiles.x ?? 0, y: tiles.y }] : []}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/i022021/dev/Issie/IssieAlbom && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `SketchTiles.x`

---

### Task 2: Handle live drag update for tiles in `handleMoveElement`

**Files:**
- Modify: `src/screens/PageEditorScreen.tsx` — lines ~3200–3207 (`handleMoveElement` `ElementMove` branch)

**Interfaces:**
- Consumes: `SketchTiles.x?: number` from Task 1, `tilesRef: React.MutableRefObject<SketchTiles | null>`, `TILES_ID: string`, `setTiles`
- Produces: live `tiles` state update during drag

- [ ] **Step 1: Add tiles live update inside the `ElementMove` branch of `handleMoveElement`**

Find (around line 3200):
```typescript
    } else if (type === MoveTypes.ElementMove) {
      // For audio elements (generic elements)
      console.log('Moving audio element');
      const audio = audiosRef.current.find(a => a.id === id);
      if (audio) {
        setAudios(prev => prev.map(a => a.id === id ? { ...a, x: p[0], y: p[1] } : a));
      }
    }
```

Replace with:
```typescript
    } else if (type === MoveTypes.ElementMove) {
      // For audio elements (generic elements)
      console.log('Moving audio element');
      const audio = audiosRef.current.find(a => a.id === id);
      if (audio) {
        setAudios(prev => prev.map(a => a.id === id ? { ...a, x: p[0], y: p[1] } : a));
      }
      // For tiles element
      if (id === TILES_ID && tilesRef.current) {
        setTiles(prev => prev ? { ...prev, x: p[0], y: p[1] } : prev);
        tilesRef.current = { ...tilesRef.current, x: p[0], y: p[1] };
      }
    }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/i022021/dev/Issie/IssieAlbom && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

---

### Task 3: Clamp and save tiles position on drag end in `handleMoveEnd`

**Files:**
- Modify: `src/screens/PageEditorScreen.tsx` — lines ~3292–3307 (`handleMoveEnd` `ElementMove` branch)

**Interfaces:**
- Consumes: `SketchTiles.x?: number` from Task 1, `tilesRef`, `TILES_ID`, `setTiles`, `queue`, `autoSave`, `rebuildStateFromQueue`
- Consumes: `canvasWidth`, `canvasHeight`, `ratio` (all already in scope as useMemo-derived consts around line 647)
- Consumes: tile size formula same as `TilesElement` — `MAX_TILE_SIZE_RATIO = 0.35`, `calculatedTileSize = canvasWidth / (1.5 * numTiles + 0.5)`, `maxTileSize = canvasHeight * 0.35`, `autoTileSize = Math.min(calculatedTileSize, maxTileSize)`, `tileSize = Math.max(20, Math.min(autoTileSize * (tiles.size ?? 1), maxTileSize))`
- Produces: clamped position persisted to queue and disk

- [ ] **Step 1: Add tiles save inside the `ElementMove` branch of `handleMoveEnd`**

Find (around line 3292):
```typescript
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
```

Replace with:
```typescript
    } else if (type === MoveTypes.ElementMove) {
      // For audio elements — use ref to avoid stale closure
      const audio = audiosRef.current.find(a => a.id === id);
      if (audio && !audio.editMode) {
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
      // For tiles element — clamp to page bounds then save
      if (id === TILES_ID && tilesRef.current) {
        const t = tilesRef.current;
        const numTiles = t.words.length;
        const MAX_TILE_SIZE_RATIO = 0.35;
        const calculatedTileSize = canvasWidth / (1.5 * numTiles + 0.5);
        const maxTileSize = canvasHeight * MAX_TILE_SIZE_RATIO;
        const autoTileSize = Math.min(calculatedTileSize, maxTileSize);
        const tileSize = Math.max(20, Math.min(autoTileSize * (t.size ?? 1), maxTileSize));
        const halfTileSpacing = tileSize * 0.5;
        // Row width = half-spacing + tiles + gaps + half-spacing
        const tileRowWidth = halfTileSpacing + numTiles * tileSize + (numTiles - 1) * halfTileSpacing + halfTileSpacing;
        const tileRowHeight = tileSize;

        const clampedX = Math.max(0, Math.min(canvasWidth - tileRowWidth, t.x ?? 0));
        const clampedY = Math.max(0, Math.min(canvasHeight - tileRowHeight, t.y));
        const updated: SketchTiles = { ...t, x: clampedX, y: clampedY };

        setTiles(updated);
        tilesRef.current = updated;
        queue.current.pushTiles(updated);
        rebuildStateFromQueue();
        await autoSave();
        console.log('[handleMoveEnd] Saved tiles position:', { x: clampedX, y: clampedY });
      }
    }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/i022021/dev/Issie/IssieAlbom && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 3: Manual test — drag tiles**

1. Open a page with tiles in edit mode
2. Long-press the tiles row and drag it — tiles should follow finger
3. Release — tiles should stay at new position
4. Drag towards an edge — tiles should stop at page boundary
5. Navigate away and back — tiles should persist at dragged position
6. Test with a page that has no `x` stored (old page) — should load with `x=0` (left edge, bottom)
