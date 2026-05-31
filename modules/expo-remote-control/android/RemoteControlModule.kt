package expo.modules.remotecontrol

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import android.util.DisplayMetrics
import android.view.WindowManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket
import java.security.MessageDigest
import java.util.Collections
import java.util.Date
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread

class RemoteControlModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        var mediaProjectionResult: Intent? = null
        var isHostRunning: Boolean = false
        const val MEDIA_PROJECTION_REQUEST_CODE = 1337
        const val WS_PORT = 9876
    }

    // -----------------------------------------------------------------------
    // Internal state
    // -----------------------------------------------------------------------

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private var captureThread: HandlerThread? = null
    private var captureHandler: Handler? = null

    private var wsServer: SimpleWebSocketServer? = null
    private var wsClient: SimpleWebSocketClient? = null

    private var sessionId: String = ""
    private var sessionRole: String = "viewer"   // "host" | "viewer"
    private var connectionState: String = "idle"
    private var peerDeviceName: String = ""
    private var startedAt: String = ""

    // Compression settings (mutable by setFrameQuality)
    @Volatile private var jpegQuality: Int = 60
    @Volatile private var targetFps: Int = 15
    private var lastFrameMs: Long = 0L

    // Activity result callback registered via onActivityResult interception
    private var pendingCapturePromise: Promise? = null

    // -----------------------------------------------------------------------
    // ReactContextBaseJavaModule
    // -----------------------------------------------------------------------

    override fun getName(): String = "RemoteControlModule"

    // -----------------------------------------------------------------------
    // Helper: emit JS event
    // -----------------------------------------------------------------------

    private fun emit(eventName: String, params: Any?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    private fun emitState(state: String) {
        connectionState = state
        val map = Arguments.createMap()
        map.putString("state", state)
        emit("RCState", map)
    }

    // -----------------------------------------------------------------------
    // 1. requestScreenCapturePermission
    // -----------------------------------------------------------------------

    @ReactMethod
    fun requestScreenCapturePermission(promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity")
            return
        }
        val mgr = activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        pendingCapturePromise = promise

        // We need to receive the result — register a one-shot ActivityEventListener
        val listener = object : com.facebook.react.bridge.BaseActivityEventListener() {
            override fun onActivityResult(
                activity: Activity?,
                requestCode: Int,
                resultCode: Int,
                data: Intent?
            ) {
                if (requestCode == MEDIA_PROJECTION_REQUEST_CODE) {
                    reactContext.removeActivityEventListener(this)
                    if (resultCode == Activity.RESULT_OK && data != null) {
                        mediaProjectionResult = data
                        pendingCapturePromise?.resolve(true)
                    } else {
                        pendingCapturePromise?.resolve(false)
                    }
                    pendingCapturePromise = null
                }
            }
        }
        reactContext.addActivityEventListener(listener)
        activity.startActivityForResult(
            mgr.createScreenCaptureIntent(),
            MEDIA_PROJECTION_REQUEST_CODE
        )
    }

    // -----------------------------------------------------------------------
    // 2. startHostSession
    // -----------------------------------------------------------------------

    @ReactMethod
    fun startHostSession(sid: String, frameInfoJson: String, promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
            promise.resolve(false)
            return
        }
        val projResult = mediaProjectionResult
        if (projResult == null) {
            promise.reject("NO_PERMISSION", "Call requestScreenCapturePermission first")
            return
        }

        val frameInfo = try { JSONObject(frameInfoJson) } catch (e: Exception) {
            promise.reject("BAD_JSON", "Invalid frameInfoJson: ${e.message}")
            return
        }

        jpegQuality = frameInfo.optInt("quality", 60).coerceIn(1, 100)
        targetFps = frameInfo.optInt("fps", 15).coerceIn(1, 60)

        sessionId = sid
        sessionRole = "host"
        startedAt = Date().toISOString()
        emitState("connecting")

        val mgr = reactContext.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        mediaProjection = mgr.getMediaProjection(Activity.RESULT_OK, projResult)

        val metrics = getDisplayMetrics()
        val width = frameInfo.optInt("width", metrics.widthPixels)
        val height = frameInfo.optInt("height", metrics.heightPixels)
        val density = metrics.densityDpi

        // ImageReader in JPEG mode so we can grab compressed frames directly
        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)

        captureThread = HandlerThread("RCCapture").also { it.start() }
        captureHandler = Handler(captureThread!!.looper)

        virtualDisplay = mediaProjection!!.createVirtualDisplay(
            "RCVirtualDisplay",
            width, height, density,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader!!.surface,
            null, captureHandler
        )

        // Start WebSocket server
        wsServer = SimpleWebSocketServer(WS_PORT, ::onCommandReceivedFromWs)
        wsServer!!.start()

        // Frame dispatch loop
        imageReader!!.setOnImageAvailableListener({ reader ->
            val now = System.currentTimeMillis()
            val minInterval = 1000L / targetFps
            if (now - lastFrameMs < minInterval) {
                reader.acquireLatestImage()?.close()
                return@setOnImageAvailableListener
            }
            lastFrameMs = now

            val image = reader.acquireLatestImage() ?: return@setOnImageAvailableListener
            try {
                val planes = image.planes
                val buffer = planes[0].buffer
                val pixelStride = planes[0].pixelStride
                val rowStride = planes[0].rowStride
                val rowPadding = rowStride - pixelStride * image.width

                val bmp = Bitmap.createBitmap(
                    image.width + rowPadding / pixelStride,
                    image.height,
                    Bitmap.Config.ARGB_8888
                )
                bmp.copyPixelsFromBuffer(buffer)

                val out = ByteArrayOutputStream()
                bmp.compress(Bitmap.CompressFormat.JPEG, jpegQuality, out)
                bmp.recycle()

                val b64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)

                // Emit to local JS (if someone is listening on the same device)
                val map = Arguments.createMap()
                map.putString("data", b64)
                emit("RCFrame", map)

                // Broadcast to connected WebSocket viewers
                wsServer?.broadcast(b64)
            } catch (e: Exception) {
                // Silently ignore single frame errors
            } finally {
                image.close()
            }
        }, captureHandler)

        isHostRunning = true
        emitState("connected")
        promise.resolve(true)
    }

    // -----------------------------------------------------------------------
    // 3. stopHostSession
    // -----------------------------------------------------------------------

    @ReactMethod
    fun stopHostSession(promise: Promise) {
        virtualDisplay?.release(); virtualDisplay = null
        imageReader?.close(); imageReader = null
        mediaProjection?.stop(); mediaProjection = null
        captureThread?.quitSafely(); captureThread = null
        wsServer?.stop(); wsServer = null
        isHostRunning = false
        emitState("disconnected")
        promise.resolve(null)
    }

    // -----------------------------------------------------------------------
    // 4. startViewerSession
    // -----------------------------------------------------------------------

    @ReactMethod
    fun startViewerSession(sid: String, serverUrl: String, promise: Promise) {
        sessionId = sid
        sessionRole = "viewer"
        startedAt = Date().toISOString()
        emitState("connecting")

        wsClient = SimpleWebSocketClient("ws://$serverUrl:$WS_PORT") { message ->
            // Incoming message is either a base64 frame or a command JSON
            val map = Arguments.createMap()
            map.putString("data", message)
            emit("RCFrame", map)
        }

        thread(name = "RCViewerConnect") {
            try {
                wsClient!!.connect()
                emitState("connected")
                promise.resolve(true)
            } catch (e: Exception) {
                emitState("error")
                promise.reject("CONNECT_FAILED", e.message)
            }
        }
    }

    // -----------------------------------------------------------------------
    // 5. stopViewerSession
    // -----------------------------------------------------------------------

    @ReactMethod
    fun stopViewerSession(promise: Promise) {
        wsClient?.disconnect(); wsClient = null
        emitState("disconnected")
        promise.resolve(null)
    }

    // -----------------------------------------------------------------------
    // 6. sendCommand
    // -----------------------------------------------------------------------

    @ReactMethod
    fun sendCommand(commandJson: String, promise: Promise) {
        // Viewer → send over WebSocket to host
        if (sessionRole == "viewer" && wsClient != null) {
            thread(name = "RCSendCmd") {
                try {
                    wsClient!!.send(commandJson)
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("SEND_FAILED", e.message)
                }
            }
        } else if (sessionRole == "host") {
            // Host injecting locally (edge-case: self-control)
            handleCommandLocally(commandJson)
            promise.resolve(null)
        } else {
            promise.resolve(null)
        }
    }

    // -----------------------------------------------------------------------
    // 7. getSessionInfo
    // -----------------------------------------------------------------------

    @ReactMethod
    fun getSessionInfo(promise: Promise) {
        val map = Arguments.createMap()
        map.putString("sessionId", sessionId)
        map.putString("role", sessionRole)
        map.putString("state", connectionState)
        map.putString("peerDeviceName", peerDeviceName)
        map.putString("startedAt", startedAt)
        promise.resolve(map)
    }

    // -----------------------------------------------------------------------
    // 8. setFrameQuality
    // -----------------------------------------------------------------------

    @ReactMethod
    fun setFrameQuality(quality: Double, fps: Double, promise: Promise) {
        jpegQuality = quality.toInt().coerceIn(1, 100)
        targetFps = fps.toInt().coerceIn(1, 60)
        promise.resolve(null)
    }

    // -----------------------------------------------------------------------
    // 9. isScreenCaptureAvailable
    // -----------------------------------------------------------------------

    @ReactMethod
    fun isScreenCaptureAvailable(promise: Promise) {
        promise.resolve(Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP)
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    private fun onCommandReceivedFromWs(commandJson: String) {
        // Inject gesture via accessibility service if available
        handleCommandLocally(commandJson)

        // Also surface to JS so host-side JS can react
        try {
            val obj = JSONObject(commandJson)
            val map = Arguments.createMap()
            map.putString("type", obj.optString("type"))
            emit("RCCommand", map)
        } catch (_: Exception) {}
    }

    private fun handleCommandLocally(commandJson: String) {
        val service = GestureInjectorService.instance
        if (service != null) {
            service.injectFromCommand(commandJson)
        }
    }

    private fun getDisplayMetrics(): DisplayMetrics {
        val wm = reactContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
        return metrics
    }
}

