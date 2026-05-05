# Tiles Multi-Select Editing Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-tile floating action buttons with a checkbox multi-select system; move all tile actions to the toolbar.

**Architecture:** `TileWord` gets per-tile color fields; `TilesElement` switches from action buttons to checkboxes with `onTilePress`; `PageEditorScreen` adds `selectedTileIndices` state and toolbar action buttons driven by selection count.

**Tech Stack:** React Native, TypeScript, @react-native-vector-icons/ionicons

---

## File Map

| File | Change |
|------|--------|
| `src/types/Album.ts` | Add `backgroundColor?` and `textColor?` to `TileWord` |
| `src/components/TilesElement.tsx` | Replace action buttons with checkbox; new props |
| `src/screens/PageEditorScreen.tsx` | Add selection state + ref; rewrite merge/unmerge handlers; add toolbar buttons; clear selection on deselect |

---

## Task 1: Extend TileWord data model

**Files:**
- Modify: `src/types/Album.ts`

- [ ] **Step 1: Add per-tile color fields to TileWord**

In `src/types/Album.ts`, replace the `TileWord` interface (currently at lines 91-96):

```typescript
export interface TileWord {
  text: string;
  originalIndices: number[];
  symbol?: string;
  symbolType?: 'emoji' | 'image';
  backgroundColor?: string; // per-tile override; falls back to SketchTiles.backgroundColor
  textColor?: string;        // per-tile override; falls back to SketchTiles.textColor
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/i022021/dev/Issie/IssieAlbom
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors (there may be pre-existing errors; confirm count doesn't increase).

- [ ] **Step 3: Commit**

```bash
git add src/types/Album.ts
git commit -m "feat(tiles): add per-tile backgroundColor and textColor to TileWord"
```

---

## Task 2: Rewrite TilesElement — checkboxes, remove action buttons

**Files:**
- Modify: `src/components/TilesElement.tsx`

- [ ] **Step 1: Update props interface**

Replace the entire `TilesElementProps` interface and function signature at the top of `src/components/TilesElement.tsx`:

```typescript
interface TilesElementProps {
  tiles: SketchTiles;
  canvasWidth: number;
  canvasHeight: number;
  ratio: number;
  editMode?: boolean;
  selectedIndices?: Set<number>;
  onTilePress?: (index: number) => void;
  highlightedWordIndex?: number;
  albumId: string;
  themeColor?: string;
}

