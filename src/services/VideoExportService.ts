import RNFS from 'react-native-fs';
import { FFmpegKit, FFmpegKitConfig, ReturnCode } from 'ffmpeg-kit-react-native';
import { captureRef } from 'react-native-view-shot';
import { AlbumPageV2, WordTiming } from '../types/Album';
import {
  VideoExportConfig,
  PageFrameData,
  ExportProgress,
  VideoExportResult,
  DEFAULT_EXPORT_CONFIG,
} from '../types/VideoExport';
import { AlbumService } from './AlbumService';
import { AttachmentService } from './AttachmentService';
import { compileQueueToElements } from '../utils/pageUtils';
import { AudioUtils } from '../utils/audioUtils';

/**
 * VideoExportService
 *
 * Exports an album to a video file with audio support.
 *
 * For pages without audio:
 * - Creates a single static frame displayed for configured duration
 *
 * For pages with audio:
 * - Creates multiple frames:
 *   1. Initial frame (before audio starts)
 *   2. One frame per word highlight (synced to wordTimings)
 *   3. Final frame (after audio ends)
 * - Syncs audio track to video timeline
 */
export class VideoExportService {
  private tempDir: string;
  private progressCallback?: (progress: ExportProgress) => void;

  constructor() {
    this.tempDir = `${RNFS.CachesDirectoryPath}/video_export`;
  }

