# Closure Trap Fixes

## Problem

Event handlers and callbacks in React can capture stale values from when they were created. When these handlers are passed as props or stored in refs (like PanResponder), they don't automatically update when the underlying state changes, leading to bugs where old values are used.

## Solution Pattern

For any value that might change and is used in a long-lived handler:
1. Create a ref for that value
2. Sync the ref with an effect when the value changes
3. Use the ref's `.current` property in the handler

## Files Fixed

### 1. PageEditorScreen.tsx

#### Added Refs (lines 68-76):
```typescript
const pageAudioFileRef = useRef<string | undefined>(undefined);
const pageAudioDurationRef = useRef<number | undefined>(undefined);
const pageAudioWordTimingsRef = useRef<WordTiming[]>([]);
```

#### Sync Effects (lines 98-109):
```typescript
useEffect(() => {
  pageAudioFileRef.current = pageAudioFile;
}, [pageAudioFile]);

useEffect(() => {
  pageAudioDurationRef.current = pageAudioDuration;
}, [pageAudioDuration]);

useEffect(() => {
  pageAudioWordTimingsRef.current = pageAudioWordTimings;
}, [pageAudioWordTimings]);
```

#### Fixed Handlers:

**handleWordTimingsChange** (line 841):
- **Before**: Captured `pageAudioFile` and `pageAudioDuration` in closure
- **After**: Uses `pageAudioFileRef.current` and `pageAudioDurationRef.current`
- **Why**: This handler is passed to modal onClose, which could be called much later

**handleUpdatePageAudio** (line 827):
- **Before**: Captured `pageAudioWordTimings` in closure
- **After**: Uses `pageAudioWordTimingsRef.current`
- **Why**: Called from recording callback, may have stale word timings

### 2. AudioWordMappingModal.tsx

#### Added Refs (lines 58-60):
```typescript
const audioDurationRef = useRef(audioDuration);
const wordTimingsRef = useRef<WordTiming[]>([]);
```

#### Sync Effects (lines 74-81):
```typescript
useEffect(() => {
  audioDurationRef.current = audioDuration;
}, [audioDuration]);

useEffect(() => {
  wordTimingsRef.current = wordTimings;
}, [wordTimings]);
```

#### Fixed Handlers:

**handleWordMarkerDragMove** (line 161):
- **Before**: Captured `audioDuration` and `wordTimings`
- **After**: Uses `audioDurationRef.current` and `wordTimingsRef.current`
- **Why**: Callback passed to WordMarker, could be called after state changes

**handleWordMarkerDragEnd** (line 181):
- **Before**: Captured `audioDuration` and `wordTimings`, and used outer `timeToX`
- **After**: Uses refs and defines local `timeToX` function
- **Why**: Same as above, plus `timeToX` needs current duration

**handleClose** (line 202):
- **Before**: Captured `wordTimings` in closure
- **After**: Uses `wordTimingsRef.current`
- **Why**: Callback passed to parent, must have latest word timings

### 3. WordMarker Component (in AudioWordMappingModal.tsx)

#### Added Refs (lines 372-375):
```typescript
const minXRef = useRef(minX);
const maxXRef = useRef(maxX);
const onDragMoveRef = useRef(onDragMove);
const onDragEndRef = useRef(onDragEnd);
```

#### Sync Effects (lines 377-396):
```typescript
useEffect(() => {
  minXRef.current = minX;
}, [minX]);

useEffect(() => {
  maxXRef.current = maxX;
}, [maxX]);

useEffect(() => {
  onDragMoveRef.current = onDragMove;
}, [onDragMove]);

useEffect(() => {
  onDragEndRef.current = onDragEnd;
}, [onDragEnd]);
```

#### Fixed PanResponder (lines 414-429):
- **Before**: PanResponder created once with `useRef().current`, captured initial `minX`, `maxX`, `onDragMove`, `onDragEnd`
- **After**: Uses refs (`minXRef.current`, `maxXRef.current`, `onDragMoveRef.current`, `onDragEndRef.current`)
- **Why**: PanResponder is created once and never recreated, so it captures initial values. Using refs ensures it always uses current values.

## Testing Checklist

### PageEditorScreen:
- [ ] Record audio, add word mappings, record again → Should preserve word mappings from first recording
- [ ] Open word mapping modal, close it → Should save current duration and file path
- [ ] Change title while modal open → Should use latest title when saving

### AudioWordMappingModal:
- [ ] Drag word marker while audio duration changes → Should use current duration
- [ ] Make multiple changes before closing → Should pass all changes to parent
- [ ] Drag one word, then drag another → Both should use latest positions

### WordMarker:
- [ ] Drag word when adjacent words move → Should respect current minX/maxX boundaries
- [ ] Drag word quickly after it appears → Should call latest onDragMove/onDragEnd callbacks

## Common Closure Trap Patterns

### ❌ Bad - Captures stale value:
```typescript
const [count, setCount] = useState(0);

const handleClick = () => {
  setTimeout(() => {
    console.log(count); // ❌ Captures count from when handleClick was created
  }, 1000);
};
```

### ✅ Good - Uses ref:
```typescript
const [count, setCount] = useState(0);
const countRef = useRef(count);

useEffect(() => {
  countRef.current = count;
}, [count]);

const handleClick = () => {
  setTimeout(() => {
    console.log(countRef.current); // ✅ Always uses latest count
  }, 1000);
};
```

### ❌ Bad - PanResponder captures props:
```typescript
const panResponder = useRef(
  PanResponder.create({
    onPanResponderMove: () => {
      onDragMove(value); // ❌ Captures initial onDragMove and value
    }
  })
).current;
```

### ✅ Good - PanResponder uses refs:
```typescript
const valueRef = useRef(value);
const onDragMoveRef = useRef(onDragMove);

useEffect(() => { valueRef.current = value; }, [value]);
useEffect(() => { onDragMoveRef.current = onDragMove; }, [onDragMove]);

const panResponder = useRef(
  PanResponder.create({
    onPanResponderMove: () => {
      onDragMoveRef.current(valueRef.current); // ✅ Always latest
    }
  })
).current;
```

## Key Insight

The closure trap happens when:
1. A function/handler is created ONCE (or infrequently)
2. That function captures variables from its surrounding scope
3. Those variables change over time
4. The function is called later and uses the OLD captured values

The fix is to store changing values in refs and read from refs in the long-lived function.
