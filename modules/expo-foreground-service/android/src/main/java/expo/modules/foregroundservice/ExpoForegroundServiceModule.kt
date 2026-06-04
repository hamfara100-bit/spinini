package expo.modules.foregroundservice

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoForegroundServiceModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)

  // Native heartbeat timer — runs on its own OS thread, so it keeps firing even
  // when Android pauses the React Native JS timers (app backgrounded / screen off).
  private var tickerThread: HandlerThread? = null
  private var tickerHandler: Handler? = null
  private var tickRunnable: Runnable? = null
  @Volatile private var tickIntervalMs: Long = 3000L

  private fun startTickerInternal() {
    stopTickerInternal()
    val ht = HandlerThread("SpininiTicker").also { it.start() }
    val h = Handler(ht.looper)
    val r = object : Runnable {
      override fun run() {
        try { this@ExpoForegroundServiceModule.sendEvent("onTick", mapOf("t" to System.currentTimeMillis())) } catch (_: Exception) {}
        h.postDelayed(this, tickIntervalMs)
      }
    }
    tickerThread = ht; tickerHandler = h; tickRunnable = r
    h.postDelayed(r, tickIntervalMs)
  }

  private fun stopTickerInternal() {
    try { tickRunnable?.let { tickerHandler?.removeCallbacks(it) } } catch (_: Exception) {}
    try { tickerThread?.quitSafely() } catch (_: Exception) {}
    tickerThread = null; tickerHandler = null; tickRunnable = null
  }

  override fun definition() = ModuleDefinition {
    Name("ExpoForegroundService")

    Events("onTick")

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

    /** Start a native heartbeat that emits "onTick" every [intervalMs] ms —
     *  immune to RN's background JS-timer pausing, so the sync poll keeps
     *  running when the app is backgrounded or the screen is off. */
    Function("startTicker") { intervalMs: Int ->
      tickIntervalMs = intervalMs.toLong().coerceAtLeast(1000L)
      startTickerInternal()
      true
    }

    /** Stop the native heartbeat. */
    Function("stopTicker") {
      stopTickerInternal()
      true
    }

    OnDestroy { stopTickerInternal() }

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
