import RNFS from 'react-native-fs';
import { AlbumService } from './AlbumService';
import { PageService } from './PageService';
import { AttachmentService } from './AttachmentService';
import { ZipUtils } from '../utils/ZipUtils';
import { ExportMetadata, AlbumPageV2 } from '../types/Album';
import { compileQueueToElements } from '../utils/pageUtils';
import { version as appVersion } from '../../package.json';

/**
 * Service for exporting albums to ZIP archives
 */
export class ExportService {
  /**
   * Export an album to a ZIP file
   * @param albumId - Album ID to export
   * @returns Path to the exported ZIP file
   */
  static async exportAlbum(albumId: string): Promise<string> {
    console.log('[ExportService] Starting album export:', albumId);

    try {
      // Ensure temp export directory exists
      const tempExportDir = `${RNFS.TemporaryDirectoryPath}/exports`;
      await RNFS.mkdir(tempExportDir);

      // Get album metadata
      const metadata = await AlbumService.getAlbumMetadata(albumId);
      const pages = await PageService.getPages(albumId);

      console.log('[ExportService] Album metadata:', metadata);
      console.log('[ExportService] Page count:', pages.length);

      // Create a temporary directory for this export
      const timestamp = Date.now();
      const exportTempDir = `${tempExportDir}/album_${albumId}_${timestamp}`;
      await RNFS.mkdir(exportTempDir);

      // Create export metadata
      const exportMetadata: ExportMetadata = {
        exportType: 'album',
        exportedAt: timestamp,
        appVersion,
        albumId,
        albumName: metadata.id,
        pageCount: pages.length,
      };

      // Write export metadata
      await RNFS.writeFile(
        `${exportTempDir}/export.metadata`,
        JSON.stringify(exportMetadata, null, 2),
        'utf8'
      );

      // Copy album metadata
      const albumPath = AlbumService.getAlbumPath(albumId);
      await RNFS.copyFile(
        `${albumPath}/metadata.json`,
        `${exportTempDir}/metadata.json`
      );

      // Create pages directory in export
      await RNFS.mkdir(`${exportTempDir}/pages`);

      // Copy all page files
      const pagesPath = AlbumService.getPagesPath(albumId);
      const pageFiles = await RNFS.readDir(pagesPath);
      for (const pageFile of pageFiles) {
        if (pageFile.name.endsWith('.json')) {
          await RNFS.copyFile(
            pageFile.path,
            `${exportTempDir}/pages/${pageFile.name}`
          );
        }
      }

      // Collect and copy attachments
      const attachmentPaths = await ExportService.collectAttachments(albumId, pages);
      if (attachmentPaths.length > 0) {
        console.log('[ExportService] Copying', attachmentPaths.length, 'attachments');

        // Create attachments directory in export
        await RNFS.mkdir(`${exportTempDir}/attachments`);

        for (const relativePath of attachmentPaths) {
          const sourcePath = AttachmentService.getAbsolutePath(albumId, relativePath);
          const exists = await RNFS.exists(sourcePath);

          if (exists) {
            // Extract filename from relative path (e.g., "attachments/image_123.jpg" -> "image_123.jpg")
            const filename = relativePath.replace('attachments/', '');
            const destPath = `${exportTempDir}/attachments/${filename}`;

            console.log('[ExportService] Copying attachment:', filename);
            await RNFS.copyFile(sourcePath, destPath);
          } else {
            console.warn('[ExportService] Attachment not found:', relativePath);
          }
        }
      }

      // Copy thumbnail if exists
      if (metadata.thumbnailPath) {
        const thumbnailSource = `${albumPath}/${metadata.thumbnailPath}`;
        const thumbnailExists = await RNFS.exists(thumbnailSource);

        if (thumbnailExists) {
          await RNFS.copyFile(
            thumbnailSource,
            `${exportTempDir}/${metadata.thumbnailPath}`
          );
        }
      }

      // Create ZIP file with sanitized filename and readable timestamp
      const sanitizedName = metadata.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const date = new Date(timestamp);
      const dateStr = date.toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '_');
      const zipFilename = `IssieAlbum_${sanitizedName}_${dateStr}.zip`;
      const zipPath = `${tempExportDir}/${zipFilename}`;

      console.log('[ExportService] Creating ZIP:', zipPath);
      await ZipUtils.zip(exportTempDir, zipPath);

      // Clean up temp directory
      await RNFS.unlink(exportTempDir);

      console.log('[ExportService] Export complete:', zipPath);
      return zipPath;
    } catch (error) {
      console.error('[ExportService] Export failed:', error);
      throw error;
    }
  }

  /**
   * Collect all attachment paths referenced in pages
   * @param albumId - Album ID
   * @param pages - Array of pages
   * @returns Array of relative attachment paths
   */
  private static async collectAttachments(
    albumId: string,
    pages: any[]
  ): Promise<string[]> {
    const attachmentSet = new Set<string>();

    for (const page of pages) {
      // Compile queue to get all elements
      const compiled = compileQueueToElements((page as AlbumPageV2).elements || []);

      // Collect image paths
      for (const image of compiled.images) {
        if (image.imagePath) {
          attachmentSet.add(image.imagePath);
        }
      }

      // Collect audio paths
      for (const audio of compiled.audios) {
        if (audio.audioPath) {
          attachmentSet.add(audio.audioPath);
        }
      }
    }

    return Array.from(attachmentSet);
  }

  /**
   * Clean up old temporary export files
   * Should be called on app startup
   */
  static async cleanupOldExports(): Promise<void> {
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
        const age = now - new Date(item.mtime!).getTime();
        if (age > maxAge) {
          console.log('[ExportService] Cleaning up old export:', item.name);
          await RNFS.unlink(item.path);
        }
      }
    } catch (error) {
      console.warn('[ExportService] Cleanup failed:', error);
    }
  }
}
