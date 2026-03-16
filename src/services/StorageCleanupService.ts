import RNFS from 'react-native-fs';
import { AlbumService } from './AlbumService';
import { PageService } from './PageService';
import { AttachmentService } from './AttachmentService';
import { compileQueueToElements, loadPageWithMigration } from '../utils/pageUtils';
import { BACKGROUND_IMAGE_SOURCES } from '../utils/backgroundPatterns';
import { ImportService } from './ImportService';
import { ExportService } from './ExportService';
import { BackupService } from './BackupService';
import { PDFService } from './PDFService';

/**
 * StorageCleanupService - Garbage collector for orphaned attachment files.
 *
 * Files can become orphaned when:
 * - An image is edited/cropped (new file created, old one left behind)
 * - Audio is re-recorded (new file, old one remains)
 * - An image/audio element is deleted (queue marks it deleted but file stays)
 * - Tile symbols are replaced or tiles are deleted
 * - Background images are changed
 * - Pages are deleted (page JSON removed but referenced files remain)
 * - Undo queue is truncated with untracked file types (symbols, bg images)
 * - Editor changes are discarded after files were saved
 *
 * Strategy: For each album, compile the "active" set of file references from
 * all pages, then delete any file in attachments/ that isn't referenced.
 */
export const StorageCleanupService = {

  /**
   * Run full cleanup: GC orphaned attachments for all albums + temp files.
   * Safe to call on app startup.
   */
  async runFullCleanup(): Promise<{ albumsCleaned: number; filesDeleted: number; bytesFreed: number }> {
    let totalFiles = 0;
    let totalBytes = 0;
    let albumsCleaned = 0;

    try {
      const albums = await AlbumService.getAllAlbums();

      for (const album of albums) {
        try {
          const result = await this.cleanupAlbum(album.id);
          totalFiles += result.filesDeleted;
          totalBytes += result.bytesFreed;
          if (result.filesDeleted > 0) albumsCleaned++;
        } catch (error) {
          console.warn(`[StorageCleanup] Failed to clean album ${album.id}:`, error);
        }
      }

      // Clean up temp directories
      await this.cleanupTempFiles();

    } catch (error) {
      console.error('[StorageCleanup] Full cleanup failed:', error);
    }

    if (totalFiles > 0) {
      console.log(`[StorageCleanup] Cleaned ${totalFiles} orphaned files (${(totalBytes / 1024).toFixed(1)} KB) from ${albumsCleaned} albums`);
    }

    return { albumsCleaned, filesDeleted: totalFiles, bytesFreed: totalBytes };
  },

  /**
   * Collect all file references from a single page's compiled elements.
   */
  getReferencedFiles(compiled: ReturnType<typeof compileQueueToElements>): Set<string> {
    const refs = new Set<string>();

    // Images
    for (const img of compiled.images) {
      if (img.imagePath) refs.add(img.imagePath);
    }

    // Audio
    for (const audio of compiled.audios) {
      if (audio.audioPath) refs.add(audio.audioPath);
    }

    // Tiles - symbol image paths
    if (compiled.tiles) {
      for (const word of compiled.tiles.words) {
        if (word.symbolType === 'image' && word.symbol) {
          refs.add(word.symbol);
        }
      }
    }

    // Background pattern - custom images (not preset ones from app bundle)
    if (compiled.backgroundPattern?.type === 'image' && compiled.backgroundPattern.imageName) {
      const name = compiled.backgroundPattern.imageName;
      // Only track if it's NOT a bundled preset
      if (!BACKGROUND_IMAGE_SOURCES[name]) {
        // Could be a relative path (attachments/...) or just a filename
        if (name.startsWith('attachments/')) {
          refs.add(name);
        }
      }
    }

    return refs;
  },

  /**
   * Scan the raw queue for ALL file references. This is critical for undo safety:
   * even if an element was deleted (e.g., imageDelete), the original entry that
   * added it (e.g., image with imagePath) is still in the queue. Undo can restore
   * it, so we must keep the file as long as the queue references it.
   * The queue is append-only (never compacted), so all historical refs are preserved.
   */
  getReferencedFilesFromQueue(queueElements: any[]): Set<string> {
    const refs = new Set<string>();

    for (const qe of queueElements) {
      const elem = qe.elem;
      if (!elem) continue;

      if (elem.imagePath) refs.add(elem.imagePath);
      if (elem.audioPath) refs.add(elem.audioPath);

      // Tiles with symbols
      if (elem.words && Array.isArray(elem.words)) {
        for (const word of elem.words) {
          if (word.symbolType === 'image' && word.symbol) {
            refs.add(word.symbol);
          }
        }
      }

      // Background pattern images
      if (elem.pattern?.type === 'image' && elem.pattern.imageName) {
        const name = elem.pattern.imageName;
        if (!BACKGROUND_IMAGE_SOURCES[name]) {
          if (name.startsWith('attachments/')) {
            refs.add(name);
          }
        }
      }
    }

    return refs;
  },

  /**
   * Clean orphaned attachment files for a single album.
   */
  async cleanupAlbum(albumId: string): Promise<{ filesDeleted: number; bytesFreed: number }> {
    const attachmentsPath = AttachmentService.getAttachmentsPath(albumId);
    const exists = await RNFS.exists(attachmentsPath);
    if (!exists) return { filesDeleted: 0, bytesFreed: 0 };

    // 1. Collect all referenced files from ALL pages (both compiled and raw queue)
    const referencedFiles = new Set<string>();
    const pages = await PageService.getPages(albumId);

    for (const page of pages) {
      try {
        const v2Page = loadPageWithMigration(page);

        // Get references from compiled state (active elements)
        const compiled = compileQueueToElements(v2Page.elements);
        for (const ref of this.getReferencedFiles(compiled)) {
          referencedFiles.add(ref);
        }

        // Also get references from the full queue (includes undo history)
        for (const ref of this.getReferencedFilesFromQueue(v2Page.elements)) {
          referencedFiles.add(ref);
        }
      } catch (error) {
        console.warn(`[StorageCleanup] Failed to parse page in album ${albumId}:`, error);
        // If we can't parse a page, skip cleanup for safety
        return { filesDeleted: 0, bytesFreed: 0 };
      }
    }

    // 2. List all files in the attachments directory
    const files = await RNFS.readDir(attachmentsPath);

    // 3. Delete files not referenced by any page
    let filesDeleted = 0;
    let bytesFreed = 0;

    for (const file of files) {
      if (file.isDirectory()) continue;

      const relativePath = `attachments/${file.name}`;
      if (!referencedFiles.has(relativePath)) {
        try {
          const size = parseInt(String(file.size), 10) || 0;
          await RNFS.unlink(file.path);
          filesDeleted++;
          bytesFreed += size;
          console.log(`[StorageCleanup] Deleted orphan: ${relativePath} (${(size / 1024).toFixed(1)} KB)`);
        } catch (error) {
          console.warn(`[StorageCleanup] Failed to delete ${file.path}:`, error);
        }
      }
    }

    return { filesDeleted, bytesFreed };
  },

  /**
   * Clean up temp directories left by import/export/backup operations.
   */
  async cleanupTempFiles(): Promise<void> {
    try {
      await ImportService.cleanupOldImports();
    } catch (e) { /* ignore */ }

    try {
      await ExportService.cleanupOldExports();
    } catch (e) { /* ignore */ }

    try {
      await BackupService.cleanupOldBackups();
    } catch (e) { /* ignore */ }

    try {
      await PDFService.cleanupOldPDFs();
    } catch (e) { /* ignore */ }
  },
};
