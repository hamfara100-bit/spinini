package expo.modules.remotecontrol

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Build
import android.view.accessibility.AccessibilityEvent
import org.json.JSONObject
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * GestureInjectorService
 *
 * An AccessibilityService that the host (kid's) device must have enabled in
 * Settings → Accessibility → Remote Control.  Once enabled, [instance] is
 * populated and [RemoteControlModule] can call [injectFromCommand] to replay
 * every touch/key/scroll command that arrives from the viewer (parent).
 *
 * Manifest entry required in the host app's AndroidManifest.xml:
 *
 *   <service
 *       android:name="expo.modules.remotecontrol.GestureInjectorService"
 *       android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
 *       android:exported="true">
 *     <intent-filter>
 *       <action android:name="android.accessibilityservice.AccessibilityService"/>
 *     </intent-filter>
 *     <meta-data
 *         android:name="android.accessibilityservice"
 *         android:resource="@xml/accessibility_service_config"/>
 *   </service>
 *
 * res/xml/accessibility_service_config.xml example:
 *
 *   <accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
 *       android:accessibilityEventTypes="typeWindowStateChanged"
 *       android:accessibilityFeedbackType="feedbackGeneric"
 *       android:canPerformGestures="true"
 *       android:description="@string/accessibility_service_description"/>
 */
class GestureInjectorService : AccessibilityService() {

    companion object {
        /** Populated when the service connects; null when not running. */
        @Volatile
        var instance: GestureInjectorService? = null

        /** Commands queued before the service was ready (drained on connect). */
        val pendingCommands: ConcurrentLinkedQueue<String> = ConcurrentLinkedQueue()
    }

    // -----------------------------------------------------------------------
    // AccessibilityService lifecycle
    // -----------------------------------------------------------------------

    override fun onServiceConnected() {
        instance = this

        // Configure the service info programmatically in addition to the XML
        serviceInfo = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2) {
                flags = AccessibilityServiceInfo.FLAG_REQUEST_TOUCH_EXPLORATION_MODE
            }
        }

        // Drain any commands that arrived before the service was ready
        while (pendingCommands.isNotEmpty()) {
            val cmd = pendingCommands.poll() ?: break
            injectFromCommand(cmd)
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // We only need gesture injection; no event processing required.
    }

    override fun onInterrupt() {
        // No-op: required by AccessibilityService contract.
    }

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }

    // -----------------------------------------------------------------------
    // Public injection API
    // -----------------------------------------------------------------------

    /**
     * Parse a RemoteCommand JSON string and inject the corresponding gesture
     * or system action on the host device.
     *
     * If the service is not yet connected the command is queued and will be
     * replayed once [onServiceConnected] fires.
     */
    fun injectFromCommand(json: String) {
        val svc = instance
        if (svc == null) {
            pendingCommands.offer(json)
            return
        }
        try {
            val obj = JSONObject(json)
            val cmd = parseCommand(obj)
            svc.injectGesture(cmd)
        } catch (_: Exception) {
            // Malformed JSON or unsupported command — silently ignore
        }
    }

    /**
     * Inject a fully parsed [ParsedCommand] on this service instance.
     *
     * All gesture injection APIs require API 24+.  System actions (HOME, BACK,
     * RECENTS) work on all API levels that support AccessibilityService.
     */
    fun injectGesture(cmd: ParsedCommand) {
        when (cmd.type) {
            "home" -> performGlobalAction(GLOBAL_ACTION_HOME)
            "back" -> performGlobalAction(GLOBAL_ACTION_BACK)
            "recents" -> performGlobalAction(GLOBAL_ACTION_RECENTS)

            "touch" -> {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return
                val touch = cmd.touch ?: return
                val (absX, absY) = normalizedToAbsolute(touch.x, touch.y)

                val path = Path().apply { moveTo(absX, absY) }
                val duration = when (touch.type) {
                    "down" -> 50L
                    "move" -> 16L   // ~1 frame at 60 fps
                    "up"   -> 50L
                    else   -> 50L
                }

                val stroke = GestureDescription.StrokeDescription(path, 0, duration)
                val gesture = GestureDescription.Builder().addStroke(stroke).build()
                dispatchGesture(gesture, null, null)
            }

            "scroll" -> {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return
                val dx = cmd.scrollDeltaX ?: 0f
                val dy = cmd.scrollDeltaY ?: 0f
                val (centerX, centerY) = screenCenter()

                // Build a swipe path: start at center, offset by scroll delta
                val endX = (centerX - dx).coerceIn(0f, screenWidth().toFloat())
                val endY = (centerY - dy).coerceIn(0f, screenHeight().toFloat())

                val path = Path().apply {
                    moveTo(centerX, centerY)
                    lineTo(endX, endY)
                }
                val stroke = GestureDescription.StrokeDescription(path, 0, 200)
                val gesture = GestureDescription.Builder().addStroke(stroke).build()
                dispatchGesture(gesture, null, null)
            }

            "key" -> {
                // AccessibilityService cannot inject arbitrary key events directly.
                // Keys that map to global actions are handled above; for all others
                // we use the InputManager reflection path as a best-effort approach.
                injectKeyEventReflection(cmd.keyCode ?: 0)
            }

            "volume_up" -> adjustVolume(android.media.AudioManager.ADJUST_RAISE)
            "volume_down" -> adjustVolume(android.media.AudioManager.ADJUST_LOWER)

            "screenshot" -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    performGlobalAction(GLOBAL_ACTION_TAKE_SCREENSHOT)
                }
            }
        }
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private fun normalizedToAbsolute(nx: Float, ny: Float): Pair<Float, Float> {
        val w = screenWidth()
        val h = screenHeight()
        return Pair(nx * w, ny * h)
    }

    private fun screenCenter(): Pair<Float, Float> =
        Pair(screenWidth() / 2f, screenHeight() / 2f)

    private fun screenWidth(): Int {
        val wm = getSystemService(WINDOW_SERVICE) as android.view.WindowManager
        val metrics = android.util.DisplayMetrics()
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
        return metrics.widthPixels
    }

    private fun screenHeight(): Int {
        val wm = getSystemService(WINDOW_SERVICE) as android.view.WindowManager
        val metrics = android.util.DisplayMetrics()
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)
        return metrics.heightPixels
    }

    private fun adjustVolume(direction: Int) {
        val am = getSystemService(AUDIO_SERVICE) as android.media.AudioManager
        am.adjustStreamVolume(
            android.media.AudioManager.STREAM_MUSIC,
            direction,
            android.media.AudioManager.FLAG_SHOW_UI
        )
    }

    /**
     * Best-effort key injection via hidden InputManager API.
     * Falls back silently if the reflection call is unavailable.
     */
    private fun injectKeyEventReflection(keyCode: Int) {
        if (keyCode == 0) return
        try {
            val im = Class.forName("android.hardware.input.InputManager")
                .getMethod("getInstance")
                .invoke(null)
            val event = android.view.KeyEvent(
                android.os.SystemClock.uptimeMillis(),
                android.os.SystemClock.uptimeMillis(),
                android.view.KeyEvent.ACTION_DOWN,
                keyCode, 0
            )
            im.javaClass.getMethod("injectInputEvent", android.view.InputEvent::class.java, Int::class.java)
                .invoke(im, event, 0)
        } catch (_: Exception) {
            // Reflection not available on this ROM — silently skip
        }
    }

    // -----------------------------------------------------------------------
    // Data types
    // -----------------------------------------------------------------------

    data class TouchData(val type: String, val x: Float, val y: Float, val pointerId: Int)

    data class ParsedCommand(
        val type: String,
        val touch: TouchData?,
        val keyCode: Int?,
        val scrollDeltaX: Float?,
        val scrollDeltaY: Float?
    )

    private fun parseCommand(obj: JSONObject): ParsedCommand {
        val type = obj.getString("type")
        val touchObj = obj.optJSONObject("touch")
        val touch = touchObj?.let {
            TouchData(
                type = it.optString("type", "down"),
                x = it.optDouble("x", 0.5).toFloat(),
                y = it.optDouble("y", 0.5).toFloat(),
                pointerId = it.optInt("pointerId", 0)
            )
        }
        return ParsedCommand(
            type = type,
            touch = touch,
            keyCode = if (obj.has("keyCode")) obj.getInt("keyCode") else null,
            scrollDeltaX = if (obj.has("scrollDeltaX")) obj.getDouble("scrollDeltaX").toFloat() else null,
            scrollDeltaY = if (obj.has("scrollDeltaY")) obj.getDouble("scrollDeltaY").toFloat() else null
        )
    }
}
