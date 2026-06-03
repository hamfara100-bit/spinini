package expo.modules.loudalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoLoudAlarmModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)
  private var alarmPlayer: MediaPlayer? = null

  private val FS_CHANNEL_ID = "spinini_alarm_fullscreen"
  private val FS_NOTIF_ID = 90901

  private fun ensureFsChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (nm.getNotificationChannel(FS_CHANNEL_ID) == null) {
        val ch = NotificationChannel(
          FS_CHANNEL_ID,
          "Urgent Alarms",
          NotificationManager.IMPORTANCE_HIGH
        )
        ch.description = "Full-screen alarm when a family member needs you right now"
        ch.enableVibration(true)
        ch.setBypassDnd(true)
        ch.setSound(null, null) // we play our own looping alarm via MediaPlayer
        nm.createNotificationChannel(ch)
      }
    }
  }

  private fun stopLoopInternal() {
    try { alarmPlayer?.stop() } catch (_: Exception) {}
    try { alarmPlayer?.release() } catch (_: Exception) {}
    alarmPlayer = null
  }

  /** Start the bundled alarm tone looping on the alarm stream. Idempotent. */
  private fun startLoopInternal() {
    try {
      stopLoopInternal()
      try {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0)
      } catch (_: Exception) {}

      val mp = MediaPlayer()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        mp.setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
      } else {
        @Suppress("DEPRECATION")
        mp.setAudioStreamType(AudioManager.STREAM_ALARM)
      }

      var sourced = false
      try {
        val resId = context.resources.getIdentifier("spinini_alarm", "raw", context.packageName)
        if (resId != 0) {
          val afd = context.resources.openRawResourceFd(resId)
          if (afd != null) {
            mp.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
            afd.close()
            sourced = true
          }
        }
      } catch (_: Exception) {}

      if (!sourced) {
        val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
          ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
          ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        if (uri != null) { mp.setDataSource(context, uri); sourced = true }
      }

      if (sourced) {
        mp.isLooping = true
        mp.prepare()
        mp.start()
        alarmPlayer = mp
      } else {
        mp.release()
      }
    } catch (_: Exception) {}
  }

  override fun definition() = ModuleDefinition {
    Name("ExpoLoudAlarm")

    /**
     * Force-sets the device to maximum alarm volume regardless of ringer/DND state.
     * On Android 6+ we also disable Do Not Disturb if the app has notification policy access.
     */
    Function("forceMaxVolume") {
      val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

      // Step 1: Set ringer mode to NORMAL so volume controls are visible
      try {
        am.ringerMode = AudioManager.RINGER_MODE_NORMAL
      } catch (e: SecurityException) {
        // DND access not granted — try anyway, often still works
      }

      // Step 2: Maximise STREAM_ALARM (bypasses silent/vibrate mode on most devices)
      val maxVol = am.getStreamMaxVolume(AudioManager.STREAM_ALARM)
      am.setStreamVolume(AudioManager.STREAM_ALARM, maxVol, AudioManager.FLAG_SHOW_UI)

      // Step 3: Also bump STREAM_RING and STREAM_MUSIC for belt + suspenders
      val maxRing = am.getStreamMaxVolume(AudioManager.STREAM_RING)
      try { am.setStreamVolume(AudioManager.STREAM_RING, maxRing, 0) } catch (_: Exception) {}

      val maxMusic = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
      try { am.setStreamVolume(AudioManager.STREAM_MUSIC, maxMusic, 0) } catch (_: Exception) {}
    }

    /**
     * Returns the URI of the default system alarm ringtone.
     * JS can feed this to expo-av or expo-audio for guaranteed loud playback.
     */
    Function("getDefaultAlarmUri") {
      val uri: Uri? = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
      uri?.toString()
    }

    /**
     * Play the system alarm ringtone in a LOOP on the alarm stream until
     * stopSystemAlarm() is called. Uses MediaPlayer so it never stops on its
     * own (a plain Ringtone plays once).
     */
    Function("playSystemAlarm") {
      startLoopInternal()
    }

    /** Stop the looping alarm. */
    Function("stopSystemAlarm") {
      stopLoopInternal()
    }

    /**
     * Bring the app to the FRONT and start the looping alarm, even when the
     * phone is on another app or the screen is off/locked. Posts a high-priority
     * notification carrying a full-screen intent (Android shows it immediately as
     * a full-screen activity), AND best-effort directly launches the app.
     */
    Function("fireFullScreenAlarm") { title: String, body: String ->
      try {
        ensureFsChannel()

        // Build the launch intent for our own app's main activity.
        val launch: Intent? = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launch != null) {
          launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
          launch.putExtra("spinini_alarm", true)
        }

        val piFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_UPDATE_CURRENT

        val contentPi = launch?.let {
          PendingIntent.getActivity(context, 7011, it, piFlags)
        }

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
          Notification.Builder(context, FS_CHANNEL_ID)
        else @Suppress("DEPRECATION") Notification.Builder(context)

        builder
          .setContentTitle(title)
          .setContentText(body)
          .setSmallIcon(context.applicationInfo.icon)
          .setCategory(Notification.CATEGORY_ALARM)
          .setAutoCancel(true)
          .setOngoing(true)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
          @Suppress("DEPRECATION")
          builder.setPriority(Notification.PRIORITY_MAX)
        }
        if (contentPi != null) {
          builder.setContentIntent(contentPi)
          builder.setFullScreenIntent(contentPi, true)
        }

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(FS_NOTIF_ID, builder.build())

        // Start the loud looping alarm immediately.
        startLoopInternal()

        // Belt + suspenders: also try to launch the activity directly. This works
        // when the app already has a foreground task / recently was foreground.
        if (launch != null) {
          try { context.startActivity(launch) } catch (_: Exception) {}
        }
      } catch (_: Exception) {}
    }

    /** Cancel the full-screen alarm notification AND stop the looping alarm. */
    Function("cancelFullScreenAlarm") {
      try {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(FS_NOTIF_ID)
      } catch (_: Exception) {}
      stopLoopInternal()
    }

    /** Check if the app has notification policy (DND override) access */
    Function("hasDndAccess") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        nm.isNotificationPolicyAccessGranted
      } else {
        true
      }
    }
  }
}
