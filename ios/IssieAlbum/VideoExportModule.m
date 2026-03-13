//
//  VideoExportModule.m
//  IssieAlbum
//
//  Native module for exporting album to video using AVFoundation
//

#import "VideoExportModule.h"
#import <AVFoundation/AVFoundation.h>
#import <UIKit/UIKit.h>

@implementation VideoExportModule {
  bool hasListeners;
}

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

// Support for event emitter
- (NSArray<NSString *> *)supportedEvents {
  return @[@"VideoExportProgress"];
}

- (void)startObserving {
  hasListeners = YES;
}

- (void)stopObserving {
  hasListeners = NO;
}

- (void)sendProgressEvent:(NSDictionary *)progress {
  if (hasListeners) {
    [self sendEventWithName:@"VideoExportProgress" body:progress];
  }
}

/**
 * Main export method
 */
RCT_EXPORT_METHOD(exportVideo:(NSArray *)frames
                  audioTracks:(NSArray *)audioTracks
                  outputPath:(NSString *)outputPath
                  width:(NSInteger)width
                  height:(NSInteger)height
                  frameRate:(NSInteger)frameRate
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {

  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    @try {
      NSLog(@"[VideoExportModule] Starting export with %lu frames and %lu audio tracks",
            (unsigned long)frames.count, (unsigned long)audioTracks.count);
      NSError *error = nil;

      // Delete existing file if it exists
      if ([[NSFileManager defaultManager] fileExistsAtPath:outputPath]) {
        [[NSFileManager defaultManager] removeItemAtPath:outputPath error:&error];
        if (error) {
          reject(@"FILE_ERROR", @"Failed to delete existing file", error);
          return;
        }
      }

      // If we have audio, we need to use AVMutableComposition for mixing
      if (audioTracks.count > 0) {
        [self exportVideoWithAudio:frames
                       audioTracks:audioTracks
                        outputPath:outputPath
                             width:width
                            height:height
                         frameRate:frameRate
                          resolver:resolve
                          rejecter:reject];
      } else {
        [self exportVideoOnly:frames
                   outputPath:outputPath
                        width:width
                       height:height
                    frameRate:frameRate
                     resolver:resolve
                     rejecter:reject];
      }

    } @catch (NSException *exception) {
      NSLog(@"[VideoExportModule] Exception: %@", exception);
      reject(@"EXPORT_ERROR", exception.reason, nil);
    }
  });
}

/**
 * Export video only (no audio)
 */
