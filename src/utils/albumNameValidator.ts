/**
 * Album name validation utilities
 *
 * Validates album names for use as folder names in the filesystem.
 * Rejects invalid characters and reserved names instead of auto-sanitizing.
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string; // Hebrew user-friendly error message
}

// Invalid characters for filesystem: / \ : * ? " < > |
// Also disallow control characters (0x00-0x1F)
const INVALID_CHARS_REGEX = /[\/\\:*?"<>|\x00-\x1f]/;

// Reserved names on Windows (also avoid on iOS for cross-platform compatibility)
// Includes . and .. which are filesystem navigation markers
const RESERVED_NAMES = /^(\.\.?|CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

/**
 * Validates an album name for use as a folder name
 *
 * @param name - The album name to validate
 * @returns ValidationResult with isValid flag and optional error message
 */
export function validateAlbumName(name: string): ValidationResult {
  const trimmed = name.trim();

  // Check empty
  if (trimmed.length === 0) {
    return { isValid: false, error: 'נא להזין שם לאלבום' };
  }

  // Check length (filesystem limit)
  if (trimmed.length > 255) {
    return { isValid: false, error: 'השם ארוך מדי (מקסימום 255 תווים)' };
  }

  // Check invalid characters
  if (INVALID_CHARS_REGEX.test(trimmed)) {
    return { isValid: false, error: 'השם מכיל תווים לא חוקיים: / \\ : * ? " < > |' };
  }

  // Check reserved names
  if (RESERVED_NAMES.test(trimmed)) {
    return { isValid: false, error: 'השם הזה שמור ואינו ניתן לשימוש' };
  }

  return { isValid: true };
}

/**
 * Gets the folder name from an album name (just trimmed, no sanitization)
 *
 * @param name - The album name
 * @returns The trimmed folder name
 */
export function getFolderName(name: string): string {
  return name.trim();
}
