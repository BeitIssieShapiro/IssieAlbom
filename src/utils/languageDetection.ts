/**
 * Detect language from text by checking character ranges
 * Returns ISO 639-1 language code (2 letters)
 */
export function detectLanguageFromText(text: string): string {
  if (!text || text.trim().length === 0) {
    return 'en'; // Default to English
  }

  // Remove spaces and punctuation for analysis
  const cleanText = text.replace(/[^\p{L}]/gu, '');

  // Count characters by script
  let hebrewChars = 0;
  let arabicChars = 0;
  let latinChars = 0;

  for (const char of cleanText) {
    const code = char.charCodeAt(0);

    // Hebrew: U+0590 to U+05FF
    if (code >= 0x0590 && code <= 0x05FF) {
      hebrewChars++;
    }
    // Arabic: U+0600 to U+06FF
    else if (code >= 0x0600 && code <= 0x06FF) {
      arabicChars++;
    }
    // Latin: U+0041 to U+007A (A-Z, a-z)
    else if ((code >= 0x0041 && code <= 0x005A) || (code >= 0x0061 && code <= 0x007A)) {
      latinChars++;
    }
  }

  // Determine language by majority script
  const total = hebrewChars + arabicChars + latinChars;
  if (total === 0) {
    return 'en'; // No recognizable characters, default to English
  }

  // If more than 30% of characters are Hebrew
  if (hebrewChars / total > 0.3) {
    return 'he';
  }

  // If more than 30% of characters are Arabic
  if (arabicChars / total > 0.3) {
    return 'ar';
  }

  // Default to English for Latin script or unknown
  return 'en';
}