- (void)exportVideoOnly:(NSArray *)frames
             outputPath:(NSString *)outputPath
                  width:(NSInteger)width
                 height:(NSInteger)height
              frameRate:(NSInteger)frameRate
               resolver:(RCTPromiseResolveBlock)resolve
               rejecter:(RCTPromiseRejectBlock)reject {

  NSError *error = nil;
  NSURL *outputURL = [NSURL fileURLWithPath:outputPath];

  AVAssetWriter *writer = [[AVAssetWriter alloc] initWithURL:outputURL
                                                     fileType:AVFileTypeMPEG4
                                                        error:&error];
  if (error) {
    reject(@"WRITER_ERROR", @"Failed to create AVAssetWriter", error);
    return;
  }

  // Configure video input
  NSDictionary *videoSettings = @{
    AVVideoCodecKey: AVVideoCodecTypeH264,
    AVVideoWidthKey: @(width),
    AVVideoHeightKey: @(height),
    AVVideoCompressionPropertiesKey: @{
      AVVideoAverageBitRateKey: @(6000000),
      AVVideoMaxKeyFrameIntervalKey: @(frameRate),
      AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
    }
  };

  AVAssetWriterInput *videoInput = [AVAssetWriterInput assetWriterInputWithMediaType:AVMediaTypeVideo
                                                                       outputSettings:videoSettings];
  videoInput.expectsMediaDataInRealTime = NO;

  NSDictionary *pixelBufferAttributes = @{
    (NSString *)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_32ARGB),
    (NSString *)kCVPixelBufferWidthKey: @(width),
    (NSString *)kCVPixelBufferHeightKey: @(height)
  };

  AVAssetWriterInputPixelBufferAdaptor *pixelBufferAdaptor =
    [AVAssetWriterInputPixelBufferAdaptor assetWriterInputPixelBufferAdaptorWithAssetWriterInput:videoInput
                                                                     sourcePixelBufferAttributes:pixelBufferAttributes];

  [writer addInput:videoInput];

  CMTime startTime = CMTimeMake(0, frameRate);
  [writer startWriting];
  [writer startSessionAtSourceTime:startTime];

  // Process frames
  CMTime currentTime = startTime;
  for (NSInteger frameIndex = 0; frameIndex < frames.count; frameIndex++) {
    @autoreleasepool {
      NSDictionary *frameData = frames[frameIndex];
      NSString *imagePath = frameData[@"imagePath"];
      NSNumber *duration = frameData[@"duration"];
      NSDictionary *transition = frameData[@"transition"];

      NSLog(@"[VideoExportModule] Frame %ld: duration=%.2fs transition=%@",
            (long)frameIndex, [duration doubleValue], transition ? @"YES" : @"NO");

      UIImage *image = [UIImage imageWithContentsOfFile:imagePath];
      if (!image) {
        NSLog(@"[VideoExportModule] ERROR: Failed to load image: %@", imagePath);
        continue;
      }

      // Handle transition if present
      if (transition) {
        NSString *toImagePath = transition[@"toImagePath"];
        NSNumber *progress = transition[@"progress"];
        NSString *direction = transition[@"direction"];

        UIImage *toImage = [UIImage imageWithContentsOfFile:toImagePath];
        if (toImage) {
          // Create composite image with slide transition
          image = [self createSlideTransition:image
                                     toImage:toImage
                                    progress:[progress doubleValue]
                                   direction:direction
                                        size:CGSizeMake(width, height)];
        }
      }

      CVPixelBufferRef pixelBuffer = [self pixelBufferFromImage:image size:CGSizeMake(width, height)];
      if (!pixelBuffer) {
        NSLog(@"[VideoExportModule] ERROR: Failed to create pixel buffer");
        continue;
      }

      while (!videoInput.readyForMoreMediaData) {
        [NSThread sleepForTimeInterval:0.01];
      }

      [pixelBufferAdaptor appendPixelBuffer:pixelBuffer withPresentationTime:currentTime];
      CVPixelBufferRelease(pixelBuffer);

      CMTime frameDuration = CMTimeMakeWithSeconds([duration doubleValue], frameRate);
      currentTime = CMTimeAdd(currentTime, frameDuration);

      dispatch_async(dispatch_get_main_queue(), ^{
        [self sendProgressEvent:@{
          @"phase": @"encoding",
          @"currentFrame": @(frameIndex + 1),
          @"totalFrames": @(frames.count),
          @"percentage": @((int)(((frameIndex + 1) * 100) / frames.count))
        }];
      });
    }
  }

  NSLog(@"[VideoExportModule] All frames processed. Final time: %.2f seconds", CMTimeGetSeconds(currentTime));

  [videoInput markAsFinished];

  NSLog(@"[VideoExportModule] Finishing write session...");
  NSLog(@"[VideoExportModule] Expected duration: %.2f seconds", CMTimeGetSeconds(currentTime));

  [writer finishWritingWithCompletionHandler:^{
    if (writer.status == AVAssetWriterStatusCompleted) {
      NSLog(@"[VideoExportModule] Export completed successfully!");
      NSLog(@"[VideoExportModule] Video duration: %.2f seconds", CMTimeGetSeconds(currentTime));

      // Verify file was written
      NSError *fileError = nil;
      NSDictionary *fileAttrs = [[NSFileManager defaultManager] attributesOfItemAtPath:outputPath error:&fileError];
      if (fileError) {
        NSLog(@"[VideoExportModule] Error reading file attributes: %@", fileError);
      } else {
        NSLog(@"[VideoExportModule] File size: %llu bytes", [fileAttrs fileSize]);
      }

      // Verify video duration by reloading
      NSURL *verifyURL = [NSURL fileURLWithPath:outputPath];
      AVAsset *verifyAsset = [AVAsset assetWithURL:verifyURL];
      [verifyAsset loadValuesAsynchronouslyForKeys:@[@"duration"] completionHandler:^{
        CMTime loadedDuration = verifyAsset.duration;
        NSLog(@"[VideoExportModule] Verification: loaded duration = %.2f seconds", CMTimeGetSeconds(loadedDuration));
      }];

      // Wait a bit to ensure file is fully written to disk
      [NSThread sleepForTimeInterval:0.5];

      dispatch_async(dispatch_get_main_queue(), ^{
        resolve(@{
          @"videoPath": outputPath,
          @"duration": @(CMTimeGetSeconds(currentTime)),
          @"success": @YES
        });
      });
    } else {
      NSLog(@"[VideoExportModule] Writing failed with status: %ld error: %@", (long)writer.status, writer.error);
      dispatch_async(dispatch_get_main_queue(), ^{
        reject(@"WRITING_ERROR", @"Failed to finish writing", writer.error);
      });
    }
  }];
}

