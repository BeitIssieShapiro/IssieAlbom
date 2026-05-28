import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { RTLAlertStatic } from './RTLAlert';
import Share from 'react-native-share';
import { AlbumPageV2 } from '../types/Album';
import {
  VideoExportConfig,
  ExportProgress,
  VideoExportResult,
  DEFAULT_EXPORT_CONFIG,
} from '../types/VideoExport';
import { videoExportService } from '../services/VideoExportService';
import { MyIcon } from '../common/icons';

interface VideoExportModalProps {
  visible: boolean;
  onClose: () => void;
  albumId: string;
  albumName: string;
  pages: AlbumPageV2[];
  canvasRef: React.RefObject<any>;
}

export function VideoExportModal({
  visible,
  onClose,
  albumId,
  albumName,
  pages,
  canvasRef,
}: VideoExportModalProps) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<VideoExportResult | null>(null);

  // Export configuration state
  const [config, setConfig] = useState<VideoExportConfig>({
    ...DEFAULT_EXPORT_CONFIG,
  });

  const handleExport = async () => {
    if (!canvasRef.current) {
      RTLAlertStatic.alert('Error', 'Canvas not ready. Please try again.');
      return;
    }

    setExporting(true);
    setResult(null);
    setProgress(null);

    try {
      const exportResult = await videoExportService.exportAlbum(
        albumId,
        pages,
        canvasRef,
        config,
        (progressUpdate) => {
          setProgress(progressUpdate);
        }
      );

      setResult(exportResult);
      setExporting(false);

      // Show success message
      RTLAlertStatic.alert(
        'Export Complete',
        `Video exported successfully!\nDuration: ${Math.round(exportResult.duration)}s\nSize: ${formatFileSize(exportResult.fileSize)}`,
        [
          { text: 'Share', onPress: () => handleShare(exportResult.videoPath) },
          { text: 'OK', style: 'cancel' },
        ]
      );
    } catch (error) {
      console.error('Export failed:', error);
      setExporting(false);
      RTLAlertStatic.alert('Export Failed', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleShare = async (videoPath: string) => {
    try {
      await Share.open({
        url: `file://${videoPath}`,
        type: 'video/mp4',
        title: `${albumName} - Video`,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const handleClose = () => {
    if (!exporting) {
      onClose();
      // Reset state after animation
      setTimeout(() => {
        setProgress(null);
        setResult(null);
      }, 300);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text allowFontScaling={false} style={styles.title}>Export to Video</Text>
            {!exporting && (
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <MyIcon info={{ name: 'close', size: 24, color: '#333', type: 'MDI' }} />
              </TouchableOpacity>
            )}
          </View>

          {/* Configuration Options (shown when not exporting) */}
          {!exporting && !result && (
            <View style={styles.configSection}>
              {/* Quality Selection */}
              <View style={styles.configGroup}>
                <Text allowFontScaling={false} style={styles.configLabel}>Quality</Text>
                <View style={styles.buttonGroup}>
                  {(['low', 'medium', 'high'] as const).map((quality) => (
                    <TouchableOpacity
                      key={quality}
                      style={[
                        styles.optionButton,
                        config.quality === quality && styles.optionButtonActive,
                      ]}
                      onPress={() => setConfig({ ...config, quality })}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.optionButtonText,
                          config.quality === quality && styles.optionButtonTextActive,
                        ]}
                      >
                        {quality.charAt(0).toUpperCase() + quality.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Static Page Duration */}
              <View style={styles.configGroup}>
                <Text allowFontScaling={false} style={styles.configLabel}>
                  Duration per page (no audio): {config.staticPageDuration}s
                </Text>
                <View style={styles.buttonGroup}>
                  {[3, 5, 7, 10].map((duration) => (
                    <TouchableOpacity
                      key={duration}
                      style={[
                        styles.optionButton,
                        config.staticPageDuration === duration && styles.optionButtonActive,
                      ]}
                      onPress={() => setConfig({ ...config, staticPageDuration: duration })}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.optionButtonText,
                          config.staticPageDuration === duration &&
                            styles.optionButtonTextActive,
                        ]}
                      >
                        {duration}s
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Album Info */}
              <View style={styles.infoBox}>
                <Text allowFontScaling={false} style={styles.infoText}>
                  Album: <Text allowFontScaling={false} style={styles.infoTextBold}>{albumName}</Text>
                </Text>
                <Text allowFontScaling={false} style={styles.infoText}>
                  Pages: <Text allowFontScaling={false} style={styles.infoTextBold}>{pages.length}</Text>
                </Text>
              </View>

              {/* Export Button */}
              <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
                <MyIcon info={{ name: 'video', size: 24, color: '#fff', type: 'MDI' }} />
                <Text allowFontScaling={false} style={styles.exportButtonText}>Export Video</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Progress (shown during export) */}
          {exporting && progress && (
            <View style={styles.progressSection}>
              <ActivityIndicator size="large" color="#C8572A" />
              <Text allowFontScaling={false} style={styles.progressMessage}>{progress.message}</Text>
              <Text allowFontScaling={false} style={styles.progressDetails}>
                {progress.phase === 'capturing' &&
                  `Page ${progress.currentPage} of ${progress.totalPages}`}
                {progress.phase === 'assembling' && 'This may take a few moments...'}
              </Text>
              <View style={styles.progressBarContainer}>
                <View
                  style={[styles.progressBar, { width: `${progress.percentage}%` }]}
                />
              </View>
              <Text allowFontScaling={false} style={styles.progressPercentage}>{progress.percentage}%</Text>
            </View>
          )}

          {/* Result (shown after successful export) */}
          {result && (
            <View style={styles.resultSection}>
              <MyIcon
                info={{ name: 'check-circle', size: 64, color: '#4CAF50', type: 'MDI' }}
              />
              <Text allowFontScaling={false} style={styles.resultTitle}>Export Complete!</Text>
              <View style={styles.resultDetails}>
                <Text allowFontScaling={false} style={styles.resultText}>
                  Duration: {Math.round(result.duration)}s
                </Text>
                <Text allowFontScaling={false} style={styles.resultText}>
                  Size: {formatFileSize(result.fileSize)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => handleShare(result.videoPath)}
              >
                <MyIcon info={{ name: 'share', size: 24, color: '#fff', type: 'MDI' }} />
                <Text allowFontScaling={false} style={styles.shareButtonText}>Share Video</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
                <Text allowFontScaling={false} style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '85%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },

  // Configuration Section
  configSection: {
    gap: 20,
  },
  configGroup: {
    gap: 10,
  },
  configLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: '#C8572A',
    borderColor: '#C8572A',
  },
  optionButtonText: {
    fontSize: 14,
    color: '#666',
  },
  optionButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  infoTextBold: {
    fontWeight: '600',
    color: '#333',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C8572A',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },

  // Progress Section
  progressSection: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 20,
  },
  progressMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  progressDetails: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#C8572A',
  },
  progressPercentage: {
    fontSize: 18,
    fontWeight: '600',
    color: '#C8572A',
  },

  // Result Section
  resultSection: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 20,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  resultDetails: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    width: '100%',
    gap: 6,
  },
  resultText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
    width: '100%',
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  doneButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  doneButtonText: {
    fontSize: 16,
    color: '#666',
  },
});
