package expo.modules.deviceguardian

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.view.accessibility.AccessibilityEvent
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class AppBlockerService : AccessibilityService() {

    private val prefs: SharedPreferences by lazy {
        applicationContext.getSharedPreferences(
            DeviceGuardianModule.PREFS_NAME,
            Context.MODE_PRIVATE
        )
    }

    override fun onServiceConnected() {
        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
            notificationTimeout = 100
        }
        serviceInfo = info
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

        val packageName = event.packageName?.toString() ?: return
        if (packageName == applicationContext.packageName) return

        val blockedRules = loadBlockedRules()
        val matchingRule = blockedRules.firstOrNull { rule ->
            rule.optString("packageName") == packageName &&
                    rule.optBoolean("blocked", false)
        } ?: return

        // Kick user back to home screen
        performGlobalAction(GLOBAL_ACTION_HOME)

        // Log the blocked attempt
        val appName = getAppName(packageName) ?: matchingRule.optString("appName", packageName)
        logBlockedAttempt(packageName, appName)
    }

    override fun onInterrupt() {
        // no-op
    }

    private fun loadBlockedRules(): List<JSONObject> {
        val json = prefs.getString(DeviceGuardianModule.KEY_APP_BLOCK_RULES, "[]") ?: "[]"
        return try {
            val arr = JSONArray(json)
            (0 until arr.length()).map { arr.getJSONObject(it) }
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun getAppName(packageName: String): String? {
        return try {
            val pm = applicationContext.packageManager
            pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0)).toString()
        } catch (e: PackageManager.NameNotFoundException) {
            null
        }
    }

    private fun logBlockedAttempt(packageName: String, appName: String) {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        val now = sdf.format(Date())

        val entry = JSONObject().apply {
            put("appId", packageName)
            put("appName", appName)
            put("blockedAt", now)
            put("reason", "app_blocked")
        }

        val existing = try {
            JSONArray(prefs.getString(DeviceGuardianModule.KEY_BLOCKED_ATTEMPTS, "[]") ?: "[]")
        } catch (e: Exception) {
            JSONArray()
        }

        // Prepend new entry and trim to max 100
        val updated = JSONArray()
        updated.put(entry)
        val limit = minOf(existing.length(), DeviceGuardianModule.MAX_BLOCKED_ATTEMPTS - 1)
        for (i in 0 until limit) {
            updated.put(existing.getJSONObject(i))
        }

        prefs.edit()
            .putString(DeviceGuardianModule.KEY_BLOCKED_ATTEMPTS, updated.toString())
            .apply()
    }
}
