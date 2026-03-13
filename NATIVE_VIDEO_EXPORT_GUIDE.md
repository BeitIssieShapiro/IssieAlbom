# Video Export with Native iOS AVFoundation

## Overview

Video export now uses **native iOS AVFoundation** instead of FFmpeg. This is more reliable, performant, and doesn't require external dependencies.

## Architecture

```
React Native (TypeScript)
        ↓
VideoExportNative.ts (Bridge)
        ↓
VideoExportModule.m (Objective-C)
        ↓
AVFoundation (iOS Native)
```

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

**Note:** No FFmpeg packages needed! We're using native iOS APIs.

### 2. Add Native Files to Xcode

The native module files have been created:
- `ios/IssieAlbum/VideoExportModule.h`
- `ios/IssieAlbum/VideoExportModule.m`

**To add them to Xcode:**

1. Open `ios/IssieAlbum.xcworkspace` in Xcode
2. Right-click on the `IssieAlbum` folder in Project Navigator
3. Select "Add Files to IssieAlbum..."
4. Navigate to `ios/IssieAlbum/`
5. Select both `VideoExportModule.h` and `VideoExportModule.m`
6. Make sure "Copy items if needed" is checked
7. Make sure your app target is selected
8. Click "Add"

### 3. Add AVFoundation Framework

1. In Xcode, select your project in Project Navigator
2. Select the `IssieAlbum` target
3. Go to "Build Phases" tab
4. Expand "Link Binary With Libraries"
5. Click the "+" button
6. Search for "AVFoundation.framework"
7. Click "Add"

### 4. Add Permissions to Info.plist

Already added (photo library permissions are sufficient for video export).

### 5. Build and Run

```bash
# Clean build
cd ios
xcodebuild clean
cd ..

# Rebuild
npm run ios
```

## How It Works

### 1. Frame Capture (JavaScript)

The `SimpleVideoExportService` captures frames:
```typescript
// For each page, capture frames
const frameUri = await onCaptureFrame(pageIndex, wordIndex);
```

### 2. Native Video Assembly (Objective-C)

The native module `VideoExportModule.m`:
1. Creates `AVAssetWriter` with H.264 codec
2. Creates `AVAssetWriterInput` for video
3. Creates `AVAssetWriterInputPixelBufferAdaptor` for frames
4. Converts each UIImage to CVPixelBuffer
5. Appends pixel buffers with timestamps
6. Adds audio tracks with correct timing
7. Finalizes and exports video

### 3. Progress Reporting

The native module sends progress events back to JavaScript:
```objective-c
[self sendEventWithName:@"VideoExportProgress" body:@{
  @"phase": @"encoding",
  @"currentFrame": @(frameIndex),
  @"totalFrames": @(frames.count),
  @"percentage": @(percentage)
}];
```

## Features

✅ **No External Dependencies** - Uses built-in iOS APIs
✅ **High Quality** - H.264 encoding at 6 Mbps
✅ **Audio Support** - Multiple audio tracks with precise timing
✅ **Progress Reporting** - Real-time encoding progress
✅ **Memory Efficient** - Processes frames sequentially
✅ **Fast** - Native performance

## Video Specifications

- **Codec:** H.264 (AVVideoCodecTypeH264)
- **Video Bitrate:** 6 Mbps (high quality)
- **Audio Codec:** AAC
- **Audio Bitrate:** 192 kbps
- **Sample Rate:** 44.1 kHz
- **Channels:** Stereo
- **Container:** MP4 (MPEG-4)
- **Pixel Format:** 32-bit ARGB

## API Usage

### JavaScript

```typescript
import { videoExportNative } from './services/VideoExportNative';

// Prepare frames
const frames = [
  { imagePath: '/path/to/frame1.jpg', duration: 2.0 },
  { imagePath: '/path/to/frame2.jpg', duration: 1.5 },
];

// Prepare audio tracks
const audioTracks = [
  { audioPath: '/path/to/audio.m4a', startTime: 0.5 },
];

// Export
const result = await videoExportNative.exportVideo(
  frames,
  audioTracks,
  '/path/to/output.mp4',
  1920, // width
  1080, // height
  30,   // frame rate
  (progress) => {
    console.log(`Progress: ${progress.percentage}%`);
  }
);

console.log('Video exported:', result.videoPath);
```

