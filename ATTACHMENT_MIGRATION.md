# Attachment Path Migration Summary

## Changes Made

### 1. Type Definitions (Album.ts)
- `SketchImage.src` → `SketchImage.imagePath` (relative path string)
- `SketchImage.imageData` → removed
- `SketchAudio.file` → `SketchAudio.audioPath` (relative path string)

### 2. New Service (AttachmentService.ts)
Created service to manage attachments with methods:
- `saveImageAttachment(albumId, sourceUri)` → returns relative path
- `saveAudioAttachment(albumId, sourceFilePath)` → returns relative path
- `getAbsolutePath(albumId, relativePath)` → converts to absolute path
- `deleteAttachment(albumId, relativePath)`
- `attachmentExists(albumId, relativePath)`

All attachments saved to: `/<albumPath>/attachments/`

## Files Still Need Updating

### PageEditorScreen.tsx
- ✅ handleAddImage - DONE
- ❌ Audio file handling (need to find where audio is recorded/saved)
- ❌ pageAudioFile usage - needs to convert relative→absolute for playback
- ❌ displayImages - needs to convert relative→absolute for rendering

### Canvas.tsx / ImageElement
- ❌ Image rendering - needs to convert imagePath (relative) to absolute URI

### AudioElement.tsx
- ❌ Audio recording - needs to save to attachments directory via callback
- ❌ Audio playback - needs to convert relative→absolute path

### PageCard.tsx
- ❌ Image/Audio rendering in view mode - needs path conversion

### DoQueue.ts
- No changes needed (stores elements as-is)

### pageUtils.ts (compileQueueToElements)
- No changes needed (just returns elements from queue)

## Migration Strategy

Since no backwards compatibility needed:
1. Update all image/audio creation to use AttachmentService
2. Update all image/audio rendering to convert relative→absolute paths
3. Update AudioElement to use callback pattern with AttachmentService

## Next Steps

1. Update PageEditorScreen audio handling
2. Update displayImages to convert paths
3. Update Canvas/ImageElement to handle imagePath
4. Update AudioElement for new path system
5. Update PageCard for view mode
6. Test with new album creation
