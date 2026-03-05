import React, { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react';
import { getLocales } from 'react-native-localize';
import { LanguageCode, Direction, LANGUAGES } from '../i18n/types';
import { t as translateFunction } from '../i18n/i18n';
import { PreferencesService } from '../services/PreferencesService';

interface LanguageContextValue {
  language: LanguageCode;
  direction: Direction;
  isRTL: boolean;
  setLanguage: (lang: LanguageCode) => Promise<void>;
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

    if (deviceLang === 'he') return 'he';
    if (deviceLang === 'ar') return 'ar';
    return 'en'; // Default to English
  } catch (error) {
    console.error('[LanguageContext] Failed to detect device language:', error);
    return 'en'; // Fallback to English
  }
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<LanguageCode>('he');
  const [isLoading, setIsLoading] = useState(true);

  // Load language preference on mount
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLanguage = await PreferencesService.getLanguage();
        if (savedLanguage) {
          console.log('[LanguageContext] Loaded saved language:', savedLanguage);
          setLanguageState(savedLanguage);
        } else {
          // No saved language, detect from device
          const deviceLang = detectDeviceLanguage();
          console.log('[LanguageContext] No saved language, using device language:', deviceLang);
          setLanguageState(deviceLang);
        }
      } catch (error) {
        console.error('[LanguageContext] Failed to load language:', error);
        setLanguageState('en'); // Fallback to English
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguage();
  }, []);

  const setLanguage = useCallback(async (lang: LanguageCode) => {
    try {
      // Save to preferences
      await PreferencesService.setLanguage(lang);

      console.log('[LanguageContext] Language changed to:', lang);

      // Update state - direction will be handled by App.tsx
      setLanguageState(lang);
    } catch (error) {
      console.error('[LanguageContext] Failed to set language:', error);
    }
  }, []);

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
    setLanguage,
    t,
  }), [language, direction, isRTL, setLanguage, t]);

  // Wait for language to load before rendering children
  if (isLoading) {
    return null;
  }

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
