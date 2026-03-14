import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SketchTiles, TileWord } from '../types/Album';
import { AttachmentService } from '../services/AttachmentService';
import Icon from '@react-native-vector-icons/ionicons';

const MAX_TILE_SIZE_RATIO = 0.35; // Max tile size as percentage of page height (must match PageEditorScreen)

interface TilesElementProps {
  tiles: SketchTiles;
  canvasWidth: number;
  canvasHeight: number;
  ratio: number;
  editMode?: boolean;
  onMergeTile?: (index: number) => void; // Merge tile at index with next tile
  onUnmergeTile?: (index: number) => void; // Unmerge tile at index
  highlightedWordIndex?: number; // For audio playback highlighting
  onAddEmoji?: (index: number) => void; // Add/edit emoji for tile at index
  onAddSymbol?: (index: number) => void; // Add/edit symbol for tile at index
  onDeleteSymbol?: (index: number) => void; // Delete symbol for tile at index
  albumId: string; // For constructing image paths
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
  onAddEmoji,
  onAddSymbol,
  onDeleteSymbol,
  albumId,
}: TilesElementProps) {
  const yPosition = tiles.y * ratio;
  const numTiles = tiles.words.length;

  // Calculate tile size to fill width with proper spacing:
  // Width = half-tile + tiles with half-tile gaps between + half-tile
  // Width = 0.5*size + numTiles*size + (numTiles-1)*0.5*size + 0.5*size
  // Width = size * (0.5 + numTiles + 0.5*numTiles - 0.5 + 0.5)
  // Width = size * (numTiles + 0.5*numTiles + 0.5)
  // Width = size * (1.5*numTiles + 0.5)
  // But cap at MAX_TILE_SIZE_RATIO of canvas height
  // Note: canvasHeight is already scaled by ratio, so maxTileSize will also be in scaled coordinates
  const calculatedTileSize = canvasWidth / (1.5 * numTiles + 0.5);
  const maxTileSize = canvasHeight * MAX_TILE_SIZE_RATIO;
  const tileSize = Math.min(calculatedTileSize, maxTileSize);
  const halfTileSpacing = tileSize * 0.5;

  // Debug logging
  if (__DEV__) {
    console.log('[TilesElement] Tile size calculation:', {
      numTiles,
      canvasWidth,
      canvasHeight,
      ratio,
      calculatedTileSize,
      maxTileSize,
      finalTileSize: tileSize,
      percentageOfHeight: ((tileSize / canvasHeight) * 100).toFixed(1) + '%',
    });
  }

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
          justifyContent: numTiles === 1 ? 'center' : 'flex-start', // Center single tile, left-align multiple
          alignItems: 'center',
          paddingHorizontal: numTiles === 1 ? 0 : halfTileSpacing, // No padding for single centered tile
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
              {/* Symbol in top 1/3, size = 2/5 of square */}
              {word.symbol && (
                <View style={styles.symbolArea}>
                  {word.symbolType === 'image' ? (
                    <Image
                      source={{ uri: `file://${AttachmentService.getAbsolutePath(albumId, word.symbol)}` }}
                      style={[styles.symbolImage, { width: tileSize * 0.4, height: tileSize * 0.4 }]}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={[styles.symbolText, { fontSize: tileSize * 0.4 }]}>
                      {word.symbol}
                    </Text>
                  )}
                </View>
              )}

              {/* Text - centered if no symbol, bottom 1/3 if symbol exists */}
              <View style={word.symbol ? styles.textArea : styles.textAreaCentered}>
                <Text
                  style={[
                    styles.tileText,
                    {
                      color: tiles.textColor,
                      fontSize: Math.max(tileSize * tiles.fontSize, 18),
                      textAlign: 'center',
                    },
                  ]}
                  numberOfLines={word.symbol ? 2 : 3}
                  adjustsFontSizeToFit
                >
                  {word.text}
                </Text>
              </View>

              {/* Edit buttons - 3 buttons: emoji, symbol, delete */}
              {editMode && (
                <View style={styles.editButtonsContainer}>
                  {/* Emoji button */}
                  {onAddEmoji && (
                    <TouchableOpacity
                      style={[styles.editButton, { backgroundColor: '#4CAF50' }]}
                      onPress={() => onAddEmoji(index)}
                    >
                      <Icon name="happy-outline" size={28} color="#FFF" />
                    </TouchableOpacity>
                  )}

                  {/* Symbol button */}
                  {onAddSymbol && (
                    <TouchableOpacity
                      style={[styles.editButton, { backgroundColor: '#2196F3' }]}
                      onPress={() => onAddSymbol(index)}
                    >
                      <Icon name="image-outline" size={28} color="#FFF" />
                    </TouchableOpacity>
                  )}

                  {/* Delete symbol button (only if symbol exists) */}
                  {word.symbol && onDeleteSymbol && (
                    <TouchableOpacity
                      style={[styles.editButton, { backgroundColor: '#F44336' }]}
                      onPress={() => onDeleteSymbol(index)}
                    >
                      <Icon name="trash-outline" size={28} color="#FFF" />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Unmerge button in edit mode (on tile) */}
              {editMode && canUnmerge && onUnmergeTile && (
                <View style={styles.unmergeButtonContainer}>
                  <TouchableOpacity
                    style={[styles.mergeButton, { backgroundColor: '#FF5722' }]}
                    onPress={() => onUnmergeTile(index)}
                  >
                    <Icon name="cut" size={28} color="#FFF" />
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
    justifyContent: 'flex-start',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    padding: 8,
  },
  symbolArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  textArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  textAreaCentered: {
    flex: 3,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  tileText: {
    fontWeight: 'bold',
  },
  symbolText: {
    lineHeight: undefined, // Let emoji render naturally
  },
  symbolImage: {
    // Size is set dynamically based on tileSize
  },
  editButtonsContainer: {
    position: 'absolute',
    top: -16,
    left: -16,
    flexDirection: 'row',
    gap: 6,
  },
  editButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  unmergeButtonContainer: {
    position: 'absolute',
    top: -16,
    right: -16,
    flexDirection: 'row',
    gap: 6,
  },
  mergeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
