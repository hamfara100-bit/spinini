import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Platform, Linking, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import { Camera } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import * as Contacts from "expo-contacts";
import { AudioModule } from "expo-audio";
import { ScreenContainer } from "../../components/screen-container";
import { Colors, FontSize, Radius, Spacing, Shadow } from "../../lib/theme";
import { UsageStats } from "../../modules/expo-usage-stats/src";

// ─── Types ────────────────────────────────────────────────────────────────────

type PermStatus = "unknown" | "granted" | "denied" | "settings";

interface PermItem {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  required: boolean;
  androidOnly?: boolean;
  /** "settings" = needs to be done in device Settings, not in-app */
  openSettings?: boolean;
}

// ─── Permission list ──────────────────────────────────────────────────────────

const PERMISSIONS: PermItem[] = [
  {
    id: "notifications",
    emoji: "🔔",
    title: "Notifications",
    desc: "Screen time alerts, chore reminders, and parent messages.",
    required: true,
  },
  {
    id: "camera",
    emoji: "📷",
    title: "Camera",
    desc: "Take photos for chores, achievements, and creative projects.",
    required: true,
  },
  {
    id: "microphone",
    emoji: "🎙️",
    title: "Microphone",
    desc: "Record voice stories and video messages.",
    required: false,
  },
  {
    id: "location",
    emoji: "📍",
    title: "Location",
    desc: "Show parents where kids are and trigger safe-zone alerts.",
    required: false,
  },
  {
    id: "locationBackground",
    emoji: "🗺️",
    title: "Background Location",
    desc: "Continue tracking location when the app is in the background.",
    required: false,
    androidOnly: true,
  },
  {
    id: "mediaLibrary",
    emoji: "🖼️",
    title: "Photos & Media",
    desc: "Attach photos to journal entries and save drawings to gallery.",
    required: false,
  },
  {
    id: "contacts",
    emoji: "📇",
    title: "Contacts",
    desc: "Display emergency contacts for kids.",
    required: false,
  },
  {
    id: "usageStats",
    emoji: "📊",
    title: "Usage Stats",
    desc: "See which apps your child uses and for how long. Required for app rules to work.",
    required: true,
    androidOnly: true,
    openSettings: true,
  },
  {
    id: "overlay",
    emoji: "🔒",
    title: "Display Over Other Apps",
    desc: "Show the app lock screen and usage overlay on top of other apps.",
    required: true,
    androidOnly: true,
    openSettings: true,
  },
];

// ─── Request helpers ──────────────────────────────────────────────────────────

async function requestPermission(id: string): Promise<PermStatus> {
  try {
    switch (id) {
      case "notifications": {
        const { status } = await Notifications.requestPermissionsAsync();
        return status === "granted" ? "granted" : "denied";
      }
      case "camera": {
        const { status } = await Camera.requestCameraPermissionsAsync();
        return status === "granted" ? "granted" : "denied";
      }
      case "microphone": {
        const result = await AudioModule.requestRecordingPermissionsAsync();
        return result.granted ? "granted" : "denied";
      }
      case "location": {
        const { status } = await Location.requestForegroundPermissionsAsync();
        return status === "granted" ? "granted" : "denied";
      }
      case "locationBackground": {
        const { status } = await Location.requestBackgroundPermissionsAsync();
        return status === "granted" ? "granted" : "denied";
      }
      case "mediaLibrary": {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        return status === "granted" ? "granted" : "denied";
      }
      case "contacts": {
        const { status } = await Contacts.requestPermissionsAsync();
        return status === "granted" ? "granted" : "denied";
      }
      case "usageStats":
      case "overlay":
        // These require Settings — handled separately
        return "settings";
      default:
        return "unknown";
    }
  } catch {
    return "denied";
  }
}

