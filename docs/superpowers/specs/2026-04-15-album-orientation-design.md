# Album Orientation Selection

## Summary

When creating an album, the user selects portrait or landscape orientation. The device's screen dimensions at creation time are stored on the album metadata. All pages in the album use these stored dimensions.

## Data Model

### AlbumMetadata (src/types/Album.ts)

Add two required fields:

```typescript
export interface AlbumMetadata {
  id: string;
  createdAt: number;
  updatedAt: number;
  pageCount: number;
  hasBeenViewed?: boolean;
  thumbnailPath?: string;
  canvasWidth: number;   // new
  canvasHeight: number;  // new
}
```

Values are set at album creation time:
- Portrait: `canvasWidth = min(screenW, screenH)`, `canvasHeight = max(screenW, screenH)`
- Landscape: `canvasWidth = max(screenW, screenH)`, `canvasHeight = min(screenW, screenH)`

Where `screenW` and `screenH` come from `Dimensions.get('window')` on the device creating the album.

## UI Changes

### New Album Modal (src/screens/HomeScreen.tsx)

Add an orientation picker below the album name text input, above the Cancel/Create buttons.

**Layout:** Two side-by-side touchable cards, each containing:
- A rectangle outline icon (View with border) — tall for portrait, wide for landscape
- A localized label below the icon: "Portrait" / "Landscape"

**Default selection:** Current device orientation (compare `window.width` vs `window.height`).

**Selected state:** Highlighted border using `#007AFF` (matching existing selection color in the app).

**Localization:** Add keys to all language files:
- `home.portrait` — "Portrait" / Hebrew / Arabic
- `home.landscape` — "Landscape" / Hebrew / Arabic

### Localization (src/i18n/translations.ts)

Add to `Translations.home` interface and all three language sections (`he`, `en`, `ar`):
- `portrait` — "Portrait" / "לאורך" / "عمودي"
- `landscape` — "Landscape" / "לרוחב" / "أفقي"

## Service Changes

### AlbumService.createAlbum (src/services/AlbumService.ts)

**Signature change:**
```typescript
createAlbum(name: string, canvasWidth: number, canvasHeight: number): Promise<Album>
```

- Store `canvasWidth` and `canvasHeight` in `metadata.json`
- Pass dimensions to first page creation (create as V2 page with these dimensions)

### First Page Creation (inside AlbumService.createAlbum)

Currently creates a legacy page without `canvasWidth`/`canvasHeight`. Change to create a V2 page:

```typescript
const firstPage: AlbumPageV2 = {
  id: firstPageId,
  pageNumber: 1,
  backgroundPath: null,
  version: '2.0',
  elements: [],
  canvasWidth: canvasWidth,
  canvasHeight: canvasHeight,
};
```

### PageService.createPage (src/services/PageService.ts)

**Signature change:**
```typescript
createPage(albumId: string): Promise<AlbumPageV2>
```

Instead of `Dimensions.get('window')`, read `canvasWidth`/`canvasHeight` from the album's `metadata.json` and use those values for the new page.

## Call Chain

1. User taps "+" in HomeScreen album grid
2. Modal shows: name input + orientation picker (default = current orientation)
3. User picks orientation, enters name, taps Create
4. HomeScreen computes `canvasWidth`/`canvasHeight` from device dimensions + selected orientation
5. Calls `AlbumService.createAlbum(name, canvasWidth, canvasHeight)`
6. AlbumService stores dimensions in `metadata.json`, creates first V2 page with those dimensions
7. All subsequent `PageService.createPage(albumId)` calls read dimensions from album metadata

## Existing Albums

No backward compatibility needed — app has not been released. Existing test albums may lack `canvasWidth`/`canvasHeight` in metadata; `PageService` can fall back to `Dimensions.get('window')` if metadata fields are missing, but this is a transitional concern, not a design requirement.

## Not In Scope

- Per-page orientation override
- Changing album orientation after creation
- Fixed canonical sizes (dimensions always come from the creating device)
