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
import { MyIcon } from '../common/icons';
import ImageLibrary from '../services/ImageLibrary';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, borderRadius } from '../theme/colors';
import { MODAL_ORIENTATIONS } from '../types/Album';

interface SearchSymbolModalProps {
  visible: boolean;
  onSelectSymbol: (symbolId: string) => void; // Returns symbol ID, not path
  onClose: () => void;
  initialKeyword?: string;
}

export function SearchSymbolModal({
  visible,
  onSelectSymbol,
  onClose,
  initialKeyword = '',
}: SearchSymbolModalProps) {
  const { t, language, isRTL } = useLanguage();
  const { colors } = useTheme();
  const [value, setValue] = useState<string>(initialKeyword);
  const [results, setResults] = useState<any[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const textRef = useRef<TextInput>(null);

  React.useEffect(() => {
    if (visible && initialKeyword) {
      setValue(initialKeyword);
      // Auto-search when opened with initial keyword
      doSearch(initialKeyword);
    }
  }, [visible, initialKeyword]);

  const doSearch = async (keyword?: string) => {
    const searchKeyword = keyword || value;
    if (!searchKeyword.trim()) return;

    if (textRef.current) {
      textRef.current.blur();
    }

    setIsSearching(true);
    try {
      const res = await ImageLibrary.get().search(searchKeyword, language);
      setResults(res);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSymbol = (item: any) => {
    onSelectSymbol(item.id); // Return just the ID, caller will download
    handleClose();
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
            {t('symbolSearch.title')}
          </Text>

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <TextInput
              ref={textRef}
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.inputBackground,
                  color: colors.text,
                  textAlign: isRTL ? 'right' : 'left',
                },
              ]}
              placeholder={t('symbolSearch.placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={value}
              onChangeText={setValue}
              onSubmitEditing={() => doSearch()}
              returnKeyType="search"
              autoFocus={!initialKeyword}
            />
            <TouchableOpacity
              style={[styles.searchButton, { backgroundColor: colors.primary }]}
              onPress={() => doSearch()}
            >
              <MyIcon info={{ type: 'Ionicons', name: 'search', size: 24, color: '#fff' }} />
            </TouchableOpacity>
          </View>

          {/* Results */}
          <ScrollView
            style={styles.resultsContainer}
            contentContainerStyle={styles.resultsContent}
          >
            {isSearching && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  {t('symbolSearch.searching')}
                </Text>
              </View>
            )}

            {!isSearching && results && results.length === 0 && (
              <View style={styles.emptyContainer}>
                <MyIcon info={{ type: 'Ionicons', name: 'sad-outline', size: 64, color: colors.textSecondary }} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {t('symbolSearch.noResults')}
                </Text>
              </View>
            )}

            {!isSearching && results && results.length > 0 && (
              <View style={styles.resultsGrid}>
                {results.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.resultItem, { backgroundColor: colors.inputBackground }]}
                    onPress={() => handleSelectSymbol(item)}
                  >
                    <Image
                      source={{ uri: item.url }}
                      style={styles.resultImage}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 600,
    height: '80%',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  pickerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsContainer: {
    flex: 1,
  },
  resultsContent: {
    paddingBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    textAlign: 'center',
  },
  resultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  resultItem: {
    width: 120,
    height: 120,
    borderRadius: 12,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultImage: {
    width: '100%',
    height: '100%',
  },
});