  /**
   * Export an album to video
   */
  async exportAlbum(
    albumId: string,
    pages: AlbumPageV2[],
    canvasRef: React.RefObject<any>,
    config: Partial<VideoExportConfig> = {},
    onProgress?: (progress: ExportProgress) => void
  ): Promise<VideoExportResult> {
    const fullConfig = { ...DEFAULT_EXPORT_CONFIG, ...config };
    this.progressCallback = onProgress;

    try {
      // Phase 1: Prepare
      this.reportProgress('preparing', 0, pages.length, 'Preparing export...');
      await this.ensureTempDirectory();

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

        const frameData = await this.capturePage(
          page,
          albumId,
          canvasRef,
          fullConfig,
          i
        );
        pageFrameData.push(frameData);
      }

      // Phase 3: Assemble video
      this.reportProgress('assembling', pages.length, pages.length, 'Assembling video...');
      const videoResult = await this.assembleVideo(
        pageFrameData,
        albumId,
        fullConfig
      );

      // Phase 4: Cleanup
      await this.cleanup();

      // Phase 5: Complete
      this.reportProgress('complete', pages.length, pages.length, 'Export complete!');
      return videoResult;
    } catch (error) {
      console.error('[VideoExportService] Export failed:', error);
      this.reportProgress('error', 0, pages.length, 'Export failed', error as Error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Capture frames for a single page
   */
  private async capturePage(
    page: AlbumPageV2,
    albumId: string,
    canvasRef: React.RefObject<any>,
    config: VideoExportConfig,
    pageIndex: number
  ): Promise<PageFrameData> {
    const compiled = compileQueueToElements(page.elements);
    const audioElement = compiled.audios[0]; // Assume one audio per page

    if (!audioElement || !audioElement.audioPath) {
      // Static page - single frame
      return this.captureStaticPage(canvasRef, config, pageIndex);
    }

    // Audio page - multiple frames with word timings
    return this.captureAudioPage(
      page,
      albumId,
      canvasRef,
      audioElement.audioPath,
      audioElement.wordTimings || [],
      config,
      pageIndex
    );
  }

  /**
   * Capture a static page (no audio)
   */
  private async captureStaticPage(
    canvasRef: React.RefObject<any>,
    config: VideoExportConfig,
    pageIndex: number
  ): Promise<PageFrameData> {
    // Capture single frame
    const frameUri = await captureRef(canvasRef, {
      format: 'jpg',
      quality: this.getQuality(config.quality),
    });

    // Save to temp directory
    const framePath = `${this.tempDir}/page_${pageIndex}_frame_0.jpg`;
    await RNFS.copyFile(frameUri.replace('file://', ''), framePath);

    return {
      framePaths: [framePath],
      frameDurations: [config.staticPageDuration],
      totalDuration: config.staticPageDuration,
    };
  }

  /**
   * Capture an audio page with word highlighting
   */
  private async captureAudioPage(
    page: AlbumPageV2,
    albumId: string,
    canvasRef: React.RefObject<any>,
    audioPath: string,
    wordTimings: WordTiming[],
    config: VideoExportConfig,
    pageIndex: number
  ): Promise<PageFrameData> {
    const framePaths: string[] = [];
    const frameDurations: number[] = [];

    // Get absolute audio path
    const absoluteAudioPath = AttachmentService.getAbsolutePath(albumId, audioPath);

    if (wordTimings.length === 0) {
      // No word timings - treat as static with audio overlay
      // Capture single frame
      const frameUri = await captureRef(canvasRef, {
        format: 'jpg',
        quality: this.getQuality(config.quality),
      });

      const framePath = `${this.tempDir}/page_${pageIndex}_frame_0.jpg`;
      await RNFS.copyFile(frameUri.replace('file://', ''), framePath);

      // Get actual audio duration
      const audioDuration = await AudioUtils.getAudioDuration(absoluteAudioPath);

      framePaths.push(framePath);
      frameDurations.push(audioDuration);

      return {
        framePaths,
        frameDurations,
        audioPath: absoluteAudioPath,
        totalDuration: audioDuration + config.finalFrameDuration,
      };
    }

    // Frame 0: Initial state (before first word)
    const initialUri = await this.captureFrameWithHighlight(canvasRef, -1, config);
    const initialPath = `${this.tempDir}/page_${pageIndex}_frame_0.jpg`;
    await RNFS.copyFile(initialUri.replace('file://', ''), initialPath);
    framePaths.push(initialPath);
    frameDurations.push(wordTimings[0].startTime);

    // Frames 1-N: One frame per word
    for (let i = 0; i < wordTimings.length; i++) {
      const frameUri = await this.captureFrameWithHighlight(canvasRef, i, config);
      const framePath = `${this.tempDir}/page_${pageIndex}_frame_${i + 1}.jpg`;
      await RNFS.copyFile(frameUri.replace('file://', ''), framePath);

      framePaths.push(framePath);

      // Calculate duration for this frame
      const startTime = wordTimings[i].startTime;
      const endTime = AudioUtils.calculateWordEndTime(i, wordTimings);

      frameDurations.push(endTime - startTime);
    }

    // Final frame: After audio ends
    const lastWordEndTime = wordTimings[wordTimings.length - 1].startTime + 1;
    const finalUri = await this.captureFrameWithHighlight(canvasRef, -1, config);
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
   * Capture a frame with a specific word highlighted
   *
   * This is a placeholder - in the actual implementation, we'll need to:
   * 1. Update the canvas component state to highlight the word
   * 2. Wait for render
   * 3. Capture the frame
   * 4. Reset highlight state
   *
   * For now, just capture the current state
   */
  private async captureFrameWithHighlight(
    canvasRef: React.RefObject<any>,
    wordIndex: number,
    config: VideoExportConfig
  ): Promise<string> {
    // TODO: Implement word highlighting logic
    // This will require cooperation from the PageCard/Canvas component
    // to accept a highlightedWordIndex prop

    return captureRef(canvasRef, {
      format: 'jpg',
      quality: this.getQuality(config.quality),
    });
  }

  /**
   * Assemble all page frames into a video using FFmpeg
   */
  private async assembleVideo(
    pageFrameData: PageFrameData[],
    albumId: string,
    config: VideoExportConfig
  ): Promise<VideoExportResult> {
    // Create FFmpeg command to assemble video
    const outputPath = `${RNFS.DocumentDirectoryPath}/albums/${albumId}/export_${Date.now()}.${config.videoFormat}`;

    // Build concat demuxer file
    const concatFilePath = `${this.tempDir}/concat.txt`;
    await this.buildConcatFile(pageFrameData, concatFilePath);

    // Build FFmpeg command
    const ffmpegCommand = this.buildFFmpegCommand(
      pageFrameData,
      concatFilePath,
      outputPath,
      config
    );

    console.log('[VideoExportService] FFmpeg command:', ffmpegCommand);

    // Execute FFmpeg
    const session = await FFmpegKit.execute(ffmpegCommand);
    const returnCode = await session.getReturnCode();

    if (!ReturnCode.isSuccess(returnCode)) {
      const output = await session.getOutput();
      const failStackTrace = await session.getFailStackTrace();
      console.error('[VideoExportService] FFmpeg failed:', output);
      console.error('[VideoExportService] Stack trace:', failStackTrace);
      throw new Error(`FFmpeg failed with return code ${returnCode}`);
    }

    // Get video file info
    const fileStats = await RNFS.stat(outputPath);
    const totalDuration = pageFrameData.reduce((sum, page) => sum + page.totalDuration, 0);

    return {
      videoPath: outputPath,
      duration: totalDuration,
      fileSize: fileStats.size,
    };
  }

  /**
   * Build FFmpeg concat demuxer file
   */
  private async buildConcatFile(
    pageFrameData: PageFrameData[],
    outputPath: string
  ): Promise<void> {
    const lines: string[] = [];

    for (const pageData of pageFrameData) {
      for (let i = 0; i < pageData.framePaths.length; i++) {
        const framePath = pageData.framePaths[i];
        const duration = pageData.frameDurations[i];

        lines.push(`file '${framePath}'`);
        lines.push(`duration ${duration}`);
      }
    }

    // Duplicate last frame (FFmpeg concat demuxer requirement)
    if (pageFrameData.length > 0) {
      const lastPage = pageFrameData[pageFrameData.length - 1];
      const lastFrame = lastPage.framePaths[lastPage.framePaths.length - 1];
      lines.push(`file '${lastFrame}'`);
    }

    await RNFS.writeFile(outputPath, lines.join('\n'), 'utf8');
  }

  /**
   * Build FFmpeg command
   */
  private buildFFmpegCommand(
    pageFrameData: PageFrameData[],
    concatFilePath: string,
    outputPath: string,
    config: VideoExportConfig
  ): string {
    const parts: string[] = [];

    // Input: concat demuxer for images
    parts.push(`-f concat -safe 0 -i "${concatFilePath}"`);

    // Collect audio files and their start times
    const audioInputs: string[] = [];
    const audioFilters: string[] = [];
    let currentTime = 0;

    for (const pageData of pageFrameData) {
      if (pageData.audioPath) {
        const inputIndex = audioInputs.length + 1; // +1 because input 0 is the concat file
        audioInputs.push(`-i "${pageData.audioPath}"`);
        audioFilters.push(`[${inputIndex}:a]adelay=${currentTime * 1000}|${currentTime * 1000}[a${inputIndex}]`);
      }
      currentTime += pageData.totalDuration;
    }

    // Add audio inputs
    if (audioInputs.length > 0) {
      parts.push(audioInputs.join(' '));
    }

    // Video filter: scale and set frame rate
    const videoFilter = `fps=${config.frameRate}`;
    parts.push(`-vf "${videoFilter}"`);

    // Audio filter: mix all audio tracks
    if (audioFilters.length > 0) {
      const mixInputs = audioFilters.map((_, i) => `[a${i + 1}]`).join('');
      const audioFilterComplex = `${audioFilters.join(';')};${mixInputs}amix=inputs=${audioFilters.length}:duration=longest[aout]`;
      parts.push(`-filter_complex "${audioFilterComplex}"`);
      parts.push('-map 0:v -map "[aout]"');
    } else {
      parts.push('-map 0:v');
    }

    // Encoding settings based on quality
    const { videoCodec, audioBitrate, videoBitrate } = this.getEncodingSettings(config);
    parts.push(`-c:v ${videoCodec}`);

    if (audioInputs.length > 0) {
      parts.push('-c:a aac');
      parts.push(`-b:a ${audioBitrate}`);
    }

    parts.push(`-b:v ${videoBitrate}`);

    // Pixel format for compatibility
    parts.push('-pix_fmt yuv420p');

    // Output path
    parts.push(`"${outputPath}"`);

    return parts.join(' ');
  }

  /**
   * Get encoding settings based on quality preset
   */
  private getEncodingSettings(config: VideoExportConfig): {
    videoCodec: string;
    videoBitrate: string;
    audioBitrate: string;
  } {
    switch (config.quality) {
      case 'low':
        return {
          videoCodec: 'libx264',
          videoBitrate: '1M',
          audioBitrate: '64k',
        };
      case 'medium':
        return {
          videoCodec: 'libx264',
          videoBitrate: '3M',
          audioBitrate: '128k',
        };
      case 'high':
        return {
          videoCodec: 'libx264',
          videoBitrate: '6M',
          audioBitrate: '192k',
        };
    }
  }

  /**
   * Get quality value for view-shot
   */
  private getQuality(quality: 'low' | 'medium' | 'high'): number {
    switch (quality) {
      case 'low':
        return 0.6;
      case 'medium':
        return 0.8;
      case 'high':
        return 1.0;
    }
  }

  /**
   * Ensure temp directory exists
   */
  private async ensureTempDirectory(): Promise<void> {
    const exists = await RNFS.exists(this.tempDir);
    if (exists) {
      // Clean old temp files
      await RNFS.unlink(this.tempDir);
    }
    await RNFS.mkdir(this.tempDir);
  }

  /**
   * Cleanup temp files
   */
  private async cleanup(): Promise<void> {
    try {
      const exists = await RNFS.exists(this.tempDir);
      if (exists) {
        await RNFS.unlink(this.tempDir);
      }
    } catch (error) {
      console.warn('[VideoExportService] Cleanup failed:', error);
    }
  }

  /**
   * Report progress to callback
   */
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

// Export singleton instance
export const videoExportService = new VideoExportService();