export function TilesElement({
  tiles,
  canvasWidth,
  canvasHeight,
  ratio,
  editMode = false,
  selectedIndices,
  onTilePress,
  highlightedWordIndex,
  albumId,
  themeColor = '#4CAF50',
}: TilesElementProps) {
```

- [ ] **Step 2: Update tile background/text color to use per-tile overrides**

In the tile `View` style, replace:
```typescript
backgroundColor: isHighlighted
  ? '#FFD700'
  : tiles.backgroundColor,
```
with:
```typescript
backgroundColor: isHighlighted
  ? '#FFD700'
  : (word.backgroundColor ?? tiles.backgroundColor),
```

In the tile text `Text` style, replace:
```typescript
color: tiles.textColor,
```
with:
```typescript
color: word.textColor ?? tiles.textColor,
```

- [ ] **Step 3: Replace the outer tile View with a TouchableOpacity when in edit mode**

Currently the tile is a plain `View`. Wrap it so tapping anywhere on the tile calls `onTilePress`. Replace:

```typescript
<View
  style={[
    styles.tile,
    {
      backgroundColor: isHighlighted
        ? '#FFD700'
        : (word.backgroundColor ?? tiles.backgroundColor),
      width: tileSize,
      height: tileSize,
      borderRadius: tileSize * 0.15,
    },
  ]}
>
```

with:

```typescript
<TouchableOpacity
  activeOpacity={editMode ? 0.7 : 1}
  onPress={editMode && onTilePress ? () => onTilePress(index) : undefined}
  style={[
    styles.tile,
    {
      backgroundColor: isHighlighted
        ? '#FFD700'
        : (word.backgroundColor ?? tiles.backgroundColor),
      width: tileSize,
      height: tileSize,
      borderRadius: tileSize * 0.15,
    },
  ]}
>
```

And close with `</TouchableOpacity>` instead of `</View>`.

- [ ] **Step 4: Remove all floating action buttons, add checkbox**

Delete the entire `{/* Edit buttons - 3 buttons: emoji, symbol, delete */}` block (lines 151-183), the `{/* Unmerge button */}` block (lines 185-195).

Also delete the merge button between tiles (lines 198-208) and replace so the spacer is always plain:

```typescript
{/* Spacer between tiles */}
{displayIndex < wordsToRender.length - 1 && (
  <View style={styles.spacer} />
)}
```

Then, add a checkbox inside the tile, after the text area. The checkbox is shown only when `editMode` is true. Position it at top-right (top-left for RTL):

```typescript
{/* Checkbox in edit mode */}
{editMode && (
  <View
    style={[
      styles.checkboxContainer,
      isTextRTL ? styles.checkboxLeft : styles.checkboxRight,
    ]}
  >
    <View
      style={[
        styles.checkbox,
        selectedIndices?.has(index) && styles.checkboxChecked,
      ]}
    >
      {selectedIndices?.has(index) && (
        <Icon name="checkmark" size={14} color="#FFF" />
      )}
    </View>
  </View>
)}
```

- [ ] **Step 5: Add checkbox styles**

Add to the `StyleSheet.create` at the bottom of the file:

```typescript
checkboxContainer: {
  position: 'absolute',
  top: 4,
},
checkboxRight: {
  right: 4,
},
checkboxLeft: {
  left: 4,
},
checkbox: {
  width: 22,
  height: 22,
  borderRadius: 11,
  borderWidth: 2,
  borderColor: '#007AFF',
  backgroundColor: 'rgba(255,255,255,0.85)',
  justifyContent: 'center',
  alignItems: 'center',
},
checkboxChecked: {
  backgroundColor: '#007AFF',
  borderColor: '#007AFF',
},
```

- [ ] **Step 6: Remove unused styles**

Delete these style entries from `StyleSheet.create` as they are no longer used:
- `editButtonsContainer`
- `editButton`
- `unmergeButtonContainer`
- `mergeButton`

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/i022021/dev/Issie/IssieAlbom
npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only in `PageEditorScreen.tsx` (old props still passed there — fixed in next task). No new errors in `TilesElement.tsx`.

- [ ] **Step 8: Commit**

```bash
git add src/components/TilesElement.tsx
git commit -m "feat(tiles): replace action buttons with selection checkboxes"
```

---

## Task 3: Add selection state to PageEditorScreen

**Files:**
- Modify: `src/screens/PageEditorScreen.tsx`

- [ ] **Step 1: Add selectedTileIndices state and ref**

After the existing tiles state block (around line 248, after `const [selectedTileIndex, ...]`), add:

```typescript
const [selectedTileIndices, setSelectedTileIndices] = useState<Set<number>>(new Set());
const selectedTileIndicesRef = useRef<Set<number>>(new Set());
```

- [ ] **Step 2: Sync selectedTileIndices ref**

Find the block of `useEffect` hooks that sync state to refs (they follow the pattern `useEffect(() => { someRef.current = someState; }, [someState])`). Add:

```typescript
useEffect(() => {
  selectedTileIndicesRef.current = selectedTileIndices;
}, [selectedTileIndices]);
```

- [ ] **Step 3: Clear selection everywhere setTilesSelected(false) is called**

There are two places where `setTilesSelected(false)` is called (lines 1248 and 1316). At each location, add `setSelectedTileIndices(new Set());` immediately after:

```typescript
setTilesSelected(false);
setSelectedTileIndices(new Set());
```

- [ ] **Step 4: Also clear selection in handleEditTiles when deselecting**

In `handleEditTiles` (line 1361), when tiles exist and we call `setTilesSelected(true)`, that's fine. But when leaving tiles (the two spots above), clear selection. Double-check all paths where `setTilesSelected(false)` is called and confirm the clear is applied to all of them.

Search: `grep -n "setTilesSelected(false)" src/screens/PageEditorScreen.tsx`

- [ ] **Step 5: Clear selection on canvas background click**

In `handleCanvasClick` (line 1174), the function is called on any canvas tap. When a tap lands on background (no `elem` and current mode is not text/image), clear tile selection. Add after the existing text save block:

```typescript
// Clear tile selection on background tap
if (!elem || elem.type === 'tiles') {
  // 'tiles' type taps are handled by onTilePress, but background taps should deselect
  if (!elem) {
    setSelectedTileIndices(new Set());
  }
}
```

- [ ] **Step 6: Add handleTilePress handler**

Add this handler after `handleDeleteSymbol`:

```typescript
const handleTilePress = (index: number) => {
  setSelectedTileIndices(prev => {
    const next = new Set(prev);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    return next;
  });
};
```

- [ ] **Step 7: Update handleRenderElements to use new TilesElement props**

Replace the `<TilesElement>` call in `handleRenderElements` (lines 3049-3063):

```typescript
const handleRenderElements = (elem: SketchElement) => {
  if (elem.type === 'tiles') {
    const tilesElem = elem as unknown as SketchTiles;
    return (
      <TilesElement
        tiles={tilesElem}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        ratio={ratio}
        editMode={true}
        selectedIndices={selectedTileIndicesRef.current}
        onTilePress={handleTilePress}
        highlightedWordIndex={undefined}
        albumId={albumId}
        themeColor={colors.primary}
      />
    );
  }
  return null;
};
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd /Users/i022021/dev/Issie/IssieAlbom
npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only related to old handler props (onMergeTile etc.) no longer existing — confirm `TilesElement` call compiles cleanly.

- [ ] **Step 9: Commit**

```bash
git add src/screens/PageEditorScreen.tsx
git commit -m "feat(tiles): add selectedTileIndices state and wire to TilesElement"
```

---

## Task 4: Rewrite handleMergeTile and handleUnmergeTile

**Files:**
- Modify: `src/screens/PageEditorScreen.tsx`

The old `handleMergeTile(index)` merges tile at index with next. New version merges all selected tiles.
The old `handleUnmergeTile(index)` unmerges at a specific index. New version unmerges the single selected tile.

Both need audio timing regeneration (extracted as a helper).

- [ ] **Step 1: Add audio timing regeneration helper**

Add this helper function before the merge/unmerge handlers. It extracts the logic already present in `handleTilesConfirm`:

```typescript
const regenerateAudioTimings = (newTileWords: TileWord[]) => {
  if (!pageAudioFile || pageAudioWordTimings.length === 0) return;

  const queueElements = queue.current.getAll();
  let durationMs: number | undefined;
  for (let i = queueElements.length - 1; i >= 0; i--) {
    const qe = queueElements[i];
    if ((qe.type === 'audio' || qe.type === 'audioAdd') &&
      qe.elem?.id === PAGE_AUDIO_ID &&
      qe.elem?.duration) {
      durationMs = qe.elem.duration;
      break;
    }
  }
  if (!durationMs && pageAudioDurationRef.current) {
    durationMs = pageAudioDurationRef.current * 1000;
  }
  if (!durationMs) durationMs = 10000;

  const audioDuration = durationMs / 1000;
  const words = newTileWords.map(w => w.text);
  const newWordTimings = generateInitialWordTimings(words, audioDuration);

  const updatedAudio: SketchAudio = {
    id: PAGE_AUDIO_ID,
    audioPath: pageAudioFile,
    x: 0,
    y: 0,
    duration: durationMs,
    wordTimings: newWordTimings,
  };
  queue.current.pushAudio(updatedAudio);
};
```

- [ ] **Step 2: Rewrite handleMergeTile**

Replace the existing `handleMergeTile` function entirely:

```typescript
const handleMergeTile = () => {
  if (!tiles) return;
  const selected = Array.from(selectedTileIndicesRef.current).sort((a, b) => a - b);
  if (selected.length < 2) return;

  // Build merged tile from all selected tiles in order
  const selectedTiles = selected.map(i => tiles.words[i]);
  const mergedText = selectedTiles.map(t => t.text).join(' ');
  const mergedIndices = selectedTiles.flatMap(t => t.originalIndices);
  const firstTile = selectedTiles[0];

  const mergedWord: TileWord = {
    text: mergedText,
    originalIndices: mergedIndices,
    symbol: firstTile.symbol,
    symbolType: firstTile.symbolType,
    backgroundColor: firstTile.backgroundColor,
    textColor: firstTile.textColor,
  };

  // Insert merged tile at position of lowest-index selected tile, remove all others
  const selectedSet = new Set(selected);
  const newWords: TileWord[] = [];
  let mergedInserted = false;
  tiles.words.forEach((word, i) => {
    if (!selectedSet.has(i)) {
      newWords.push(word);
    } else if (!mergedInserted) {
      newWords.push(mergedWord);
      mergedInserted = true;
    }
    // Other selected tiles are dropped
  });

  const numTiles = newWords.length;
  const calculatedTileSize = pageWidth / (1.5 * numTiles + 0.5);
  const maxTileSize = pageHeight * MAX_TILE_SIZE_RATIO;
  const approxTileSize = Math.min(calculatedTileSize, maxTileSize);

  const updatedTiles: SketchTiles = {
    ...tiles,
    words: newWords,
    y: pageHeight - approxTileSize * 1.5,
  };

  queue.current.pushTiles(updatedTiles);
  regenerateAudioTimings(newWords);
  rebuildStateFromQueue();
  autoSave();
};
```

- [ ] **Step 3: Rewrite handleUnmergeTile**

Replace the existing `handleUnmergeTile` function entirely:

```typescript
const handleUnmergeTile = () => {
  if (!tiles) return;
  const selected = Array.from(selectedTileIndicesRef.current);
  if (selected.length !== 1) return;
  const index = selected[0];
  if (tiles.words[index].originalIndices.length <= 1) return;

  const tileToUnmerge = tiles.words[index];
  const words = tileToUnmerge.text.split(/\s+/);

  const newTiles: TileWord[] = words.map((word, i) => ({
    text: word,
    originalIndices: [tileToUnmerge.originalIndices[i]],
  }));

  const newWords = [...tiles.words];
  newWords.splice(index, 1, ...newTiles);

  const numTiles = newWords.length;
  const calculatedTileSize = pageWidth / (1.5 * numTiles + 0.5);
  const maxTileSize = pageHeight * MAX_TILE_SIZE_RATIO;
  const approxTileSize = Math.min(calculatedTileSize, maxTileSize);

  const updatedTiles: SketchTiles = {
    ...tiles,
    words: newWords,
    y: pageHeight - approxTileSize * 1.5,
  };

  queue.current.pushTiles(updatedTiles);
  regenerateAudioTimings(newWords);
  rebuildStateFromQueue();
  autoSave();
};
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/i022021/dev/Issie/IssieAlbom
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/screens/PageEditorScreen.tsx
git commit -m "feat(tiles): rewrite merge/unmerge to use selectedTileIndices with audio regen"
```

---

## Task 5: Update per-tile action handlers to use selectedTileIndices

**Files:**
- Modify: `src/screens/PageEditorScreen.tsx`

The old `handleAddEmoji(index)`, `handleAddSymbol(index)`, `handleDeleteSymbol(index)` received an index from the on-tile button. Now they are called from the toolbar with no index argument — they derive the index from `selectedTileIndices`.

- [ ] **Step 1: Rewrite handleAddEmoji**

Replace existing `handleAddEmoji`:

```typescript
const handleAddEmoji = () => {
  if (!tiles) return;
  const selected = Array.from(selectedTileIndicesRef.current);
  if (selected.length !== 1) return;
  setSelectedTileIndex(selected[0]);
  setShowEmojiKeyboard(true);
};
```

- [ ] **Step 2: Rewrite handleAddSymbol**

Replace existing `handleAddSymbol`:

```typescript
const handleAddSymbol = () => {
  if (!tiles) return;
  const selected = Array.from(selectedTileIndicesRef.current);
  if (selected.length !== 1) return;
  setSelectedTileIndex(selected[0]);
  setShowSearchSymbolModal(true);
};
```

- [ ] **Step 3: Rewrite handleDeleteSymbol**

Replace existing `handleDeleteSymbol`:

```typescript
const handleDeleteSymbol = () => {
  if (!tiles) return;
  const selected = Array.from(selectedTileIndicesRef.current);
  if (selected.length !== 1) return;
  const index = selected[0];

  const newWords = [...tiles.words];
  newWords[index] = {
    ...newWords[index],
    symbol: undefined,
    symbolType: undefined,
  };

  const updatedTiles: SketchTiles = { ...tiles, words: newWords };
  queue.current.pushTiles(updatedTiles);
  rebuildStateFromQueue();
  autoSave();
};
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/i022021/dev/Issie/IssieAlbom
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add src/screens/PageEditorScreen.tsx
git commit -m "feat(tiles): update emoji/symbol handlers to derive index from selectedTileIndices"
```

---

## Task 6: Add per-tile color handlers

**Files:**
- Modify: `src/screens/PageEditorScreen.tsx`

- [ ] **Step 1: Add handleTilesBgColorChange**

Add this handler after `handleDeleteSymbol`:

```typescript
const handleTilesBgColorChange = (color: string) => {
  setTilesBgColor(color);
  if (!tiles) return;
  const selected = selectedTileIndicesRef.current;
  if (selected.size === 0) return;

  const newWords = tiles.words.map((word, i) =>
    selected.has(i) ? { ...word, backgroundColor: color } : word
  );
  const updatedTiles: SketchTiles = { ...tiles, words: newWords };
  queue.current.pushTiles(updatedTiles);
  rebuildStateFromQueue();
  autoSave();
};
```

- [ ] **Step 2: Add handleTilesTextColorChange**

```typescript
const handleTilesTextColorChange = (color: string) => {
  setTilesTextColor(color);
  if (!tiles) return;
  const selected = selectedTileIndicesRef.current;
  if (selected.size === 0) return;

  const newWords = tiles.words.map((word, i) =>
    selected.has(i) ? { ...word, textColor: color } : word
  );
  const updatedTiles: SketchTiles = { ...tiles, words: newWords };
  queue.current.pushTiles(updatedTiles);
  rebuildStateFromQueue();
  autoSave();
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/i022021/dev/Issie/IssieAlbom
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/screens/PageEditorScreen.tsx
git commit -m "feat(tiles): add per-tile bg and text color handlers"
```

---

## Task 7: Rewrite tiles toolbar UI

**Files:**
- Modify: `src/screens/PageEditorScreen.tsx`

This is the biggest visual change. Replace the existing tiles subtoolbar section (roughly lines 3500-3665 inside the `tilesSelected` block) with the new layout.

- [ ] **Step 1: Derive toolbar enablement variables**

Add these computed values just before the `return` statement (or in the toolbar render area, using `useMemo` or inline):

```typescript
const numSelected = selectedTileIndices.size;
const allSelected = tiles ? selectedTileIndices.size === tiles.words.length : false;
const canMerge = numSelected >= 2;
const canUnmerge = numSelected === 1 &&
  tiles != null &&
  tiles.words[Array.from(selectedTileIndices)[0]]?.originalIndices.length > 1;
const canSingleAction = numSelected === 1;
const selectedHasSymbol = canSingleAction && tiles != null &&
  !!tiles.words[Array.from(selectedTileIndices)[0]]?.symbol;
```

- [ ] **Step 2: Replace the tiles toolbar section**

Find the tiles subtoolbar block starting with the `<TouchableOpacity>` for the tiles button (around line 3500) and the color/size pickers below it. Replace the entire tiles-specific section that shows when `tilesSelected` with:

```tsx
{/* Tiles mode toolbar */}
{!audioMode && currentElementType === ElementTypes.Text && tilesSelected && tiles && (
  <>
    {/* Action buttons row */}
    <View style={styles.optionsSection}>
      {/* Select All / Deselect All */}
      <TouchableOpacity
        style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }]}
        onPress={() => {
          if (allSelected) {
            setSelectedTileIndices(new Set());
          } else {
            setSelectedTileIndices(new Set(tiles.words.map((_, i) => i)));
          }
        }}
      >
        <MyIcon info={{ name: allSelected ? "checkbox-multiple-marked" : "checkbox-multiple-blank-outline", size: 24, color: '#007AFF', type: "MDI" }} />
        <Text style={[styles.optionLabel, { color: '#007AFF' }]}>
          {allSelected ? t('editor.deselectAll') : t('editor.selectAll')}
        </Text>
      </TouchableOpacity>

      {/* Merge */}
      <TouchableOpacity
        style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }, !canMerge && styles.optionButtonDisabled]}
        onPress={canMerge ? handleMergeTile : undefined}
        disabled={!canMerge}
      >
        <MyIcon info={{ name: "merge", size: 24, color: canMerge ? '#007AFF' : '#ccc', type: "MDI" }} />
        <Text style={[styles.optionLabel, !canMerge && styles.optionLabelDisabled]}>{t('editor.merge')}</Text>
      </TouchableOpacity>

      {/* Unmerge */}
      <TouchableOpacity
        style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }, !canUnmerge && styles.optionButtonDisabled]}
        onPress={canUnmerge ? handleUnmergeTile : undefined}
        disabled={!canUnmerge}
      >
        <MyIcon info={{ name: "call-split", size: 24, color: canUnmerge ? '#007AFF' : '#ccc', type: "MDI" }} />
        <Text style={[styles.optionLabel, !canUnmerge && styles.optionLabelDisabled]}>{t('editor.unmerge')}</Text>
      </TouchableOpacity>

      {/* Add Emoji */}
      <TouchableOpacity
        style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }, !canSingleAction && styles.optionButtonDisabled]}
        onPress={canSingleAction ? handleAddEmoji : undefined}
        disabled={!canSingleAction}
      >
        <MyIcon info={{ name: "emoticon-outline", size: 24, color: canSingleAction ? '#007AFF' : '#ccc', type: "MDI" }} />
        <Text style={[styles.optionLabel, !canSingleAction && styles.optionLabelDisabled]}>{t('editor.addEmoji')}</Text>
      </TouchableOpacity>

      {/* Add Symbol */}
      <TouchableOpacity
        style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }, !canSingleAction && styles.optionButtonDisabled]}
        onPress={canSingleAction ? handleAddSymbol : undefined}
        disabled={!canSingleAction}
      >
        <MyIcon info={{ name: "image-search-outline", size: 24, color: canSingleAction ? '#007AFF' : '#ccc', type: "MDI" }} />
        <Text style={[styles.optionLabel, !canSingleAction && styles.optionLabelDisabled]}>{t('editor.addSymbol')}</Text>
      </TouchableOpacity>

      {/* Delete Symbol */}
      <TouchableOpacity
        style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }, !selectedHasSymbol && styles.optionButtonDisabled]}
        onPress={selectedHasSymbol ? handleDeleteSymbol : undefined}
        disabled={!selectedHasSymbol}
      >
        <MyIcon info={{ name: "image-remove", size: 24, color: selectedHasSymbol ? '#F44336' : '#ccc', type: "MDI" }} />
        <Text style={[styles.optionLabel, !selectedHasSymbol && { color: '#ccc' }]}>{t('editor.deleteSymbol')}</Text>
      </TouchableOpacity>

      {/* Edit Text */}
      <TouchableOpacity
        style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }]}
        onPress={handleEditTilesText}
      >
        <MyIcon info={{ name: "pencil", size: 24, color: '#007AFF', type: "MDI" }} />
        <Text style={[styles.optionLabel, { color: '#007AFF' }]}>{t('editor.editText')}</Text>
      </TouchableOpacity>

      {/* Delete Tiles */}
      <TouchableOpacity
        style={[styles.optionButton, { flexDirection: 'row', justifyContent: 'flex-start' }]}
        onPress={handleDeleteTiles}
      >
        <MyIcon info={{ name: "delete", size: 24, color: '#FF5722', type: "MDI" }} />
        <Text style={[styles.optionLabel, { color: '#FF5722' }]}>{t('editor.deleteTiles')}</Text>
      </TouchableOpacity>
    </View>

    {/* BG Color picker — applies to selected tiles */}
    <View style={[styles.optionsSection, { marginTop: 8 }]}>
      <Text style={styles.sectionLabel}>{t('editor.tilesBackgroundColor')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.colorGrid}>
          {TILES_BG_COLORS.map(color => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorSwatch,
                { backgroundColor: color },
                tilesBgColor === color && styles.colorSwatchActive,
                numSelected === 0 && styles.colorSwatchDisabled,
              ]}
              onPress={numSelected > 0 ? () => handleTilesBgColorChange(color) : undefined}
              disabled={numSelected === 0}
            />
          ))}
        </View>
      </ScrollView>
    </View>

    {/* Text Color picker — applies to selected tiles */}
    <View style={[styles.optionsSection, { marginTop: 8 }]}>
      <Text style={styles.sectionLabel}>{t('editor.tilesTextColor')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.colorGrid}>
          {TILES_TEXT_COLORS.map(color => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorSwatch,
                { backgroundColor: color },
                tilesTextColor === color && styles.colorSwatchActive,
                numSelected === 0 && styles.colorSwatchDisabled,
              ]}
              onPress={numSelected > 0 ? () => handleTilesTextColorChange(color) : undefined}
              disabled={numSelected === 0}
            />
          ))}
        </View>
      </ScrollView>
    </View>

    {/* Size picker — applies to all tiles */}
    <View style={[styles.optionsSection, { marginTop: 8 }]}>
      <Text style={styles.sectionLabel}>{t('editor.size')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.sizeGrid}>
          {TILES_SIZES.map(s => (
            <TouchableOpacity
              key={s.label}
              style={[styles.sizeButton, tilesSize === s.value && styles.sizeButtonActive]}
              onPress={() => {
                setTilesSize(s.value);
                if (tiles) {
                  const updatedTiles: SketchTiles = { ...tiles, fontSize: s.value };
                  queue.current.pushTiles(updatedTiles);
                  rebuildStateFromQueue();
                  autoSave();
                }
              }}
            >
              <Text style={[styles.sizeText, tilesSize === s.value && styles.sizeTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  </>
)}
```

Also keep the top-level tiles button in the text mode toolbar (the `view-grid` button that toggles `tilesSelected`) — don't remove that.

Remove the old `{tiles && tilesSelected && ...}` Edit Text button, `{tiles && ...}` Delete Tiles button, and old color/size pickers for tiles since they're now inside the new block above.

- [ ] **Step 3: Add missing i18n keys**

In the translations files, add the following keys if not already present. Check `src/i18n/` for the translation files:

```bash
grep -rn "selectAll\|deselectAll\|editor.merge\|editor.unmerge\|editor.addEmoji\|editor.addSymbol\|editor.deleteSymbol\|editor.editText\|editor.deleteTiles" src/i18n/
```

Add any missing keys to all locale files (typically `en.json`, `he.json` etc.):
- `editor.selectAll` → "Select All" / "בחר הכל"
- `editor.deselectAll` → "Deselect All" / "בטל בחירה"
- `editor.merge` → "Merge" / "מיזוג"
- `editor.unmerge` → "Unmerge" / "פיצול"
- `editor.addEmoji` → "Add Emoji" / "הוסף אמוג'י"
- `editor.addSymbol` → "Add Symbol" / "הוסף סמל"
- `editor.deleteSymbol` → "Delete Symbol" / "מחק סמל"
- `editor.editText` → "Edit Text" / "ערוך טקסט"
- `editor.deleteTiles` → "Delete Tiles" / "מחק קלפים"

- [ ] **Step 4: Add optionButtonDisabled and optionLabelDisabled styles**

Check if these styles already exist: `grep -n "optionButtonDisabled\|optionLabelDisabled" src/screens/PageEditorScreen.tsx`

If not, add to `StyleSheet.create`:

```typescript
optionButtonDisabled: {
  opacity: 0.35,
},
optionLabelDisabled: {
  color: '#ccc',
},
colorSwatchDisabled: {
  opacity: 0.35,
},
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/i022021/dev/Issie/IssieAlbom
npx tsc --noEmit 2>&1 | head -30
```

Expected: clean or pre-existing errors only.

- [ ] **Step 6: Commit**

```bash
git add src/screens/PageEditorScreen.tsx src/i18n/
git commit -m "feat(tiles): rewrite toolbar with multi-select action buttons"
```

---

## Task 8: Cleanup — remove old selectedTileIndex state

**Files:**
- Modify: `src/screens/PageEditorScreen.tsx`

`selectedTileIndex` (singular) was used to pass the tile index into the emoji/symbol flow before we had toolbar buttons. It's still used in `handleSymbolSelect` and `handleSymbolSelectFromWeb` — those receive a callback result and need to know which tile to update. Keep `selectedTileIndex` for those two use cases (they set it from the new `handleAddEmoji`/`handleAddSymbol` which reads from `selectedTileIndices`). No removal needed — it's still valid as the "pending tile for symbol pick" state.

- [ ] **Step 1: Verify selectedTileIndex is only used for symbol/emoji pick flow**

```bash
grep -n "selectedTileIndex" src/screens/PageEditorScreen.tsx
```

Confirm usages are only:
- `setSelectedTileIndex(selected[0])` in `handleAddEmoji` and `handleAddSymbol`
- `if (!tiles || selectedTileIndex === null) return;` in `handleSymbolSelect` and `handleSymbolSelectFromWeb`
- `newWords[selectedTileIndex]` in those same handlers
- `setSelectedTileIndex(null)` at end of those handlers
- `initialKeyword={...tiles.words[selectedTileIndex].text}` in the SearchSymbolModal props

If any other usage remains referencing the old pattern (passing `index` from TilesElement callbacks), remove it.

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
cd /Users/i022021/dev/Issie/IssieAlbom
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/PageEditorScreen.tsx
git commit -m "chore(tiles): verify selectedTileIndex only used for symbol pick flow"
```

---

## Task 9: Manual smoke test

No automated tests exist for UI components in this project. Manual testing checklist:

- [ ] **Tiles edit mode shows checkboxes, no floating buttons**
  - Open editor, add tiles, enter tiles edit mode
  - Verify: each tile has a small checkbox top-right (top-left for RTL), no emoji/symbol/merge buttons visible

- [ ] **Tile tap toggles checkbox**
  - Tap a tile → checkbox fills blue
  - Tap again → checkbox clears

- [ ] **Select All / Deselect All works**
  - Press "Select All" → all checkboxes filled
  - Press "Deselect All" (button label changes) → all cleared

- [ ] **Merge: select 2+ tiles, tap Merge**
  - Select tiles 1 and 3 → tap Merge → one tile with combined text
  - Verify tile count decreases

- [ ] **Unmerge: select 1 merged tile, tap Unmerge**
  - Tap merged tile → tap Unmerge → splits back to original words

- [ ] **Add Emoji: single tile selected**
  - Select 1 tile → tap Add Emoji → emoji keyboard opens → select emoji → tile shows emoji

- [ ] **Add Symbol: single tile selected**
  - Select 1 tile → tap Add Symbol → symbol search opens → select symbol → tile shows symbol image

- [ ] **Delete Symbol: single tile with symbol selected**
  - Tap tile with symbol → tap Delete Symbol → symbol removed from tile

- [ ] **BG Color: select tiles, pick color**
  - Select 2 tiles → tap a BG color → only those 2 tiles change color
  - Other tiles retain original color

- [ ] **Text Color: select tiles, pick text color**
  - Select 1 tile → pick text color → only that tile's text color changes

- [ ] **Size: changes all tiles regardless of selection**
  - Pick size M then XL → all tiles resize

- [ ] **Selection clears on toolbar switch**
  - Select tiles → tap another toolbar section (e.g., sketch) → come back to tiles → selection is cleared

- [ ] **Selection clears on canvas background tap**
  - Select tiles → tap blank canvas area → selection cleared

- [ ] **Audio word timings regenerated after merge/unmerge**
  - Add page audio → create tiles → merge two tiles → verify audio playback still highlights words (approximate, timing may shift)

- [ ] **RTL text: checkbox on left**
  - Create tiles with Hebrew text → verify checkbox appears top-left

- [ ] **Final commit**

```bash
git add .
git commit -m "test(tiles): manual smoke test complete"
```
