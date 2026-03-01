# IssieAlbom Project Guide

## Project Overview

IssieAlbom is a React Native photo album application that allows users to create interactive albums with pages containing drawings, text, images, emojis, and audio recordings. The app uses a canvas-based editing system with support for device rotation and carousel page navigation.

## Critical Architecture Patterns

### 1. React State Management - Avoiding Stale Closures

**CRITICAL**: Event handlers that access state MUST use refs to avoid stale closures. This is mandatory for:
- PanResponder handlers
- Async callbacks (setTimeout, promises)
- Event listeners (Dimensions.addEventListener)
- Handlers passed to child components

**Pattern**:
```typescript
const [sketchColor, setSketchColor] = useState('#333333');
const sketchColorRef = useRef(sketchColor);

// Sync ref with state
useEffect(() => {
  sketchColorRef.current = sketchColor;
}, [sketchColor]);

// Use ref in handlers
const handleDraw = useCallback(() => {
  const color = sketchColorRef.current; // Always gets latest value
  // ... use color
}, []);
```

**Why**: React closures capture state values at creation time. Without refs, handlers see stale state values.

See: `/Users/i022021/.claude/projects/-Users-i022021-dev-Issie-IssieAlbom/memory/react-closure-pattern.md`

### 2. Canvas Coordinate System & Path Normalization

**Key Concept**: Paths are stored in original canvas coordinates and scaled by ratio when rendering.

**Functions** (in `IssieDocs/src/canvas/canvas.tsx`):
```typescript
// When saving: normalize by dividing by ratio
function toCmds(path: SkPath, ratio: number): PathCommand[] {
  const commands = path.toCmds();
  return commands.map(c => [c[0], c[1] / ratio, c[2] / ratio]);
}

// When rendering: denormalize by multiplying by ratio
function createSkiaPath(points: PathCommand[], ratio: number): any {
  const skPath = Skia.Path.Make();
  for (let i = 0; i < points.length; i++) {
    const [verb, x, y] = points[i];
    if (verb == PathVerb.Move) {
      skPath.moveTo(x * ratio, y * ratio);
    } else if (verb == PathVerb.Line) {
      skPath.lineTo(x * ratio, y * ratio);
    }
  }
  return skPath;
}
```

**Why**: This ensures paths maintain correct positions relative to images regardless of screen orientation or view mode.

### 3. Ratio Calculation for Canvas Scaling

**CRITICAL**: PageCard and PageEditorScreen must use IDENTICAL ratio calculations.

**Pattern**:
```typescript
// Get screen dimensions
const [screenDimensions, setScreenDimensions] = useState(() => {
  const window = Dimensions.get('window');
  return { width: window.width, height: window.height };
});

// Listen for rotation
useEffect(() => {
  const subscription = Dimensions.addEventListener('change', ({ window }) => {
    setScreenDimensions({ width: window.width, height: window.height });
  });
  return () => subscription?.remove();
}, []);

// Calculate available space
const availableWidth = screenDimensions.width - TOOLBAR_WIDTH;
const availableHeight = screenDimensions.height - HEADER_HEIGHT - insets.top;

// Get original page dimensions
const originalWidth = page.canvasWidth || screenDimensions.width;
const originalHeight = page.canvasHeight || screenDimensions.height;

// Calculate scale ratio
const ratioX = availableWidth / originalWidth;
const ratioY = availableHeight / originalHeight;
const ratio = Math.min(ratioX, ratioY, 1); // Don't scale up, only down

// Calculate display dimensions
const displayWidth = PixelRatio.roundToNearestPixel(originalWidth * ratio);
const displayHeight = PixelRatio.roundToNearestPixel(originalHeight * ratio);

// Pass to Canvas
<Canvas
  canvasWidth={displayWidth}
  canvasHeight={displayHeight}
  ratio={ratio}
/>
```

**Important**:
- Use `PixelRatio.roundToNearestPixel()` to prevent sub-pixel rendering gaps
- Don't subtract `insets.bottom` - we want to use that space for the canvas
- PageCard and PageEditorScreen available height calculations must match carousel height

## Key File Structure

### Core Screens
- `src/screens/PageEditorScreen.tsx` - Main page editor with toolbar, canvas, and undo/redo
- `src/screens/AlbumScreen.tsx` - Album viewer with carousel navigation
- `src/screens/HomeScreen.tsx` - Home screen with album list

### Canvas System
- `src/components/canvas/canvas.tsx` - Main canvas component (from IssieDocs)
- `src/components/canvas/text-element.tsx` - Text/emoji rendering with rotation
- `src/components/canvas/types.ts` - Type definitions for canvas elements

### Components
- `src/components/PageCard.tsx` - Page view component (used in carousel)
- `src/components/AudioElement.tsx` - Audio playback with word timing
- `src/components/BackgroundSettingsModal.tsx` - Background pattern/color picker

### Utilities
- `src/utils/DoQueue.ts` - Undo/redo queue implementation
- `src/utils/pageUtils.ts` - Queue compilation (deduplication, merging)
- `src/utils/backgroundPatterns.ts` - Pattern generation utilities

