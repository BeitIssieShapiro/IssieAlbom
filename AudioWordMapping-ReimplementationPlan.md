# Audio Word Mapping - Reimplementation Plan

## Requirements (from user)

### 1. Initial Mapping Generation
- If opening mapper with NO previous mappings:
  - Try to find beginning of words in histogram/waveform
  - Place word markers at detected positions
  - If detection fails, spread evenly across duration
- **This ONLY happens ONCE on first open with no previous state**

### 2. No Title = Simple Audio Controls
- If no title text found:
  - Don't show histogram/waveform
  - Don't show word mapping UI
  - Only show: Play button, Record button, Delete button

### 3. Auto-Save (No Manual Save Button)
- No Save/Cancel buttons
- Auto-commit changes when:
  - User drags a word marker (on drop)
  - Modal closes
  - Mode changes
  - Move to view-mode
- Use onChange callback to notify parent

### 4. Preserve State During Changes
- **CRITICAL**: When user drags one marker, ONLY that marker moves
- Other markers must NOT move or jump
- State must be preserved across any changes
- No recalculations that affect other markers

### 5. Use Existing Mappings As-Is
- When opening mapper with previous state in queue:
  - Use it exactly as stored
  - NO attempt to match words
  - NO re-distribution
  - NO heuristics applied

## Current Problems

### Problem 1: Multiple State Updates
- AudioWaveform calls onLoad multiple times (real duration + timeout)
- Each call triggers re-render and potential state changes
- Causes words to jump

### Problem 2: Complex State Dependencies
- Multiple useEffects with overlapping dependencies
- Closures capturing stale state
- Refs and flags (heuristicsApplied, isInitialMount, pendingOnChange) making it hard to track

### Problem 3: onChange Called During Render
- React error: "Cannot update component during render"
- Trying to call parent setState from child render cycle

### Problem 4: Waveform Re-renders
- AudioWaveform component re-renders multiple times
- Each time it restarts the audio player
- Creates race conditions with callbacks

## New Implementation Strategy

### Simplified State Design

```typescript
// Single source of truth
const [wordTimings, setWordTimings] = useState<WordTiming[]>([]);

// Simple flags (no complex interactions)
const [isInitialized, setIsInitialized] = useState(false);
const [audioDuration, setAudioDuration] = useState(0);
```

### Single Initialization Flow

1. **On Mount:**
   - If `initialWordTimings` provided → use them, set `isInitialized = true`
   - If no initial timings → create temporary even distribution
   - Mark as initialized

2. **When Audio Loads (ONCE):**
   - Update `audioDuration`
   - If `!isInitialized && words.length > 0`:
     - Apply heuristics with waveform data (if available)
     - OR use even distribution (if no waveform data)
     - Set `isInitialized = true`

3. **On Drag End:**
   - Update `wordTimings` for that ONE word
   - Call `onChange` with new timings (via useEffect)

### AudioWaveform Simplification

```typescript
// Load duration ONCE, prevent multiple calls
const [durationLoaded, setDurationLoaded] = useState(false);

useEffect(() => {
  if (durationLoaded) return;

  // Load duration
  // Call onLoad ONCE
  // Set durationLoaded = true
}, [audioFile]);
```

### Prevent setState During Render

```typescript
// Use a separate effect that watches wordTimings
// Only call onChange when wordTimings changes AND isInitialized
useEffect(() => {
  if (isInitialized && wordTimings.length > 0) {
    onChange(wordTimings);
  }
}, [wordTimings]);

// But skip the FIRST time (initial load)
const isFirstRender = useRef(true);
useEffect(() => {
  if (isFirstRender.current) {
    isFirstRender.current = false;
    return;
  }
  if (wordTimings.length > 0) {
    onChange(wordTimings);
  }
}, [wordTimings]);
```

### Key Principles

1. **Single Responsibility**: Each useEffect does ONE thing
2. **No Overlapping Dependencies**: Effects don't trigger each other
3. **Idempotent**: Running an effect twice has same result as once
4. **Clear Data Flow**: Props → State → Render (no loops)

## Implementation Steps

1. ✅ Remove all existing complex logic
2. ✅ Create simple AudioWaveform that loads duration ONCE
3. ✅ Create simple initialization effect (run once on mount)
4. ✅ Create simple onChange effect (skip first render)
5. ✅ Implement drag with functional setState (no closures)
6. ✅ Test: Open with existing mappings → should load exactly as stored
7. ✅ Test: Open without mappings → should create initial distribution
8. ✅ Test: Drag one word → only that word moves
9. ✅ Test: Drag triggers onChange callback

## Files to Modify

- `/Users/i022021/dev/Issie/IssieAlbom/src/components/AudioWordMappingModal.tsx` - Main component (simplify)
- `/Users/i022021/dev/Issie/IssieAlbom/src/components/AudioWaveform.tsx` - Load duration once
