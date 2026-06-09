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
  selectedIndices?: Set<number>;
  onTilePress?: (index: number) => void;
  onTilePressViewMode?: (originalIndices: number[]) => void;
  onTileLongPressViewMode?: (tileIndex: number) => void;
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
  onTilePressViewMode,
  onTileLongPressViewMode,
  highlightedWordIndex,
  albumId,
  themeColor = '#4CAF50',
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
  const autoTileSize = Math.min(calculatedTileSize, maxTileSize);
  // Apply user size multiplier (default 1), still cap at maxTileSize and floor at small minimum
  const sizeMultiplier = tiles.size ?? 1;
  const tileSize = Math.max(20, Math.min(autoTileSize * sizeMultiplier, maxTileSize));
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
    ? /[֐-׿؀-ۿ܀-ݏݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(tiles.words[0].text[0])
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
        const isSelected = selectedIndices?.has(index) ?? false;

        return (
          <React.Fragment key={displayIndex}>
            {/* Tile */}
            <TouchableOpacity
              activeOpacity={editMode ? 0.7 : (onTilePressViewMode ? 0.6 : 1)}
              onPress={
                editMode && onTilePress
                  ? () => onTilePress(index)
                  : !editMode && onTilePressViewMode
                  ? () => onTilePressViewMode(word.originalIndices)
                  : undefined
              }
              onLongPress={
                !editMode && onTileLongPressViewMode
                  ? () => onTileLongPressViewMode(index)
                  : undefined
              }
              delayLongPress={500}
              style={[
                styles.tile,
                {
                  backgroundColor: isHighlighted
                    ? '#FFD700' // Gold when highlighted
                    : (word.backgroundColor ?? tiles.backgroundColor),
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
                    <Text allowFontScaling={false} style={[styles.symbolText, { fontSize: tileSize * 0.4 }]}>
                      {word.symbol}
                    </Text>
                  )}
                </View>
              )}

              {/* Text - centered if no symbol, bottom 1/3 if symbol exists */}
              <View style={word.symbol ? styles.textArea : styles.textAreaCentered}>
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.tileText,
                    {
                      color: word.textColor ?? tiles.textColor,
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
                      isSelected && styles.checkboxChecked,
                    ]}
                  >
                    {isSelected && (
                      <Icon name="checkmark" size={14} color="#FFF" />
                    )}
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* Spacer between tiles */}
            {displayIndex < wordsToRender.length - 1 && (
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
  spacer: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1, // Takes up the gap space
  },
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
});
