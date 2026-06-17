# Tiles Drag Positioning

## Goal

Allow the user to freely drag the tiles row (all cells together) to any position on the page while in edit mode. Default placement remains bottom of page.

## Data Model

Add optional `x` to `SketchTiles` in `src/types/Album.ts`:

```typescript
export interface SketchTiles extends ElementBase {
  // existing fields unchanged
  y: number;
  x?: number; // horizontal offset from left edge; 0 = default
}
```

Backward compatible — existing pages without `x` treat it as `0`.

## Canvas Integration

No canvas changes. The element passed to canvas already carries `x` and `y`. Change hardcoded `x: 0` to `x: tiles.x ?? 0`:

```typescript
elements={tiles ? [{ ...tiles, type: 'tiles', x: tiles.x ?? 0, y: tiles.y }] : []}
```

## Move Handling (PageEditorScreen)

Reuse existing `ElementMove` path. Tiles are identified by `TILES_ID`.

### Live drag — `handleMoveElement`

When `type === MoveTypes.ElementMove` and `id === TILES_ID`, update tiles x/y state live so the user sees movement:

```typescript
if (id === TILES_ID && tilesRef.current) {
  setTiles(prev => prev ? { ...prev, x: p[0], y: p[1] } : prev);
}
```

### Drag end — `handleMoveEnd`

Clamp to page bounds then save to queue:

- `clampedX = clamp(x, 0, canvasWidth - tileRowWidth)`
- `clampedY = clamp(y, 0, canvasHeight - tileRowHeight)`
- Use same tile size formula as `TilesElement` for accurate bounds
- Save via `queue.current.pushTiles(updated)` then `autoSave()`

## Constraints

- Tiles cannot be dragged outside page edges (clamped on all four sides)
- Tile row width does not change when position changes
- Drag only active in edit mode (canvas already enforces this for ElementMove)
