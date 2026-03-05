import RNFS from 'react-native-fs';
import { ThemeName } from '../theme/colors';
import { LanguageCode } from '../i18n/types';

const PREFERENCES_FILE = `${RNFS.DocumentDirectoryPath}/preferences.json`;

export interface Preferences {
  theme: ThemeName;
  language?: LanguageCode;
}

const DEFAULT_PREFERENCES: Preferences = {
  theme: 'girly',
  language: undefined, // Will be detected from device
};

export const PreferencesService = {
  /**
   * Load preferences from disk
   */
  async loadPreferences(): Promise<Preferences> {
    try {
      const exists = await RNFS.exists(PREFERENCES_FILE);
      if (!exists) {
        console.log('[PreferencesService] No preferences file found, using defaults');
        return DEFAULT_PREFERENCES;
      }

      const content = await RNFS.readFile(PREFERENCES_FILE, 'utf8');
      const preferences = JSON.parse(content) as Preferences;

      console.log('[PreferencesService] Loaded preferences:', preferences);
      return preferences;
    } catch (error) {
      console.error('[PreferencesService] Failed to load preferences:', error);
      return DEFAULT_PREFERENCES;
    }
  },

  /**
   * Save preferences to disk
   */
  async savePreferences(preferences: Preferences): Promise<void> {
    try {
      const content = JSON.stringify(preferences, null, 2);
      await RNFS.writeFile(PREFERENCES_FILE, content, 'utf8');
      console.log('[PreferencesService] Saved preferences:', preferences);
    } catch (error) {
      console.error('[PreferencesService] Failed to save preferences:', error);
      throw error;
    }
  },

  /**
   * Update theme preference
   */
  async setTheme(theme: ThemeName): Promise<void> {
    const preferences = await this.loadPreferences();
    preferences.theme = theme;
    await this.savePreferences(preferences);
  },

  /**
   * Get current theme preference
   */
  async getTheme(): Promise<ThemeName> {
    const preferences = await this.loadPreferences();
    return preferences.theme;
  },

  /**
   * Update language preference
   */
  async setLanguage(language: LanguageCode): Promise<void> {
    const preferences = await this.loadPreferences();
    preferences.language = language;
    await this.savePreferences(preferences);
  },

  /**
   * Get current language preference
   */
  async getLanguage(): Promise<LanguageCode | undefined> {
    const preferences = await this.loadPreferences();
    return preferences.language;
  },
};
