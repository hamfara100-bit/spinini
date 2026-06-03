/**
 * Setup Health — one screen that shows whether every permission the powerful
 * features depend on is granted, and a one-tap "Fix" that deep-links to the
 * exact system setting. Run it ON each device (especially the child's).
 *
 * Without these grants features fail SILENTLY ("it only vibrated", "the lock
 * didn't pop up"), so this screen is the single source of truth for setup.
 */
import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";
import * as Notifications from "expo-notifications";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { AppMonitor } from "expo-app-monitor";
import { DeviceLock } from "expo-device-lock";
import { UsageStats } from "expo-usage-stats";
import {
  hasDndAccess, openDndSettings,
  canUseFullScreenIntent, openFullScreenIntentSettings,
} from "expo-loud-alarm";
import { isBatteryExempt, requestBatteryExemption } from "../../../modules/expo-foreground-service/src";

interface Check {
  key: string;
  emoji: string;
  label: string;
  why: string;
  granted: boolean;
  critical: boolean;
  fix: () => void;
}

const IS_ANDROID = Platform.OS === "android";

export default function SetupHealthScreen() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    let notifGranted = true;
    try { notifGranted = (await Notifications.getPermissionsAsync()).granted; } catch {}

    const list: Check[] = [
      {
        key: "notifications",
        emoji: "🔔",
        label: "Notifications",
        why: "Pings, alerts and reminders can't show without this.",
        granted: notifGranted,
        critical: true,
        fix: async () => { try { await Notifications.requestPermissionsAsync(); } catch {} },
      },
    ];

    if (IS_ANDROID) {
      const safe = <T,>(f: () => T, d: T): T => { try { return f(); } catch { return d; } };
      list.push(
        {
          key: "accessibility",
          emoji: "♿",
          label: "Accessibility Service",
          why: "Needed to detect/block apps and enforce the hard lock.",
          granted: safe(() => AppMonitor.isAccessibilityEnabled(), false),
          critical: true,
          fix: () => { try { AppMonitor.openAccessibilitySettings(); } catch {} },
        },
        {
          key: "overlay",
          emoji: "🪟",
          label: "Display over other apps",
          why: "Lets the lock screen and alarms pop up over any app.",
          granted: safe(() => DeviceLock.hasOverlayPermission(), false),
          critical: true,
          fix: () => { try { DeviceLock.openOverlaySettings(); } catch {} },
        },
        {
          key: "usage",
          emoji: "📊",
          label: "Usage Access",
          why: "Reads per-app screen time so limits work.",
          granted: safe(() => UsageStats.hasUsagePermission(), false),
          critical: true,
          fix: () => { try { UsageStats.openUsageSettings(); } catch {} },
        },
        {
          key: "fsi",
          emoji: "📲",
          label: "Full-screen alarms (Android 14+)",
          why: "Lets alarms/locks take over the screen, not just buzz.",
          granted: safe(() => canUseFullScreenIntent(), true),
          critical: true,
          fix: () => openFullScreenIntentSettings(),
        },
        {
          key: "dnd",
          emoji: "🔕",
          label: "Do Not Disturb access",
          why: "Lets loud alarms sound even in silent/DND mode.",
          granted: safe(() => hasDndAccess(), false),
          critical: false,
          fix: () => openDndSettings(),
        },
        {
          key: "battery",
          emoji: "🔋",
          label: "Battery optimization off",
          why: "Keeps the background service alive so sync/alarms keep working.",
          granted: safe(() => isBatteryExempt(), false),
          critical: true,
          fix: () => requestBatteryExemption(),
        },
        {
          key: "notif_access",
          emoji: "🛡️",
          label: "Notification Access",
          why: "Scans incoming messages for bad words to alarm the parent.",
          granted: safe(() => AppMonitor.isNotificationAccessEnabled(), false),
          critical: false,
          fix: () => { try { AppMonitor.openNotificationAccessSettings(); } catch {} },
        },
      );
    }
    setChecks(list);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const granted = checks.filter(c => c.granted).length;
  const total = checks.length;
  const allGood = total > 0 && granted === total;
  const criticalMissing = checks.filter(c => c.critical && !c.granted).length;

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🩺 Setup Health</Text>
      <Text style={styles.sub}>
        Grant these on THIS device for every feature to work. Run it on each child's phone too —
        missing permissions make features fail silently.
      </Text>

      {/* Summary */}
      <View style={[styles.summary, { backgroundColor: allGood ? "#10391F" : criticalMissing ? "#3a1414" : "#3a3214" }]}>
        <Text style={styles.summaryBig}>{allGood ? "✅ All set!" : `${granted} / ${total} ready`}</Text>
        <Text style={styles.summarySub}>
          {allGood
            ? "Everything is good to go."
            : criticalMissing > 0
              ? `${criticalMissing} critical ${criticalMissing === 1 ? "item needs" : "items need"} attention.`
              : "Optional items remain — core features will work."}
        </Text>
      </View>

      {!IS_ANDROID && (
        <View style={styles.iosNote}><Text style={styles.iosNoteText}>ℹ️ Most device-control permissions are Android-only. On iOS, only Notifications applies here.</Text></View>
      )}

      {checks.map(c => (
        <View key={c.key} style={[styles.row, c.granted ? styles.rowOk : styles.rowBad]}>
          <Text style={styles.rowEmoji}>{c.emoji}</Text>
          <View style={{ flex: 1 }}>
            <View style={styles.rowHead}>
              <Text style={styles.rowLabel}>{c.label}</Text>
              {c.critical && !c.granted && <View style={styles.reqBadge}><Text style={styles.reqText}>REQUIRED</Text></View>}
            </View>
            <Text style={styles.rowWhy}>{c.why}</Text>
          </View>
          {c.granted ? (
            <Text style={styles.ok}>✅</Text>
          ) : (
            <TouchableOpacity style={styles.fixBtn} onPress={c.fix}>
              <Text style={styles.fixText}>Fix</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <TouchableOpacity style={styles.recheck} onPress={refresh} disabled={loading}>
        <Text style={styles.recheckText}>{loading ? "Checking…" : "🔄 Re-check"}</Text>
      </TouchableOpacity>

      <Text style={styles.foot}>
        Tip: after tapping “Fix”, enable the setting, then come back here — it refreshes automatically.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  summary: { borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  summaryBig: { fontSize: FontSize.lg, fontWeight: "900", color: "#fff" },
  summarySub: { fontSize: FontSize.sm, color: "rgba(255,255,255,0.8)", marginTop: 4 },
  iosNote: { backgroundColor: "#1c2a3a", borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  iosNoteText: { color: "#9fc4e8", fontSize: FontSize.xs },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, borderWidth: 1.5, ...Shadow.sm },
  rowOk: { backgroundColor: Colors.surfaceLight, borderColor: "#1f5132" },
  rowBad: { backgroundColor: Colors.surfaceLight, borderColor: "#5a2a2a" },
  rowEmoji: { fontSize: 26 },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowLabel: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  reqBadge: { backgroundColor: Colors.error + "25", borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  reqText: { fontSize: 9, fontWeight: "900", color: Colors.error, letterSpacing: 0.5 },
  rowWhy: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  ok: { fontSize: 22 },
  fixBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 10, ...Shadow.sm },
  fixText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },
  recheck: { backgroundColor: Colors.cardLight, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, marginTop: 8 },
  recheckText: { color: Colors.textPrimary, fontWeight: "800", fontSize: FontSize.base },
  foot: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "center", marginTop: 12, lineHeight: 17 },
});
