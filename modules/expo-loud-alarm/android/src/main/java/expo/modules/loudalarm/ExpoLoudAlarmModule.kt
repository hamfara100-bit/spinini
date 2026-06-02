package expo.modules.loudalarm

import android.content.Context
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

  private fun stopLoopInternal() {
    try { alarmPlayer?.stop() } catch (_: Exception) {}
    try { alarmPlayer?.release() } catch (_: Exception) {}
    alarmPlayer = null
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
      try {
        stopLoopInternal()
        val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
          ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
          ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        if (uri != null) {
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
          mp.setDataSource(context, uri)
          mp.isLooping = true
          mp.prepare()
          mp.start()
          alarmPlayer = mp
        }
      } catch (_: Exception) {}
    }

    /** Stop the looping alarm. */
    Function("stopSystemAlarm") {
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
