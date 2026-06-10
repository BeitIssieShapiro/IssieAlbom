import React, { useState, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { RTLAlertStatic } from './RTLAlert';
import RNFS from 'react-native-fs';
import { useLanguage } from '../contexts/LanguageContext';
import { ExportService } from '../services/ExportService';
import { PDFService } from '../services/PDFService';
import { PageService } from '../services/PageService';
import { ShareUtils } from '../utils/ShareUtils';
import { PDFPageRenderer } from './PDFPageRenderer';
import { VideoPageRenderer } from './VideoPageRenderer';
import { AlbumPage, AlbumPageV2, MODAL_ORIENTATIONS } from '../types/Album';
import { simpleVideoExportService } from '../services/SimpleVideoExportService';
import { videoExportNative } from '../services/VideoExportNative';
import { DEFAULT_EXPORT_CONFIG } from '../types/VideoExport';
import { PageCardRef } from './PageCard';

interface ExportModalProps {
  visible: boolean;
  albumId: string;
  albumName: string;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  visible,
  albumId,
  albumName,
  onClose,
}) => {
  const { t } = useLanguage();
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState<'zip' | 'pdf' | 'video' | null>(null);
  const [renderingPDF, setRenderingPDF] = useState(false);
  const [renderingVideo, setRenderingVideo] = useState(false);
  const [pages, setPages] = useState<AlbumPage[]>([]);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });
  const [videoProgress, setVideoProgress] = useState({ current: 0, total: 0, message: '' });
  const [videoPageIndex, setVideoPageIndex] = useState(0);
  const [videoWordIndex, setVideoWordIndex] = useState(-1);
  const videoPageCardRef = useRef<PageCardRef | null>(null);
  const captureResolve = useRef<((uri: string) => void) | null>(null);

  const handleExportAsZip = async () => {
    setExportType('zip');
    setExporting(true);

    try {
      console.log('[ExportModal] Starting ZIP export');
      const zipPath = await ExportService.exportAlbum(albumId);

      console.log('[ExportModal] Sharing ZIP:', zipPath);
      // Share without message to avoid creating extra files
      await ShareUtils.shareFile(
        zipPath,
        'application/zip',
        t('export.share')
      );

      // Don't unlink immediately — iOS hands the URL to the receiving app
      // asynchronously, so the file must outlive Share.open()'s resolve.
      // Stale exports are swept on app startup (ExportService.cleanupExports / PDFService.cleanupOldPDFs).

      RTLAlertStatic.alert(
        t('export.exportComplete'),
        t('export.exportComplete')
      );

      onClose();
    } catch (error: any) {
      console.error('[ExportModal] Export failed:', error);

      // Check if it was a user cancellation
      if (error?.message?.includes('User did not share') || error?.message?.includes('cancelled')) {
        console.log('[ExportModal] Export cancelled by user');
        onClose();
        return;
      }

      RTLAlertStatic.alert(
        t('export.exportFailed'),
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setExporting(false);
      setExportType(null);
    }
  };

  const handleExportAsPDF = async () => {
    setExportType('pdf');
    setExporting(true);

    try {
      console.log('[ExportModal] Starting PDF export - loading pages');

      // Load all pages
      const albumPages = await PageService.getPages(albumId);
      console.log('[ExportModal] Loaded', albumPages.length, 'pages');
      setPages(albumPages);
      setPdfProgress({ current: 0, total: albumPages.length });

      // Trigger rendering (PDFPageRenderer will handle capture)
      setRenderingPDF(true);
    } catch (error: any) {
      console.error('[ExportModal] PDF export failed:', error);
      RTLAlertStatic.alert(
        t('export.exportFailed'),
        error instanceof Error ? error.message : String(error)
      );
      setExporting(false);
      setExportType(null);
    }
  };

  const handlePDFProgress = (current: number, total: number) => {
    console.log(`[ExportModal] PDF Progress: ${current}/${total}`);
    setPdfProgress({ current, total });
  };

  const handlePagesCaptured = async (capturedPages: Array<{ base64: string; size: { width: number; height: number } }>) => {
    try {
      console.log('[ExportModal] Pages captured, generating PDF');
      setRenderingPDF(false);

      // Generate PDF from captured pages
      const pdfPath = await PDFService.generateAlbumPDFFromImages(
        albumId,
        albumName,
        capturedPages
      );

      console.log('[ExportModal] Sharing PDF:', pdfPath);
      await ShareUtils.shareFile(
        pdfPath,
        'application/pdf',
        t('export.share')
      );

      // Don't unlink immediately — iOS hands the URL to the receiving app
      // asynchronously (e.g. Preview), so the file must outlive Share.open()'s
      // resolve. Old exports are swept by PDFService.cleanupOldPDFs on app startup.

      RTLAlertStatic.alert(
        t('export.exportComplete'),
        t('export.exportComplete')
      );

      onClose();
    } catch (error: any) {
      console.error('[ExportModal] PDF generation failed:', error);

      // Check if it was a user cancellation
      if (error?.message?.includes('User did not share') || error?.message?.includes('cancelled')) {
        console.log('[ExportModal] PDF export cancelled by user');
        onClose();
        return;
      }

      RTLAlertStatic.alert(
        t('export.exportFailed'),
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setExporting(false);
      setExportType(null);
      setRenderingPDF(false);
      setPages([]);
      setPdfProgress({ current: 0, total: 0 });
    }
  };

  const handlePDFRenderError = (error: Error) => {
    console.error('[ExportModal] PDF rendering failed:', error);
    RTLAlertStatic.alert(
      t('export.exportFailed'),
      error.message
    );
    setExporting(false);
    setExportType(null);
    setRenderingPDF(false);
    setPages([]);
    setPdfProgress({ current: 0, total: 0 });
  };

  const handleExportAsVideo = async () => {
    // Check if native module is available
    if (!videoExportNative.isAvailable()) {
      RTLAlertStatic.alert(
        'Setup Required',
        'Video export requires native module setup.\n\n' +
        'Steps:\n' +
        '1. Open Xcode\n' +
        '2. Add VideoExportModule files\n' +
        '3. Add AVFoundation framework\n' +
        '4. Rebuild app\n\n' +
        'See NATIVE_VIDEO_SUMMARY.md for details.',
        [{ text: 'OK' }]
      );
      return;
    }

    setExportType('video');
    setExporting(true);
    setVideoProgress({ current: 0, total: 0, message: t('export.exportingVideo') });

    try {
      console.log('[ExportModal] Starting video export - loading pages');

      // Load all pages
      const albumPages = await PageService.getPages(albumId);
      console.log('[ExportModal] Loaded', albumPages.length, 'pages');

      if (albumPages.length === 0) {
        RTLAlertStatic.alert(t('export.exportFailed'), 'Album has no pages to export');
        setExporting(false);
        setExportType(null);
        return;
      }

      setPages(albumPages);
      setVideoProgress({ current: 0, total: albumPages.length, message: t('export.exportingVideo') });
      setRenderingVideo(true);

      // Create capture function
      const captureFrame = async (pageIndex: number, wordIndex: number): Promise<string> => {
        console.log('[ExportModal] captureFrame called:', pageIndex, wordIndex);

        // Update renderer state
        setVideoPageIndex(pageIndex);
        setVideoWordIndex(wordIndex);

        // Wait for page to be ready and captured
        return new Promise((resolve) => {
          captureResolve.current = resolve;
        });
      };

      // Get direction for transitions
      const isRTL = t('direction') === 'rtl';

      // Start video export
      const result = await simpleVideoExportService.exportAlbum(
        albumId,
        albumPages as AlbumPageV2[],
        captureFrame,
        { ...DEFAULT_EXPORT_CONFIG, isRTL },
        (progress) => {
          console.log('[ExportModal] Video progress:', progress);
          setVideoProgress({
            current: progress.currentPage,
            total: progress.totalPages,
            message: progress.message,
          });
        }
      );

      console.log('[ExportModal] Video export complete:', result);
      setRenderingVideo(false);

      // Share the video
      await ShareUtils.shareFile(
        result.videoPath,
        'video/mp4',
        t('export.share')
      );

      // Don't unlink immediately — iOS hands the URL to the receiving app
      // asynchronously, so the file must outlive Share.open()'s resolve.
      // Stale video exports are swept by VideoExportService cleanup.

      RTLAlertStatic.alert(
        t('export.exportComplete'),
        `Video exported successfully!\nDuration: ${Math.round(result.duration)}s`
      );

      onClose();
    } catch (error: any) {
      console.error('[ExportModal] Video export failed:', error);
      setRenderingVideo(false);

      // Check if it was a user cancellation
      if (error?.message?.includes('User did not share') || error?.message?.includes('cancelled')) {
        console.log('[ExportModal] Video export cancelled by user');
        onClose();
        return;
      }

      RTLAlertStatic.alert(
        t('export.exportFailed'),
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setExporting(false);
      setExportType(null);
      setVideoProgress({ current: 0, total: 0, message: '' });
      setPages([]);
    }
  };

  const handleVideoPageReady = useCallback(async (pageCardRef: PageCardRef) => {
    console.log('[ExportModal] Video page ready, capturing...');

    try {
      if (!pageCardRef.captureScreenshot) {
        throw new Error('PageCard captureScreenshot not available');
      }

      const uri = await pageCardRef.captureScreenshot();
      console.log('[ExportModal] Screenshot captured:', uri);

      // Resolve the waiting promise
      if (captureResolve.current) {
        captureResolve.current(uri);
        captureResolve.current = null;
      }
    } catch (error) {
      console.error('[ExportModal] Failed to capture video frame:', error);
      if (captureResolve.current) {
        captureResolve.current(''); // Resolve with empty to avoid hanging
        captureResolve.current = null;
      }
    }
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={MODAL_ORIENTATIONS}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text allowFontScaling={false} style={styles.title}>{t('export.share')}</Text>
          <Text allowFontScaling={false} style={styles.subtitle}>{albumName}</Text>

          {exporting ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text allowFontScaling={false} style={styles.loadingText}>
                {exportType === 'zip'
                  ? t('export.exportingAlbum')
                  : exportType === 'pdf' && pdfProgress.total > 0
                  ? `${t('export.capturingPages')} ${pdfProgress.current}/${pdfProgress.total}`
                  : exportType === 'video' && videoProgress.total > 0
                  ? videoProgress.message || `${t('export.exportingVideo')} ${videoProgress.current}/${videoProgress.total}`
                  : exportType === 'video'
                  ? t('export.exportingVideo')
                  : t('export.exportingPDF')}
              </Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.option}
                onPress={handleExportAsZip}
              >
                <Text allowFontScaling={false} style={styles.optionIcon}>📦</Text>
                <View style={styles.optionText}>
                  <Text allowFontScaling={false} style={styles.optionTitle}>
                    {t('export.exportAsAlbum')}
                  </Text>
                  <Text allowFontScaling={false} style={styles.optionDescription}>
                    {t('export.exportAsAlbumDesc')}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.option}
                onPress={handleExportAsPDF}
              >
                <Text allowFontScaling={false} style={styles.optionIcon}>📄</Text>
                <View style={styles.optionText}>
                  <Text allowFontScaling={false} style={styles.optionTitle}>
                    {t('export.exportAsPDF')}
                  </Text>
                  <Text allowFontScaling={false} style={styles.optionDescription}>
                    {t('export.exportAsPDFDesc')}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.option}
                onPress={handleExportAsVideo}
              >
                <Text allowFontScaling={false} style={styles.optionIcon}>🎬</Text>
                <View style={styles.optionText}>
                  <Text allowFontScaling={false} style={styles.optionTitle}>
                    {t('export.exportAsVideo')}
                  </Text>
                  <Text allowFontScaling={false} style={styles.optionDescription}>
                    {t('export.exportAsVideoDesc')}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
              >
                <Text allowFontScaling={false} style={styles.cancelText}>
                  {t('home.cancel')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Hidden PDF page renderer */}
      {renderingPDF && pages.length > 0 && (
        <PDFPageRenderer
          pages={pages}
          albumId={albumId}
          onPagesCaptured={handlePagesCaptured}
          onError={handlePDFRenderError}
          onProgress={handlePDFProgress}
        />
      )}

      {/* Hidden video page renderer */}
      {renderingVideo && pages.length > 0 && (
        <VideoPageRenderer
          pages={pages as AlbumPageV2[]}
          albumId={albumId}
          currentPageIndex={videoPageIndex}
          highlightedWordIndex={videoWordIndex}
          onPageReady={handleVideoPageReady}
        />
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '80%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 12,
  },
  optionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    color: '#666',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
});
