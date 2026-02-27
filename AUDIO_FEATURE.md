# Audio Recording Feature

## Installation

After pulling the latest changes, you need to install the audio recording dependencies:

```bash
npm install
cd ios && pod install && cd ..
```

**Note:** This feature uses `react-native-nitro-sound`, a high-performance audio library built with NitroModules.

## Permissions

### iOS
The audio recording permissions are already configured in `Info.plist`. Make sure these entries exist:
- `NSMicrophoneUsageDescription` - "We need access to your microphone to record audio notes"

### Android
Permissions are handled automatically by the library. The app will request:
- `RECORD_AUDIO`
- `WRITE_EXTERNAL_STORAGE`
- `READ_EXTERNAL_STORAGE`

## Usage

1. **Switch to Audio Mode**: Tap the microphone icon (הקלטה) in the toolbar
2. **Record Audio**: Click anywhere on the canvas to place an audio element, then tap the microphone button to start recording
3. **Stop Recording**: Tap the stop button to finish recording
4. **Play Audio**: Tap the play button on any recorded audio element
5. **Move Audio**: Drag audio elements to reposition them
6. **Delete Audio**: Long press or use delete button (when implemented in UI)

## Implementation Details

### Audio Storage
- Audio files are stored using the same lightweight position pattern as images
- Full audio data is saved on creation: `pushAudio()`
- Position updates save only coordinates: `pushAudioPosition()`
- Queue compilation merges position updates onto base audio elements

### Audio Element Structure
```typescript
interface SketchAudio {
  id: string;
  x: number;
  y: number;
  file?: string;        // Audio file path
  duration?: number;    // Duration in milliseconds
  editMode?: boolean;   // True when recording
}
```

### Files Created/Modified
- `src/components/AudioElement.tsx` - Audio recording/playback component using react-native-nitro-sound
- `src/types/Album.ts` - Added SketchAudio type and Audio to ElementTypes
- `src/utils/DoQueue.ts` - Added pushAudio, pushAudioPosition, pushDeleteAudio
- `src/utils/pageUtils.ts` - Updated compileQueueToElements for audio
- `src/screens/PageEditorScreen.tsx` - Audio mode, rendering, handlers
- `src/components/PageCard.tsx` - Audio rendering in view mode
- `src/components/canvas/types.tsx` - Added Audio to ElementTypes
- `package.json` - Added react-native-nitro-sound and react-native-nitro-modules dependencies

## Testing

1. Create a new page
2. Switch to audio mode
3. Tap to place an audio element
4. Record a message
5. Play it back
6. Move the audio element
7. Go back to view mode and verify audio is visible and playable
8. Reopen the page and verify audio persists

## Troubleshooting

### No audio recording on iOS
- Check that microphone permissions are granted in Settings
- Verify Info.plist has NSMicrophoneUsageDescription

### No audio recording on Android
- Grant microphone and storage permissions when prompted
- Check that permissions are granted in app settings

### Audio not persisting
- Check that PageService.updatePage is being called
- Verify queue contains audio elements with `console.log(queue.getAll())`
- Check that compileQueueToElements is handling 'audio' and 'audioPosition' types

### Audio not playing
- Verify file path starts with 'file://' protocol
- Check that the audio file exists at the specified path
- Look for errors in react-native-nitro-sound logs
- Ensure iOS deployment target is iOS 13.0+
- For Android, verify API level 24+

## Technical Details

### Library Information
This feature uses `react-native-nitro-sound` (v0.2.10+), a high-performance audio library built with NitroModules:
- Zero bridge overhead for better performance
- Full TypeScript support
- Background thread recording to prevent UI freezing
- Cross-platform support (iOS 13.0+, Android API 24+)

### Audio Configuration
The app uses the following audio configuration:
```typescript
{
  AudioSamplingRate: 44100,
  AudioEncodingBitRate: 128000,
  AudioChannels: 1,
}
```

### Default Storage Paths
- **Android:** `{cacheDir}/sound.mp4`
- **iOS:** `{cacheDir}/sound.m4a`
