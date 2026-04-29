# Album Orientation Selection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users pick portrait/landscape when creating an album; store device dimensions on album metadata; all pages use those dimensions.

**Architecture:** Add `canvasWidth`/`canvasHeight` to `AlbumMetadata`. Add orientation picker to the new-album modal in HomeScreen. Change `AlbumService.createAlbum` to accept and store dimensions. Change `PageService.createPage` to read dimensions from album metadata instead of `Dimensions.get('window')`.

**Tech Stack:** React Native, TypeScript, react-native-fs

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/Album.ts` | Modify | Add `canvasWidth`/`canvasHeight` to `AlbumMetadata` |
| `src/i18n/translations.ts` | Modify | Add `portrait`/`landscape` translation keys |
| `src/services/AlbumService.ts` | Modify | Accept + store dimensions in `createAlbum` |
| `src/services/PageService.ts` | Modify | Read dimensions from album metadata |
| `src/screens/HomeScreen.tsx` | Modify | Add orientation picker UI + pass dimensions to service |

---

### Task 1: Add canvasWidth/canvasHeight to AlbumMetadata

**Files:**
- Modify: `src/types/Album.ts:231-238`

- [ ] **Step 1: Add fields to AlbumMetadata interface**

In `src/types/Album.ts`, add `canvasWidth` and `canvasHeight` to the `AlbumMetadata` interface:

```typescript
export interface AlbumMetadata {
  id: string;
  createdAt: number;
  updatedAt: number;
  pageCount: number;
  hasBeenViewed?: boolean;
  thumbnailPath?: string;
  canvasWidth: number;
  canvasHeight: number;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: Errors in `AlbumService.ts` where `createAlbum` builds metadata without the new fields. This is expected — we fix it in Task 3.

- [ ] **Step 3: Commit**

```bash
git add src/types/Album.ts
git commit -m "feat: add canvasWidth/canvasHeight to AlbumMetadata type"
```

---

### Task 2: Add translation keys

**Files:**
- Modify: `src/i18n/translations.ts`

- [ ] **Step 1: Add keys to Translations interface**

In the `home` section of the `Translations` interface (around line 30, after `rename: string;`), add:

```typescript
    portrait: string;
    landscape: string;
```

- [ ] **Step 2: Add Hebrew translations**

In the `he` section's `home` object (around line 265, after the `rename` entry), add:

```typescript
      portrait: 'לאורך',
      landscape: 'לרוחב',
```

- [ ] **Step 3: Add English translations**

In the `en` section's `home` object (around line 486, after the `rename` entry), add:

```typescript
      portrait: 'Portrait',
      landscape: 'Landscape',
```

- [ ] **Step 4: Add Arabic translations**

In the `ar` section's `home` object (around line 707, after the `rename` entry), add:

```typescript
      portrait: 'عمودي',
      landscape: 'أفقي',
```

- [ ] **Step 5: Commit**

```bash
git add src/i18n/translations.ts
git commit -m "feat: add portrait/landscape translation keys"
```

---

### Task 3: Update AlbumService.createAlbum to accept and store dimensions

**Files:**
- Modify: `src/services/AlbumService.ts:86-153`

- [ ] **Step 1: Change createAlbum signature**

Change line 86 from:

```typescript
  async createAlbum(name: string): Promise<Album> {
```

to:

```typescript
  async createAlbum(name: string, canvasWidth: number, canvasHeight: number): Promise<Album> {
```

- [ ] **Step 2: Store dimensions in metadata**

Change the metadata object (around line 117-122) from:

```typescript
    const metadata: AlbumMetadata = {
      id: folderName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pageCount: 1,
    };
```

to:

```typescript
    const metadata: AlbumMetadata = {
      id: folderName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pageCount: 1,
      canvasWidth,
      canvasHeight,
    };
```

- [ ] **Step 3: Create first page as V2 with stored dimensions**

Change the first page creation (around lines 131-137) from:

```typescript
    const firstPageId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const firstPage: AlbumPage = {
      id: firstPageId,
      pageNumber: 1,
      backgroundPath: null,
      elements: [],
    };
```

to:

```typescript
    const firstPageId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const firstPage: AlbumPageV2 = {
      id: firstPageId,
      pageNumber: 1,
      backgroundPath: null,
      version: '2.0',
      elements: [],
      canvasWidth,
      canvasHeight,
    };
```

Make sure `AlbumPageV2` is imported at the top of the file. Check existing imports — if only `AlbumPage` is imported, add `AlbumPageV2`:

```typescript
import { Album, AlbumMetadata, AlbumPage, AlbumPageV2 } from '../types/Album';
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: Error in `HomeScreen.tsx` where `createAlbum` is called with only 1 argument. This is expected — we fix it in Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/services/AlbumService.ts
git commit -m "feat: AlbumService.createAlbum accepts and stores canvas dimensions"
```

---

### Task 4: Update PageService.createPage to read dimensions from album metadata

**Files:**
- Modify: `src/services/PageService.ts:33-61`

- [ ] **Step 1: Read dimensions from album metadata instead of screen**

Replace the body of `createPage` (lines 33-61) with:

```typescript
  async createPage(albumId: string): Promise<AlbumPageV2> {
    const pagesPath = AlbumService.getPagesPath(albumId);
    const existingPages = await this.getPages(albumId);
    const nextPageNumber = existingPages.length + 1;

    const pageId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Read canvas dimensions from album metadata
    const metadata = await AlbumService.getAlbumMetadata(albumId);
    const canvasWidth = metadata.canvasWidth;
    const canvasHeight = metadata.canvasHeight;

    const newPage: AlbumPageV2 = {
      id: pageId,
      pageNumber: nextPageNumber,
      backgroundPath: null,
      version: '2.0',
      elements: [],
      canvasWidth,
      canvasHeight,
    };

    const pagePath = `${pagesPath}/${pageId}.json`;
    await RNFS.writeFile(pagePath, JSON.stringify(newPage, null, 2), 'utf8');

    // Update album metadata
    await this.updateAlbumPageCount(albumId, nextPageNumber);

    return newPage;
  },
```

Note: The `Dimensions` import at the top of `PageService.ts` can be removed if it's no longer used elsewhere in the file. Check before removing.

- [ ] **Step 2: Update return type**

The return type changed from `AlbumPage` to `AlbumPageV2`. Check that the import at the top includes `AlbumPageV2`:

```typescript
import { AlbumPage, AlbumPageV2 } from '../types/Album';
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: Still error from HomeScreen (Task 5 fixes it). No new errors from this change since `AlbumPageV2` extends `AlbumPage`.

- [ ] **Step 4: Commit**

```bash
git add src/services/PageService.ts
git commit -m "feat: PageService reads canvas dimensions from album metadata"
```

---

### Task 5: Add orientation picker to HomeScreen new-album modal

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

This is the largest task. It adds state for orientation selection, computes dimensions, renders the picker UI, and passes dimensions to `createAlbum`.

- [ ] **Step 1: Add orientation state**

After the existing state declarations (around line 42, near `const [newAlbumName, setNewAlbumName] = useState('');`), add:

```typescript
  const [selectedOrientation, setSelectedOrientation] = useState<'portrait' | 'landscape'>(() => {
    const { width, height } = Dimensions.get('window');
    return height >= width ? 'portrait' : 'landscape';
  });
```

Note: `Dimensions` is already imported in HomeScreen.

- [ ] **Step 2: Reset orientation default when modal opens**

In `handleAddAlbum` (line 128-131), add orientation reset so it defaults to current device orientation each time the modal opens:

```typescript
  const handleAddAlbum = () => {
    setNewAlbumName('');
    const { width, height } = Dimensions.get('window');
    setSelectedOrientation(height >= width ? 'portrait' : 'landscape');
    setShowNewAlbumModal(true);
  };
```

- [ ] **Step 3: Compute dimensions and pass to createAlbum**

In `handleCreateAlbum` (around line 141), change the `createAlbum` call from:

```typescript
      const newAlbum = await AlbumService.createAlbum(trimmedName);
```

to:

```typescript
      const { width, height } = Dimensions.get('window');
      const canvasWidth = selectedOrientation === 'landscape'
        ? Math.max(width, height)
        : Math.min(width, height);
      const canvasHeight = selectedOrientation === 'landscape'
        ? Math.min(width, height)
        : Math.max(width, height);
      const newAlbum = await AlbumService.createAlbum(trimmedName, canvasWidth, canvasHeight);
```

- [ ] **Step 4: Add orientation picker UI to the modal**

In the modal JSX (between the `<TextInput>` ending around line 375 and the `<View style={styles.modalButtons}>` starting around line 376), insert the orientation picker:

```tsx
                <View style={styles.orientationPicker}>
                  <TouchableOpacity
                    style={[
                      styles.orientationOption,
                      {
                        borderColor: selectedOrientation === 'portrait' ? '#007AFF' : colors.border,
                        borderWidth: selectedOrientation === 'portrait' ? 2 : 1,
                        backgroundColor: selectedOrientation === 'portrait' ? '#007AFF10' : colors.background,
                      },
                    ]}
                    onPress={() => setSelectedOrientation('portrait')}
                  >
                    <View style={[styles.orientationIconPortrait, { borderColor: selectedOrientation === 'portrait' ? '#007AFF' : colors.textLight }]} />
                    <Text style={[styles.orientationLabel, { color: selectedOrientation === 'portrait' ? '#007AFF' : colors.textPrimary }]}>
                      {t('home.portrait')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.orientationOption,
                      {
                        borderColor: selectedOrientation === 'landscape' ? '#007AFF' : colors.border,
                        borderWidth: selectedOrientation === 'landscape' ? 2 : 1,
                        backgroundColor: selectedOrientation === 'landscape' ? '#007AFF10' : colors.background,
                      },
                    ]}
                    onPress={() => setSelectedOrientation('landscape')}
                  >
                    <View style={[styles.orientationIconLandscape, { borderColor: selectedOrientation === 'landscape' ? '#007AFF' : colors.textLight }]} />
                    <Text style={[styles.orientationLabel, { color: selectedOrientation === 'landscape' ? '#007AFF' : colors.textPrimary }]}>
                      {t('home.landscape')}
                    </Text>
                  </TouchableOpacity>
                </View>
```

- [ ] **Step 5: Add styles**

Add these styles to the `StyleSheet.create` block (before the closing `});`):

```typescript
  orientationPicker: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: spacing.lg,
  },
  orientationOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.medium,
  },
  orientationIconPortrait: {
    width: 28,
    height: 40,
    borderWidth: 2,
    borderRadius: 4,
    marginBottom: spacing.sm,
  },
  orientationIconLandscape: {
    width: 40,
    height: 28,
    borderWidth: 2,
    borderRadius: 4,
    marginBottom: spacing.sm,
  },
  orientationLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
```

- [ ] **Step 6: Verify TypeScript compiles cleanly**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: No errors.

- [ ] **Step 7: Build and test on simulator**

Run iOS build and verify:
1. Open app, tap "+" to create new album
2. Modal shows name input + orientation picker
3. Default selection matches current device orientation
4. Tapping each option highlights it
5. Create album with "portrait" — first page has portrait dimensions
6. Add a page — new page also has portrait dimensions
7. Repeat with "landscape"

- [ ] **Step 8: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: add orientation picker to new album modal"
```