/**
 * Export video with audio using AVMutableComposition
 */
- (void)exportVideoWithAudio:(NSArray *)frames
                 audioTracks:(NSArray *)audioTracks
                  outputPath:(NSString *)outputPath
                       width:(NSInteger)width
                      height:(NSInteger)height
                   frameRate:(NSInteger)frameRate
                    resolver:(RCTPromiseResolveBlock)resolve
                    rejecter:(RCTPromiseRejectBlock)reject {

  NSLog(@"[VideoExportModule] Creating video with audio composition");

  // Step 1: Create temporary video-only file
  NSString *tempVideoPath = [NSTemporaryDirectory() stringByAppendingPathComponent:@"temp_video.mp4"];
  [[NSFileManager defaultManager] removeItemAtPath:tempVideoPath error:nil];

  // Export video frames to temp file
  [self exportVideoOnly:frames
             outputPath:tempVideoPath
                  width:width
                 height:height
              frameRate:frameRate
               resolver:^(id result) {
    // Step 2: Now mix with audio
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
      [self mixVideoWithAudio:tempVideoPath
                  audioTracks:audioTracks
                   outputPath:outputPath
                     resolver:resolve
                     rejecter:reject];
    });
  }
               rejecter:reject];
}

/**
 * Mix video with audio tracks
 */
