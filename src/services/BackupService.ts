import RNFS from 'react-native-fs';
import { AlbumService } from './AlbumService';
import { ExportService } from './ExportService';
import { ImportService } from './ImportService';
import { ZipUtils } from '../utils/ZipUtils';
import { ExportMetadata } from '../types/Album';
import { version as appVersion } from '../../package.json';

/**
 * Service for backing up and restoring all albums
 */
export class BackupService {
  /**
   * Backup all albums to a single ZIP file
   * @param onProgress - Optional progress callback (current, total)
   * @returns Path to the backup ZIP file
   */
  static async backupAllAlbums(
    onProgress?: (current: number, total: number) => void
  ): Promise<string> {
    console.log('[BackupService] Starting full backup');

    try {
      // Get all albums
      const albums = await AlbumService.getAllAlbums();
      console.log('[BackupService] Found', albums.length, 'albums to backup');

      if (albums.length === 0) {
        throw new Error('No albums to backup');
      }

      // Create temporary backup directory
      const tempBackupDir = `${RNFS.TemporaryDirectoryPath}/backup_${Date.now()}`;
      await RNFS.mkdir(tempBackupDir);

      // Export each album to ZIP
      const albumZips: string[] = [];
      for (let i = 0; i < albums.length; i++) {
        const album = albums[i];
        console.log(`[BackupService] Exporting album ${i + 1}/${albums.length}: ${album.name}`);

        if (onProgress) {
          onProgress(i + 1, albums.length);
        }

        try {
          // Export album to ZIP
          const albumZipPath = await ExportService.exportAlbum(album.id);

          // Move ZIP to backup directory with album name
          const sanitizedName = album.name.replace(/[^a-zA-Z0-9_-]/g, '_');
          const backupZipName = `${sanitizedName}_${album.id}.zip`;
          const targetPath = `${tempBackupDir}/${backupZipName}`;

          await RNFS.moveFile(albumZipPath, targetPath);
          albumZips.push(targetPath);

          console.log('[BackupService] Album exported:', backupZipName);
        } catch (error) {
          console.error(`[BackupService] Failed to export album ${album.name}:`, error);
          // Continue with other albums even if one fails
        }
      }

      if (albumZips.length === 0) {
        throw new Error('Failed to export any albums');
      }

      // Create backup metadata
      const timestamp = Date.now();
      const backupMetadata: ExportMetadata = {
        exportType: 'backup',
        exportedAt: timestamp,
        appVersion,
        albumCount: albumZips.length,
      };

      // Write backup metadata
      await RNFS.writeFile(
        `${tempBackupDir}/backup.metadata`,
        JSON.stringify(backupMetadata, null, 2),
        'utf8'
      );

      // Create final backup ZIP
      const date = new Date(timestamp);
      const dateStr = date.toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '_');
      const backupFilename = `IssieAlbum_Backup_${dateStr}.zip`;
      const backupTempDir = `${RNFS.TemporaryDirectoryPath}/exports`;

      const backupExists = await RNFS.exists(backupTempDir);
      if (!backupExists) {
        await RNFS.mkdir(backupTempDir);
      }

      const backupPath = `${backupTempDir}/${backupFilename}`;

      console.log('[BackupService] Creating final backup ZIP:', backupPath);
      await ZipUtils.zip(tempBackupDir, backupPath);

      // Clean up temp directory
      await RNFS.unlink(tempBackupDir);

      console.log('[BackupService] Backup complete:', backupPath);
      return backupPath;
    } catch (error) {
      console.error('[BackupService] Backup failed:', error);
      throw error;
    }
  }

  /**
   * Restore albums from a backup ZIP file
   * @param zipPath - Path to backup ZIP file
   * @param onProgress - Optional progress callback (current, total)
   * @returns Statistics about the restore operation
   */
  static async restoreFromBackup(
    zipPath: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ imported: number; skipped: number }> {
    console.log('[BackupService] Starting restore from:', zipPath);

    const stats = { imported: 0, skipped: 0 };

    try {
      // Extract backup ZIP
      const tempDir = `${RNFS.TemporaryDirectoryPath}/restore_${Date.now()}`;
      console.log('[BackupService] Extracting backup to:', tempDir);
      await ZipUtils.unzip(zipPath, tempDir);

      // Validate backup structure
      const isValid = await BackupService.validateBackupZip(tempDir);
      if (!isValid) {
        throw new Error('Invalid backup file structure');
      }

      // Read backup metadata (try both IssieAlbum and IssieDocs formats)
      const issieAlbumMetadataPath = `${tempDir}/backup.metadata`;
      const issieDocsMetadataPath = `${tempDir}/backup.metadata`;

      let metadata: ExportMetadata | undefined;
      const metadataExists = await RNFS.exists(issieAlbumMetadataPath);

      if (metadataExists) {
        const metadataContent = await RNFS.readFile(issieAlbumMetadataPath, 'utf8');
        const parsed = JSON.parse(metadataContent);

        // Check if it's IssieDocs format (just {"backup": true})
        if (parsed.backup === true && !parsed.exportType) {
          console.log('[BackupService] IssieDocs format detected');
          metadata = {
            exportType: 'backup',
            exportedAt: Date.now(),
            appVersion: 'IssieDocs',
            albumCount: 0,
          };
        } else {
          metadata = parsed as ExportMetadata;
        }
      }

      console.log('[BackupService] Backup metadata:', metadata);
      if (metadata?.albumCount) {
        console.log('[BackupService] Albums in backup:', metadata.albumCount);
      }

      // Find all album ZIPs
      const files = await RNFS.readDir(tempDir);
      const albumZips = files.filter(f => f.name.endsWith('.zip'));

      console.log('[BackupService] Found', albumZips.length, 'album ZIPs');

      // Import each album
      for (let i = 0; i < albumZips.length; i++) {
        const albumZip = albumZips[i];
        console.log(`[BackupService] Importing album ${i + 1}/${albumZips.length}: ${albumZip.name}`);

        if (onProgress) {
          onProgress(i + 1, albumZips.length);
        }

        try {
          // Extract and import album
          const zipInfo = await ImportService.extractZipInfo(albumZip.path);

          // Import album with silent skip for existing albums
          const albumId = await ImportService.importAlbum(zipInfo, undefined, true);

          if (albumId) {
            stats.imported++;
            console.log('[BackupService] Album imported successfully:', albumId);
          } else {
            stats.skipped++;
            console.log('[BackupService] Album skipped (already exists)');
          }
        } catch (error: any) {
          console.error(`[BackupService] Failed to import album ${albumZip.name}:`, error);
          stats.skipped++;
          // Continue with other albums
        }
      }

      // Clean up temp directory
      await RNFS.unlink(tempDir);

      console.log('[BackupService] Restore complete:', stats);
      return stats;
    } catch (error) {
      console.error('[BackupService] Restore failed:', error);
      throw error;
    }
  }

  /**
   * Validate backup ZIP structure
   * @param extractedPath - Path to extracted backup
   * @returns True if valid
   */
  private static async validateBackupZip(extractedPath: string): Promise<boolean> {
    // Check for backup metadata
    const metadataExists = await RNFS.exists(`${extractedPath}/backup.metadata`);
    if (!metadataExists) {
      console.error('[BackupService] Missing backup.metadata');
      return false;
    }

    // Check for at least one album ZIP
    const files = await RNFS.readDir(extractedPath);
    const hasAlbumZips = files.some(f => f.name.endsWith('.zip'));
    if (!hasAlbumZips) {
      console.error('[BackupService] No album ZIPs found');
      return false;
    }

    return true;
  }

  /**
   * Clean up old backup files
   * Should be called on app startup
   */
  static async cleanupOldBackups(): Promise<void> {
    const tempExportDir = `${RNFS.TemporaryDirectoryPath}/exports`;
    const exists = await RNFS.exists(tempExportDir);

    if (!exists) {
      return;
    }

    try {
      const items = await RNFS.readDir(tempExportDir);
      const now = Date.now();
      const maxAge = 3600000; // 1 hour

      for (const item of items) {
        if (item.name.startsWith('IssieAlbum_Backup_') && item.name.endsWith('.zip')) {
          const age = now - new Date(item.mtime!).getTime();
          if (age > maxAge) {
            console.log('[BackupService] Cleaning up old backup:', item.name);
            await RNFS.unlink(item.path);
          }
        }
      }
    } catch (error) {
      console.warn('[BackupService] Cleanup failed:', error);
    }
  }
}
