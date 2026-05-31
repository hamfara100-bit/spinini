package expo.modules.deviceguardian

import android.app.AppOpsManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class DeviceGuardianModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "DeviceGuardianModule"
        const val PREFS_NAME = "DeviceGuardianPrefs"
        const val KEY_BLOCKED_ATTEMPTS = "blocked_attempts"
        const val KEY_APP_BLOCK_RULES = "app_block_rules"
        const val KEY_VPN_CONFIG = "vpn_config"
        const val MAX_BLOCKED_ATTEMPTS = 100
    }

    override fun getName(): String = NAME

    private fun getPrefs(): SharedPreferences =
        reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun isoNow(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date())
    }

    private fun isoFromMs(ms: Long): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date(ms))
    }

    private fun hasUsageStatsPermission(): Boolean {
        val appOps = reactContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactContext.packageName
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactContext.packageName
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val enabledServices = Settings.Secure.getString(
            reactContext.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        val expectedComponent = "${reactContext.packageName}/${reactContext.packageName}.AppBlockerService"
        return enabledServices.split(":").any { it.equals(expectedComponent, ignoreCase = true) }
    }

    private fun isDeviceAdminActive(): Boolean {
        val dpm = reactContext.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val component = ComponentName(reactContext, DeviceAdminReceiver::class.java)
        return dpm.isAdminActive(component)
    }

    private fun isVpnRunning(): Boolean = GuardianVpnService.isRunning

    @ReactMethod
    fun getGuardianStatus(promise: Promise) {
        try {
            val map: WritableMap = Arguments.createMap()
            map.putBoolean("usageStatsGranted", hasUsageStatsPermission())
            map.putBoolean("accessibilityEnabled", isAccessibilityServiceEnabled())
            map.putBoolean("deviceAdminActive", isDeviceAdminActive())
            map.putBoolean("vpnActive", isVpnRunning())
            map.putBoolean("screenTimeAuthorized", false)
            map.putBoolean("contentFilterEnabled", isVpnRunning())
            map.putString("platform", "android")
            map.putBoolean("kioskMode", false)
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("GET_STATUS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun requestUsageStatsPermission(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("USAGE_PERMISSION_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun requestAccessibilityPermission(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ACCESSIBILITY_PERMISSION_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun requestDeviceAdminPermission(promise: Promise) {
        try {
            val component = ComponentName(reactContext, DeviceAdminReceiver::class.java)
            val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, component)
                putExtra(
                    DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                    "FamilyGuard needs device admin to enforce app restrictions."
                )
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DEVICE_ADMIN_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getUsageStats(sinceMs: Double, promise: Promise) {
        try {
            if (!hasUsageStatsPermission()) {
                promise.reject("NO_PERMISSION", "Usage stats permission not granted")
                return
            }
            val usageStatsManager =
                reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val now = System.currentTimeMillis()
            val stats: List<UsageStats> = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_BEST,
                sinceMs.toLong(),
                now
            ) ?: emptyList()

            val pm: PackageManager = reactContext.packageManager
            val result: WritableArray = Arguments.createArray()

            for (stat in stats) {
                if (stat.totalTimeInForeground <= 0) continue
                val map: WritableMap = Arguments.createMap()
                map.putString("appId", stat.packageName)
                val appName = try {
                    pm.getApplicationLabel(
                        pm.getApplicationInfo(stat.packageName, 0)
                    ).toString()
                } catch (e: PackageManager.NameNotFoundException) {
                    stat.packageName
                }
                map.putString("appName", appName)
                map.putInt("totalMinutes", (stat.totalTimeInForeground / 60000).toInt())
                map.putString("lastUsed", isoFromMs(stat.lastTimeUsed))
                result.pushMap(map)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("USAGE_STATS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getBlockedAttempts(promise: Promise) {
        try {
            val prefs = getPrefs()
            val json = prefs.getString(KEY_BLOCKED_ATTEMPTS, "[]") ?: "[]"
            val arr = JSONArray(json)
            val result: WritableArray = Arguments.createArray()
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val map: WritableMap = Arguments.createMap()
                map.putString("appId", obj.optString("appId", ""))
                map.putString("appName", obj.optString("appName", ""))
                map.putString("blockedAt", obj.optString("blockedAt", ""))
                map.putString("reason", obj.optString("reason", "app_blocked"))
                result.pushMap(map)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("GET_BLOCKED_ATTEMPTS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setAppBlockRules(rulesJson: String, promise: Promise) {
        try {
            // Validate JSON before saving
            JSONArray(rulesJson)
            getPrefs().edit().putString(KEY_APP_BLOCK_RULES, rulesJson).apply()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SET_BLOCK_RULES_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun startVpn(configJson: String, promise: Promise) {
        try {
            JSONObject(configJson) // validate
            getPrefs().edit().putString(KEY_VPN_CONFIG, configJson).apply()
            val intent = Intent(reactContext, GuardianVpnService::class.java)
            intent.action = GuardianVpnService.ACTION_START
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_VPN_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopVpn(promise: Promise) {
        try {
            val intent = Intent(reactContext, GuardianVpnService::class.java)
            intent.action = GuardianVpnService.ACTION_STOP
            reactContext.startService(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("STOP_VPN_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openMdmEnrollment(serverUrl: String, promise: Promise) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(serverUrl))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("MDM_ENROLLMENT_ERROR", e.message, e)
        }
    }
}
