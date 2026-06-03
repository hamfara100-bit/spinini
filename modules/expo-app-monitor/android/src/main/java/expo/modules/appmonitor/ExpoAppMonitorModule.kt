package expo.modules.appmonitor

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.provider.CallLog
import android.provider.Settings
import android.provider.Telephony
import android.text.TextUtils
import android.view.accessibility.AccessibilityManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoAppMonitorModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)
  private var appChangeReceiver: BroadcastReceiver? = null
  private var socialAlertReceiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoAppMonitor")

    Events("onAppChange", "onSocialAlert")

    // ── Accessibility helpers ────────────────────────────────────────────────
    Function("isAccessibilityEnabled") { isAccessibilityEnabled() }

    Function("openAccessibilitySettings") {
      context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
      })
    }

    // ── App blocking ─────────────────────────────────────────────────────────
    Function("setBlockedPackages") { packages: List<String> ->
      AppMonitorService.blockedPackages = packages.toSet()
    }

    Function("setStudyModePackages") { packages: List<String> ->
      AppMonitorService.studyModePackages = packages.toSet()
    }

    Function("setStudyModeActive") { active: Boolean ->
      AppMonitorService.studyModeActive = active
    }

    // Hard lock (kiosk): when active, every app except ours is bounced back.
    Function("setLockMode") { active: Boolean ->
      AppMonitorService.lockModeActive = active
    }

    Function("getCurrentPackage") {
      AppMonitorService.currentForegroundPackage
    }

    // ── Social monitoring ─────────────────────────────────────────────────────
    /**
     * Enable or disable on-screen text scanning for dangerous keywords.
     * [kidId] is stored so JS can identify which kid triggered the alert.
     */
    Function("setSocialMonitoring") { enabled: Boolean, kidId: String ->
      AppMonitorService.monitoringEnabled = enabled
      AppMonitorService.monitoredKidId = kidId
    }

    // ── Event listeners ───────────────────────────────────────────────────────
    Function("startMonitoring") {
      // App-change receiver
      if (appChangeReceiver == null) {
        val filter = IntentFilter(AppMonitorService.ACTION_APP_CHANGED)
        val br = object : BroadcastReceiver() {
          override fun onReceive(ctx: Context?, intent: Intent?) {
            val pkg     = intent?.getStringExtra(AppMonitorService.EXTRA_PACKAGE) ?: return
            val blocked = intent.getBooleanExtra("isBlocked", false)
            sendEvent("onAppChange", mapOf("packageName" to pkg, "isBlocked" to blocked))
          }
        }
        registerReceiver(br, filter)
        appChangeReceiver = br
      }

      // Social-alert receiver
      if (socialAlertReceiver == null) {
        val filter = IntentFilter(AppMonitorService.ACTION_SOCIAL_ALERT)
        val br = object : BroadcastReceiver() {
          override fun onReceive(ctx: Context?, intent: Intent?) {
            if (intent == null) return
            sendEvent("onSocialAlert", mapOf(
              "kidId"       to (intent.getStringExtra("kidId")       ?: ""),
              "appPackage"  to (intent.getStringExtra("appPackage")  ?: ""),
              "appName"     to (intent.getStringExtra("appName")     ?: ""),
              "keyword"     to (intent.getStringExtra("keyword")     ?: ""),
              "severity"    to (intent.getStringExtra("severity")    ?: "warning"),
              "context"     to (intent.getStringExtra("context")     ?: ""),
            ))
          }
        }
        registerReceiver(br, filter)
        socialAlertReceiver = br
      }
    }

    Function("stopMonitoring") {
      appChangeReceiver?.let { try { context.unregisterReceiver(it) } catch (_: Exception) {} }
      appChangeReceiver = null
      socialAlertReceiver?.let { try { context.unregisterReceiver(it) } catch (_: Exception) {} }
      socialAlertReceiver = null
    }

    // ── Stranger Alert — scan call log + SMS for unknown numbers ────────────
    /**
     * Returns a list of maps, each with:
     *   { type: "call"|"text", number: String, maskedNumber: String, timestamp: Long, note: String }
     * Only entries after [sinceMs] that are NOT in [allowedNumbers] are returned.
     */
    Function("getUnknownContacts") { allowedNumbers: List<String>, sinceMs: Long ->
      val results = mutableListOf<Map<String, Any>>()

      fun normalise(n: String): String =
        n.replace(Regex("[^0-9+]"), "").trimStart('+').takeLast(10)

      val normAllowed = allowedNumbers.map { normalise(it) }.toSet()

      fun isAllowed(number: String): Boolean {
        if (number.isBlank()) return true
        val n = normalise(number)
        return n.isEmpty() || normAllowed.any { it.endsWith(n) || n.endsWith(it) }
      }

      fun maskNumber(n: String): String {
        val digits = n.replace(Regex("[^0-9]"), "")
        return if (digits.length >= 4) "***-***-${digits.takeLast(4)}" else "Unknown"
      }

      // ── Call log ──
      try {
        val proj = arrayOf(CallLog.Calls.NUMBER, CallLog.Calls.DATE, CallLog.Calls.TYPE)
        val sel  = "${CallLog.Calls.DATE} > ? AND ${CallLog.Calls.TYPE} IN (?,?)"
        val args = arrayOf(sinceMs.toString(),
          CallLog.Calls.INCOMING_TYPE.toString(),
          CallLog.Calls.MISSED_TYPE.toString())
        context.contentResolver.query(CallLog.Calls.CONTENT_URI, proj, sel, args,
          "${CallLog.Calls.DATE} DESC")?.use { cursor ->
          val numIdx  = cursor.getColumnIndex(CallLog.Calls.NUMBER)
          val dateIdx = cursor.getColumnIndex(CallLog.Calls.DATE)
          while (cursor.moveToNext()) {
            val num = cursor.getString(numIdx) ?: continue
            val ts  = cursor.getLong(dateIdx)
            if (!isAllowed(num)) {
              results.add(mapOf(
                "type"         to "call",
                "number"       to num,
                "maskedNumber" to maskNumber(num),
                "timestamp"    to ts,
                "note"         to ""
              ))
            }
          }
        }
      } catch (_: Exception) {}

      // ── SMS ──
      try {
        val uri  = Telephony.Sms.Inbox.CONTENT_URI
        val proj = arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.DATE, Telephony.Sms.BODY)
        val sel  = "${Telephony.Sms.DATE} > ?"
        val args = arrayOf(sinceMs.toString())
        context.contentResolver.query(uri, proj, sel, args,
          "${Telephony.Sms.DATE} DESC")?.use { cursor ->
          val addrIdx = cursor.getColumnIndex(Telephony.Sms.ADDRESS)
          val dateIdx = cursor.getColumnIndex(Telephony.Sms.DATE)
          val seen    = mutableSetOf<String>()
          while (cursor.moveToNext()) {
            val addr = cursor.getString(addrIdx) ?: continue
            val ts   = cursor.getLong(dateIdx)
            if (!isAllowed(addr) && seen.add(normalise(addr))) {
              results.add(mapOf(
                "type"         to "text",
                "number"       to addr,
                "maskedNumber" to maskNumber(addr),
                "timestamp"    to ts,
                "note"         to "Sent a message"
              ))
            }
          }
        }
      } catch (_: Exception) {}

      results
    }

    OnDestroy {
      appChangeReceiver?.let { try { context.unregisterReceiver(it) } catch (_: Exception) {} }
      appChangeReceiver = null
      socialAlertReceiver?.let { try { context.unregisterReceiver(it) } catch (_: Exception) {} }
      socialAlertReceiver = null
    }
  }

  private fun registerReceiver(br: BroadcastReceiver, filter: IntentFilter) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(br, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      context.registerReceiver(br, filter)
    }
  }

  private fun isAccessibilityEnabled(): Boolean {
    val am = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
    val enabled = Settings.Secure.getString(
      context.contentResolver,
      Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
    ) ?: return false
    val serviceName = "${context.packageName}/${AppMonitorService::class.java.name}"
    return TextUtils.SimpleStringSplitter(':').also { it.setString(enabled) }
      .any { it.equals(serviceName, ignoreCase = true) }
  }
}
