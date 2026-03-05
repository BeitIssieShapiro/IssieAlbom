import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

/**
 * Utilities for sharing files via native OS share sheet
 */
export class ShareUtils {
  /**
   * Share a file using the native share sheet
   * @param filePath - Absolute path to file
   * @param mimeType - MIME type (e.g., 'application/zip', 'application/pdf')
   * @param title - Share dialog title
   * @param message - Optional message to include
   */
  static async shareFile(
    filePath: string,
    mimeType: string,
    title: string,
    message?: string
  ): Promise<void> {
    try {
      // Verify file exists
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Get shareable URI (handles platform differences)
      const uri = await ShareUtils.getShareableUri(filePath);

      console.log('[ShareUtils] Sharing file:', { uri, mimeType, title });

      const options: any = {
        title,
        url: uri,
        type: mimeType,
        failOnCancel: false,
      };

      // Only include message if explicitly provided
      if (message) {
        options.message = message;
      }

      const result = await Share.open(options);
      console.log('[ShareUtils] Share result:', result);
    } catch (error: any) {
      // User cancelled share
      if (error?.message?.includes('User did not share')) {
        console.log('[ShareUtils] User cancelled share');
        return;
      }

      console.error('[ShareUtils] Share failed:', error);
      throw new Error(`Failed to share file: ${error.message}`);
    }
  }

  /**
   * Get a shareable URI for the file
   * Android requires content:// URIs in some cases
   * iOS works with file:// paths
   * @param filePath - Absolute file path
   * @returns Shareable URI
   */
  private static async getShareableUri(filePath: string): Promise<string> {
    if (Platform.OS === 'ios') {
      // iOS: Use file:// URI
      return `file://${filePath}`;
    } else {
      // Android: react-native-share handles content URI conversion
      // Just return the file path
      return filePath;
    }
  }

  /**
   * Share multiple files at once
   * @param filePaths - Array of file paths
   * @param mimeType - MIME type
   * @param title - Share dialog title
   */
  static async shareFiles(
    filePaths: string[],
    mimeType: string,
    title: string
  ): Promise<void> {
    try {
      // Verify all files exist
      for (const path of filePaths) {
        const exists = await RNFS.exists(path);
        if (!exists) {
          throw new Error(`File not found: ${path}`);
        }
      }

      // Get shareable URIs
      const uris = await Promise.all(
        filePaths.map(path => ShareUtils.getShareableUri(path))
      );

      console.log('[ShareUtils] Sharing multiple files:', { uris, mimeType, title });

      const options: any = {
        title,
        urls: uris,
        type: mimeType,
        failOnCancel: false,
      };

      const result = await Share.open(options);
      console.log('[ShareUtils] Share result:', result);
    } catch (error: any) {
      if (error?.message?.includes('User did not share')) {
        console.log('[ShareUtils] User cancelled share');
        return;
      }

      console.error('[ShareUtils] Share failed:', error);
      throw new Error(`Failed to share files: ${error.message}`);
    }
  }

  /**
   * Check if sharing is available on this platform
   */
  static isAvailable(): boolean {
    // react-native-share works on both iOS and Android
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }
}