- (void)mixVideoWithAudio:(NSString *)videoPath
              audioTracks:(NSArray *)audioTracks
               outputPath:(NSString *)outputPath
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject {

  NSLog(@"[VideoExportModule] Mixing video with audio");

  // Verify temp video file exists
  if (![[NSFileManager defaultManager] fileExistsAtPath:videoPath]) {
    NSLog(@"[VideoExportModule] ERROR: Temp video file does not exist: %@", videoPath);
    reject(@"FILE_ERROR", @"Temp video file not found", nil);
    return;
  }

  // Wait for file system to flush
  [NSThread sleepForTimeInterval:0.2];

  AVMutableComposition *composition = [AVMutableComposition composition];

  // Load video
  NSURL *videoURL = [NSURL fileURLWithPath:videoPath];
  AVAsset *videoAsset = [AVAsset assetWithURL:videoURL];

  // IMPORTANT: Wait for asset to fully load
  NSArray *keys = @[@"tracks", @"duration"];
  dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
  __block NSError *loadError = nil;

  [videoAsset loadValuesAsynchronouslyForKeys:keys completionHandler:^{
    for (NSString *key in keys) {
      NSError *error = nil;
      AVKeyValueStatus status = [videoAsset statusOfValueForKey:key error:&error];
      if (status == AVKeyValueStatusFailed) {
        loadError = error;
        NSLog(@"[VideoExportModule] Failed to load key: %@ error: %@", key, error);
      }
    }
    dispatch_semaphore_signal(semaphore);
  }];

  // Wait for asset to load (with timeout)
  dispatch_time_t timeout = dispatch_time(DISPATCH_TIME_NOW, 5 * NSEC_PER_SEC);
  long result = dispatch_semaphore_wait(semaphore, timeout);

  if (result != 0) {
    NSLog(@"[VideoExportModule] Timeout loading video asset");
    reject(@"TIMEOUT_ERROR", @"Timeout loading video asset", nil);
    return;
  }

  if (loadError) {
    NSLog(@"[VideoExportModule] Error loading video asset: %@", loadError);
    reject(@"LOAD_ERROR", @"Failed to load video asset", loadError);
    return;
  }

  // Add video track
  AVAssetTrack *videoTrack = [[videoAsset tracksWithMediaType:AVMediaTypeVideo] firstObject];
  if (videoTrack) {
    NSLog(@"[VideoExportModule] Video track duration: %.2f seconds", CMTimeGetSeconds(videoAsset.duration));
    AVMutableCompositionTrack *compositionVideoTrack = [composition addMutableTrackWithMediaType:AVMediaTypeVideo
                                                                                 preferredTrackID:kCMPersistentTrackID_Invalid];
    NSError *error = nil;
    [compositionVideoTrack insertTimeRange:CMTimeRangeMake(kCMTimeZero, videoAsset.duration)
                                   ofTrack:videoTrack
                                    atTime:kCMTimeZero
                                     error:&error];
    if (error) {
      NSLog(@"[VideoExportModule] Error adding video track: %@", error);
      reject(@"VIDEO_TRACK_ERROR", @"Failed to add video track", error);
      return;
    }
  }

  // Add audio tracks
  AVMutableCompositionTrack *compositionAudioTrack = [composition addMutableTrackWithMediaType:AVMediaTypeAudio
                                                                               preferredTrackID:kCMPersistentTrackID_Invalid];

  for (NSDictionary *audioTrackData in audioTracks) {
    NSString *audioPath = audioTrackData[@"audioPath"];
    NSNumber *startTimeNum = audioTrackData[@"startTime"];
    CMTime startTime = CMTimeMakeWithSeconds([startTimeNum doubleValue], 600);

    NSLog(@"[VideoExportModule] Adding audio: %@ at %f seconds", audioPath, [startTimeNum doubleValue]);

    NSURL *audioURL = [NSURL fileURLWithPath:audioPath];
    AVAsset *audioAsset = [AVAsset assetWithURL:audioURL];
    AVAssetTrack *audioTrack = [[audioAsset tracksWithMediaType:AVMediaTypeAudio] firstObject];

    if (audioTrack) {
      NSError *error = nil;
      [compositionAudioTrack insertTimeRange:CMTimeRangeMake(kCMTimeZero, audioAsset.duration)
                                     ofTrack:audioTrack
                                      atTime:startTime
                                       error:&error];
      if (error) {
        NSLog(@"[VideoExportModule] Error adding audio track: %@", error);
      }
    } else {
      NSLog(@"[VideoExportModule] Warning: No audio track found in %@", audioPath);
    }
  }

  // Export composition
  NSURL *outputURL = [NSURL fileURLWithPath:outputPath];
  [[NSFileManager defaultManager] removeItemAtPath:outputPath error:nil];

  AVAssetExportSession *exportSession = [[AVAssetExportSession alloc] initWithAsset:composition
                                                                          presetName:AVAssetExportPresetHighestQuality];
  exportSession.outputURL = outputURL;
  exportSession.outputFileType = AVFileTypeMPEG4;

  [exportSession exportAsynchronouslyWithCompletionHandler:^{
    if (exportSession.status == AVAssetExportSessionStatusCompleted) {
      NSLog(@"[VideoExportModule] Audio mixing completed successfully!");
      NSLog(@"[VideoExportModule] Final composition duration: %.2f seconds", CMTimeGetSeconds(composition.duration));

      // Clean up temp video file
      [[NSFileManager defaultManager] removeItemAtPath:videoPath error:nil];

      dispatch_async(dispatch_get_main_queue(), ^{
        resolve(@{
          @"videoPath": outputPath,
          @"duration": @(CMTimeGetSeconds(composition.duration)),
          @"success": @YES
        });
      });
    } else {
      NSLog(@"[VideoExportModule] Audio mixing failed: %@", exportSession.error);
      dispatch_async(dispatch_get_main_queue(), ^{
        reject(@"EXPORT_ERROR", @"Failed to mix audio", exportSession.error);
      });
    }
  }];
}

