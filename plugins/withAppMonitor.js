/**
 * Expo config plugin that registers the AppMonitor AccessibilityService
 * and adds QUERY_ALL_PACKAGES permission to AndroidManifest.xml.
 */
const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withAppMonitor(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = manifest.manifest.application[0];

    // ── QUERY_ALL_PACKAGES permission ─────────────────────────────────────────
    const permissions = manifest.manifest["uses-permission"] ?? [];
    const queryPerm = "android.permission.QUERY_ALL_PACKAGES";
    if (!permissions.some((p) => p.$?.["android:name"] === queryPerm)) {
      permissions.push({ $: { "android:name": queryPerm } });
      manifest.manifest["uses-permission"] = permissions;
    }

    // ── GET_TASKS permission (usage stats fallback) ───────────────────────────
    const tasksPerm = "android.permission.GET_TASKS";
    if (!permissions.some((p) => p.$?.["android:name"] === tasksPerm)) {
      permissions.push({ $: { "android:name": tasksPerm } });
    }

    // ── uses-feature: accessibility ───────────────────────────────────────────
    const features = manifest.manifest["uses-feature"] ?? [];
    if (!features.some((f) => f.$?.["android:name"] === "android.software.accessibility")) {
      features.push({
        $: {
          "android:name": "android.software.accessibility",
          "android:required": "false",
        },
      });
      manifest.manifest["uses-feature"] = features;
    }

    // ── AccessibilityService declaration ──────────────────────────────────────
    const services = app.service ?? [];
    const serviceName = "expo.modules.appmonitor.AppMonitorService";
    if (!services.some((s) => s.$?.["android:name"] === serviceName)) {
      services.push({
        $: {
          "android:name": serviceName,
          "android:permission": "android.permission.BIND_ACCESSIBILITY_SERVICE",
          "android:exported": "true",
        },
        "intent-filter": [
          {
            action: [{ $: { "android:name": "android.accessibilityservice.AccessibilityService" } }],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.accessibilityservice",
              "android:resource": "@xml/accessibility_service_config",
            },
          },
        ],
      });
      app.service = services;
    }

    return cfg;
  });
};
