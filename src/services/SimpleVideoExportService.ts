import RNFS from 'react-native-fs';
import { AlbumPageV2 } from '../types/Album';
import {
  VideoExportConfig,
  PageFrameData,
  ExportProgress,
  VideoExportResult,
  DEFAULT_EXPORT_CONFIG,
} from '../types/VideoExport';
import { AttachmentService } from './AttachmentService';
import { compileQueueToElements } from '../utils/pageUtils';
import { AudioUtils } from '../utils/audioUtils';
import { videoExportNative, FrameData, AudioTrackData } from './VideoExportNative';

/**
 * VideoExportService - Simple version
 *
 * Works with VideoPageRenderer to capture frames page by page
 */
export class SimpleVideoExportService {
  private tempDir: string;
  private progressCallback?: (progress: ExportProgress) => void;

  constructor() {
    this.tempDir = `${RNFS.CachesDirectoryPath}/video_export`;
  }

  /**
   * Export an album to video - simplified for single page capture
   */
  async exportAlbum(
    albumId: string,
    pages: AlbumPageV2[],
    onCaptureFrame: (pageIndex: number, wordIndex: number) => Promise<string>,
    config: Partial<VideoExportConfig> = {},
    onProgress?: (progress: ExportProgress) => void
  ): Promise<VideoExportResult> {
    const fullConfig = { ...DEFAULT_EXPORT_CONFIG, ...config };
    this.progressCallback = onProgress;

    try {
      // Phase 1: Prepare
      this.reportProgress('preparing', 0, pages.length, 'Preparing export...');
      await this.ensureTempDirectory();

      // Get dimensions from first page
      const firstPage = pages[0];
      const videoWidth = fullConfig.width || firstPage.canvasWidth || 1080;
      const videoHeight = fullConfig.height || firstPage.canvasHeight || 1920;
      console.log('[SimpleVideoExportService] Video dimensions:', videoWidth, 'x', videoHeight);

      // Phase 2: Capture frames for each page
      this.reportProgress('capturing', 0, pages.length, 'Capturing page frames...');
      const pageFrameData: PageFrameData[] = [];

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        this.reportProgress(
          'capturing',
          i + 1,
          pages.length,
          `Capturing page ${i + 1} of ${pages.length}...`
        );

        const frameData = await this.capturePageFrames(
          page,
          albumId,
          i,
          fullConfig,
          onCaptureFrame
        );
        pageFrameData.push(frameData);
      }

      // Phase 3: Generate transitions between pages
      if (pages.length > 1) {
        this.reportProgress('capturing', pages.length, pages.length, 'Generating transitions...');
        await this.generateTransitions(
          pageFrameData,
          fullConfig,
          videoWidth,
          videoHeight
        );
      }

      // Phase 4: Assemble video
      this.reportProgress('assembling', pages.length, pages.length, 'Assembling video...');
      const videoResult = await this.assembleVideo(
        pageFrameData,
        albumId,
        fullConfig,
        videoWidth,
        videoHeight
      );

      // Phase 5: Cleanup
      await this.cleanup();

      // Phase 6: Complete
      this.reportProgress('complete', pages.length, pages.length, 'Export complete!');
      return videoResult;
    } catch (error) {
      console.error('[SimpleVideoExportService] Export failed:', error);
      this.reportProgress('error', 0, pages.length, 'Export failed', error as Error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Capture frames for a single page
   */
  private async capturePageFrames(
    page: AlbumPageV2,
    albumId: string,
    pageIndex: number,
    config: VideoExportConfig,
    onCaptureFrame: (pageIndex: number, wordIndex: number) => Promise<string>
  ): Promise<PageFrameData> {
    const compiled = compileQueueToElements(page.elements);
    const audioElement = compiled.audios[0]; // Assume one audio per page

    if (!audioElement || !audioElement.audioPath) {
      // Static page - split into multiple frames for better encoding
      const frameUri = await onCaptureFrame(pageIndex, -1);
      const framePath = `${this.tempDir}/page_${pageIndex}_frame_0.jpg`;
      await RNFS.copyFile(frameUri.replace('file://', ''), framePath);

      console.log(`[SimpleVideoExportService] Static page ${pageIndex}: duration=${config.staticPageDuration}s`);

      // Split into 1-second frames for better video encoding
      const numFrames = Math.ceil(config.staticPageDuration);
      const framePaths: string[] = [];
      const frameDurations: number[] = [];

      for (let i = 0; i < numFrames; i++) {
        framePaths.push(framePath); // Reuse same image
        frameDurations.push(i === numFrames - 1 ? config.staticPageDuration - i : 1.0);
      }

      return {
        framePaths,
        frameDurations,
        totalDuration: config.staticPageDuration,
      };
    }

    // Audio page
    const absoluteAudioPath = AttachmentService.getAbsolutePath(albumId, audioElement.audioPath);
    const wordTimings = audioElement.wordTimings || [];

    if (wordTimings.length === 0) {
      // No word timings - single frame with audio
      const frameUri = await onCaptureFrame(pageIndex, -1);
      const framePath = `${this.tempDir}/page_${pageIndex}_frame_0.jpg`;
      await RNFS.copyFile(frameUri.replace('file://', ''), framePath);

      const audioDuration = await AudioUtils.getAudioDuration(absoluteAudioPath);

      return {
        framePaths: [framePath],
        frameDurations: [audioDuration],
        audioPath: absoluteAudioPath,
        totalDuration: audioDuration + config.finalFrameDuration,
      };
    }

    // Audio page with word timings - multiple frames
    const framePaths: string[] = [];
    const frameDurations: number[] = [];

    // Frame 0: Initial state (before first word)
    const initialUri = await onCaptureFrame(pageIndex, -1);
    const initialPath = `${this.tempDir}/page_${pageIndex}_frame_0.jpg`;
    await RNFS.copyFile(initialUri.replace('file://', ''), initialPath);
    framePaths.push(initialPath);
    frameDurations.push(wordTimings[0].startTime);

    // Frames 1-N: One frame per word
    for (let i = 0; i < wordTimings.length; i++) {
      const frameUri = await onCaptureFrame(pageIndex, i);
      const framePath = `${this.tempDir}/page_${pageIndex}_frame_${i + 1}.jpg`;
      await RNFS.copyFile(frameUri.replace('file://', ''), framePath);

      framePaths.push(framePath);

      const endTime = AudioUtils.calculateWordEndTime(i, wordTimings);
      frameDurations.push(endTime - wordTimings[i].startTime);
    }

    // Final frame: After audio ends
    const finalUri = await onCaptureFrame(pageIndex, -1);
    const finalPath = `${this.tempDir}/page_${pageIndex}_frame_final.jpg`;
    await RNFS.copyFile(finalUri.replace('file://', ''), finalPath);
    framePaths.push(finalPath);
    frameDurations.push(config.finalFrameDuration);

    const totalDuration = frameDurations.reduce((sum, d) => sum + d, 0);

    return {
      framePaths,
      frameDurations,
      audioPath: absoluteAudioPath,
      totalDuration,
    };
  }

  /**
   * Generate slide transition frames between pages
   * Note: Actual transition compositing is handled by native module
   */
  private async generateTransitions(
    pageFrameData: PageFrameData[],
    config: VideoExportConfig,
    videoWidth: number,
    videoHeight: number
  ): Promise<void> {
    // Log transition info for debugging
    for (let i = 0; i < pageFrameData.length - 1; i++) {
      const currentPage = pageFrameData[i];
      const nextPage = pageFrameData[i + 1];

      const currentFramePath = currentPage.framePaths[currentPage.framePaths.length - 1];
      const nextFramePath = nextPage.framePaths[0];

      console.log(`[SimpleVideoExportService] Transition ${i + 1}: ${currentFramePath} -> ${nextFramePath}`);
    }
  }

  /**
   * Assemble video using native AVFoundation
   */
  private async assembleVideo(
    pageFrameData: PageFrameData[],
    albumId: string,
    config: VideoExportConfig,
    videoWidth: number,
    videoHeight: number
  ): Promise<VideoExportResult> {
    const outputPath = `${RNFS.DocumentDirectoryPath}/albums/${albumId}/export_${Date.now()}.${config.videoFormat}`;

    // Collect all frames with transitions
    const allFrames: FrameData[] = [];
    for (let i = 0; i < pageFrameData.length; i++) {
      const pageData = pageFrameData[i];
      const isLastPage = i === pageFrameData.length - 1;

      console.log(`[SimpleVideoExportService] Page ${i}: ${pageData.framePaths.length} frames, durations:`, pageData.frameDurations);

      // Add all page frames (including last frame for now)
      for (let j = 0; j < pageData.framePaths.length; j++) {
        console.log(`[SimpleVideoExportService] Adding frame ${j} of page ${i}: duration=${pageData.frameDurations[j]}s`);
        allFrames.push({
          imagePath: pageData.framePaths[j],
          duration: pageData.frameDurations[j],
        });
      }

      // Add transition frames (except after last page)
      if (!isLastPage) {
        console.log(`[SimpleVideoExportService] Adding ${config.transitionFrames} transition frames between page ${i} and ${i + 1}`);
        const currentLastFrame = pageData.framePaths[pageData.framePaths.length - 1];
        const nextFirstFrame = pageFrameData[i + 1].framePaths[0];
        const frameDuration = config.transitionDuration / config.transitionFrames;

        for (let t = 0; t < config.transitionFrames; t++) {
          const progress = (t + 1) / config.transitionFrames;
          allFrames.push({
            imagePath: currentLastFrame,
            duration: frameDuration,
            transition: {
              toImagePath: nextFirstFrame,
              progress,
              direction: config.isRTL ? 'right' : 'left',
            },
          });
        }
      }
    }

    console.log(`[SimpleVideoExportService] Total frames assembled: ${allFrames.length}`);

    // Collect audio tracks with their start times
    const audioTracks: AudioTrackData[] = [];
    let currentTime = 0;
    for (const pageData of pageFrameData) {
      if (pageData.audioPath) {
        audioTracks.push({
          audioPath: pageData.audioPath,
          startTime: currentTime,
        });
      }
      currentTime += pageData.totalDuration;
    }

    // Add time for transitions
    const transitionTime = config.transitionDuration * (pageFrameData.length - 1);
    currentTime += transitionTime;

    console.log('[SimpleVideoExportService] Exporting with native module');
    console.log('[SimpleVideoExportService] Frames:', allFrames.length);
    console.log('[SimpleVideoExportService] Audio tracks:', audioTracks.length);
    console.log('[SimpleVideoExportService] Dimensions:', videoWidth, 'x', videoHeight);

    // Call native module
    const result = await videoExportNative.exportVideo(
      allFrames,
      audioTracks,
      outputPath,
      videoWidth,
      videoHeight,
      config.frameRate,
      (progress) => {
        console.log('[SimpleVideoExportService] Native progress:', progress);
        if (this.progressCallback) {
          this.progressCallback({
            phase: 'assembling',
            currentPage: progress.currentFrame,
            totalPages: progress.totalFrames,
            percentage: progress.percentage,
            message: `Encoding video... ${progress.percentage}%`,
          });
        }
      }
    );

    // Get file stats
    const fileStats = await RNFS.stat(outputPath);

    return {
      videoPath: outputPath,
      duration: currentTime,
      fileSize: fileStats.size,
    };
  }

  private async ensureTempDirectory(): Promise<void> {
    const exists = await RNFS.exists(this.tempDir);
    if (exists) {
      await RNFS.unlink(this.tempDir);
    }
    await RNFS.mkdir(this.tempDir);
  }

  private async cleanup(): Promise<void> {
    try {
      const exists = await RNFS.exists(this.tempDir);
      if (exists) {
        await RNFS.unlink(this.tempDir);
      }
    } catch (error) {
      console.warn('[SimpleVideoExportService] Cleanup failed:', error);
    }
  }

  private reportProgress(
    phase: ExportProgress['phase'],
    currentPage: number,
    totalPages: number,
    message: string,
    error?: Error
  ): void {
    if (!this.progressCallback) return;

    const percentage = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

    this.progressCallback({
      phase,
      currentPage,
      totalPages,
      percentage,
      message,
      error: error?.message,
    });
  }
}

export const simpleVideoExportService = new SimpleVideoExportService();
