/**
 * Audio utilities for video export
 */
export class AudioUtils {
  /**
   * Get the duration of an audio file in seconds
   * For iOS, we'll estimate based on file size or use default
   * The native module will handle actual audio duration
   */
  static async getAudioDuration(audioPath: string): Promise<number> {
    try {
      // For now, return a default duration
      // The native AVFoundation module will handle actual duration
      console.log('[AudioUtils] Estimating audio duration for:', audioPath);
      return 5; // Default 5 seconds
    } catch (error) {
      console.error('[AudioUtils] Failed to get audio duration:', error);
      return 5; // Default 5 seconds
    }
  }

  /**
   * Calculate end time for a word timing
   * If the word has an explicit endTime, use it
   * Otherwise, use the start time of the next word
   * For the last word, estimate based on average word duration or use a default
   */
  static calculateWordEndTime(
    wordIndex: number,
    wordTimings: Array<{ word: string; startTime: number; endTime?: number }>,
    defaultWordDuration: number = 0.5
  ): number {
    const word = wordTimings[wordIndex];

    // If explicit endTime exists, use it
    if (word.endTime !== undefined) {
      return word.endTime;
    }

    // If there's a next word, use its start time
    if (wordIndex < wordTimings.length - 1) {
      return wordTimings[wordIndex + 1].startTime;
    }

    // Last word: calculate average word duration and apply it
    if (wordTimings.length > 1) {
      const totalDuration = word.startTime - wordTimings[0].startTime;
      const averageDuration = totalDuration / (wordTimings.length - 1);
      return word.startTime + averageDuration;
    }

    // Fallback: use default duration
    return word.startTime + defaultWordDuration;
  }

  /**
   * Validate that word timings are properly ordered
   * Returns an error message if invalid, or null if valid
   */
  static validateWordTimings(
    wordTimings: Array<{ word: string; startTime: number }>
  ): string | null {
    if (wordTimings.length === 0) {
      return null; // Empty is valid
    }

    // Check for negative times
    for (let i = 0; i < wordTimings.length; i++) {
      if (wordTimings[i].startTime < 0) {
        return `Word ${i} has negative start time: ${wordTimings[i].startTime}`;
      }
    }

    // Check for proper ordering
    for (let i = 1; i < wordTimings.length; i++) {
      if (wordTimings[i].startTime < wordTimings[i - 1].startTime) {
        return `Word ${i} start time (${wordTimings[i].startTime}) is before previous word (${wordTimings[i - 1].startTime})`;
      }
    }

    return null;
  }

  /**
   * Normalize audio file to ensure compatibility with FFmpeg
   * Converts to AAC format with standard settings
   */
  static async normalizeAudioFile(
    inputPath: string,
    outputPath: string
  ): Promise<void> {
    const command = `-i "${inputPath}" -c:a aac -b:a 128k -ar 44100 -ac 2 "${outputPath}"`;
    const session = await FFmpegKit.execute(command);
    const returnCode = await session.getReturnCode();

    if (!returnCode.isValueSuccess()) {
      const output = await session.getOutput();
      throw new Error(`Failed to normalize audio: ${output}`);
    }
  }

  /**
   * Extract audio from a video file
   */
  static async extractAudioFromVideo(
    videoPath: string,
    outputAudioPath: string
  ): Promise<void> {
    const command = `-i "${videoPath}" -vn -acodec copy "${outputAudioPath}"`;
    const session = await FFmpegKit.execute(command);
    const returnCode = await session.getReturnCode();

    if (!returnCode.isValueSuccess()) {
      const output = await session.getOutput();
      throw new Error(`Failed to extract audio: ${output}`);
    }
  }

  /**
   * Mix multiple audio files with specific delays
   * Used for combining audio tracks in video export
   */
  static async mixAudioFiles(
    audioInputs: Array<{ path: string; delayMs: number }>,
    outputPath: string
  ): Promise<void> {
    if (audioInputs.length === 0) {
      throw new Error('No audio inputs provided');
    }

    if (audioInputs.length === 1) {
      // Single audio - just apply delay if needed
      const input = audioInputs[0];
      if (input.delayMs === 0) {
        // No delay - just copy
        const command = `-i "${input.path}" -c copy "${outputPath}"`;
        const session = await FFmpegKit.execute(command);
        const returnCode = await session.getReturnCode();

        if (!returnCode.isValueSuccess()) {
          const output = await session.getOutput();
          throw new Error(`Failed to copy audio: ${output}`);
        }
        return;
      }

      // Apply delay
      const command = `-i "${input.path}" -af "adelay=${input.delayMs}|${input.delayMs}" "${outputPath}"`;
      const session = await FFmpegKit.execute(command);
      const returnCode = await session.getReturnCode();

      if (!returnCode.isValueSuccess()) {
        const output = await session.getOutput();
        throw new Error(`Failed to apply delay: ${output}`);
      }
      return;
    }

    // Multiple audio files - build complex filter
    const inputs = audioInputs.map((input) => `-i "${input.path}"`).join(' ');
    const delays = audioInputs.map(
      (input, i) => `[${i}:a]adelay=${input.delayMs}|${input.delayMs}[a${i}]`
    );
    const mixInputs = audioInputs.map((_, i) => `[a${i}]`).join('');
    const filterComplex = `${delays.join(';')};${mixInputs}amix=inputs=${audioInputs.length}:duration=longest`;

    const command = `${inputs} -filter_complex "${filterComplex}" "${outputPath}"`;
    const session = await FFmpegKit.execute(command);
    const returnCode = await session.getReturnCode();

    if (!returnCode.isValueSuccess()) {
      const output = await session.getOutput();
      throw new Error(`Failed to mix audio: ${output}`);
    }
  }
}
