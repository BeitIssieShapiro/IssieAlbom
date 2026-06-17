import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { MODAL_ORIENTATIONS } from '../types/Album';
import { TileWord } from '../types/Album';
import { MyIcon } from '../common/icons';
import { SymbolSearchService } from '../services/SymbolSearchService';
import { detectLanguageFromText } from '../utils/languageDetection';
import { AttachmentService } from '../services/AttachmentService';

const MIN_TILES = 1;
const MAX_TILES = 10;
const DEFAULT_TILES = 3;
const TILE_SIZE = 110;
const IMAGE_AREA_RATIO = 0.58; // top fraction of tile is image

interface TileState {
  text: string;
  symbol?: string; // relative path
  symbolType?: 'emoji' | 'image';
  searching: boolean;
}

export interface TilesCreationModalRef {
  setTileSymbol: (index: number, relativePath: string) => void;
}

interface TilesCreationModalProps {
  visible: boolean;
  hidden?: boolean; // hide without unmounting (preserves state while another modal is open)
  albumId: string;
  initialTiles?: TileWord[];
  isEditing?: boolean;
  onConfirm: (tiles: TileWord[]) => void;
  onClose: () => void;
  onImagePick: (tileIndex: number, keyword: string) => void;
}

export const TilesCreationModal = forwardRef<TilesCreationModalRef, TilesCreationModalProps>(function TilesCreationModal(
  { visible, hidden = false, albumId, initialTiles, isEditing = false, onConfirm, onClose, onImagePick },
  ref
) {
  const { colors, borderRadius } = useTheme();
  const { t } = useLanguage();

  const [count, setCount] = useState(DEFAULT_TILES);
  const [tileStates, setTileStates] = useState<TileState[]>(
    Array.from({ length: DEFAULT_TILES }, () => ({ text: '', searching: false }))
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const editingIndexRef = useRef<number | null>(null);
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const currentInputRef = useRef<string>('');

  useImperativeHandle(ref, () => ({
    setTileSymbol: (index: number, relativePath: string) => {
      handleSymbolSelect(relativePath, index);
    },
  }));

  const setEditingIndexBoth = (i: number | null) => {
    editingIndexRef.current = i;
    setEditingIndex(i);
  };

  const blurAndCommit = () => {
    Keyboard.dismiss();
    const idx = editingIndexRef.current;
    if (idx !== null) {
      inputRefs.current[idx]?.blur();
      commitText(idx, currentInputRef.current);
    }
  };

  useEffect(() => {
    if (visible) {
      if (initialTiles && initialTiles.length > 0) {
        const n = initialTiles.length;
        setCount(n);
        setTileStates(initialTiles.map(w => ({
          text: w.text,
          symbol: w.symbol,
          symbolType: w.symbolType,
          searching: false,
        })));
      } else {
        setCount(DEFAULT_TILES);
        setTileStates(Array.from({ length: DEFAULT_TILES }, () => ({ text: '', searching: false })));
      }
      setEditingIndexBoth(null);
    }
  }, [visible]);

  useEffect(() => {
    setTileStates(prev => {
      if (prev.length === count) return prev;
      if (prev.length < count) {
        return [...prev, ...Array.from({ length: count - prev.length }, () => ({ text: '', searching: false }))];
      }
      return prev.slice(0, count);
    });
  }, [count]);

  const searchSymbol = async (index: number, text: string) => {
    if (!text.trim()) return;
    setTileStates(prev => {
      const next = [...prev];
      next[index] = { ...next[index], searching: true };
      return next;
    });
    try {
      const lang = detectLanguageFromText(text);
      const result = await SymbolSearchService.searchSymbol(text.trim(), lang, albumId);
      setTileStates(prev => {
        const next = [...prev];
        next[index] = { ...next[index], symbol: result || undefined, symbolType: result ? 'image' : undefined, searching: false };
        return next;
      });
    } catch {
      setTileStates(prev => {
        const next = [...prev];
        next[index] = { ...next[index], searching: false };
        return next;
      });
    }
  };

  const commitText = (index: number, text: string) => {
    const trimmed = text.trim();
    setTileStates(prev => {
      const next = [...prev];
      next[index] = { ...next[index], text: trimmed };
      return next;
    });
    setEditingIndexBoth(null);
    if (trimmed && !tileStates[index]?.symbol && !tileStates[index]?.searching) {
      setTimeout(() => searchSymbol(index, trimmed), 0);
    }
  };

  const handleSymbolSelect = (relativePath: string, index: number) => {
    setTileStates(prev => {
      const next = [...prev];
      next[index] = { ...next[index], symbol: relativePath, symbolType: 'image' };
      return next;
    });
  };

  const handleConfirm = () => {
    const words: TileWord[] = tileStates
      .filter(t => t.text.trim().length > 0)
      .map((t, i) => ({
        text: t.text.trim(),
        originalIndices: [i],
        symbol: t.symbol,
        symbolType: t.symbolType,
      }));
    if (words.length === 0) return;
    onConfirm(words);
  };

  const anyFilled = tileStates.some(t => t.text.trim().length > 0);
  const imageAreaHeight = TILE_SIZE * IMAGE_AREA_RATIO;
  const textAreaHeight = TILE_SIZE * (1 - IMAGE_AREA_RATIO);

  return (
    <>
      <Modal
        visible={visible && !hidden}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        supportedOrientations={MODAL_ORIENTATIONS}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.cardBackground, borderRadius: borderRadius.large }]}>
            {/* Tap-to-dismiss overlay inside modal */}
            {editingIndex !== null && (
              <TouchableOpacity
                style={[StyleSheet.absoluteFill, { zIndex: 1, borderRadius: borderRadius.large }]}
                activeOpacity={1}
                onPress={blurAndCommit}
              />
            )}

            <Text allowFontScaling={false} style={[styles.title, { color: colors.textPrimary }]}>
              {isEditing ? t('editor.tilesUpdate') : t('editor.tilesCreate')}
            </Text>

            {/* Counter */}
            <View style={styles.counterRow}>
              <TouchableOpacity
                onPress={() => setCount(c => Math.max(MIN_TILES, c - 1))}
                style={[styles.counterBtn, { backgroundColor: colors.border }]}
              >
                <MyIcon info={{ name: 'minus', size: 20, color: '#333', type: 'MDI' }} />
              </TouchableOpacity>
              <Text allowFontScaling={false} style={[styles.counterText, { color: colors.textPrimary }]}>{count}</Text>
              <TouchableOpacity
                onPress={() => setCount(c => Math.min(MAX_TILES, c + 1))}
                style={[styles.counterBtn, { backgroundColor: colors.border }]}
              >
                <MyIcon info={{ name: 'plus', size: 20, color: '#333', type: 'MDI' }} />
              </TouchableOpacity>
            </View>

            {/* Tile boxes */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tilesScroll}
              contentContainerStyle={styles.tilesScrollContent}
            >
              {tileStates.map((tile, i) => {
                const isEditing_ = editingIndex === i;
                const symbolUri = tile.symbol
                  ? `file://${AttachmentService.getAbsolutePath(albumId, tile.symbol)}`
                  : null;

                return (
                  <View
                    key={i}
                    style={[
                      styles.tile,
                      {
                        borderColor: isEditing_ ? '#007AFF' : tile.text ? '#007AFF' : colors.border,
                        backgroundColor: tile.text ? '#E3F2FD' : colors.background,
                        zIndex: isEditing_ ? 2 : 0,
                      },
                    ]}
                  >
                    {/* Image area — top tap, only active once tile has text */}
                    <TouchableOpacity
                      style={[styles.imageArea, { height: imageAreaHeight }]}
                      onPress={() => {
                        if (!tileStates[i]?.text?.trim()) return;
                        blurAndCommit();
                        onImagePick(i, tileStates[i].text.trim());
                      }}
                      activeOpacity={tileStates[i]?.text?.trim() ? 0.7 : 1}
                    >
                      {tile.searching ? (
                        <ActivityIndicator size="small" color="#007AFF" />
                      ) : symbolUri ? (
                        <Image source={{ uri: symbolUri }} style={styles.symbolImage} resizeMode="contain" />
                      ) : (
                        <MyIcon info={{ name: 'image-plus', size: 28, color: tileStates[i]?.text?.trim() ? '#999' : '#ddd', type: 'MDI' }} />
                      )}
                    </TouchableOpacity>

                    {/* Divider */}
                    <View style={[styles.tileDivider, { backgroundColor: colors.border }]} />

                    {/* Text area — bottom tap */}
                    <TouchableOpacity
                      style={[styles.textArea, { height: textAreaHeight }]}
                      activeOpacity={isEditing_ ? 1 : 0.7}
                      onPress={() => {
                        currentInputRef.current = tileStates[i]?.text || '';
                        setEditingIndexBoth(i);
                        setTimeout(() => inputRefs.current[i]?.focus(), 50);
                      }}
                    >
                      {isEditing_ ? (
                        <TextInput
                          ref={ref => { inputRefs.current[i] = ref; }}
                          style={[styles.tileInput, { color: colors.textPrimary }]}
                          value={tile.text}
                          onChangeText={text => {
                            currentInputRef.current = text;
                            setTileStates(prev => {
                              const next = [...prev];
                              next[i] = { ...next[i], text, symbol: undefined, symbolType: undefined };
                              return next;
                            });
                          }}
                          onSubmitEditing={() => commitText(i, currentInputRef.current)}
                          onBlur={() => commitText(i, currentInputRef.current)}
                          autoFocus
                          returnKeyType="done"
                          selectTextOnFocus
                          textAlign="center"
                          allowFontScaling={false}
                        />
                      ) : (
                        <Text
                          allowFontScaling={false}
                          style={[styles.tileLabel, { color: tile.text ? '#007AFF' : '#bbb' }]}
                          numberOfLines={2}
                          adjustsFontSizeToFit
                        >
                          {tile.text || 'abc'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.border, borderRadius: borderRadius.medium }]}
                onPress={onClose}
              >
                <Text allowFontScaling={false} style={[styles.buttonText, { color: colors.textPrimary }]}>
                  {t('imageEdit.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: anyFilled ? '#007AFF' : colors.border, borderRadius: borderRadius.medium }]}
                onPress={handleConfirm}
                disabled={!anyFilled}
              >
                <Text allowFontScaling={false} style={[styles.buttonText, { color: '#fff' }]}>
                  {isEditing ? t('editor.tilesUpdate') : t('editor.tilesCreate')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modal: {
    width: '80%',
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  counterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterText: {
    fontSize: 20,
    fontWeight: 'bold',
    minWidth: 32,
    textAlign: 'center',
  },
  tilesScroll: {
    marginBottom: 16,
  },
  tilesScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 10,
    borderWidth: 2,
    overflow: 'hidden',
    marginHorizontal: 5,
  },
  imageArea: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileDivider: {
    height: 1,
    width: '100%',
  },
  textArea: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  symbolImage: {
    width: '85%',
    height: '90%',
    resizeMode: 'contain',
  },
  tileInput: {
    fontSize: 13,
    fontWeight: 'bold',
    width: '100%',
    textAlign: 'center',
    padding: 0,
    minHeight: 20,
  },
  tileLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    minWidth: 90,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
