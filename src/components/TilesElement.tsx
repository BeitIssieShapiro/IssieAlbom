import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SketchTiles, TileWord } from '../types/Album';
import Icon from '@react-native-vector-icons/ionicons';

interface TilesElementProps {
  tiles: SketchTiles;
  canvasWidth: number;
  canvasHeight: number;
  ratio: number;
  editMode?: boolean;
  onMergeTile?: (index: number) => void; // Merge tile at index with next tile
  onUnmergeTile?: (index: number) => void; // Unmerge tile at index
  highlightedWordIndex?: number; // For audio playback highlighting
  onEditSymbol?: (index: number) => void; // Edit symbol for tile at index
}

export function TilesElement({
  tiles,
  canvasWidth,
  canvasHeight,
  ratio,
  editMode = false,
  onMergeTile,
  onUnmergeTile,
  highlightedWordIndex,
  onEditSymbol,
}: TilesElementProps) {
  const yPosition = tiles.y * ratio;
  const numTiles = tiles.words.length;

  // Calculate tile size to fill width with proper spacing:
  // Width = half-tile + tiles with half-tile gaps between + half-tile
  // Width = 0.5*size + numTiles*size + (numTiles-1)*0.5*size + 0.5*size
  // Width = size * (0.5 + numTiles + 0.5*numTiles - 0.5 + 0.5)
  // Width = size * (numTiles + 0.5*numTiles + 0.5)
  // Width = size * (1.5*numTiles + 0.5)
  const tileSize = canvasWidth / (1.5 * numTiles + 0.5);
  const halfTileSpacing = tileSize * 0.5;

  // Detect text direction from the actual text (check first word's first character)
  const isTextRTL = tiles.words.length > 0 && tiles.words[0].text.length > 0
    ? /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(tiles.words[0].text[0])
    : false;

  // For RTL text, reverse the array to show words in correct order (right to left)
  const wordsToRender = isTextRTL ? [...tiles.words].reverse() : tiles.words;

  return (
    <View
      style={[
        styles.container,
        {
          flexDirection: 'row',
          justifyContent: 'flex-start',
          alignItems: 'center',
          paddingHorizontal: halfTileSpacing,
          width: canvasWidth,
        },
      ]}
    >
      {wordsToRender.map((word, displayIndex) => {
        // For RTL, calculate original index from reversed position
        const index = isTextRTL ? tiles.words.length - 1 - displayIndex : displayIndex;
        const isHighlighted = highlightedWordIndex !== undefined &&
          word.originalIndices.includes(highlightedWordIndex);
        const canMerge = index < tiles.words.length - 1;
        const canUnmerge = word.originalIndices.length > 1;

        return (
          <React.Fragment key={displayIndex}>
            {/* Tile */}
            <View
              style={[
                styles.tile,
                {
                  backgroundColor: isHighlighted
                    ? '#FFD700' // Gold when highlighted
                    : tiles.backgroundColor,
                  width: tileSize,
                  height: tileSize,
                  borderRadius: tileSize * 0.15, // Rounded corners proportional to size
                },
              ]}
            >
              {/* Symbol above text */}
              {word.symbol && (
                <View style={styles.symbolContainer}>
                  <Text style={[styles.symbolText, { fontSize: tiles.fontSize * ratio * 1.2 }]}>
                    {word.symbol}
                  </Text>
                  {editMode && onEditSymbol && (
                    <TouchableOpacity
                      style={styles.editSymbolButton}
                      onPress={() => onEditSymbol(index)}
                    >
                      <Icon name="pencil" size={12} color="#666" />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* No symbol - show edit button if in edit mode */}
              {!word.symbol && editMode && onEditSymbol && (
                <TouchableOpacity
                  style={styles.addSymbolButton}
                  onPress={() => onEditSymbol(index)}
                >
                  <Icon name="add-circle-outline" size={16} color="#999" />
                </TouchableOpacity>
              )}

              <Text
                style={[
                  styles.tileText,
                  {
                    color: tiles.textColor,
                    fontSize: tiles.fontSize * ratio,
                    textAlign: 'center',
                  },
                ]}
                numberOfLines={2}
                adjustsFontSizeToFit
              >
                {word.text}
              </Text>

              {/* Unmerge button in edit mode (on tile) */}
              {editMode && canUnmerge && onUnmergeTile && (
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={[styles.mergeButton, { backgroundColor: '#FF5722' }]}
                    onPress={() => onUnmergeTile(index)}
                  >
                    <Icon name="cut" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Merge button between tiles (in the gap) */}
            {editMode && canMerge && onMergeTile && (
              <View style={styles.spacer}>
                <TouchableOpacity
                  style={[styles.mergeButton, { backgroundColor: '#4CAF50' }]}
                  onPress={() => onMergeTile(index)}
                >
                  <Icon name="add" size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}

            {/* Regular spacer when no merge button needed */}
            {(!editMode || !canMerge) && displayIndex < wordsToRender.length - 1 && (
              <View style={styles.spacer} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tile: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    padding: 8,
  },
  tileText: {
    fontWeight: 'bold',
  },
  symbolContainer: {
    position: 'absolute',
    top: 4,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  symbolText: {
    lineHeight: undefined, // Let emoji render naturally
  },
  editSymbolButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
    padding: 2,
  },
  addSymbolButton: {
    position: 'absolute',
    top: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
    padding: 2,
  },
  buttonContainer: {
    position: 'absolute',
    top: -12,
    right: -12,
    flexDirection: 'row',
    gap: 4,
  },
  mergeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  spacer: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1, // Takes up the gap space
  },
});
