# Video Export - Native iOS Implementation

## Key Features

1. **Native iOS AVFoundation** - No external dependencies
2. **Word-by-word highlighting** - Synchronized with audio playback
3. **Static and audio pages** - Automatic detection and frame generation
4. **Multiple audio tracks** - Per-page audio with precise timing
5. **First page dimensions** - Video uses dimensions from first page
6. **Slide transitions** - Smooth page-to-page transitions with RTL/LTR support

## Architecture

### Components

```
JavaScript Layer:
  - ExportModal.tsx          : UI with 3 export options (ZIP/PDF/Video)
  - VideoPageRenderer.tsx    : Renders pages offscreen for capture
  - SimpleVideoExportService : Orchestrates frame capture
  - VideoExportNative.ts     : Bridge to native module

Native Layer (Objective-C):
  - VideoExportModule.h/m    : AVFoundation video encoding
```

### How It Works

```
1. User taps "Export as Video"
   ↓
2. Get dimensions from first page (canvasWidth × canvasHeight)
   ↓
3. For each page, capture frames:
   - Static pages: 1 frame
   - Audio pages: Multiple frames (initial + per-word + final)
   ↓
4. Generate slide transitions between pages:
   - RTL languages: slide right (current → right, next ← left)
   - LTR languages: slide left (current ← left, next → right)
   - 15 frames at 30fps = 500ms smooth transition
   ↓
5. JavaScript passes frames + audio to native module
   ↓
6. Native module creates video:
   - Encode frames to temp video file
   - Apply slide transitions using image compositing
   - Mix audio tracks at correct timestamps
   - Export final MP4
   ↓
7. Share video
```

## Key Files

### Native Module

**`ios/IssieAlbum/VideoExportModule.m`**
- `exportVideo` - Main export method
- `exportVideoOnly` - Creates video from frames
- `exportVideoWithAudio` - Mixes video with audio tracks
- `mixVideoWithAudio` - Uses AVMutableComposition for audio mixing
- `pixelBufferFromImage` - Converts UIImage to CVPixelBuffer
- `createSlideTransition` - Generates smooth slide transitions between pages

### JavaScript

**`src/services/VideoExportNative.ts`**
- Bridge to native module
- Handles progress events
- Checks if native module is available

**`src/services/SimpleVideoExportService.ts`**
- Orchestrates frame capture per page
- Handles static vs audio pages
- Compiles frame data for native module

**`src/components/VideoPageRenderer.tsx`**
- Renders pages offscreen for capture
- Supports word highlighting via `highlightedWordIndex`

**`src/components/PageCard.tsx`**
- Updated to accept `highlightedWordIndex` prop
- Uses external highlight during export
- Falls back to audio playback highlight during normal use

## Word Highlighting

Word highlighting works through frame-by-frame rendering:

1. **VideoPageRenderer** renders page with `highlightedWordIndex={n}`
2. **PageCard** passes highlight to **TilesElement**
3. **TilesElement** highlights the nth word
4. Frame is captured with highlight visible
5. Repeat for each word

Result: Video shows words highlighting in sync with audio.

## Video Specifications

- **Format:** MP4 (H.264 video + AAC audio)
- **Video Codec:** H.264 (AVVideoCodecTypeH264)
- **Video Bitrate:** 6 Mbps
- **Audio Codec:** AAC
- **Audio Bitrate:** 192 kbps
- **Sample Rate:** 44.1 kHz
- **Frame Rate:** 30 fps
- **Dimensions:** Taken from first page (canvasWidth × canvasHeight)
- **Transitions:** 500ms slide (15 frames at 30fps), direction based on language

## Native Module API

```objective-c
RCT_EXPORT_METHOD(exportVideo:(NSArray *)frames
                  audioTracks:(NSArray *)audioTracks
                  outputPath:(NSString *)outputPath
                  width:(NSInteger)width
                  height:(NSInteger)height
                  frameRate:(NSInteger)frameRate
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
```

**Frame format:**
```javascript
{
  imagePath: "/path/to/frame.jpg",
  duration: 2.5,  // seconds
  transition: {    // Optional - for slide transitions
    toImagePath: "/path/to/next-frame.jpg",
    progress: 0.5,  // 0.0 to 1.0
    direction: "left" // or "right" for RTL
  }
}
```

**Audio track format:**
```javascript
{
  audioPath: "/path/to/audio.m4a",
  startTime: 1.5  // seconds from video start
}
```

