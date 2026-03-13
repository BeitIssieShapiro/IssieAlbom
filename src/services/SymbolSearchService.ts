/**
 * SymbolSearchService - Search for emojis/symbols using OpenMoji API
 *
 * Searches for symbols by keyword and returns the first matching emoji.
 */

interface OpenMojiSearchResult {
  emoji: string;
  hexcode: string;
  group: string;
  subgroups: string;
  annotation: string;
  tags: string;
  openmoji_tags: string;
  openmoji_author: string;
  openmoji_date: string;
  skintone?: string;
  skintone_combination?: string;
  skintone_base_emoji?: string;
  skintone_base_hexcode?: string;
  unicode?: number;
  order?: number;
}

class SymbolSearchServiceClass {
  private cache: Map<string, string | null> = new Map();
  private openMojiData: OpenMojiSearchResult[] | null = null;
  private loadingPromise: Promise<void> | null = null;

  /**
   * Load OpenMoji data from CDN
   * Data is loaded once and cached for the session
   */
  private async loadOpenMojiData(): Promise<void> {
    if (this.openMojiData) {
      return; // Already loaded
    }

    if (this.loadingPromise) {
      return this.loadingPromise; // Already loading
    }

    this.loadingPromise = (async () => {
      try {
        const response = await fetch(
          'https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/data/openmoji.json',
          {
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to load OpenMoji data: ${response.status}`);
        }

        this.openMojiData = await response.json();
        console.log('[SymbolSearchService] Loaded OpenMoji data:', this.openMojiData?.length, 'emojis');
      } catch (error) {
        console.error('[SymbolSearchService] Failed to load OpenMoji data:', error);
        this.openMojiData = []; // Empty array to prevent retry
      }
    })();

    return this.loadingPromise;
  }

  /**
   * Search for a symbol by keyword
   * Returns the first matching emoji or null if not found
   */
  async searchSymbol(keyword: string): Promise<string | null> {
    const normalizedKeyword = keyword.toLowerCase().trim();

    // Check cache
    if (this.cache.has(normalizedKeyword)) {
      return this.cache.get(normalizedKeyword) || null;
    }

    // Ensure data is loaded
    await this.loadOpenMojiData();

    if (!this.openMojiData || this.openMojiData.length === 0) {
      console.warn('[SymbolSearchService] No OpenMoji data available');
      return null;
    }

    // Search for matching emoji
    // Priority: annotation > tags > openmoji_tags
    const result = this.openMojiData.find((item) => {
      const annotation = item.annotation?.toLowerCase() || '';
      const tags = item.tags?.toLowerCase() || '';
      const openmojiTags = item.openmoji_tags?.toLowerCase() || '';

      return (
        annotation.includes(normalizedKeyword) ||
        tags.split(',').some(tag => tag.trim().includes(normalizedKeyword)) ||
        openmojiTags.split(',').some(tag => tag.trim().includes(normalizedKeyword))
      );
    });

    const emoji = result?.emoji || null;

    // Cache result
    this.cache.set(normalizedKeyword, emoji);

    console.log('[SymbolSearchService] Search result for', keyword, ':', emoji);
    return emoji;
  }

  /**
   * Search symbols for multiple words
   * Returns an array of symbols (or null for words with no match)
   */
  async searchSymbols(words: string[]): Promise<(string | null)[]> {
    await this.loadOpenMojiData();

    const promises = words.map(word => this.searchSymbol(word));
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