### Native Module (Objective-C)

```objective-c
@implementation VideoExportModule

RCT_EXPORT_METHOD(exportVideo:(NSArray *)frames
                  audioTracks:(NSArray *)audioTracks
                  outputPath:(NSString *)outputPath
                  width:(NSInteger)width
                  height:(NSInteger)height
                  frameRate:(NSInteger)frameRate
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  // Implementation...
}

@end
```

## Testing

### Test Without Audio

```typescript
const frames = [
  { imagePath: frame1Path, duration: 3.0 },
  { imagePath: frame2Path, duration: 3.0 },
];

await videoExportNative.exportVideo(
  frames,
  [], // no audio
  outputPath,
  1920,
  1080,
  30
);
```

### Test With Audio

```typescript
const frames = [
  { imagePath: frame1Path, duration: 2.0 },
  { imagePath: frame2Path, duration: 3.0 },
];

const audioTracks = [
  { audioPath: audioPath, startTime: 0.0 },
];

await videoExportNative.exportVideo(
  frames,
  audioTracks,
  outputPath,
  1920,
  1080,
  30
);
```

## Troubleshooting

### Issue: Native module not found

**Solution:**
1. Make sure VideoExportModule files are added to Xcode
2. Clean and rebuild:
   ```bash
   cd ios
   xcodebuild clean
   cd ..
   npm run ios
   ```

### Issue: AVFoundation not found

**Solution:**
1. In Xcode, check Build Phases → Link Binary With Libraries
2. Make sure `AVFoundation.framework` is listed
3. If not, add it manually

### Issue: Video export fails silently

**Solution:**
1. Check Xcode console for native logs
2. Enable verbose logging:
   ```objective-c
   NSLog(@"[VideoExport] Status: %@", @"message");
   ```

### Issue: Audio not synced

**Solution:**
- Check that `startTime` values are correct
- Verify audio file paths are absolute
- Check audio file format (should be .m4a or .mp3)

### Issue: Black frames or distorted video

**Solution:**
- Verify image paths are correct
- Check image dimensions match video dimensions
- Ensure images are valid UIImage-compatible formats (JPG, PNG)

## Performance

### Expected Export Times

- **5 pages, static only:** ~5-10 seconds
- **5 pages with audio:** ~10-15 seconds
- **20 pages with audio:** ~30-45 seconds

### Memory Usage

- **Frame-by-frame processing:** Low memory footprint
- **No intermediate files:** Direct pixel buffer conversion
- **Audio streaming:** Processed in chunks

## Comparison: Native vs FFmpeg

| Feature | Native AVFoundation | FFmpeg |
|---------|-------------------|--------|
| Dependencies | ✅ None | ❌ Large binary |
| Setup | ✅ Simple | ❌ Complex |
| Performance | ✅ Fast | ⚠️ Slower |
| Memory | ✅ Efficient | ⚠️ Higher |
| Quality | ✅ Excellent | ✅ Excellent |
| Platform | ⚠️ iOS only | ✅ Cross-platform |
| Maintenance | ✅ Apple-supported | ⚠️ Third-party |

## Future Enhancements

- [ ] Add video transitions (fade, slide)
- [ ] Support multiple aspect ratios
- [ ] Add watermark support
- [ ] Implement video compression options
- [ ] Add background music support
- [ ] Support for Android (MediaCodec)

## Summary

✅ **No FFmpeg needed** - Pure native iOS solution
✅ **Ready to use** - Just add files to Xcode and build
✅ **High quality** - Professional H.264 encoding
✅ **Simple API** - Easy to use from JavaScript

**Next Step:** Add the native files to Xcode and build!
