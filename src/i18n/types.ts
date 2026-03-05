export type LanguageCode = 'en' | 'he' | 'ar';
export type Direction = 'ltr' | 'rtl';

export interface Language {
  code: LanguageCode;
  label: string;
  dir: Direction;
}

export const LANGUAGES: Language[] = [
  { code: 'he', label: 'עברית', dir: 'rtl' },
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
];
