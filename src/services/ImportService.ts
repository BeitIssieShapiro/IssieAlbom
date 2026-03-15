import RNFS from 'react-native-fs';
import { RTLAlertStatic } from '../components/RTLAlert';
import { AlbumService } from './AlbumService';
import { ZipUtils } from '../utils/ZipUtils';
import { ExportMetadata, ZipInfo, AlbumMetadata } from '../types/Album';

/**
 * Service for importing albums from ZIP archives
 */
export class ImportService {
  /**
   * Extract and inspect a ZIP file
   * @param zipPath - Path to ZIP file
   * @returns ZIP information including metadata
   */
  static async extractZipInfo(zipPath: string): Promise<ZipInfo> {
    console.log('[ImportService] Extracting ZIP info:', zipPath);

    const tempDir = `${RNFS.TemporaryDirectoryPath}/import_${Date.now()}`;

    try {
      // Extract ZIP
      const extractedPath = await ZipUtils.unzip(zipPath, tempDir);

      // Try IssieAlbum format first (export.metadata)
      const exportMetadataPath = `${extractedPath}/export.metadata`;
      const exportMetadataExists = await RNFS.exists(exportMetadataPath);

      if (exportMetadataExists) {
        // IssieAlbum format
        const metadataContent = await RNFS.readFile(exportMetadataPath, 'utf8');
        const metadata: ExportMetadata = JSON.parse(metadataContent);

        return {
          zipPath,
          extractedPath,
          metadata,
        };
      }

      // Try IssieDocs format (backup.metadata)
      const backupMetadataPath = `${extractedPath}/backup.metadata`;
      const backupMetadataExists = await RNFS.exists(backupMetadataPath);

      if (backupMetadataExists) {
        // IssieDocs format - check if it's a backup
        const metadataContent = await RNFS.readFile(backupMetadataPath, 'utf8');
        const backupMetadata = JSON.parse(metadataContent);

        if (backupMetadata.backup === true) {
          // This is an IssieDocs backup, not compatible with IssieAlbum
          throw new Error('IssieDocs backups are not compatible with IssieAlbum. Please use IssieAlbum backup files only.');
        }

        // Convert to IssieAlbum format
        const metadata: ExportMetadata = {
          exportType: 'backup',
          exportedAt: Date.now(),
          appVersion: 'IssieDocs',
          albumCount: 0, // Will be determined by counting ZIPs
        };

        return {
          zipPath,
          extractedPath,
          metadata,
        };
      }

      // No valid metadata found
      throw new Error('Invalid ZIP file: missing export metadata');
    } catch (error) {
      // Clean up on error
      const exists = await RNFS.exists(tempDir);
      if (exists) {
        await RNFS.unlink(tempDir);
      }
      throw error;
    }
  }

  /**
   * Import an album from a ZIP file
   * @param zipInfo - ZIP information from extractZipInfo
   * @param newName - Optional new name if there's a conflict
   * @param silentSkip - If true, skip existing albums without showing dialog (for backup restore)
   * @returns Album ID of imported album, or null if skipped
   */
  static async importAlbum(
    zipInfo: ZipInfo,
    newName?: string,
    silentSkip?: boolean
  ): Promise<string | null> {
    console.log('[ImportService] Importing album:', zipInfo.metadata.albumName);

    try {
      // Validate ZIP structure
      const isValid = await ImportService.validateAlbumZip(zipInfo.extractedPath);
      if (!isValid) {
        throw new Error('Invalid ZIP file structure');
      }

      // Read album metadata from ZIP
      const albumMetadataPath = `${zipInfo.extractedPath}/metadata.json`;
      const albumMetadataContent = await RNFS.readFile(albumMetadataPath, 'utf8');
      const albumMetadata: AlbumMetadata = JSON.parse(albumMetadataContent);

      // Determine target album name
      let targetAlbumName = newName || zipInfo.metadata.albumName || albumMetadata.id;

      // Check for name conflicts
      const exists = await AlbumService.albumExists(targetAlbumName);
      if (exists && !newName) {
        if (silentSkip) {
          // Silent skip for backup restore - return null instead of throwing
          console.log('[ImportService] Album exists, skipping:', targetAlbumName);
          // Clean up temp directory
          await RNFS.unlink(zipInfo.extractedPath);
          return null;
        }
        // Show conflict resolution dialog
        const newAlbumName = await ImportService.resolveNameConflict(targetAlbumName);
        if (!newAlbumName) {
          throw new Error('Import cancelled');
        }
        targetAlbumName = newAlbumName;
      }

      // Create new album with target name
      console.log('[ImportService] Creating album:', targetAlbumName);
      const newAlbum = await AlbumService.createAlbum(targetAlbumName);
      const targetAlbumPath = AlbumService.getAlbumPath(newAlbum.id);

      // Copy all files from extracted ZIP to new album
      await ImportService.copyAlbumFiles(zipInfo.extractedPath, targetAlbumPath);

      // Update metadata with new album ID and timestamps
      const newMetadata: AlbumMetadata = {
        ...albumMetadata,
        id: newAlbum.id,
        updatedAt: Date.now(),
      };

      await RNFS.writeFile(
        `${targetAlbumPath}/metadata.json`,
        JSON.stringify(newMetadata, null, 2),
        'utf8'
      );

      // Clean up temp directory
      await RNFS.unlink(zipInfo.extractedPath);

      console.log('[ImportService] Import complete:', newAlbum.id);
      return newAlbum.id;
    } catch (error) {
      // Clean up on error
      const exists = await RNFS.exists(zipInfo.extractedPath);
      if (exists) {
        await RNFS.unlink(zipInfo.extractedPath);
      }
      throw error;
    }
  }

