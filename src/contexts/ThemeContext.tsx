import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeName, ThemeColors, themes, typography, spacing, borderRadius, shadows } from '../theme/colors';
import { PreferencesService } from '../services/PreferencesService';

interface ThemeContextValue {
  themeName: ThemeName;
  colors: ThemeColors;
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  setTheme: (theme: ThemeName) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themeName, setThemeName] = useState<ThemeName>('girly');

  // Load saved theme on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await PreferencesService.getTheme();
        console.log('[ThemeContext] Loaded theme:', savedTheme);
        setThemeName(savedTheme);
      } catch (error) {
        console.error('[ThemeContext] Failed to load theme:', error);
      }
    };
    loadTheme();
  }, []);

  const setTheme = async (theme: ThemeName) => {
    try {
      await PreferencesService.setTheme(theme);
      setThemeName(theme);
      console.log('[ThemeContext] Theme changed to:', theme);
    } catch (error) {
      console.error('[ThemeContext] Failed to save theme:', error);
      throw error;
    }
  };

  const value: ThemeContextValue = {
    themeName,
    colors: themes[themeName],
    typography,
    spacing,
    borderRadius,
    shadows,
    setTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
