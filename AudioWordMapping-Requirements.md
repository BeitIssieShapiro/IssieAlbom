# Audio Word Mapping Requirements

## Requirement 1: Initial Mapping Generation
**Status:** ✅ Implemented (lines 58-90 in AudioWordMappingModal.tsx)

When opening the mapper with NO previous mappings:
- Try to find beginning of words in the histogram/waveform
- Place word markers at those positions
- If word boundary detection not available, spread words evenly across duration
- **This ONLY happens on first open with no previous state**

**Current Implementation:**
```typescript
// Lines 65-75
if (initialWordTimings.length > 0) {
  setWordTimings(initialWordTimings);
} else {
  // No previous mappings - distribute evenly for now (requirement #1)
  // TODO: In the future, analyze audio waveform to find word boundaries
  const timings: WordTiming[] = parsedWords.map((word, index) => ({
    word,
    startTime: (index / parsedWords.length) * audioDuration,
  }));
  setWordTimings(timings);
}
```

**Issue:** Currently spreads evenly. TODO: Implement waveform analysis to find word boundaries.

---

## Requirement 2: No Title = Simple Audio Controls
**Status:** ✅ Implemented (lines 205-282 in AudioWordMappingModal.tsx)

If no title text found:
- Don't show histogram/waveform
- Don't show word mapping UI
- Only show: Play button, Record button, Delete button

**Current Implementation:**
```typescript
// Line 55
const hasTitle = titleText && titleText.trim().length > 0;

// Lines 205-282
{hasTitle && (
  <>
    {/* Audio Highlights Toggle */}
    {/* Word Markers */}
    {/* Waveform */}
  </>
)}
```

---

## Requirement 3: Auto-Save (No Manual Save Button)
**Status:** ✅ Implemented (lines 144-148 in AudioWordMappingModal.tsx)

No need for Save button:
- Auto-commit changes at close of modal
- Auto-commit on marker drag end
- Auto-commit on mode change
- Auto-commit on move to view-mode

**Current Implementation:**
```typescript
// Lines 144-148 - Auto-save on drag end
setWordTimings(updatedTimings);
setDraggingIndex(null);

// Auto-save on change (requirement #3)
onChange(updatedTimings);
```

**Modal closes with X button** (line 197), no separate Save/Cancel buttons.

---

## Requirement 4: Preserve State During Changes
**Status:** ⚠️ **ISSUE** - State getting messed up

When user changes a marker:
- The state of mapper should preserve it
- Any other change should NOT lose this change
- Each word should ONLY change itself when dragged
- Other words should NOT move when one word is dragged

**Current Implementation Issues:**
- `initializedRef` added (line 57) to prevent re-initialization
- Effect has dependencies that may cause re-runs (line 90)
- WordMarker uses `React.memo` but still experiencing issues
- Position threshold check (0.1px) may not be enough

**Problem:** When dragging one word, other words are moving/affected.

---

## Requirement 5: Use Existing Mappings As-Is
**Status:** ✅ Implemented (lines 65-66 in AudioWordMappingModal.tsx)

When opening mapper and previous state exists in queue:
- Use it as-is
- NO attempt to match words
- NO re-distribution
- NO heuristics

**Current Implementation:**
```typescript
// Lines 65-66
if (initialWordTimings.length > 0) {
  setWordTimings(initialWordTimings);
}
```

---

## Summary

### ✅ Working:
1. Auto-save on changes
2. No title = simple controls
3. Initial mappings used as-is when provided
4. Initial even distribution when no mappings exist

### ⚠️ Issues:
1. **Requirement 4 BROKEN:** State preservation during drag - one word affects others
2. **Requirement 1 INCOMPLETE:** Need waveform analysis for word boundary detection (currently only even distribution)

### Root Cause Analysis:
The state preservation issue (Requirement 4) appears to be caused by:
- The effect at line 58-90 may be re-running when it shouldn't
- `initializedRef` check at line 60 should prevent this, BUT...
- Dependencies include `audioDuration` (line 90) which changes during playback
- This may trigger re-initialization even when `initializedRef.current` is true
- Need to remove effect re-runs after first initialization completely
