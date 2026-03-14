import React, { useRef, useState } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import RNFS from 'react-native-fs';
import { MyIcon } from '../common/icons';
import ImageLibrary from '../services/ImageLibrary';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, borderRadius } from '../theme/colors';
import { MODAL_ORIENTATIONS } from '../types/Album';
import { detectLanguageFromText } from '../utils/languageDetection';

interface SearchImageModalProps {
  visible: boolean;
  onSelectImage: (filePath: string) => void;
  onClose: () => void;
}

export function SearchImageModal({
  visible,
  onSelectImage,
  onClose,
}: SearchImageModalProps) {
  const { t, language, isRTL } = useLanguage();
  const { colors } = useTheme();
  const [value, setValue] = useState<string>('');
  const [results, setResults] = useState<any[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const textRef = useRef<TextInput>(null);

  const doSearch = async () => {
    if (!value.trim()) return;

    if (textRef.current) {
      textRef.current.blur();
    }

    setIsSearching(true);
    try {
      // Detect language from the search text itself, not UI language
      const detectedLanguage = detectLanguageFromText(value);
      console.log('[SearchImageModal] Detected language from text:', detectedLanguage, 'for keyword:', value);

      const res = await ImageLibrary.get().search(value, detectedLanguage);
      setResults(res);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectImage = async (item: any) => {
    setIsDownloading(item.id);
    try {
      // Download to temporary location
      const tempPath = `${RNFS.TemporaryDirectoryPath}/search_${Date.now()}.jpg`;
      await downloadImage(item.url, tempPath);
      onSelectImage(tempPath);
      onClose();
    } catch (error) {
      console.error('Download failed:', error);
      alert(t('editor.errorSaveImage'));
    } finally {
      setIsDownloading(null);
    }
  };

  const handleClose = () => {
    setValue('');
    setResults(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      supportedOrientations={MODAL_ORIENTATIONS}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(93, 78, 109, 0.6)' }]}>
        <View style={[styles.container, { backgroundColor: colors.cardBackground }]}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <MyIcon info={{ type: 'Ionicons', name: 'close', size: 45, color: colors.primary }} />
          </TouchableOpacity>

          {/* Title */}
          <Text style={[styles.pickerTitle, { color: colors.primary }]}>
            {t('imageSearch.title')}
          </Text>

          {/* Search Input */}
          <View style={styles.searchRoot}>
            <View
              style={[
                styles.searchTextAndBtnContainer,
                { flexDirection: isRTL ? 'row-reverse' : 'row' },
              ]}
            >
              <View style={{ flex: 1, position: 'relative' }}>
                <TextInput
                  ref={textRef}
                  style={[
                    styles.searchInput,
                    {
                      textAlign: isRTL ? 'right' : 'left',
                      backgroundColor: colors.background,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholder={t('imageSearch.searchPlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={value}
                  onChangeText={setValue}
                  onSubmitEditing={doSearch}
                  returnKeyType="search"
                />
                {value?.length > 0 && (
                  <TouchableOpacity
                    style={[
                      styles.cleanSearchX,
                      isRTL ? { left: 5 } : { right: 5 },
                    ]}
                    onPress={() => setValue('')}
                  >
                    <Text style={[styles.cleanXText, { color: colors.textSecondary }]}>
                      ×
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={[styles.searchImageBtn, { backgroundColor: colors.primary }]}
                onPress={doSearch}
                disabled={isSearching}
              >
                {isSearching ? (
                  <ActivityIndicator color={colors.cardBackground} />
                ) : (
                  <Text style={[styles.searchBtnText, { color: colors.cardBackground }]}>
                    {t('imageSearch.search')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Results */}
            <ScrollView style={styles.scrollView}>
              <View style={styles.resultContainer}>
                {results &&
                  (results.length > 0 ? (
                    results.map((item: any, i: number) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => handleSelectImage(item)}
                        disabled={isDownloading !== null}
                      >
                        {isDownloading === item.id ? (
                          <View style={[styles.foundItem, styles.downloadingItem]}>
                            <ActivityIndicator color={colors.primary} />
                          </View>
                        ) : (
                          <Image source={{ uri: item.url }} style={styles.foundItem} />
                        )}
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={[styles.noResultMsg, { color: colors.textSecondary }]}>
                      {t('imageSearch.noResults')}
                    </Text>
                  ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

async function downloadImage(url: string, targetPath: string): Promise<string> {
  try {
    const downloadResult = await RNFS.downloadFile({
      fromUrl: url,
      toFile: targetPath,
    }).promise;

    if (downloadResult.statusCode === 200) {
      return targetPath;
    } else {
      throw new Error(`Download failed with status code ${downloadResult.statusCode}`);
    }
  } catch (error) {
    console.error('Error downloading image:', error);
    throw error;
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1200,
  },
  container: {
    width: '95%',
    height: '90%',
    padding: spacing.xl,
    borderRadius: borderRadius.large,
    alignItems: 'center',
    shadowColor: '#171717',
    shadowOffset: { width: 3, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 7,
  },
  closeButton: {
    position: 'absolute',
    right: 10,
    top: 30,
    zIndex: 100,
  },
  pickerTitle: {
    margin: spacing.lg,
    fontSize: 25,
    fontWeight: '700',
  },
  searchRoot: {
    alignItems: 'center',
    width: '100%',
    flex: 1,
  },
  searchTextAndBtnContainer: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    width: '80%',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    borderRadius: borderRadius.large,
    paddingHorizontal: spacing.lg,
    fontSize: 18,
    height: 40,
  },
  cleanSearchX: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -21 }],
    padding: spacing.sm,
  },
  cleanXText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchImageBtn: {
    borderRadius: borderRadius.round,
    height: 40,
    minWidth: 100,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginLeft: spacing.md,
  },
  searchBtnText: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  resultContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.lg,
    paddingTop: spacing.xl,
    justifyContent: 'center',
  },
  foundItem: {
    height: 80,
    width: 80,
    margin: spacing.md,
    borderRadius: borderRadius.medium,
    backgroundColor: '#f0f0f0',
  },
  downloadingItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noResultMsg: {
    fontSize: 24,
    marginTop: '10%',
    textAlign: 'center',
  },
});