// ===========================================================================
// Minimal raw WebSocket server (RFC 6455, text frames only)
// Avoids adding NanoHTTPD as a dependency.
// ===========================================================================

private class SimpleWebSocketServer(
    private val port: Int,
    private val onMessage: (String) -> Unit
) {
    private var serverSocket: ServerSocket? = null
    private val running = AtomicBoolean(false)
    private val clients = CopyOnWriteArrayList<Socket>()

    fun start() {
        running.set(true)
        thread(name = "RCWsServer") {
            serverSocket = ServerSocket(port)
            while (running.get()) {
                try {
                    val client = serverSocket!!.accept()
                    thread(name = "RCWsClient") { handleClient(client) }
                } catch (_: IOException) { break }
            }
        }
    }

    fun stop() {
        running.set(false)
        clients.forEach { runCatching { it.close() } }
        clients.clear()
        runCatching { serverSocket?.close() }
    }

    fun broadcast(text: String) {
        val frame = encodeTextFrame(text)
        val dead = mutableListOf<Socket>()
        for (client in clients) {
            try {
                client.getOutputStream().write(frame)
                client.getOutputStream().flush()
            } catch (_: IOException) { dead.add(client) }
        }
        clients.removeAll(dead)
    }

    private fun handleClient(socket: Socket) {
        try {
            val input = socket.getInputStream()
            val output = socket.getOutputStream()

            // Perform WebSocket HTTP upgrade handshake
            val requestLines = mutableListOf<String>()
            val sb = StringBuilder()
            var prev = -1
            while (true) {
                val b = input.read()
                if (b == -1) return
                sb.append(b.toChar())
                if (prev == '\r'.code && b == '\n'.code) {
                    val line = sb.toString().trim()
                    if (line.isEmpty()) break
                    requestLines.add(line)
                    sb.clear()
                }
                prev = b
            }

            val wsKey = requestLines
                .firstOrNull { it.startsWith("Sec-WebSocket-Key:") }
                ?.substringAfter(":")?.trim() ?: return

            val acceptKey = Base64.encodeToString(
                MessageDigest.getInstance("SHA-1")
                    .digest("$wsKey258EAFA5-E914-47DA-95CA-C5AB0DC85B11".toByteArray()),
                Base64.NO_WRAP
            )
            val response = "HTTP/1.1 101 Switching Protocols\r\n" +
                "Upgrade: websocket\r\n" +
                "Connection: Upgrade\r\n" +
                "Sec-WebSocket-Accept: $acceptKey\r\n\r\n"
            output.write(response.toByteArray())
            output.flush()

            clients.add(socket)

            // Read frames
            while (running.get() && !socket.isClosed) {
                val text = readTextFrame(input) ?: break
                onMessage(text)
            }
        } catch (_: Exception) {
        } finally {
            clients.remove(socket)
            runCatching { socket.close() }
        }
    }

    private fun readTextFrame(input: InputStream): String? {
        val b0 = input.read().takeIf { it != -1 } ?: return null
        val b1 = input.read().takeIf { it != -1 } ?: return null
        val masked = (b1 and 0x80) != 0
        var length = (b1 and 0x7F).toLong()
        if (length == 126L) {
            length = ((input.read() shl 8) or input.read()).toLong()
        } else if (length == 127L) {
            length = 0
            repeat(8) { length = (length shl 8) or input.read().toLong() }
        }
        val mask = if (masked) ByteArray(4) { input.read().toByte() } else null
        val data = ByteArray(length.toInt())
        var offset = 0
        while (offset < data.size) {
            val read = input.read(data, offset, data.size - offset)
            if (read == -1) return null
            offset += read
        }
        if (mask != null) {
            for (i in data.indices) data[i] = (data[i].toInt() xor mask[i % 4].toInt()).toByte()
        }
        return String(data, Charsets.UTF_8)
    }

    private fun encodeTextFrame(text: String): ByteArray {
        val payload = text.toByteArray(Charsets.UTF_8)
        val len = payload.size
        val frame = when {
            len <= 125 -> ByteArray(2 + len).also { it[1] = len.toByte() }
            len <= 65535 -> ByteArray(4 + len).also {
                it[1] = 126.toByte()
                it[2] = (len shr 8).toByte()
                it[3] = (len and 0xFF).toByte()
            }
            else -> ByteArray(10 + len).also {
                it[1] = 127.toByte()
                for (i in 0..7) it[2 + i] = (len.toLong() shr (56 - 8 * i) and 0xFF).toByte()
            }
        }
        frame[0] = 0x81.toByte() // FIN + text opcode
        payload.copyInto(frame, frame.size - len)
        return frame
    }
}

