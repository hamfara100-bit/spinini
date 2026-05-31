package expo.modules.usagestats

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar

class ExpoUsageStatsModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {
    Name("ExpoUsageStats")

    // Check if the PACKAGE_USAGE_STATS permission is granted
    Function("hasUsagePermission") {
      hasUsagePermission()
    }

    // Open Android Settings > Apps > Special app access > Usage access
    Function("openUsageSettings") {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
      }
      context.startActivity(intent)
    }

    // Get per-app usage for the past N days
    // Returns list of {packageName, appName, totalMinutes, lastUsed}
    AsyncFunction("getAppUsage") { days: Int ->
      if (!hasUsagePermission()) return@AsyncFunction emptyList<Map<String, Any>>()

      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val pm  = context.packageManager

      val cal = Calendar.getInstance()
      cal.add(Calendar.DAY_OF_YEAR, -days)
      val startMs = cal.timeInMillis
      val endMs   = System.currentTimeMillis()

      val stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startMs, endMs)
        ?: return@AsyncFunction emptyList<Map<String, Any>>()

      // Aggregate by package name across days
      val totals = mutableMapOf<String, Long>()
      val lastUsed = mutableMapOf<String, Long>()
      for (s in stats) {
        totals[s.packageName] = (totals[s.packageName] ?: 0L) + s.totalTimeInForeground
        if ((lastUsed[s.packageName] ?: 0L) < s.lastTimeUsed) {
          lastUsed[s.packageName] = s.lastTimeUsed
        }
      }

      totals.entries
        .filter { it.value > 0 }
        .sortedByDescending { it.value }
        .map { (pkg, ms) ->
          val name = try {
            pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
          } catch (e: PackageManager.NameNotFoundException) {
            pkg
          }
          mapOf(
            "packageName"    to pkg,
            "appName"        to name,
            "totalMinutes"   to (ms / 60_000).toInt(),
            "lastUsedAt"     to (lastUsed[pkg] ?: 0L),
          )
        }
    }

    // Get today's usage for a single package (minutes)
    AsyncFunction("getAppUsageToday") { packageName: String ->
      if (!hasUsagePermission()) return@AsyncFunction 0

      val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val cal = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0);      set(Calendar.MILLISECOND, 0)
      }
      val stats = usm.queryUsageStats(
        UsageStatsManager.INTERVAL_DAILY,
        cal.timeInMillis,
        System.currentTimeMillis()
      ) ?: return@AsyncFunction 0

      val ms = stats.filter { it.packageName == packageName }.sumOf { it.totalTimeInForeground }
      (ms / 60_000).toInt()
    }

    // List installed, non-system apps the parent can configure
    AsyncFunction("getInstalledApps") {
      val pm = context.packageManager
      val intent = Intent(Intent.ACTION_MAIN, null).apply { addCategory(Intent.CATEGORY_LAUNCHER) }
      pm.queryIntentActivities(intent, 0)
        .map { it.activityInfo.applicationInfo }
        .distinctBy { it.packageName }
        .filter { it.packageName != context.packageName }
        .map { ai ->
          mapOf(
            "packageName" to ai.packageName,
            "appName"     to pm.getApplicationLabel(ai).toString(),
          )
        }
        .sortedBy { it["appName"] as String }
    }
  }

  private fun hasUsagePermission(): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        android.os.Process.myUid(),
        context.packageName
      )
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        android.os.Process.myUid(),
        context.packageName
      )
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }
}