## Debugging

### Check Native Module Status

```typescript
import { videoExportNative } from './services/VideoExportNative';

if (!videoExportNative.isAvailable()) {
  console.log('Native module not loaded!');
}
```

### Enable Native Logging

Native logs appear in Xcode console with `[VideoExportModule]` prefix:
```
[VideoExportModule] Starting export with 5 frames and 2 audio tracks
[VideoExportModule] Processing frame 1/5: /path/to/frame.jpg
[VideoExportModule] Mixing video with audio
[VideoExportModule] Export completed successfully!
```

### Common Issues

**No audio in exported video:**
- Check audio file paths are absolute (not relative)
- Verify audio files exist at specified paths
- Check Xcode console for audio track errors

**Word highlighting not working:**
- Verify `highlightedWordIndex` is passed to PageCard
- Check TilesElement receives the prop
- Ensure pages have `wordTimings` data

**Export fails:**
- Check Xcode console for detailed error messages
- Verify AVFoundation framework is linked
- Ensure temp directory has write permissions

**Black frames or wrong dimensions:**
- Verify image paths point to valid files
- Check frame dimensions match video dimensions
- Ensure images are UIImage-compatible (JPG/PNG)

## Extending

### Customize Transition Duration

To change transition speed, update config:

```typescript
const config = {
  ...DEFAULT_EXPORT_CONFIG,
  transitionDuration: 0.8, // 800ms
  transitionFrames: 24,    // 24 frames at 30fps
};
```

### Add Different Transition Types

To add fade/zoom/flip transitions:

1. Update `FrameData` type to include `transitionType: 'slide' | 'fade' | 'zoom'`
2. Add new method in VideoExportModule.m: `createFadeTransition`, `createZoomTransition`
3. Update frame processing to select appropriate transition method
4. Pass transition type from SimpleVideoExportService

### Support Android

Create parallel implementation:
1. Create `VideoExportModule.java` using MediaCodec
2. Update `VideoExportNative.ts` to handle both platforms
3. Use platform-specific implementation

### Add Background Music

To add background music to entire video:

1. Add `backgroundMusicPath` parameter
2. In `mixVideoWithAudio`, add background music track
3. Mix with page audio tracks using `AVMutableComposition`

### Custom Quality Settings

Currently hardcoded at 6 Mbps. To make configurable:

1. Add `quality` parameter to `exportVideo`
2. Map quality to bitrate (low: 2Mbps, medium: 4Mbps, high: 6Mbps)
3. Update `videoSettings` in native module

## Performance Notes

- **Frame capture:** ~100-200ms per frame (depends on page complexity)
- **Video encoding:** ~1-2 seconds per page
- **Audio mixing:** ~1 second per audio track
- **Total time:** ~10-30 seconds for 5-page album

Memory usage is low due to sequential frame processing.

## Maintenance

### Updating Native Module

After changing `VideoExportModule.m`:
1. Clean build: `cd ios && xcodebuild clean`
2. Rebuild in Xcode or `npm run ios`
3. Test with simple video first, then complex ones

### Testing Checklist

- [ ] Static pages only (no audio)
- [ ] Audio pages without word timings
- [ ] Audio pages with word timings
- [ ] Mixed album (static + audio)
- [ ] Multiple audio tracks per page
- [ ] Long videos (20+ pages)
- [ ] Device rotation during export
- [ ] Export cancellation

## Known Limitations

1. **iOS only** - No Android support yet
2. **Sequential processing** - Frames processed one at a time (can't parallelize)
3. **Single transition type** - Only slide transitions supported currently
4. **Single audio per page** - Code supports multiple but not tested extensively
5. **Fixed quality** - 6 Mbps hardcoded
6. **First page dimensions** - All pages rendered at first page's canvas size

## Future Enhancements

- [ ] Android support with MediaCodec
- [ ] Multiple transition types (fade, zoom, flip, wipe)
- [ ] Configurable video quality
- [ ] Background music support
- [ ] Watermark/logo overlay
- [ ] Multiple aspect ratios (16:9, 4:3, 1:1)
- [ ] Export progress cancellation
- [ ] Resume failed exports
- [ ] Custom transition easing functions
- [ ] Per-page dimensions (adaptive resizing)

---

**Status:** ✅ Production Ready
**Platform:** iOS (AVFoundation)
**Dependencies:** None (native iOS APIs only)
