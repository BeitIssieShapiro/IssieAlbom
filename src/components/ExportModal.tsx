import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import RNFS from 'react-native-fs';
import { useLanguage } from '../contexts/LanguageContext';
import { ExportService } from '../services/ExportService';
import { PDFService } from '../services/PDFService';
import { PageService } from '../services/PageService';
import { ShareUtils } from '../utils/ShareUtils';
import { PDFPageRenderer } from './PDFPageRenderer';
import { AlbumPage, MODAL_ORIENTATIONS } from '../types/Album';

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
  const [exportType, setExportType] = useState<'zip' | 'pdf' | null>(null);
  const [renderingPDF, setRenderingPDF] = useState(false);
  const [pages, setPages] = useState<AlbumPage[]>([]);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });

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

      // Clean up the exported ZIP after sharing
      // (The temporary directory cleanup will also run, but this is immediate)
      try {
        const exists = await RNFS.exists(zipPath);
        if (exists) {
          await RNFS.unlink(zipPath);
        }
      } catch (cleanupError) {
        console.warn('[ExportModal] Failed to cleanup ZIP:', cleanupError);
      }

      Alert.alert(
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

      Alert.alert(
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
      Alert.alert(
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

      // Clean up the PDF after sharing
      try {
        const exists = await RNFS.exists(pdfPath);
        if (exists) {
          await RNFS.unlink(pdfPath);
        }
      } catch (cleanupError) {
        console.warn('[ExportModal] Failed to cleanup PDF:', cleanupError);
      }

      Alert.alert(
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

      Alert.alert(
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
    Alert.alert(
      t('export.exportFailed'),
      error.message
    );
    setExporting(false);
    setExportType(null);
    setRenderingPDF(false);
    setPages([]);
    setPdfProgress({ current: 0, total: 0 });
  };

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
          <Text style={styles.title}>{t('export.share')}</Text>
          <Text style={styles.subtitle}>{albumName}</Text>

          {exporting ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>
                {exportType === 'zip'
                  ? t('export.exportingAlbum')
                  : exportType === 'pdf' && pdfProgress.total > 0
                  ? `${t('export.capturingPages')} ${pdfProgress.current}/${pdfProgress.total}`
                  : t('export.exportingPDF')}
              </Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.option}
                onPress={handleExportAsZip}
              >
                <Text style={styles.optionIcon}>📦</Text>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>
                    {t('export.exportAsAlbum')}
                  </Text>
                  <Text style={styles.optionDescription}>
                    {t('export.exportAsAlbumDesc')}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.option}
                onPress={handleExportAsPDF}
              >
                <Text style={styles.optionIcon}>📄</Text>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>
                    {t('export.exportAsPDF')}
                  </Text>
                  <Text style={styles.optionDescription}>
                    {t('export.exportAsPDFDesc')}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
              >
                <Text style={styles.cancelText}>
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
