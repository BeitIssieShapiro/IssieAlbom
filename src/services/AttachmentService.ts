import RNFS from 'react-native-fs';
import { AlbumService } from './AlbumService';

export const AttachmentService = {
  /**
   * Get the attachments directory path for an album
   */
  getAttachmentsPath(albumId: string): string {
    const albumPath = AlbumService.getAlbumPath(albumId);
    return `${albumPath}/attachments`;
  },

  /**
   * Ensure attachments directory exists
   */
  async ensureAttachmentsDirectory(albumId: string): Promise<void> {
    const attachmentsPath = this.getAttachmentsPath(albumId);
    const exists = await RNFS.exists(attachmentsPath);
    if (!exists) {
      await RNFS.mkdir(attachmentsPath);
    }
  },

  /**
   * Generate a unique filename for an attachment
   */
  generateAttachmentName(type: 'image' | 'audio', extension: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${type}_${timestamp}_${random}.${extension}`;
  },

  /**
   * Save an image attachment and return relative path
   * @param albumId - Album ID
   * @param sourceUri - Source image URI (from image picker)
   * @returns Relative path to the saved image (e.g., "attachments/image_123.jpg")
   */
  async saveImageAttachment(albumId: string, sourceUri: string): Promise<string> {
    await this.ensureAttachmentsDirectory(albumId);

    // Determine extension from source URI
    const extension = sourceUri.split('.').pop()?.toLowerCase() || 'jpg';
    const filename = this.generateAttachmentName('image', extension);
    const attachmentsPath = this.getAttachmentsPath(albumId);
    const destPath = `${attachmentsPath}/${filename}`;

    // Copy file to attachments directory
    const cleanSourceUri = sourceUri.replace('file://', '');
    await RNFS.copyFile(cleanSourceUri, destPath);

    // Return relative path
    return `attachments/${filename}`;
  },

  /**
   * Save an audio attachment and return relative path
   * @param albumId - Album ID
   * @param sourceFilePath - Source audio file path (from recorder)
   * @returns Relative path to the saved audio (e.g., "attachments/audio_123.m4a")
   */
  async saveAudioAttachment(albumId: string, sourceFilePath: string): Promise<string> {
    await this.ensureAttachmentsDirectory(albumId);

    // Determine extension from source file
    const extension = sourceFilePath.split('.').pop()?.toLowerCase() || 'm4a';
    const filename = this.generateAttachmentName('audio', extension);
    const attachmentsPath = this.getAttachmentsPath(albumId);
    const destPath = `${attachmentsPath}/${filename}`;

    // Move file to attachments directory
    const cleanSourcePath = sourceFilePath.replace('file://', '');
    await RNFS.moveFile(cleanSourcePath, destPath);

    // Return relative path
    return `attachments/${filename}`;
  },

  /**
   * Convert relative path to absolute path
   * @param albumId - Album ID
   * @param relativePath - Relative path (e.g., "attachments/image_123.jpg")
   * @returns Absolute file path
   */
  getAbsolutePath(albumId: string, relativePath: string): string {
    const albumPath = AlbumService.getAlbumPath(albumId);
    return `${albumPath}/${relativePath}`;
  },

  /**
   * Delete an attachment by relative path
   * @param albumId - Album ID
   * @param relativePath - Relative path to delete
   */
  async deleteAttachment(albumId: string, relativePath: string): Promise<void> {
    const absolutePath = this.getAbsolutePath(albumId, relativePath);
    const exists = await RNFS.exists(absolutePath);
    if (exists) {
      await RNFS.unlink(absolutePath);
    }
  },

  /**
   * Check if an attachment exists
   * @param albumId - Album ID
   * @param relativePath - Relative path to check
   * @returns True if file exists
   */
  async attachmentExists(albumId: string, relativePath: string): Promise<boolean> {
    const absolutePath = this.getAbsolutePath(albumId, relativePath);
    return await RNFS.exists(absolutePath);
  },
};
