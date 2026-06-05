package expo.modules.appmonitor

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Accessibility service that:
 *   1. Watches for foreground app changes (original behaviour).
 *   2. Reads visible text on screen when a monitored social media app is open
 *      and scans for dangerous keywords (self-harm, bullying, drugs, strangers).
 *      Matching text triggers a SOCIAL_ALERT broadcast picked up by JS.
 *
 * Privacy: all scanning is 100% on-device. No text is ever uploaded.
 */
class AppMonitorService : AccessibilityService() {

  companion object {
    const val ACTION_APP_CHANGED   = "expo.modules.appmonitor.APP_CHANGED"
    const val ACTION_SOCIAL_ALERT  = "expo.modules.appmonitor.SOCIAL_ALERT"
    const val EXTRA_PACKAGE        = "packageName"

    var blockedPackages: Set<String> = emptySet()
    var studyModePackages: Set<String> = emptySet()
    var studyModeActive: Boolean = false
    var currentForegroundPackage: String = ""
    var monitoringEnabled: Boolean = false
    var monitoredKidId: String = ""

    // ── Hard lock (kiosk) mode ──────────────────────────────────────────────
    // When active, ANY foreground app that isn't us (or essential system UI, or
    // an allow-listed app) is treated as blocked and the device is yanked back.
    var lockModeActive: Boolean = false
    var lockAllowedPackages: Set<String> = emptySet()

    // Minimum seconds between social alerts for the same keyword (avoid spam)
    private const val ALERT_COOLDOWN_MS = 30_000L
    private val lastAlertAt = mutableMapOf<String, Long>()

    /** Social media package names to monitor for dangerous content */
    val SOCIAL_PACKAGES = setOf(
      "com.instagram.android",
      "com.zhiliaoapp.musically",   // TikTok
      "com.snapchat.android",
      "com.whatsapp",
      "com.facebook.katana",
      "com.twitter.android",
      "com.discord",
      "com.reddit.frontpage",
      "com.tumblr",
      "com.kik.android",
      "com.ask.android",
    )

    // ── Keyword categories ──────────────────────────────────────────────────
    data class Keyword(val word: String, val severity: String)

    val KEYWORDS: List<Keyword> = listOf(
      // Self-harm / suicidal ideation
      Keyword("kill myself",      "critical"),
      Keyword("want to die",      "critical"),
      Keyword("end my life",      "critical"),
      Keyword("suicide",          "critical"),
      Keyword("cut myself",       "danger"),
      Keyword("hurt myself",      "danger"),
      Keyword("self harm",        "danger"),
      Keyword("hate myself",      "warning"),
      Keyword("nobody loves me",  "warning"),
      Keyword("worthless",        "warning"),
      // Bullying
      Keyword("kill you",         "danger"),
      Keyword("nobody likes you", "warning"),
      Keyword("loser",            "warning"),
      Keyword("go kill yourself", "critical"),
      Keyword("kys",              "critical"),
      // Drug slang
      Keyword("get me xanax",     "danger"),
      Keyword("buy weed",         "warning"),
      Keyword("buy xanax",        "danger"),
      Keyword("molly",            "warning"),
      Keyword("rolling on",       "warning"),
      // Stranger danger
      Keyword("where do you live","warning"),
      Keyword("send me pics",     "danger"),
      Keyword("send nudes",       "critical"),
      Keyword("how old are you",  "warning"),
      Keyword("meet up",          "warning"),
      Keyword("don't tell your parents", "danger"),
    )
  }

  private var lastScreenText = ""
  private var lastRelaunchAt = 0L

  /** Status bar, recents, IME, etc. — never bounce these or we fight the OS. */
  private fun isSystemUiPackage(pkg: String): Boolean {
    return pkg == "com.android.systemui" ||
      pkg == "android" ||
      pkg.endsWith(".inputmethod") ||
      pkg.contains("inputmethod") ||
      pkg.endsWith(".ime")
  }

  /** Pop our app (the lock screen) straight back to the foreground. */
  private fun bringSelfToFront() {
    val now = System.currentTimeMillis()
    if (now - lastRelaunchAt < 700L) return   // debounce relaunch storms
    lastRelaunchAt = now
    try {
      val launch = packageManager.getLaunchIntentForPackage(packageName)
      if (launch != null) {
        launch.addFlags(
          Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        )
        launch.putExtra("spinini_lock", true)
        startActivity(launch)
      }
    } catch (_: Exception) {}
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null) return