### Services
- `src/services/AlbumService.ts` - Album CRUD operations
- `src/services/PageService.ts` - Page CRUD operations
- `src/services/AttachmentService.ts` - File path management

### Types
- `src/types/Album.ts` - Core type definitions (AlbumPageV2, SketchText, etc.)

## Data Model

### Page Structure (AlbumPageV2)
```typescript
interface AlbumPageV2 {
  id: string;
  pageNumber: number;
  canvasWidth: number;    // Original canvas width when created
  canvasHeight: number;   // Original canvas height when created
  elements: SketchElement[];  // Queue of all elements
  backgroundPath?: string;
  createdAt: number;
  updatedAt: number;
}
```

### Element Types
- **Paths** (SketchPath): Free-hand drawings with paths array
- **Texts** (SketchText): Text or emoji with `isEmoji` flag, rotation support
- **Images** (SketchImage): Photos with imagePath and dimensions
- **Audios** (SketchAudio): Audio recordings with optional wordTimings
- **Background Patterns** (BackgroundPattern): Solid colors, patterns, or images

### Queue System
Elements are stored in a queue with operations (ADD, UPDATE, DELETE). The `compileQueueToElements()` function in `pageUtils.ts` deduplicates and merges queue entries into final element arrays.

## Device Rotation Support

**Must-have for all screens that display canvas**:

1. Track screen dimensions with state
2. Listen to Dimensions.addEventListener('change')
3. Recalculate ratio and display dimensions in useMemo
4. Pass updated dimensions to Canvas component

Example:
```typescript
const [screenDimensions, setScreenDimensions] = useState(() => {
  const window = Dimensions.get('window');
  return { width: window.width, height: window.height };
});

useEffect(() => {
  const subscription = Dimensions.addEventListener('change', ({ window }) => {
    console.log('[Component] Dimensions changed:', window);
    setScreenDimensions({ width: window.width, height: window.height });
  });
  return () => subscription?.remove();
}, []);
```

## Styling Guidelines

### Canvas Container Styling

**Edit Mode** (PageEditorScreen):
```typescript
canvasContainer: {
  flex: 1,
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
  backgroundColor: '#f5f5f5',
  padding: 12,  // Margin around canvas
}

canvas: {
  backgroundColor: '#fff',
  borderRadius: 8,
  boxShadow: '5px 5px 5px 0px rgba(0, 0, 0, 0.3)',
  overflow: 'hidden',
}
```

**View Mode** (PageCard):
```typescript
container: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  borderRadius: 8,
  boxShadow: '5px 5px 5px 0px rgba(0, 0, 0, 0.3)',
}

pageContent: {
  flex: 1,
  margin: 0,
  padding: 0,
}
```

**Important**: Use `boxShadow` CSS property, not React Native's shadowColor/shadowOffset/shadowOpacity/shadowRadius.

## Common Issues & Solutions

### Issue: Sketch pen loses color/size on release
**Cause**: useEffect hooks syncing refs placed before state declarations (violates Rules of Hooks)
**Solution**: Move useEffect hooks to after all state declarations

### Issue: Paths shift position between edit and view mode
**Cause**: Different ratio calculations in PageCard vs PageEditorScreen
**Solution**: Use identical calculation logic in both components

### Issue: 20px gap at bottom of canvas
**Cause**: Subtracting `insets.bottom` when carousel doesn't
**Solution**: Don't subtract `insets.bottom` from availableHeight

### Issue: Page navigation exits edit mode
**Cause**: `handleEditorSave` always calling `setEditingPage(null)`
**Solution**: Add `shouldExit` parameter, only exit when explicitly requested

### Issue: Canvas has black border
**Cause**: `borderWidth: 2` in inline Canvas style
**Solution**: Remove borderWidth from Canvas style

## Development Guidelines

1. **Always read files before editing** - Use Read tool, not cat/head/tail
2. **Never use dedicated tools for system operations** - Use Bash only when necessary
3. **Respect user styling choices** - If user sets flex:1, don't change to explicit width/height
4. **Focus on logic issues over cosmetic changes** - Don't refactor unless asked
5. **Test rotation** - Always verify canvas renders correctly after device rotation
6. **Log ratio calculations** - Include detailed logs for debugging scaling issues

## Dependencies

- React Native
- @shopify/react-native-skia - Canvas rendering
- react-native-reanimated-carousel - Page carousel
- react-native-fs - File system operations
- react-native-view-shot - Screenshot capture
- react-native-sound - Audio playback

## Testing Checklist

When making canvas-related changes, verify:
- [ ] Canvas renders correctly in portrait orientation
- [ ] Canvas renders correctly in landscape orientation
- [ ] Paths maintain position relative to images after rotation
- [ ] No gaps/margins around canvas in view mode
- [ ] Proper spacing/shadow in edit mode
- [ ] Sketch pen retains color/size during drawing
- [ ] Page navigation works without exiting edit mode
- [ ] Carousel shows peek of adjacent pages
- [ ] Audio playback highlights correct words
