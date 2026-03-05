import { useLanguage } from '../contexts/LanguageContext';

/**
 * Hook-based translate function
 * Use this inside React components
 */
export function useTranslation() {
  const { t } = useLanguage();
  return { t };
}

/**
 * Direct translate function for use outside React components
 * Uses English as default language
 */
export function translate(key: string, params?: Record<string, string>): string {
  // This is a simplified version that always returns the key
  // In a real implementation, you'd need to access the current language
  // For now, services will need to be refactored to use context
  console.warn('[i18n] Using direct translate outside React context:', key);
  return key;
}

// Re-export types
export * from './types';
export { t } from './i18n';
export { translations } from './translations';
