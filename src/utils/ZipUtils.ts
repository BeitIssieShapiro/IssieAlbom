import { zip, unzip, unzipAssets } from 'react-native-zip-archive';
import RNFS from 'react-native-fs';

/**
 * Wrapper around react-native-zip-archive for ZIP operations
 */
export class ZipUtils {
  /**
   * Create a ZIP archive from a source directory or file
   * @param source - Path to source directory or file
   * @param target - Path to output ZIP file
   */
  static async zip(source: string, target: string): Promise<void> {
    try {
      console.log('[ZipUtils] Creating ZIP:', { source, target });
      const result = await zip(source, target);
      console.log('[ZipUtils] ZIP created successfully:', result);
    } catch (error) {
      console.error('[ZipUtils] ZIP creation failed:', error);
      throw new Error(`Failed to create ZIP: ${error}`);
    }
  }

  /**
   * Extract a ZIP archive to a target directory
   * @param source - Path to ZIP file
   * @param target - Path to extraction directory
   * @returns Path to extracted contents
   */
  static async unzip(source: string, target: string): Promise<string> {
    try {
      console.log('[ZipUtils] Extracting ZIP:', { source, target });

      // Ensure target directory exists
      const targetExists = await RNFS.exists(target);
      if (!targetExists) {
        await RNFS.mkdir(target);
      }

      const result = await unzip(source, target);
      console.log('[ZipUtils] ZIP extracted successfully:', result);
      return result;
    } catch (error) {
      console.error('[ZipUtils] ZIP extraction failed:', error);
      throw new Error(`Failed to extract ZIP: ${error}`);
    }
  }

  /**
   * Get list of files in a ZIP archive
   * Note: react-native-zip-archive doesn't provide direct listing,
   * so we extract to temp and list files
   * @param zipPath - Path to ZIP file
   * @returns Array of file paths relative to ZIP root
   */
  static async getFileList(zipPath: string): Promise<string[]> {
    const tempDir = `${RNFS.TemporaryDirectoryPath}/zip_list_${Date.now()}`;

    try {
      await ZipUtils.unzip(zipPath, tempDir);
      const files = await ZipUtils.listFilesRecursive(tempDir);

      // Make paths relative to tempDir
      const relativePaths = files.map(file =>
        file.replace(tempDir + '/', '')
      );

      return relativePaths;
    } finally {
      // Clean up temp directory
      const exists = await RNFS.exists(tempDir);
      if (exists) {
        await RNFS.unlink(tempDir);
      }
    }
  }

  /**
   * Recursively list all files in a directory
   * @param dirPath - Directory path
   * @returns Array of absolute file paths
   */
  private static async listFilesRecursive(dirPath: string): Promise<string[]> {
    const items = await RNFS.readDir(dirPath);
    const files: string[] = [];

    for (const item of items) {
      if (item.isDirectory()) {
        const subFiles = await ZipUtils.listFilesRecursive(item.path);
        files.push(...subFiles);
      } else {
        files.push(item.path);
      }
    }

    return files;
  }

  /**
   * Clean up old temporary ZIP files
   * @param maxAgeMs - Maximum age in milliseconds (default: 1 hour)
   */
  static async cleanupTempZips(maxAgeMs: number = 3600000): Promise<void> {
    const tempDir = RNFS.TemporaryDirectoryPath;
    const now = Date.now();

    try {
      const items = await RNFS.readDir(tempDir);

      for (const item of items) {
        // Look for zip-related temp directories and files
        if (item.name.includes('zip_') || item.name.endsWith('.zip')) {
          const age = now - new Date(item.mtime!).getTime();

          if (age > maxAgeMs) {
            console.log('[ZipUtils] Cleaning up old temp file:', item.name);
            await RNFS.unlink(item.path);
          }
        }
      }
    } catch (error) {
      console.warn('[ZipUtils] Cleanup failed:', error);
      // Don't throw - cleanup is non-critical
    }
  }
}