// ===========================================================================
// Minimal WebSocket client (RFC 6455, text frames, no masking on receive)
// ===========================================================================

private class SimpleWebSocketClient(
    private val url: String,
    private val onMessage: (String) -> Unit
) {
    private var socket: Socket? = null
    private val running = AtomicBoolean(false)

    fun connect() {
        // Parse ws://host:port
        val withoutScheme = url.removePrefix("ws://")
        val host = withoutScheme.substringBefore(":")
        val port = withoutScheme.substringAfter(":").toIntOrNull() ?: 9876

        socket = Socket(host, port)
        running.set(true)
        val output = socket!!.getOutputStream()
        val input = socket!!.getInputStream()

        // Send HTTP upgrade request
        val key = Base64.encodeToString(ByteArray(16).also { java.util.Random().nextBytes(it) }, Base64.NO_WRAP)
        val request = "GET / HTTP/1.1\r\n" +
            "Host: $host:$port\r\n" +
            "Upgrade: websocket\r\n" +
            "Connection: Upgrade\r\n" +
            "Sec-WebSocket-Key: $key\r\n" +
            "Sec-WebSocket-Version: 13\r\n\r\n"
        output.write(request.toByteArray())
        output.flush()

        // Consume HTTP response until blank line
        val sb = StringBuilder()
        var prev = -1
        while (true) {
            val b = input.read()
            if (b == -1) throw IOException("Connection closed during handshake")
            sb.append(b.toChar())
            if (prev == '\r'.code && b == '\n'.code) {
                if (sb.toString() == "\r\n") break
                sb.clear()
            }
            prev = b
        }

        // Read incoming frames on this thread (caller wraps in a thread)
        while (running.get()) {
            val text = readTextFrame(input) ?: break
            onMessage(text)
        }
    }

    fun send(text: String) {
        val payload = text.toByteArray(Charsets.UTF_8)
        val len = payload.size
        // Client frames must be masked
        val maskBytes = ByteArray(4).also { java.util.Random().nextBytes(it) }
        val headerSize = when {
            len <= 125 -> 2
            len <= 65535 -> 4
            else -> 10
        }
        val frame = ByteArray(headerSize + 4 + len)
        frame[0] = 0x81.toByte()
        when {
            len <= 125 -> { frame[1] = (0x80 or len).toByte() }
            len <= 65535 -> {
                frame[1] = (0x80 or 126).toByte()
                frame[2] = (len shr 8).toByte()
                frame[3] = (len and 0xFF).toByte()
            }
            else -> {
                frame[1] = (0x80 or 127).toByte()
                for (i in 0..7) frame[2 + i] = (len.toLong() shr (56 - 8 * i) and 0xFF).toByte()
            }
        }
        maskBytes.copyInto(frame, headerSize)
        for (i in payload.indices) {
            frame[headerSize + 4 + i] = (payload[i].toInt() xor maskBytes[i % 4].toInt()).toByte()
        }
        socket?.getOutputStream()?.apply { write(frame); flush() }
    }

    fun disconnect() {
        running.set(false)
        runCatching { socket?.close() }
    }

    private fun readTextFrame(input: InputStream): String? {
        val b0 = input.read().takeIf { it != -1 } ?: return null
        val b1 = input.read().takeIf { it != -1 } ?: return null
        val masked = (b1 and 0x80) != 0
        var length = (b1 and 0x7F).toLong()
        if (length == 126L) {
            length = ((input.read() shl 8) or input.read()).toLong()
        } else if (length == 127L) {
            length = 0
            repeat(8) { length = (length shl 8) or input.read().toLong() }
        }
        val mask = if (masked) ByteArray(4) { input.read().toByte() } else null
        val data = ByteArray(length.toInt())
        var offset = 0
        while (offset < data.size) {
            val read = input.read(data, offset, data.size - offset)
            if (read == -1) return null
            offset += read
        }
        if (mask != null) {
            for (i in data.indices) data[i] = (data[i].toInt() xor mask[i % 4].toInt()).toByte()
        }
        return String(data, Charsets.UTF_8)
    }
}

// ---------------------------------------------------------------------------
// Extension: Date to ISO-8601 string
// ---------------------------------------------------------------------------
private fun Date.toISOString(): String =
    java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
        .apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }
        .format(this)
