package expo.modules.loudalarm

import android.content.Context
import android.media.AudioManager
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoLoudAlarmModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)

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
     * Play the system alarm ringtone once. Useful for quick test.
     */
    Function("playSystemAlarm") {
      try {
        val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
          ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        if (uri != null) {
          val ringtone = RingtoneManager.getRingtone(context, uri)
          ringtone?.play()
        }
      } catch (_: Exception) {}
    }

    /** Stop any playing system ringtone */
    Function("stopSystemAlarm") {
      try {
        val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        if (uri != null) {
          val ringtone = RingtoneManager.getRingtone(context, uri)
          ringtone?.stop()
        }
      } catch (_: Exception) {}
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
