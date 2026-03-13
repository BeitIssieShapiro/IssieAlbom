import { NativeModules, NativeEventEmitter, EmitterSubscription } from 'react-native';

interface FrameData {
  imagePath: string;
  duration: number; // in seconds
  transition?: {
    toImagePath: string; // Image to transition to
    progress: number; // 0.0 to 1.0
    direction: 'left' | 'right'; // Slide direction
  };
}

interface AudioTrackData {
  audioPath: string;
  startTime: number; // in seconds
}

interface VideoExportResult {
  videoPath: string;
  duration: number;
  success: boolean;
}

interface VideoExportProgress {
  phase: 'encoding' | 'audio' | 'complete';
  currentFrame: number;
  totalFrames: number;
  percentage: number;
}

interface VideoExportModuleType {
  exportVideo(
    frames: FrameData[],
    audioTracks: AudioTrackData[],
    outputPath: string,
    width: number,
    height: number,
    frameRate: number
  ): Promise<VideoExportResult>;
}

const { VideoExportModule } = NativeModules;

// Check if native module is available
const isNativeModuleAvailable = VideoExportModule != null;

class VideoExportNative {
  private eventEmitter: NativeEventEmitter | null = null;
  private progressSubscription: EmitterSubscription | null = null;

  constructor() {
    if (isNativeModuleAvailable) {
      this.eventEmitter = new NativeEventEmitter(VideoExportModule);
    }
  }

  /**
   * Check if native module is available
   */
  isAvailable(): boolean {
    return isNativeModuleAvailable;
  }

  /**
   * Export video with frames and audio tracks
   */
  async exportVideo(
    frames: FrameData[],
    audioTracks: AudioTrackData[],
    outputPath: string,
    width: number,
    height: number,
    frameRate: number = 30,
    onProgress?: (progress: VideoExportProgress) => void
  ): Promise<VideoExportResult> {
    if (!isNativeModuleAvailable) {
      throw new Error(
        'VideoExportModule not found. Please add VideoExportModule.h and VideoExportModule.m to Xcode.\n\n' +
        'Steps:\n' +
        '1. Open ios/IssieAlbum.xcworkspace in Xcode\n' +
        '2. Right-click IssieAlbum folder → Add Files\n' +
        '3. Select VideoExportModule.h and VideoExportModule.m\n' +
        '4. Add AVFoundation.framework in Build Phases\n' +
        '5. Clean build and run'
      );
    }

    // Subscribe to progress events
    if (onProgress && this.eventEmitter) {
      this.progressSubscription = this.eventEmitter.addListener(
        'VideoExportProgress',
        onProgress
      );
    }

    try {
      const result = await (VideoExportModule as VideoExportModuleType).exportVideo(
        frames,
        audioTracks,
        outputPath,
        width,
        height,
        frameRate
      );

      return result;
    } finally {
      // Clean up subscription
      if (this.progressSubscription) {
        this.progressSubscription.remove();
        this.progressSubscription = null;
      }
    }
  }
}

export const videoExportNative = new VideoExportNative();
export type { FrameData, AudioTrackData, VideoExportResult, VideoExportProgress };
