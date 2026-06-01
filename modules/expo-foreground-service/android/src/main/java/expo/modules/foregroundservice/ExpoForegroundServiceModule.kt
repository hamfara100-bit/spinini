package expo.modules.foregroundservice

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoForegroundServiceModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {
    Name("ExpoForegroundService")

    /** Start the persistent keep-alive foreground service. */
    Function("start") {
      try {
        ContextCompat.startForegroundService(context, Intent(context, KeepAliveService::class.java))
      } catch (_: Exception) {}
      KeepAliveService.isRunning
    }

    /** Stop the keep-alive service. */
    Function("stop") {
      try {
        context.stopService(Intent(context, KeepAliveService::class.java))
      } catch (_: Exception) {}
      true
    }

    /** Whether the keep-alive service is currently running. */
    Function("isRunning") {
      KeepAliveService.isRunning
    }

    /** Whether the app is exempt from battery optimization (Doze). */
    Function("isBatteryExempt") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        pm.isIgnoringBatteryOptimizations(context.packageName)
      } else true
    }

    /** Open the system dialog asking the user to exempt the app from battery
     *  optimization, so the service keeps running reliably with the screen off. */
    Function("requestBatteryExemption") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        if (!pm.isIgnoringBatteryOptimizations(context.packageName)) {
          try {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
              data = Uri.parse("package:" + context.packageName)
              addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
          } catch (_: Exception) {}
        }
      }
      true
    }
  }
}
