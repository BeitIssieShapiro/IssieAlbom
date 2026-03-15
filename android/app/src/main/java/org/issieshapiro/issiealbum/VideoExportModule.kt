package org.issieshapiro.issiealbum

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Matrix
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.nio.ByteBuffer

class VideoExportModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

    companion object {
        private const val TAG = "VideoExportModule"
        private const val EVENT_PROGRESS = "VideoExportProgress"
        private const val MIME_TYPE = "video/avc" // H.264 Advanced Video Coding
        private const val FRAME_RATE = 30
        private const val IFRAME_INTERVAL = 1
        private const val BIT_RATE = 6000000
    }

    override fun getName(): String = "VideoExportModule"

    override fun initialize() {
        super.initialize()
        reactContext.addLifecycleEventListener(this)
    }

    override fun onHostResume() {}
    override fun onHostPause() {}
    override fun onHostDestroy() {}

    private fun sendProgressEvent(progress: WritableMap) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_PROGRESS, progress)
    }

    @ReactMethod
    fun exportVideo(
        frames: ReadableArray,
        audioTracks: ReadableArray,
        outputPath: String,
        width: Int,
        height: Int,
        frameRate: Int,
        promise: Promise
    ) {
        Log.d(TAG, "Starting export with ${frames.size()} frames and ${audioTracks.size()} audio tracks")
        Log.d(TAG, "Output: $outputPath, Size: ${width}x${height}, FPS: $frameRate")

        Thread {
            try {
                // Delete existing file if it exists
                val outputFile = File(outputPath)
                if (outputFile.exists()) {
                    outputFile.delete()
                }

                exportVideoWithAudio(frames, audioTracks, outputPath, width, height, frameRate, promise)

            } catch (e: Exception) {
                Log.e(TAG, "Export failed", e)
                promise.reject("EXPORT_ERROR", "Failed to export video: ${e.message}", e)
            }
        }.start()
    }

    private fun exportVideoWithAudio(
        frames: ReadableArray,
        audioTracks: ReadableArray,
        outputPath: String,
        width: Int,
        height: Int,
        frameRate: Int,
        promise: Promise
    ) {
        var encoder: MediaCodec? = null
        var muxer: MediaMuxer? = null
        var inputSurface: InputSurface? = null
        var textureRenderer: TextureRenderer? = null

        try {
            // Prepare the encoder
            val format = MediaFormat.createVideoFormat(MIME_TYPE, width, height)
            format.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
            format.setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE)
            format.setInteger(MediaFormat.KEY_FRAME_RATE, frameRate)
            format.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, IFRAME_INTERVAL)

            encoder = MediaCodec.createEncoderByType(MIME_TYPE)
            encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)

            // Create input surface
            inputSurface = InputSurface(encoder.createInputSurface())
            encoder.start()

            // Setup OpenGL for rendering
            inputSurface.makeCurrent()
            textureRenderer = TextureRenderer()
            textureRenderer.surfaceCreated()

            // Prepare muxer
            muxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            var videoTrackIndex = -1
            var audioTrackIndex = -1
            var muxerStarted = false

            val bufferInfo = MediaCodec.BufferInfo()
            var presentationTimeUs = 0L

            // Process each frame
            for (frameIndex in 0 until frames.size()) {
                val frameData = frames.getMap(frameIndex) ?: continue
                val imagePath = frameData.getString("imagePath") ?: continue
                val duration = frameData.getDouble("duration")
                val transition = if (frameData.hasKey("transition")) frameData.getMap("transition") else null

                Log.d(TAG, "Frame $frameIndex: path=$imagePath, duration=${duration}s, transition=${transition != null}")

                // Load bitmap
                val bitmap = loadAndScaleBitmap(imagePath, width, height)
                if (bitmap == null) {
                    Log.e(TAG, "Failed to load bitmap: $imagePath")
                    continue
                }

                // Handle transition if present
                val finalBitmap = if (transition != null) {
                    val toImagePath = transition.getString("toImagePath")
                    val progress = transition.getDouble("progress")
                    val direction = transition.getString("direction") ?: "left"

                    val toBitmap = loadAndScaleBitmap(toImagePath!!, width, height)
                    if (toBitmap != null) {
                        val transitionBitmap = createSlideTransition(bitmap, toBitmap, progress, direction, width, height)
                        toBitmap.recycle()
                        transitionBitmap
                    } else {
                        bitmap
                    }
                } else {
                    bitmap
                }

                // Render bitmap to surface
                textureRenderer.drawFrame(finalBitmap, width, height)
                inputSurface.setPresentationTime(presentationTimeUs * 1000) // Convert to nanoseconds
                inputSurface.swapBuffers()

                finalBitmap.recycle()

                // Drain encoder
                var encoderDone = false
                while (!encoderDone) {
                    val encoderStatus = encoder.dequeueOutputBuffer(bufferInfo, 10000)

                    when {
                        encoderStatus == MediaCodec.INFO_TRY_AGAIN_LATER -> {
                            encoderDone = true
                        }
                        encoderStatus == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                            if (muxerStarted) {
                                throw RuntimeException("format changed twice")
                            }
                            val newFormat = encoder.outputFormat
                            Log.d(TAG, "Encoder output format changed: $newFormat")
                            videoTrackIndex = muxer.addTrack(newFormat)

                            // Add audio tracks if present
                            if (audioTracks.size() > 0) {
                                Log.d(TAG, "Adding ${audioTracks.size()} audio track(s)")
                                for (i in 0 until audioTracks.size()) {
                                    val audioTrackData = audioTracks.getMap(i) ?: continue
                                    val audioPath = audioTrackData.getString("audioPath") ?: continue

                                    try {
                                        val extractor = MediaExtractor()
                                        extractor.setDataSource(audioPath)

                                        // Find audio track
                                        for (trackIndex in 0 until extractor.trackCount) {
                                            val format = extractor.getTrackFormat(trackIndex)
                                            val mime = format.getString(MediaFormat.KEY_MIME) ?: ""
                                            if (mime.startsWith("audio/")) {
                                                Log.d(TAG, "Found audio track: $format")
                                                audioTrackIndex = muxer.addTrack(format)
                                                extractor.release()
                                                break
                                            }
                                        }
                                        if (audioTrackIndex == -1) {
                                            extractor.release()
                                        }
                                    } catch (e: Exception) {
                                        Log.e(TAG, "Failed to add audio track from $audioPath", e)
                                    }
                                }
                            }

                            muxer.start()
                            muxerStarted = true
                        }
                        encoderStatus < 0 -> {
                            Log.w(TAG, "Unexpected result from encoder.dequeueOutputBuffer: $encoderStatus")
                        }
                        else -> {
                            val encodedData = encoder.getOutputBuffer(encoderStatus)
                                ?: throw RuntimeException("encoderOutputBuffer $encoderStatus was null")

                            if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) {
                                Log.d(TAG, "Ignoring BUFFER_FLAG_CODEC_CONFIG")
                                bufferInfo.size = 0
                            }

                            if (bufferInfo.size != 0) {
                                if (!muxerStarted) {
                                    throw RuntimeException("muxer hasn't started")
                                }

                                encodedData.position(bufferInfo.offset)
                                encodedData.limit(bufferInfo.offset + bufferInfo.size)
                                muxer.writeSampleData(videoTrackIndex, encodedData, bufferInfo)
                            }

                            encoder.releaseOutputBuffer(encoderStatus, false)

                            if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                                encoderDone = true
                            }
                        }
                    }
                }

                // Update presentation time for next frame
                presentationTimeUs += (duration * 1_000_000).toLong()

                // Send progress
                val progress = Arguments.createMap()
                progress.putString("phase", "encoding")
                progress.putInt("currentFrame", frameIndex + 1)
                progress.putInt("totalFrames", frames.size())
                progress.putInt("percentage", ((frameIndex + 1) * 100) / frames.size())
                sendProgressEvent(progress)
            }

            // Signal end of input
            encoder.signalEndOfInputStream()

            // Drain remaining encoded data
            var encoderDone = false
            while (!encoderDone) {
                val encoderStatus = encoder.dequeueOutputBuffer(bufferInfo, 10000)

                when {
                    encoderStatus == MediaCodec.INFO_TRY_AGAIN_LATER -> {
                        // No output available yet
                    }
                    encoderStatus < 0 -> {
                        Log.w(TAG, "Unexpected result from encoder.dequeueOutputBuffer: $encoderStatus")
                    }
                    else -> {
                        val encodedData = encoder.getOutputBuffer(encoderStatus)
                            ?: throw RuntimeException("encoderOutputBuffer $encoderStatus was null")

                        if (bufferInfo.size != 0) {
                            encodedData.position(bufferInfo.offset)
                            encodedData.limit(bufferInfo.offset + bufferInfo.size)
                            muxer.writeSampleData(videoTrackIndex, encodedData, bufferInfo)
                        }

                        encoder.releaseOutputBuffer(encoderStatus, false)

                        if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                            encoderDone = true
                        }
                    }
                }
            }

            // Copy audio samples if audio track was added
            if (audioTrackIndex != -1 && audioTracks.size() > 0) {
                Log.d(TAG, "Copying audio samples")
                for (i in 0 until audioTracks.size()) {
                    val audioTrackData = audioTracks.getMap(i) ?: continue
                    val audioPath = audioTrackData.getString("audioPath") ?: continue
                    val startTimeSec = audioTrackData.getDouble("startTime")

                    try {
                        val extractor = MediaExtractor()
                        extractor.setDataSource(audioPath)

                        // Find audio track
                        var audioTrackIdx = -1
                        for (trackIndex in 0 until extractor.trackCount) {
                            val format = extractor.getTrackFormat(trackIndex)
                            val mime = format.getString(MediaFormat.KEY_MIME) ?: ""
                            if (mime.startsWith("audio/")) {
                                audioTrackIdx = trackIndex
                                break
                            }
                        }

                        if (audioTrackIdx == -1) {
                            extractor.release()
                            continue
                        }

                        extractor.selectTrack(audioTrackIdx)

                        // Copy audio samples
                        val audioBuffer = ByteBuffer.allocate(1024 * 1024) // 1MB buffer
                        val audioBufferInfo = MediaCodec.BufferInfo()
                        val startTimeUs = (startTimeSec * 1_000_000).toLong()

                        while (true) {
                            audioBufferInfo.size = extractor.readSampleData(audioBuffer, 0)
                            if (audioBufferInfo.size < 0) {
                                break
                            }

                            audioBufferInfo.presentationTimeUs = extractor.sampleTime + startTimeUs
                            audioBufferInfo.flags = extractor.sampleFlags
                            audioBufferInfo.offset = 0

                            muxer.writeSampleData(audioTrackIndex, audioBuffer, audioBufferInfo)
                            extractor.advance()
                        }

                        extractor.release()
                        Log.d(TAG, "Audio samples copied from $audioPath")
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to copy audio from $audioPath", e)
                    }
                }
            }

            Log.d(TAG, "Export completed successfully!")
            Log.d(TAG, "Total duration: ${presentationTimeUs / 1_000_000.0}s")

            val result = Arguments.createMap()
            result.putString("videoPath", outputPath)
            result.putDouble("duration", presentationTimeUs / 1_000_000.0)
            result.putBoolean("success", true)
            promise.resolve(result)

        } catch (e: Exception) {
            Log.e(TAG, "exportVideoWithAudio failed", e)
            promise.reject("EXPORT_ERROR", "Failed to export video: ${e.message}", e)
        } finally {
            try {
                textureRenderer = null
                inputSurface?.release()
                encoder?.stop()
                encoder?.release()
                muxer?.stop()
                muxer?.release()
            } catch (e: Exception) {
                Log.e(TAG, "Error releasing resources", e)
            }
        }
    }

    private fun loadAndScaleBitmap(path: String, targetWidth: Int, targetHeight: Int): Bitmap? {
        return try {
            val options = BitmapFactory.Options()
            options.inJustDecodeBounds = true
            BitmapFactory.decodeFile(path, options)

            options.inSampleSize = calculateInSampleSize(options, targetWidth, targetHeight)
            options.inJustDecodeBounds = false

            val bitmap = BitmapFactory.decodeFile(path, options) ?: return null

            // Scale to exact target size
            if (bitmap.width != targetWidth || bitmap.height != targetHeight) {
                val scaled = Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, true)
                if (scaled != bitmap) {
                    bitmap.recycle()
                }
                scaled
            } else {
                bitmap
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load bitmap: $path", e)
            null
        }
    }

    private fun calculateInSampleSize(options: BitmapFactory.Options, reqWidth: Int, reqHeight: Int): Int {
        val height = options.outHeight
        val width = options.outWidth
        var inSampleSize = 1

        if (height > reqHeight || width > reqWidth) {
            val halfHeight = height / 2
            val halfWidth = width / 2

            while (halfHeight / inSampleSize >= reqHeight && halfWidth / inSampleSize >= reqWidth) {
                inSampleSize *= 2
            }
        }

        return inSampleSize
    }

    private fun createSlideTransition(
        fromBitmap: Bitmap,
        toBitmap: Bitmap,
        progress: Double,
        direction: String,
        width: Int,
        height: Int
    ): Bitmap {
        val result = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(result)

        val offset = (width * progress).toFloat()
        val fromX: Float
        val toX: Float

        if (direction == "right") {
            // RTL: slide to right
            fromX = offset
            toX = offset - width
        } else {
            // LTR: slide to left
            fromX = -offset
            toX = width - offset
        }

        val matrix1 = Matrix()
        matrix1.setTranslate(toX, 0f)
        canvas.drawBitmap(toBitmap, matrix1, null)

        val matrix2 = Matrix()
        matrix2.setTranslate(fromX, 0f)
        canvas.drawBitmap(fromBitmap, matrix2, null)

        return result
    }
}
