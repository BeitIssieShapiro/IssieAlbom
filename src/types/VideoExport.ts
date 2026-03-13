/**
 * Types for video export functionality
 */

export interface VideoExportConfig {
  // Duration for pages without audio (in seconds)
  staticPageDuration: number;

  // Duration to hold the final frame after audio ends (in seconds)
  finalFrameDuration: number;

  // Video format
  videoFormat: 'mp4' | 'mov';

  // Quality preset
  quality: 'low' | 'medium' | 'high';

  // Video dimensions (optional - defaults to first page dimensions)
  width?: number;
  height?: number;

  // Frame rate
  frameRate: 30 | 60;

  // Transition duration between pages (in seconds)
  transitionDuration: number;

  // Number of frames for transition animation
  transitionFrames: number;

  // Is RTL language (affects slide direction)
  isRTL?: boolean;
}

export interface PageFrameData {
  // Frame image paths (absolute paths to temporary frame files)
  framePaths: string[];

  // Duration for each frame (in seconds)
  frameDurations: number[];

  // Audio file path (if page has audio)
  audioPath?: string;

  // Total duration for this page segment (in seconds)
  totalDuration: number;
}

export interface ExportProgress {
  // Current phase of export
  phase: 'preparing' | 'capturing' | 'assembling' | 'complete' | 'error';

  // Current page being processed (1-based)
  currentPage: number;

  // Total pages to process
  totalPages: number;

  // Progress percentage (0-100)
  percentage: number;

  // Human-readable status message
  message: string;

  // Error message (if phase is 'error')
  error?: string;
}

export interface VideoExportResult {
  // Path to the exported video file
  videoPath: string;

  // Duration of the exported video (in seconds)
  duration: number;

  // File size in bytes
  fileSize: number;
}

// Default export configuration
export const DEFAULT_EXPORT_CONFIG: VideoExportConfig = {
  staticPageDuration: 5,
  finalFrameDuration: 2,
  videoFormat: 'mp4',
  quality: 'high',
  frameRate: 30,
  transitionDuration: 0.5, // 500ms transition
  transitionFrames: 15, // 15 frames at 30fps = 500ms
};
