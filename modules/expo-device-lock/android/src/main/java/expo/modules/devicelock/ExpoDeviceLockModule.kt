package expo.modules.devicelock

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoDeviceLockModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)
  private var overlayView: View? = null
  private var windowManager: WindowManager? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoDeviceLock")

    // Check if overlay permission is granted
    Function("hasOverlayPermission") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        Settings.canDrawOverlays(context)
      } else {
        true
      }
    }

    // Open overlay permission settings
    Function("openOverlaySettings") {
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${context.packageName}")
      ).apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK }
      context.startActivity(intent)
    }

    // Show the full-screen lock overlay
    Function("showLock") { message: String, _imageUri: String? ->
      val activity = appContext.currentActivity
      if (activity != null) {
        activity.runOnUiThread {
          if (overlayView == null) {
            val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
            windowManager = wm

            val tv = TextView(context).apply {
              text = "🔒 $message"
              setTextColor(Color.WHITE)
              textSize = 22f
              gravity = Gravity.CENTER
              setPadding(48, 0, 48, 0)
            }

            val frame = FrameLayout(context).apply {
              setBackgroundColor(Color.parseColor("#EE0E0B1F"))
              addView(tv, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
              ).also { it.gravity = Gravity.CENTER })
              isClickable = true
              isFocusable = true
              setOnTouchListener { _, _ -> true }
            }

            val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
              WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
              @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

            val params = WindowManager.LayoutParams(
              WindowManager.LayoutParams.MATCH_PARENT,
              WindowManager.LayoutParams.MATCH_PARENT,
              type,
              WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
              PixelFormat.TRANSLUCENT
            ).apply {
              gravity = Gravity.TOP or Gravity.START
              x = 0; y = 0
            }

            try {
              wm.addView(frame, params)
              overlayView = frame
            } catch (e: Exception) {
              // Overlay permission not granted or already showing
            }
          }
        }
      }
    }

    // Remove the overlay
    Function("hideLock") {
      val activity = appContext.currentActivity
      if (activity != null) {
        activity.runOnUiThread {
          overlayView?.let { v ->
            try { windowManager?.removeView(v) } catch (e: Exception) {}
            overlayView = null
            windowManager = null
          }
        }
      }
    }

    // Returns true if the lock overlay is currently visible
    Function("isLocked") {
      overlayView != null
    }
  }
}