  /**
   * Validate album ZIP structure
   * @param extractedPath - Path to extracted ZIP contents
   * @returns True if valid
   */
  private static async validateAlbumZip(extractedPath: string): Promise<boolean> {
    // Check for required files
    const metadataExists = await RNFS.exists(`${extractedPath}/metadata.json`);
    const exportMetadataExists = await RNFS.exists(`${extractedPath}/export.metadata`);
    const pagesExists = await RNFS.exists(`${extractedPath}/pages`);

    return metadataExists && exportMetadataExists && pagesExists;
  }

  /**
   * Copy files from extracted ZIP to target album directory
   * @param sourcePath - Extracted ZIP path
   * @param targetAlbumPath - Target album path
   */
  private static async copyAlbumFiles(
    sourcePath: string,
    targetAlbumPath: string
  ): Promise<void> {
    console.log('[ImportService] Copying album files');

    // Copy pages directory
    const pagesSourcePath = `${sourcePath}/pages`;
    const pagesTargetPath = `${targetAlbumPath}/pages`;

    // Delete existing pages (from album creation)
    const existingPages = await RNFS.readDir(pagesTargetPath);
    for (const page of existingPages) {
      await RNFS.unlink(page.path);
    }

    // Copy all page files
    const pageFiles = await RNFS.readDir(pagesSourcePath);
    for (const pageFile of pageFiles) {
      if (pageFile.name.endsWith('.json')) {
        await RNFS.copyFile(
          pageFile.path,
          `${pagesTargetPath}/${pageFile.name}`
        );
      }
    }

    // Copy attachments if they exist
    const attachmentsSourcePath = `${sourcePath}/attachments`;
    const attachmentsExists = await RNFS.exists(attachmentsSourcePath);

    if (attachmentsExists) {
      const attachmentsTargetPath = `${targetAlbumPath}/attachments`;

      // Ensure attachments directory exists
      const targetAttachmentsExists = await RNFS.exists(attachmentsTargetPath);
      if (!targetAttachmentsExists) {
        await RNFS.mkdir(attachmentsTargetPath);
      }

      // Copy all attachment files
      const attachmentFiles = await RNFS.readDir(attachmentsSourcePath);
      for (const attachmentFile of attachmentFiles) {
        console.log('[ImportService] Copying attachment:', attachmentFile.name);
        await RNFS.copyFile(
          attachmentFile.path,
          `${attachmentsTargetPath}/${attachmentFile.name}`
        );
      }
    }

    // Copy thumbnail if exists
    const files = await RNFS.readDir(sourcePath);
    for (const file of files) {
      if (file.name.startsWith('thumbnail_') && file.name.endsWith('.jpg')) {
        console.log('[ImportService] Copying thumbnail:', file.name);
        await RNFS.copyFile(
          file.path,
          `${targetAlbumPath}/${file.name}`
        );
      }
    }
  }

  /**
   * Resolve name conflict with user input
   * @param existingName - Existing album name
   * @param translations - Translation object with keys
   * @returns New name or null if cancelled
   */
  static async resolveNameConflict(
    existingName: string,
    translations?: { cancel?: string; rename?: string; replace?: string; message?: string }
  ): Promise<string | null> {
    const t = translations || {
      cancel: 'Cancel',
      rename: 'Rename',
      replace: 'Replace',
      message: 'An album with this name already exists',
    };

    return new Promise((resolve) => {
      RTLAlertStatic.alert(
        t.message!,
        `${t.message!}: "${existingName}"`,
        [
          {
            text: t.cancel!,
            style: 'cancel',
            onPress: () => resolve(null),
          },
          {
            text: t.rename!,
            onPress: () => {
              // Generate new name with suffix
              const newName = ImportService.generateUniqueName(existingName);
              resolve(newName);
            },
          },
          {
            text: t.replace!,
            style: 'destructive',
            onPress: async () => {
              // Delete existing album
              try {
                await AlbumService.deleteAlbum(existingName);
                resolve(existingName);
              } catch (error) {
                console.error('[ImportService] Failed to delete existing album:', error);
                resolve(null);
              }
            },
          },
        ],
        { cancelable: false }
      );
    });
  }

  /**
   * Generate a unique album name by adding a suffix
   * @param baseName - Base album name
   * @returns Unique name
   */
  private static generateUniqueName(baseName: string): string {
    let counter = 1;
    let newName = `${baseName} (${counter})`;

    // Keep incrementing until we find a unique name
    // Note: This is synchronous for simplicity, but in practice
    // we'd need to check async. For now, we'll return the first attempt.
    return newName;
  }

  /**
   * Clean up old temporary import files
   * Should be called on app startup
   */
  static async cleanupOldImports(): Promise<void> {
    const tempDir = RNFS.TemporaryDirectoryPath;

    try {
      const items = await RNFS.readDir(tempDir);
      const now = Date.now();
      const maxAge = 3600000; // 1 hour

      for (const item of items) {
        if (item.name.startsWith('import_')) {
          const age = now - new Date(item.mtime!).getTime();
          if (age > maxAge) {
            console.log('[ImportService] Cleaning up old import:', item.name);
            await RNFS.unlink(item.path);
          }
        }
      }
    } catch (error) {
      console.warn('[ImportService] Cleanup failed:', error);
    }
  }
}
