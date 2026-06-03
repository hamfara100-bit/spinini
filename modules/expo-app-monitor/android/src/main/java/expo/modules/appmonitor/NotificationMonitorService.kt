package expo.modules.appmonitor

import android.content.Intent
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Reads INCOMING notifications on the (kid's) device and flags ones whose text
 * contains a "bad word" — profanity, bullying, self-harm, drugs, or stranger
 * danger. A match is broadcast to JS, which raises a loud alarm on the PARENT
 * device showing the bad word, the message, and which app sent it.
 *
 * Requires the user to grant "Notification access" in system settings
 * (ACTION_NOTIFICATION_LISTENER_SETTINGS).
 */
class NotificationMonitorService : NotificationListenerService() {

  companion object {
    const val ACTION_BAD_WORD = "expo.modules.appmonitor.BAD_WORD"

    /** Toggled from JS — when false the listener ignores everything. */
    var scanEnabled: Boolean = false

    private const val COOLDOWN_MS = 15_000L
    private val lastAlertAt = mutableMapOf<String, Long>()

    // Apps whose notifications are pure noise — never scan these.
    private val IGNORE_PACKAGES = setOf(
      "android",
      "com.android.systemui",
      "com.google.android.gms",
    )

    /** Single bad words → matched on word boundaries (so "class" ≠ "ass"). */
    val BAD_WORDS = listOf(
      // profanity
      "fuck", "fuk", "fucking", "shit", "bitch", "bastard", "asshole",
      "dick", "pussy", "cunt", "slut", "whore", "fag", "faggot", "nigga",
      "nigger", "retard", "wtf", "stfu", "bullshit", "damn", "crap", "piss",
      // bullying / threats
      "kys", "loser", "ugly", "idiot", "stupid", "hate you", "kill you",
      "nobody likes you", "go die",
      // self-harm
      "suicide", "kill myself", "want to die", "cut myself", "self harm",
      "end my life", "worthless",
      // drugs
      "weed", "xanax", "molly", "cocaine", "vape", "drunk", "high af",
      // stranger danger / grooming
      "send nudes", "send pics", "send pic", "how old are you",
      "where do you live", "meet up", "don't tell your parents",
      "our secret",
    )
  }

  private fun matchBadWord(text: String): String? {
    for (w in BAD_WORDS) {
      val pattern = if (w.contains(" "))
        Regex(Regex.escape(w))
      else
        Regex("(^|[^a-z])" + Regex.escape(w) + "($|[^a-z])")
      if (pattern.containsMatchIn(text)) return w
    }
    return null
  }

  private fun appLabel(pkg: String): String {
    return try {
      val pm = packageManager
      pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
    } catch (_: Exception) {
      pkg.substringAfterLast(".").replaceFirstChar { it.uppercase() }
    }
  }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (!scanEnabled || sbn == null) return
    val pkg = sbn.packageName ?: return
    if (pkg == packageName || IGNORE_PACKAGES.contains(pkg)) return

    val extras = sbn.notification?.extras ?: return
    val title = extras.getCharSequence("android.title")?.toString() ?: ""
    val text  = extras.getCharSequence("android.text")?.toString() ?: ""
    val big   = extras.getCharSequence("android.bigText")?.toString() ?: ""
    val body  = if (big.isNotBlank()) big else text

    val haystack = "$title $body".lowercase()
    if (haystack.isBlank()) return

    val matched = matchBadWord(haystack) ?: return

    val key = "$pkg:$matched"
    val now = System.currentTimeMillis()
    if ((lastAlertAt[key] ?: 0L) + COOLDOWN_MS > now) return
    lastAlertAt[key] = now

    sendBroadcast(Intent(ACTION_BAD_WORD).apply {
      putExtra("packageName", pkg)
      putExtra("appName", appLabel(pkg))
      putExtra("title", title)
      putExtra("text", body)
      putExtra("word", matched)
      setPackage(packageName)
    })
  }
}