/**
 * Convert UIImage to CVPixelBuffer
 */
- (CVPixelBufferRef)pixelBufferFromImage:(UIImage *)image size:(CGSize)size {
  CGImageRef cgImage = image.CGImage;

  NSDictionary *options = @{
    (NSString *)kCVPixelBufferCGImageCompatibilityKey: @YES,
    (NSString *)kCVPixelBufferCGBitmapContextCompatibilityKey: @YES
  };

  CVPixelBufferRef pixelBuffer = NULL;
  CVReturn status = CVPixelBufferCreate(kCFAllocatorDefault,
                                       size.width,
                                       size.height,
                                       kCVPixelFormatType_32ARGB,
                                       (__bridge CFDictionaryRef)options,
                                       &pixelBuffer);

  if (status != kCVReturnSuccess) {
    return NULL;
  }

  CVPixelBufferLockBaseAddress(pixelBuffer, 0);
  void *pixelData = CVPixelBufferGetBaseAddress(pixelBuffer);

  CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
  CGContextRef context = CGBitmapContextCreate(pixelData,
                                              size.width,
                                              size.height,
                                              8,
                                              CVPixelBufferGetBytesPerRow(pixelBuffer),
                                              colorSpace,
                                              kCGImageAlphaNoneSkipFirst);

  if (!context) {
    CVPixelBufferUnlockBaseAddress(pixelBuffer, 0);
    CVPixelBufferRelease(pixelBuffer);
    CGColorSpaceRelease(colorSpace);
    return NULL;
  }

  CGContextDrawImage(context, CGRectMake(0, 0, size.width, size.height), cgImage);

  CGColorSpaceRelease(colorSpace);
  CGContextRelease(context);
  CVPixelBufferUnlockBaseAddress(pixelBuffer, 0);

  return pixelBuffer;
}

/**
 * Create slide transition between two images
 */
- (UIImage *)createSlideTransition:(UIImage *)fromImage
                           toImage:(UIImage *)toImage
                          progress:(double)progress
                         direction:(NSString *)direction
                              size:(CGSize)size {

  // Create graphics context
  UIGraphicsBeginImageContextWithOptions(size, NO, 1.0);
  CGContextRef context = UIGraphicsGetCurrentContext();

  if (!context) {
    UIGraphicsEndImageContext();
    return fromImage;
  }

  // Calculate positions based on direction and progress
  CGFloat offset = size.width * progress;
  CGFloat fromX, toX;

  if ([direction isEqualToString:@"right"]) {
    // RTL: slide to right (current moves right, next comes from left)
    fromX = offset;
    toX = offset - size.width;
  } else {
    // LTR: slide to left (current moves left, next comes from right)
    fromX = -offset;
    toX = size.width - offset;
  }

  // Draw both images
  [toImage drawInRect:CGRectMake(toX, 0, size.width, size.height)];
  [fromImage drawInRect:CGRectMake(fromX, 0, size.width, size.height)];

  // Get the composite image
  UIImage *result = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  return result ? result : fromImage;
}

@end
