package expo.modules.foregroundservice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/**
 * A long-running foreground service whose only job is to keep the app's process
 * (and therefore the JS runtime + Supabase sync poll) alive while the screen is
 * off, so incoming alerts/calls/messages still ring and notify.
 *
 * It holds a partial wake lock so the CPU keeps servicing the 4s sync timer even
 * under Doze. The persistent notification lives on a MIN-importance channel so it
 * is silent and unobtrusive — the actual alerts fire on the app's MAX channel.
 */
class KeepAliveService : Service() {
  companion object {
    const val CHANNEL_ID = "spinini-foreground"
    const val NOTIF_ID = 7710
    @Volatile var isRunning = false
  }

  private var wakeLock: PowerManager.WakeLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    createChannel()
    startForegroundInternal()
    acquireWakeLock()
    isRunning = true
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startForegroundInternal()
    isRunning = true
    // START_STICKY: ask the system to recreate the service if it gets killed.
    return START_STICKY
  }

  override fun onDestroy() {
    releaseWakeLock()
    isRunning = false
    super.onDestroy()
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // Restart ourselves if the user swipes the app away, so we keep listening.
    try {
      val restart = Intent(applicationContext, KeepAliveService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        applicationContext.startForegroundService(restart)
      } else {
        applicationContext.startService(restart)
      }
    } catch (_: Exception) {}
    super.onTaskRemoved(rootIntent)
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (nm.getNotificationChannel(CHANNEL_ID) == null) {
        val ch = NotificationChannel(
          CHANNEL_ID,
          "Spinini Background",
          NotificationManager.IMPORTANCE_MIN
        )
        ch.description = "Keeps Spinini listening for family alerts, calls and messages."
        ch.setShowBadge(false)
        nm.createNotificationChannel(ch)
      }
    }
  }

  private fun buildNotification(): Notification {
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or
      (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
    val pi = if (launch != null) PendingIntent.getActivity(this, 0, launch, flags) else null

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Spinini is active")
      .setContentText("Listening for family alerts, calls and messages.")
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .setShowWhen(false)
      .setContentIntent(pi)
      .build()
  }

  private fun startForegroundInternal() {
    val notif = buildNotification()
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        ServiceCompat.startForeground(
          this, NOTIF_ID, notif,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        )
      } else {
        startForeground(NOTIF_ID, notif)
      }
    } catch (_: Exception) {
      try { startForeground(NOTIF_ID, notif) } catch (_: Exception) {}
    }
  }

  private fun acquireWakeLock() {
    try {
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Spinini::KeepAlive").apply {
        setReferenceCounted(false)
        acquire()
      }
    } catch (_: Exception) {}
  }

  private fun releaseWakeLock() {
    try { if (wakeLock?.isHeld == true) wakeLock?.release() } catch (_: Exception) {}
    wakeLock = null
  }
}
