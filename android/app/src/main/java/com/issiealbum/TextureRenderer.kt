package com.issiealbum

import android.graphics.Bitmap
import android.opengl.GLES20
import android.opengl.GLUtils
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

/**
 * Renders a bitmap to an OpenGL texture and displays it on screen.
 */
class TextureRenderer {
    private val mTriangleVertices: FloatBuffer
    private var mProgram = 0
    private var mTextureID = -1
    private var muMVPMatrixHandle = 0
    private var muTexMatrixHandle = 0
    private var maPositionHandle = 0
    private var maTextureHandle = 0

    private val mMVPMatrix = FloatArray(16)
    private val mTexMatrix = FloatArray(16)

    companion object {
        private const val FLOAT_SIZE_BYTES = 4
        private const val TRIANGLE_VERTICES_DATA_STRIDE_BYTES = 5 * FLOAT_SIZE_BYTES
        private const val TRIANGLE_VERTICES_DATA_POS_OFFSET = 0
        private const val TRIANGLE_VERTICES_DATA_UV_OFFSET = 3

        private val mTriangleVerticesData = floatArrayOf(
            // X, Y, Z, U, V
            -1.0f, -1.0f, 0f, 0f, 1f,
            1.0f, -1.0f, 0f, 1f, 1f,
            -1.0f, 1.0f, 0f, 0f, 0f,
            1.0f, 1.0f, 0f, 1f, 0f
        )

        private const val VERTEX_SHADER = """
            uniform mat4 uMVPMatrix;
            uniform mat4 uTexMatrix;
            attribute vec4 aPosition;
            attribute vec4 aTextureCoord;
            varying vec2 vTextureCoord;
            void main() {
                gl_Position = uMVPMatrix * aPosition;
                vTextureCoord = (uTexMatrix * aTextureCoord).xy;
            }
        """

        private const val FRAGMENT_SHADER = """
            precision mediump float;
            varying vec2 vTextureCoord;
            uniform sampler2D sTexture;
            void main() {
                gl_FragColor = texture2D(sTexture, vTextureCoord);
            }
        """
    }

    init {
        mTriangleVertices = ByteBuffer.allocateDirect(
            mTriangleVerticesData.size * FLOAT_SIZE_BYTES
        ).order(ByteOrder.nativeOrder()).asFloatBuffer()
        mTriangleVertices.put(mTriangleVerticesData).position(0)

        // Identity matrix for MVP
        android.opengl.Matrix.setIdentityM(mMVPMatrix, 0)
        android.opengl.Matrix.setIdentityM(mTexMatrix, 0)
    }

    fun surfaceCreated() {
        mProgram = createProgram(VERTEX_SHADER, FRAGMENT_SHADER)
        if (mProgram == 0) {
            throw RuntimeException("failed creating program")
        }

        maPositionHandle = GLES20.glGetAttribLocation(mProgram, "aPosition")
        checkGlError("glGetAttribLocation aPosition")
        if (maPositionHandle == -1) {
            throw RuntimeException("Could not get attrib location for aPosition")
        }

        maTextureHandle = GLES20.glGetAttribLocation(mProgram, "aTextureCoord")
        checkGlError("glGetAttribLocation aTextureCoord")
        if (maTextureHandle == -1) {
            throw RuntimeException("Could not get attrib location for aTextureCoord")
        }

        muMVPMatrixHandle = GLES20.glGetUniformLocation(mProgram, "uMVPMatrix")
        checkGlError("glGetUniformLocation uMVPMatrix")
        if (muMVPMatrixHandle == -1) {
            throw RuntimeException("Could not get attrib location for uMVPMatrix")
        }

        muTexMatrixHandle = GLES20.glGetUniformLocation(mProgram, "uTexMatrix")
        checkGlError("glGetUniformLocation uTexMatrix")
        if (muTexMatrixHandle == -1) {
            throw RuntimeException("Could not get attrib location for uTexMatrix")
        }

        // Generate texture
        val textures = IntArray(1)
        GLES20.glGenTextures(1, textures, 0)
        mTextureID = textures[0]
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, mTextureID)
        checkGlError("glBindTexture mTextureID")

