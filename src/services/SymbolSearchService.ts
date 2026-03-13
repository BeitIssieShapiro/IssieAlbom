/**
 * SymbolSearchService - Search for symbols/pictograms using ARASAAC API
 *
 * Searches for accessibility symbols by keyword and downloads them to local storage.
 */

import RNFS from 'react-native-fs';
import ImageLibrary from './ImageLibrary';

interface SearchResult {
  id: string;
  url: string;
}

class SymbolSearchServiceClass {
  private cache: Map<string, string | null> = new Map();

  /**
   * Search for a symbol by keyword and download it
   * Returns the local file path or null if not found
   */
  async searchSymbol(keyword: string, language: string, albumId: string): Promise<string | null> {
    const normalizedKeyword = keyword.toLowerCase().trim();
    const cacheKey = `${normalizedKeyword}_${language}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) || null;
    }

    try {
      // Search using ARASAAC API
      const results = await ImageLibrary.get().search(normalizedKeyword, language);

      if (!results || results.length === 0) {
        console.log('[SymbolSearchService] No results for', keyword);
        this.cache.set(cacheKey, null);
        return null;
      }

      // Get first result
      const firstResult = results[0] as SearchResult;

      // Download to album attachments directory
      const timestamp = Date.now();
      const fileName = `symbol_${firstResult.id}_${timestamp}.png`;
      const symbolsDir = `${RNFS.DocumentDirectoryPath}/albums/${albumId}/attachments`;

      // Ensure directory exists
      await RNFS.mkdir(symbolsDir);

      const localPath = `${symbolsDir}/${fileName}`;

      // Download the image
      await RNFS.downloadFile({
        fromUrl: firstResult.url,
        toFile: localPath,
      }).promise;

      // Store relative path for portability
      const relativePath = `attachments/${fileName}`;

      console.log('[SymbolSearchService] Downloaded symbol for', keyword, 'to', relativePath);

      // Cache result
      this.cache.set(cacheKey, relativePath);

      return relativePath;
    } catch (error) {
      console.error('[SymbolSearchService] Search failed for', keyword, error);
      this.cache.set(cacheKey, null);
      return null;
    }
  }

  /**
   * Search symbols for multiple words
   * Returns an array of paths (or null for words with no match)
   */
  async searchSymbols(words: string[], language: string, albumId: string): Promise<(string | null)[]> {
    const promises = words.map(word => this.searchSymbol(word, language, albumId));
    return Promise.all(promises);
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const SymbolSearchService = new SymbolSearchServiceClass();