    // ── 1. Track foreground app ────────────────────────────────────────────
    if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
      val pkg = event.packageName?.toString() ?: return

      // HARD LOCK: while locked, the only allowed foreground app is us. Anything
      // else (including the launcher / recents) is immediately bounced back so
      // the child can't use the device. Essential system UI is ignored so we
      // don't fight the status bar / IME.
      if (lockModeActive && pkg.isNotEmpty() && pkg != packageName && !isSystemUiPackage(pkg) && !lockAllowedPackages.contains(pkg)) {
        bringSelfToFront()
        // also report it as blocked so JS can drop the cover overlay
        sendBroadcast(Intent(ACTION_APP_CHANGED).apply {
          putExtra(EXTRA_PACKAGE, pkg)
          putExtra("isBlocked", true)
          putExtra("lockMode", true)
          setPackage(packageName)
        })
        currentForegroundPackage = pkg
        return
      }

      if (pkg != currentForegroundPackage) {
        currentForegroundPackage = pkg
        val effectiveBlocked = blockedPackages + if (studyModeActive) studyModePackages else emptySet()
        val isBlocked = effectiveBlocked.contains(pkg)
        val intent = Intent(ACTION_APP_CHANGED).apply {
          putExtra(EXTRA_PACKAGE, pkg)
          putExtra("isBlocked", isBlocked)
          setPackage(packageName)
        }
        sendBroadcast(intent)
        // Enforce the block natively: kick the child straight out to the home
        // screen. This works even without the overlay permission (the JS overlay
        // is a bonus cover on top).
        if (isBlocked && pkg != packageName && !isSystemUiPackage(pkg)) {
          try { performGlobalAction(GLOBAL_ACTION_HOME) } catch (_: Exception) {}
        }
      }
    }

    // ── 2. Social media text monitoring ───────────────────────────────────
    if (!monitoringEnabled) return
    val pkg = event.packageName?.toString() ?: return
    if (!SOCIAL_PACKAGES.contains(pkg)) return
    if (event.eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED &&
        event.eventType != AccessibilityEvent.TYPE_VIEW_SCROLLED &&
        event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

    val root = rootInActiveWindow ?: return
    val text = collectText(root).lowercase()
    root.recycle()

    // Avoid re-scanning the exact same screen contents
    if (text == lastScreenText || text.length < 10) return
    lastScreenText = text

    for (kw in KEYWORDS) {
      if (!text.contains(kw.word)) continue
      val key = "${pkg}:${kw.word}"
      val now = System.currentTimeMillis()
      if ((lastAlertAt[key] ?: 0L) + ALERT_COOLDOWN_MS > now) continue
      lastAlertAt[key] = now

      // Extract up to 100 chars of context around the keyword
      val idx = text.indexOf(kw.word)
      val start = maxOf(0, idx - 40)
      val end   = minOf(text.length, idx + kw.word.length + 40)
      val context = text.substring(start, end).replace('\n', ' ').trim()

      val appName = SOCIAL_PACKAGES
        .firstOrNull { it == pkg }
        ?.let { pkg.substringAfterLast(".").replaceFirstChar { c -> c.uppercase() } }
        ?: pkg

      sendBroadcast(Intent(ACTION_SOCIAL_ALERT).apply {
        putExtra("kidId",          monitoredKidId)
        putExtra("appPackage",     pkg)
        putExtra("appName",        appName)
        putExtra("keyword",        kw.word)
        putExtra("severity",       kw.severity)
        putExtra("context",        "…$context…")
        setPackage(packageName)
      })
      break // one alert per screen scan
    }
  }

  private fun collectText(node: AccessibilityNodeInfo?): String {
    if (node == null) return ""
    val sb = StringBuilder()
    if (!node.text.isNullOrBlank()) sb.append(node.text).append(' ')
    if (!node.contentDescription.isNullOrBlank()) sb.append(node.contentDescription).append(' ')
    for (i in 0 until node.childCount) {
      sb.append(collectText(node.getChild(i)))
    }
    return sb.toString()
  }

  override fun onInterrupt() {}

  override fun onServiceConnected() {
    super.onServiceConnected()
    sendBroadcast(Intent("expo.modules.appmonitor.SERVICE_CONNECTED").apply {
      setPackage(packageName)
    })
  }
}
