import React, { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { getLocales } from 'react-native-localize';
import { LanguageCode, Direction, LANGUAGES } from '../i18n/types';
import { t as translateFunction } from '../i18n/i18n';

interface LanguageContextValue {
  language: LanguageCode;
  direction: Direction;
  isRTL: boolean;
  t: (key: string, params?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

/**
 * Detects the device language and returns the closest supported language
 * @returns LanguageCode - defaults to 'en' if device language is not supported
 */
function detectDeviceLanguage(): LanguageCode {
  try {
    const locales = getLocales();
    const deviceLang = locales[0]?.languageCode;

    console.log('[LanguageContext] Device language:', deviceLang);
    // return 'he';
    if (deviceLang === 'he') return 'he';
    if (deviceLang === 'ar') return 'ar';
    return 'en'; // Default to English
  } catch (error) {
    console.error('[LanguageContext] Failed to detect device language:', error);
    return 'en'; // Fallback to English
  }
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const language = detectDeviceLanguage();

  // Derive direction and isRTL from current language
  const langInfo = LANGUAGES.find(l => l.code === language);
  const direction: Direction = langInfo?.dir || 'ltr';
  const isRTL = direction === 'rtl';

  // Create translation function bound to current language (memoized to prevent re-renders)
  const t = useCallback((key: string, params?: Record<string, string>) => {
    return translateFunction(key, language, params);
  }, [language]);

  const value: LanguageContextValue = useMemo(() => ({
    language,
    direction,
    isRTL,
    t,
  }), [language, direction, isRTL, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Hook to access language context
 * @throws Error if used outside LanguageProvider
 */
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
