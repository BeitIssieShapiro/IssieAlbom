# IssieAlbum - Architecture Overview

A React Native mobile app for creating and editing photo albums with pages/slides. Early stage — offline-only, no backend.

## Tech Stack

- **React Native** 0.83 + **React** 19 + **TypeScript**
- **react-native-fs** for local file persistence
- **react-native-image-picker** for selecting images
- **react-native-gesture-handler** for touch interactions
- **react-native-vector-icons** for toolbar icons (MaterialCommunityIcons)
- Pure React hooks for state (no Redux/Context)
- UI language: Hebrew

## Directory Layout

```
src/
├── App.tsx                  # Root component, manages screen navigation via state
├── types/
│   └── Album.ts             # Core data interfaces (Album, AlbumPage, PageElement, AlbumMetadata)
├── screens/
│   ├── HomeScreen.tsx        # Album grid list — create, rename, delete albums
│   ├── AlbumScreen.tsx       # Pages within an album — add, delete, view/edit toggle
│   └── PageEditorScreen.tsx  # Full-screen page editor with bottom toolbar
├── components/
│   ├── AlbumCard.tsx         # Album preview card with context menu
│   ├── PageCard.tsx          # Page thumbnail rendering elements
│   └── AddAlbumButton.tsx    # New album creation button
└── services/
    ├── AlbumService.ts       # Album CRUD (filesystem operations)
    └── PageService.ts        # Page CRUD, renumbering, reordering
```

## Data Model

- **Album** — has an `id`, `name`, `path`, optional `previewImagePath`, and a `createdAt` timestamp.
- **AlbumPage** — belongs to an album. Has a `pageNumber`, optional `backgroundPath`, and an array of `PageElement`s.
- **PageElement** — content item on a page. Types: `image`, `text`, `sticker`, `recording`. Positioned by `x`/`y`/`width`/`height` with optional `rotation` and `scale`.

## On-Device Storage

All data lives in the local filesystem under `Documents/albums/{albumId}/`:

```
metadata.json          # AlbumMetadata
preview.jpg            # Optional album preview
pages/{pageId}.json    # One file per page
resources/             # backgrounds/, images/, stickers/, recordings/
```

## Navigation

No routing library. `App.tsx` holds a `selectedAlbum` state — `null` shows `HomeScreen`, non-null shows `AlbumScreen`. Within `AlbumScreen`, an `editingPage` state controls showing `PageEditorScreen`.

## What's Implemented

- Album CRUD (create, list, rename, delete)
- Page CRUD (add, delete with automatic renumbering)
- View/edit mode toggle in AlbumScreen
- Page content rendering (backgrounds + positioned elements)
- Page editor UI with bottom toolbar (text, image, recording, pen, eraser tools — UI only)

## What's Not Yet Built

- Tool functionality in page editor (add text/image/recording, draw, erase)
- Element manipulation (move/resize/rotate elements on a page)
- Asset picker for page elements

## Conventions

- Functional components with hooks (`useState`, `useCallback`, `useEffect`)
- Services are plain objects with async methods (not classes)
- Error feedback via `Alert.alert()`
- Styles use `StyleSheet.create()` at the bottom of each file
