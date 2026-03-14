import RNFS from 'react-native-fs';
import { captureRef } from 'react-native-view-shot';
// @ts-ignore - pdfkit doesn't have proper React Native types
import PDFDocument from '@react-pdf/pdfkit';
import { Buffer } from 'buffer';
import { AlbumPageV2 } from '../types/Album';
import { AlbumService } from './AlbumService';
import { PageService } from './PageService';

interface ImageSize {
  width: number;
  height: number;
}

interface CapturedPage {
  base64: string; // base64 image without data URI prefix
  size: ImageSize;
}

/**
 * Service for generating PDF documents from albums
 */
export class PDFService {
  /**
   * Generate a PDF from captured page images
   * @param albumId - Album ID
   * @param albumName - Album name
   * @param capturedPages - Array of captured page images with sizes
   * @returns Path to the generated PDF file
   */
  static async generateAlbumPDFFromImages(
    albumId: string,
    albumName: string,
    capturedPages: CapturedPage[]
  ): Promise<string> {
    console.log('[PDFService] Generating PDF from', capturedPages.length, 'captured pages');

    return new Promise(async (resolve, reject) => {
      try {
        // Create exports directory
        console.log('[PDFService] Creating exports directory...');
        const exportsDir = `${RNFS.DocumentDirectoryPath}/exports`;
        const exists = await RNFS.exists(exportsDir);
        if (!exists) {
          await RNFS.mkdir(exportsDir);
        }

        // Generate filename
        const timestamp = Date.now();
        const date = new Date(timestamp);
        const dateStr = date.toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '_');
        const sanitizedName = albumName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const pdfFilename = `IssieAlbum_${sanitizedName}_${dateStr}.pdf`;
        const pdfPath = `${exportsDir}/${pdfFilename}`;

        console.log('[PDFService] PDF path:', pdfPath);

        // Create PDF document
        console.log('[PDFService] Creating PDF document...');
        const doc = new PDFDocument({
          autoFirstPage: false,
        });

        // Accumulate PDF data in buffers
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          console.log('[PDFService] Received data chunk, size:', chunk.length);
        });

        doc.on('error', (err: any) => {
          console.error('[PDFService] PDF document error:', err);
          reject(err);
        });

        // When the document ends, write the PDF buffer to a file
        doc.on('end', async () => {
          try {
            console.log('[PDFService] PDF generation complete, writing to file...');
            const pdfData = Buffer.concat(chunks);
            console.log('[PDFService] Total PDF size:', pdfData.length, 'bytes');

            // Write to app's exports directory
            await RNFS.writeFile(pdfPath, pdfData.toString('base64'), 'base64');
            console.log('[PDFService] PDF written to app directory:', pdfPath);

            // Also write to Downloads folder for easy access
            try {
              const downloadsPath = `${RNFS.DownloadDirectoryPath}/${pdfFilename}`;
              await RNFS.writeFile(downloadsPath, pdfData.toString('base64'), 'base64');
              console.log('[PDFService] PDF also written to Downloads:', downloadsPath);
            } catch (downloadErr) {
              console.warn('[PDFService] Could not write to Downloads (non-critical):', downloadErr);
            }

            resolve(pdfPath);
          } catch (fileErr) {
            console.error('[PDFService] Failed to write PDF:', fileErr);
            reject(fileErr);
          }
        });

        // Add each captured image on its own page
        console.log('[PDFService] Adding', capturedPages.length, 'pages to PDF...');
        for (let i = 0; i < capturedPages.length; i++) {
          const capturedPage = capturedPages[i];
          const { base64, size } = capturedPage;

          console.log(`[PDFService] Adding page ${i + 1}/${capturedPages.length}, size: ${size.width}x${size.height}`);

          // Determine page orientation based on dimensions
          const isPortrait = size.height > size.width;
          console.log(`[PDFService] Page orientation: ${isPortrait ? 'portrait' : 'landscape'}`);

          // Create PDF page with exact image dimensions
          // This ensures the image fits perfectly without scaling
          doc.addPage({
            size: isPortrait ? [size.width, size.height] : [size.height, size.width],
            layout: isPortrait ? 'portrait' : 'landscape',
            margins: 0,
          });
          console.log('[PDFService] Page added to document with custom size');

          // Clean the base64 string if it includes data URI prefix
          const cleanedBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
          console.log('[PDFService] Base64 cleaned, length:', cleanedBase64.length);

          // Insert the image at (x=0, y=0) to fill the page exactly
          console.log('[PDFService] Adding image to page...');
          doc.image(Buffer.from(cleanedBase64, 'base64'), 0, 0, {
            fit: [size.width, size.height],
            align: 'center',
            valign: 'top',
          });
          console.log('[PDFService] Image added successfully');
        }

        // Finalize the PDF
        console.log('[PDFService] Finalizing PDF document...');
        doc.end();
      } catch (err) {
        console.error('[PDFService] PDF generation error:', err);
        reject(err);
      }
    });
  }

  /**
   * Clean up old PDF exports
   * Should be called on app startup
   */
  static async cleanupOldPDFs(): Promise<void> {
    const exportsDir = `${RNFS.DocumentDirectoryPath}/exports`;
    const exists = await RNFS.exists(exportsDir);

    if (!exists) {
      return;
    }

    try {
      const items = await RNFS.readDir(exportsDir);
      const now = Date.now();
      const maxAge = 3600000; // 1 hour

      for (const item of items) {
        if (item.name.endsWith('.pdf')) {
          const age = now - new Date(item.mtime!).getTime();
          if (age > maxAge) {
            console.log('[PDFService] Cleaning up old PDF:', item.name);
            await RNFS.unlink(item.path);
          }
        }
      }
    } catch (error) {
      console.warn('[PDFService] Cleanup failed:', error);
    }
  }
}
