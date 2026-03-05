// Theme system with 4 distinct themes

export type ThemeName = 'girly' | 'boyish' | 'solid' | 'sparkly';

export interface ThemeColors {
  // Primary colors
  primary: string;
  primaryLight: string;
  primaryDark: string;

  // Secondary colors
  secondary: string;
  secondaryLight: string;
  secondaryDark: string;

  // Accent colors
  accent1: string;
  accent2: string;
  accent3: string;
  accent4: string;
  accent5: string;

  // Backgrounds
  background: string;
  cardBackground: string;
  headerBackground: string;

  // Text colors
  textPrimary: string;
  textSecondary: string;
  textLight: string;

  // UI elements
  border: string;
  shadow: string;

  // Status colors
  success: string;
  warning: string;
  error: string;

  // Audio/recording
  recordButton: string;
  playButton: string;
}

// Theme 1: Girly - Playful and soft (original theme)
const girlyTheme: ThemeColors = {
  primary: '#FF6B9D',
  primaryLight: '#FFB5D0',
  primaryDark: '#E85A8A',

  secondary: '#FFA500',
  secondaryLight: '#FFD580',
  secondaryDark: '#E69500',

  accent1: '#4ECDC4',
  accent2: '#95E1D3',
  accent3: '#FFE66D',
  accent4: '#A8E6CF',
  accent5: '#C3AED6',

  background: '#FFF9F0',
  cardBackground: '#FFFFFF',
  headerBackground: '#FFE5F1',

  textPrimary: '#5D4E6D',
  textSecondary: '#8B7E93',
  textLight: '#B8AEC2',

  border: '#FFD4E5',
  shadow: 'rgba(255, 107, 157, 0.2)',

  success: '#7FD5A0',
  warning: '#FFD166',
  error: '#FF8B94',

  recordButton: '#FF6B9D',
  playButton: '#4ECDC4',
};

// Theme 2: Boyish - Cool and adventurous
const boyishTheme: ThemeColors = {
  primary: '#3498DB',
  primaryLight: '#85C1E9',
  primaryDark: '#2874A6',

  secondary: '#2ECC71',
  secondaryLight: '#82E0AA',
  secondaryDark: '#229954',

  accent1: '#F39C12',
  accent2: '#E74C3C',
  accent3: '#9B59B6',
  accent4: '#1ABC9C',
  accent5: '#34495E',

  background: '#ECF0F1',
  cardBackground: '#FFFFFF',
  headerBackground: '#D6EAF8',

  textPrimary: '#2C3E50',
  textSecondary: '#5D6D7E',
  textLight: '#95A5A6',

  border: '#BDC3C7',
  shadow: 'rgba(52, 152, 219, 0.2)',

  success: '#27AE60',
  warning: '#F39C12',
  error: '#E74C3C',

  recordButton: '#E74C3C',
  playButton: '#2ECC71',
};

// Theme 3: Solid - Professional and neutral
const solidTheme: ThemeColors = {
  primary: '#2C3E50',
  primaryLight: '#5D6D7E',
  primaryDark: '#1C2833',

  secondary: '#34495E',
  secondaryLight: '#616A6B',
  secondaryDark: '#273746',

  accent1: '#7F8C8D',
  accent2: '#95A5A6',
  accent3: '#BDC3C7',
  accent4: '#ABB2B9',
  accent5: '#85929E',

  background: '#F8F9F9',
  cardBackground: '#FFFFFF',
  headerBackground: '#ECF0F1',

  textPrimary: '#212F3C',
  textSecondary: '#566573',
  textLight: '#7B7D7D',

  border: '#D5D8DC',
  shadow: 'rgba(44, 62, 80, 0.15)',

  success: '#52BE80',
  warning: '#F4D03F',
  error: '#EC7063',

  recordButton: '#5D6D7E',
  playButton: '#52BE80',
};

// Theme 4: Sparkly - Elegant with shimmer and gradients
const sparklyTheme: ThemeColors = {
  primary: '#9B59B6',
  primaryLight: '#D2B4DE',
  primaryDark: '#7D3C98',

  secondary: '#E91E63',
  secondaryLight: '#F8BBD0',
  secondaryDark: '#AD1457',

  accent1: '#FF6F61',
  accent2: '#FFD700',
  accent3: '#87CEEB',
  accent4: '#DA70D6',
  accent5: '#F0E68C',

  background: '#FFF5F7',
  cardBackground: '#FFFFFF',
  headerBackground: '#F4ECF7',

  textPrimary: '#4A235A',
  textSecondary: '#76448A',
  textLight: '#A569BD',

  border: '#E8DAEF',
  shadow: 'rgba(155, 89, 182, 0.25)',

  success: '#58D68D',
  warning: '#F8C471',
  error: '#EC7063',

  recordButton: '#E91E63',
  playButton: '#58D68D',
};

export const themes: Record<ThemeName, ThemeColors> = {
  girly: girlyTheme,
  boyish: boyishTheme,
  solid: solidTheme,
  sparkly: sparklyTheme,
};

export const themeDisplayNames: Record<ThemeName, string> = {
  girly: 'ילדותי',
  boyish: 'בנים',
  solid: 'מבוגרים',
  sparkly: 'נוצץ',
};

// Export default theme for backward compatibility
export const colors = girlyTheme;

export const typography = {
  fontFamily: {
    regular: 'System',
    bold: 'System',
  },
  fontSize: {
    huge: 32,
    large: 24,
    medium: 18,
    regular: 16,
    small: 14,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const borderRadius = {
  small: 12,
  medium: 16,
  large: 20,
  round: 9999,
};

export const shadows = {
  card: '0px 4px 12px rgba(255, 107, 157, 0.15)',
  button: '0px 3px 8px rgba(255, 107, 157, 0.2)',
  header: '0px 2px 8px rgba(255, 107, 157, 0.1)',
};