async function checkPermission(id: string): Promise<PermStatus> {
  try {
    switch (id) {
      case "notifications": {
        const { status } = await Notifications.getPermissionsAsync();
        return status === "granted" ? "granted" : status === "denied" ? "denied" : "unknown";
      }
      case "camera": {
        const { status } = await Camera.getCameraPermissionsAsync();
        return status === "granted" ? "granted" : status === "denied" ? "denied" : "unknown";
      }
      case "microphone": {
        const result = await AudioModule.getRecordingPermissionsAsync();
        return result.granted ? "granted" : "unknown";
      }
      case "location": {
        const { status } = await Location.getForegroundPermissionsAsync();
        return status === "granted" ? "granted" : status === "denied" ? "denied" : "unknown";
      }
      case "locationBackground": {
        const { status } = await Location.getBackgroundPermissionsAsync();
        return status === "granted" ? "granted" : status === "denied" ? "denied" : "unknown";
      }
      case "mediaLibrary": {
        const { status } = await MediaLibrary.getPermissionsAsync();
        return status === "granted" ? "granted" : status === "denied" ? "denied" : "unknown";
      }
      case "contacts": {
        const { status } = await Contacts.getPermissionsAsync();
        return status === "granted" ? "granted" : status === "denied" ? "denied" : "unknown";
      }
      case "usageStats":
        if (Platform.OS === "android") {
          return UsageStats.hasUsagePermission() ? "granted" : "denied";
        }
        return "granted";
      case "overlay":
        // No easy API to check — assume needs granting
        return "unknown";
      default:
        return "unknown";
    }
  } catch {
    return "unknown";
  }
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PermissionsScreen() {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, PermStatus>>({});
  const [requesting, setRequesting] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Only show Android-only perms on Android
  const visiblePerms = PERMISSIONS.filter(p => !p.androidOnly || Platform.OS === "android");

  const checkAll = useCallback(async () => {
    setChecking(true);
    const result: Record<string, PermStatus> = {};
    for (const p of visiblePerms) {
      result[p.id] = await checkPermission(p.id);
    }
    setStatuses(result);
    setChecking(false);
  }, []);

  useEffect(() => {
    checkAll();
  }, []);

  function openAndroidSettings(permId: string) {
    const actionMap: Record<string, string> = {
      usageStats: "android.settings.USAGE_ACCESS_SETTINGS",
      overlay: "android.settings.MANAGE_OVERLAY_PERMISSION",
    };
    const action = actionMap[permId];
    if (action) {
      Linking.sendIntent(action).catch(() => Linking.openSettings());
    } else {
      Linking.openSettings();
    }
    setTimeout(() => checkAll(), 2000);
  }

  async function handleRequest(perm: PermItem) {
    if (perm.openSettings) {
      openAndroidSettings(perm.id);
      return;
    }

    if (statuses[perm.id] === "denied") {
      // Already denied — must go to app Settings
      Linking.openSettings();
      setTimeout(() => checkAll(), 2000);
      return;
    }

    // Background location needs foreground first
    if (perm.id === "locationBackground" && statuses["location"] !== "granted") {
      Alert.alert(
        "Location Required First",
        "Please grant foreground location access before enabling background location.",
      );
      return;
    }

    setRequesting(perm.id);
    const status = await requestPermission(perm.id);
    setStatuses(prev => ({ ...prev, [perm.id]: status }));
    setRequesting(null);
  }

  async function grantAll() {
    for (const p of visiblePerms) {
      if (p.openSettings) continue; // skip settings-based ones (need manual action)
      if (statuses[p.id] === "granted") continue;
      // Skip background location if foreground not yet granted
      if (p.id === "locationBackground" && statuses["location"] !== "granted") continue;
      setRequesting(p.id);
      const status = await requestPermission(p.id);
      setStatuses(prev => ({ ...prev, [p.id]: status }));
    }
    setRequesting(null);
  }

  const requiredDone = visiblePerms
    .filter(p => p.required && !p.openSettings)
    .every(p => statuses[p.id] === "granted");

  const allGranted = visiblePerms.every(p => statuses[p.id] === "granted");

  function proceed() {
    router.replace("/setup/parent-pin");
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.emoji}>🛡️</Text>
        <Text style={styles.title}>App Permissions</Text>
        <Text style={styles.sub}>
          Spinini needs the following permissions to keep your family safe and connected.
        </Text>
      </View>

      {checking ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ color: Colors.textSecondary, fontSize: FontSize.sm }}>Checking permissions…</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          {/* Grant All button */}
          {!allGranted && (
            <TouchableOpacity
              style={styles.grantAllBtn}
              onPress={grantAll}
              disabled={!!requesting}
            >
              <Text style={styles.grantAllText}>
                {requesting ? "Requesting…" : "⚡ Grant All Permissions"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Permission items */}
          {visiblePerms.map(perm => {
            const status = statuses[perm.id] ?? "unknown";
            const isGranted = status === "granted";
            const isDenied = status === "denied";
            const isLoading = requesting === perm.id;

            return (
              <View
                key={perm.id}
                style={[
                  styles.card,
                  isGranted && styles.cardGranted,
                  isDenied && styles.cardDenied,
                ]}
              >
                <View style={styles.cardLeft}>
                  <Text style={styles.permEmoji}>{perm.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text style={styles.permTitle}>{perm.title}</Text>
                      {perm.required && (
                        <View style={styles.requiredBadge}>
                          <Text style={styles.requiredText}>Required</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.permDesc}>{perm.desc}</Text>
                    {perm.openSettings && !isGranted && (
                      <Text style={styles.settingsHint}>Opens Android Settings</Text>
                    )}
                    {isDenied && !perm.openSettings && (
                      <Text style={styles.deniedHint}>Denied — tap to open Settings</Text>
                    )}
                  </View>
                </View>

                <View style={styles.cardRight}>
                  {isGranted ? (
                    <View style={styles.grantedBadge}>
                      <Text style={styles.grantedText}>✓</Text>
                    </View>
                  ) : isLoading ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <TouchableOpacity
                      style={[styles.grantBtn, isDenied && styles.grantBtnSettings]}
                      onPress={() => handleRequest(perm)}
                    >
                      <Text style={styles.grantBtnText}>
                        {perm.openSettings ? "Open Settings" : isDenied ? "Settings" : "Allow"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}

          {/* Info box */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>ℹ️ Why we need these</Text>
            <Text style={styles.infoText}>
              Permissions are only used for the features described. You can change them any time in your device Settings. The app works without optional permissions, but some features will be unavailable.
            </Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Continue button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueBtn, !requiredDone && styles.continueBtnSoft]}
          onPress={proceed}
        >
          <Text style={styles.continueBtnText}>
            {requiredDone ? "Continue →" : "Continue (some required permissions missing)"}
          </Text>
        </TouchableOpacity>
        {!requiredDone && (
          <Text style={styles.skipNote}>
            You can grant remaining permissions later in Settings.
          </Text>
        )}
      </View>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: { alignItems: "center", paddingVertical: Spacing.lg },
  emoji: { fontSize: 56 },
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginTop: Spacing.sm },
  sub: {
    fontSize: FontSize.sm, color: Colors.textSecondary,
    textAlign: "center", marginTop: Spacing.xs, lineHeight: 20,
    paddingHorizontal: Spacing.md,
  },

  grantAllBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingVertical: 14, marginBottom: Spacing.md, alignItems: "center",
  },
  grantAllText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },

  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: 10,
    borderWidth: 1.5, borderColor: Colors.border,
    ...Shadow.sm,
  },
  cardGranted: { borderColor: Colors.success + "60", backgroundColor: Colors.success + "08" },
  cardDenied: { borderColor: Colors.error + "40" },

  cardLeft: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardRight: { marginLeft: 10, alignItems: "center", justifyContent: "center", minWidth: 80 },

  permEmoji: { fontSize: 30, marginTop: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" },
  permTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  permDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  settingsHint: { fontSize: 11, color: Colors.warning, fontWeight: "600", marginTop: 4 },
  deniedHint: { fontSize: 11, color: Colors.error, fontWeight: "600", marginTop: 4 },

  requiredBadge: {
    backgroundColor: Colors.primary + "18", borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  requiredText: { fontSize: 10, color: Colors.primary, fontWeight: "700" },

  grantedBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.success, alignItems: "center", justifyContent: "center",
  },
  grantedText: { color: "#fff", fontWeight: "800", fontSize: 18 },

  grantBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  grantBtnSettings: { backgroundColor: Colors.warning },
  grantBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  infoBox: {
    backgroundColor: Colors.info + "12", borderRadius: Radius.lg,
    padding: Spacing.md, marginTop: Spacing.sm,
    borderWidth: 1, borderColor: Colors.info + "30",
  },
  infoTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.info, marginBottom: 6 },
  infoText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  footer: { paddingTop: Spacing.sm, paddingBottom: Spacing.sm, gap: 6 },
  continueBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingVertical: 16, alignItems: "center",
  },
  continueBtnSoft: { backgroundColor: Colors.primary + "AA" },
  continueBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  skipNote: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "center" },
});
