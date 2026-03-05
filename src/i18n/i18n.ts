import { translations } from './translations';
import { LanguageCode } from './types';

/**
 * Translation helper function
 * @param key - Dot-notation key (e.g., 'home.title')
 * @param language - Language code
 * @param params - Optional parameters for string interpolation (e.g., {name: 'Album1'})
 * @returns Translated string or the key if not found
 */
export function t(key: string, language: LanguageCode, params?: Record<string, string>): string {
  const keys = key.split('.');
  let value: any = translations[language];

  for (const k of keys) {
    value = value?.[k];
  }

  if (typeof value !== 'string') {
    console.warn(`[i18n] Missing translation for key: ${key} in language: ${language}`);
    return key; // Fallback to key if not found
  }

  // Replace parameters like {name} with actual values
  if (params) {
    return value.replace(/\{(\w+)\}/g, (match: string, paramKey: string) => {
      return params[paramKey] !== undefined ? params[paramKey] : match;
    });
  }

  return value;
}
