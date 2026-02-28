# Album Name as ID Refactoring - Implementation Complete

## Summary

Albums now use their user-provided name as both the ID and folder name, replacing the old generated ID system (`album_${timestamp}_${random}`). The `metadata.name` field has been **completely removed** - the album name is stored only in `metadata.id` (which matches the folder name).

## Changes Made

### 1. New Validation Utility (`src/utils/albumNameValidator.ts`)
- Created comprehensive validation for album names
- Rejects invalid filesystem characters: `/ \ : * ? " < > |`
- Rejects reserved names: `. .. CON PRN AUX NUL COM1-9 LPT1-9`
- Enforces length limits (1-255 characters)
- Provides Hebrew error messages for user feedback

### 2. Album Service Updates (`src/services/AlbumService.ts`)
- **New method**: `albumExists(name)` - checks for duplicate album names
- **Updated**: `createAlbum(name)`
  - Validates name using `validateAlbumName()`
  - Checks for duplicates
  - Uses trimmed name as ID and folder name
  - **Removed** `metadata.name` field entirely
- **Updated**: `updateAlbumName(albumId, newName)`
  - Validates new name
  - Checks for duplicates
  - Renames the folder on filesystem
  - Updates `metadata.id` with new name
- **Updated**: `getAllAlbums()`
  - Uses `metadata.id` as the album name (no fallback needed)

### 3. Type Updates (`src/types/Album.ts`)
- **Removed** `name` field from `AlbumMetadata` interface
- Album name is now always `metadata.id`

### 4. UI Updates (`src/screens/HomeScreen.tsx`)
- **Updated**: `handleCreateAlbum()` - displays specific validation error messages
- **Updated**: `handleRenameAlbum()` - displays specific validation error messages

## Validation Rules

### Rejected
- Empty names (after trimming)
- Names with invalid characters: `/ \ : * ? " < > |`
- Control characters (0x00-0x1F)
- Reserved names: `. .. CON PRN AUX NUL COM1-9 LPT1-9`
- Names longer than 255 characters
- Duplicate names (case-sensitive filesystem check)

### Allowed
- Spaces (valid on iOS/modern filesystems)
- Unicode characters (emoji, Hebrew, etc.)
- Numbers, letters, `-`, `_`

### Error Messages (Hebrew)
- Empty: "נא להזין שם לאלבום"
- Invalid chars: "השם מכיל תווים לא חוקיים: / \ : * ? \" < > |"
- Reserved: "השם הזה שמור ואינו ניתן לשימוש"
- Too long: "השם ארוך מדי (מקסימום 255 תווים)"
- Duplicate: "אלבום עם שם זה כבר קיים"

## Folder Structure

### Before (Old System)
```
albums/
  album_1234567890_abc123/    ← Generated ID
    metadata.json             ← Contains id: "album_...", name: "My Album"
    pages/
    resources/
```

### After (New System)
```
albums/
  My Album/                   ← User-provided name (trimmed)
    metadata.json             ← ONLY contains id: "My Album" (no name field)
    pages/
    resources/
```

## Benefits

1. **Natural duplicate prevention** - Filesystem enforces unique folder names
2. **Human-readable structure** - Easy to debug, backup, and inspect manually
3. **Simplified import/export** - Folder name directly maps to album name
4. **Better user experience** - Clear validation errors, prevents confusion
5. **Cleaner data model** - No redundant `name` field

## Backward Compatibility

⚠️ **No backward compatibility** - This is a breaking change:
- Old albums with generated IDs will need manual migration
- The `metadata.name` field is no longer used
- Existing albums with old structure may not load correctly

## Testing Checklist

- [ ] Create album with valid name → creates folder with that name
- [ ] Create album with duplicate name → shows "אלבום עם שם זה כבר קיים"
- [ ] Create album with invalid chars (`/`, `*`, etc.) → shows invalid characters error
- [ ] Create album with reserved name (`.`, `..`, `CON`) → shows reserved name error
- [ ] Create album with empty/whitespace-only name → shows empty name error
- [ ] Create album with very long name (>255 chars) → shows too long error
- [ ] Rename album to duplicate name → shows duplicate error
- [ ] Rename album to new valid name → renames folder successfully
- [ ] Rename album to same name → no-op (no error)
- [ ] Open, edit, save pages in new albums → works correctly
- [ ] Delete album → deletes folder successfully
- [ ] Manual filesystem check → folder names match album names
- [ ] Metadata has NO `name` field, only `id`

## Critical Files Modified

- `src/utils/albumNameValidator.ts` (NEW)
- `src/services/AlbumService.ts` (MODIFIED)
- `src/types/Album.ts` (MODIFIED - removed name field)
- `src/screens/HomeScreen.tsx` (MODIFIED)

## Dependencies

All service methods that use `album.id` continue to work because:
- `PageService.getPages(albumId)`
- `PageService.updatePage(albumId, page)`
- `PageService.createPage(albumId)`
- `PageService.deletePage(albumId, pageId)`
- `AlbumService.getAlbumMetadata(albumId)`
- `AlbumService.markAlbumAsViewed(albumId)`
- `AlbumService.generateThumbnail(albumId, screenshotUri)`

All construct paths using `${ALBUMS_ROOT}/${albumId}`, which now uses the human-readable name.