        GLES20.glTexParameterf(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR.toFloat())
        GLES20.glTexParameterf(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR.toFloat())
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
        checkGlError("glTexParameter")
    }

    fun drawFrame(bitmap: Bitmap, width: Int, height: Int) {
        checkGlError("onDrawFrame start")

        // Set viewport
        GLES20.glViewport(0, 0, width, height)
        GLES20.glClearColor(0.0f, 0.0f, 0.0f, 1.0f)
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)

        // Use program
        GLES20.glUseProgram(mProgram)
        checkGlError("glUseProgram")

        // Load bitmap into texture
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, mTextureID)
        GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bitmap, 0)
        checkGlError("texImage2D")

        // Set vertex positions
        mTriangleVertices.position(TRIANGLE_VERTICES_DATA_POS_OFFSET)
        GLES20.glVertexAttribPointer(maPositionHandle, 3, GLES20.GL_FLOAT, false,
            TRIANGLE_VERTICES_DATA_STRIDE_BYTES, mTriangleVertices)
        checkGlError("glVertexAttribPointer maPosition")
        GLES20.glEnableVertexAttribArray(maPositionHandle)
        checkGlError("glEnableVertexAttribArray maPositionHandle")

        // Set texture coordinates
        mTriangleVertices.position(TRIANGLE_VERTICES_DATA_UV_OFFSET)
        GLES20.glVertexAttribPointer(maTextureHandle, 2, GLES20.GL_FLOAT, false,
            TRIANGLE_VERTICES_DATA_STRIDE_BYTES, mTriangleVertices)
        checkGlError("glVertexAttribPointer maTextureHandle")
        GLES20.glEnableVertexAttribArray(maTextureHandle)
        checkGlError("glEnableVertexAttribArray maTextureHandle")

        // Set matrices
        GLES20.glUniformMatrix4fv(muMVPMatrixHandle, 1, false, mMVPMatrix, 0)
        GLES20.glUniformMatrix4fv(muTexMatrixHandle, 1, false, mTexMatrix, 0)

        // Draw
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
        checkGlError("glDrawArrays")

        GLES20.glFinish()
    }

    private fun createProgram(vertexSource: String, fragmentSource: String): Int {
        val vertexShader = loadShader(GLES20.GL_VERTEX_SHADER, vertexSource)
        if (vertexShader == 0) {
            return 0
        }
        val pixelShader = loadShader(GLES20.GL_FRAGMENT_SHADER, fragmentSource)
        if (pixelShader == 0) {
            return 0
        }

        var program = GLES20.glCreateProgram()
        checkGlError("glCreateProgram")
        if (program == 0) {
            return 0
        }

        GLES20.glAttachShader(program, vertexShader)
        checkGlError("glAttachShader")
        GLES20.glAttachShader(program, pixelShader)
        checkGlError("glAttachShader")
        GLES20.glLinkProgram(program)

        val linkStatus = IntArray(1)
        GLES20.glGetProgramiv(program, GLES20.GL_LINK_STATUS, linkStatus, 0)
        if (linkStatus[0] != GLES20.GL_TRUE) {
            GLES20.glDeleteProgram(program)
            program = 0
        }
        return program
    }

    private fun loadShader(shaderType: Int, source: String): Int {
        var shader = GLES20.glCreateShader(shaderType)
        checkGlError("glCreateShader type=$shaderType")
        GLES20.glShaderSource(shader, source)
        GLES20.glCompileShader(shader)
        val compiled = IntArray(1)
        GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, compiled, 0)
        if (compiled[0] == 0) {
            GLES20.glDeleteShader(shader)
            shader = 0
        }
        return shader
    }

    private fun checkGlError(op: String) {
        val error = GLES20.glGetError()
        if (error != GLES20.GL_NO_ERROR) {
            throw RuntimeException("$op: glError $error")
        }
    }
}
