import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Platform,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as ImagePicker from "expo-image-picker";
import * as Contacts from "expo-contacts";
import { AudioModule } from "expo-audio";
import { useCameraPermissions } from "expo-camera";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";

// ─── Special Android Permissions (must be granted manually in Settings) ────────

const ANDROID_SPECIAL = [
  {
    id: "usage_access",
    emoji: "📊",
    title: "Usage Access (Screen Time)",
    description: "Allows Spinini to read how long your child spends in each app. This data is used only for parental usage reports and enforcing daily limits. It stays on your device and is never sent to our servers.\n\nMust be granted manually in: Settings → Special App Access → Usage Access → Spinini → Allow.",
    settingsAction: "android.settings.USAGE_ACCESS_SETTINGS",
    required: true,
  },
  {
    id: "accessibility",
    emoji: "♿",
    title: "Accessibility Service (App Blocking)",
    description: "Allows Spinini to detect which app is in the foreground in real time. This is used only to show a lock screen when your child opens a blocked app. Spinini does NOT read the content, text, passwords, or data of any other app.\n\nMust be granted manually in: Settings → Accessibility → Installed apps → Spinini → Allow.",
    settingsAction: "android.settings.ACCESSIBILITY_SETTINGS",
    required: true,
  },
  {
    id: "overlay",
    emoji: "🪟",
    title: "Display Over Other Apps (Lock Overlay)",
    description: "Allows Spinini to show a full-screen lock overlay when a blocked app is opened or when you activate Remote Lock. The overlay cannot capture screen content or data from other apps.\n\nMust be granted manually in: Settings → Apps → Spinini → Display over other apps → Allow.",
    settingsAction: "android.settings.MANAGE_OVERLAY_PERMISSION",
    required: true,
  },
];

// ─── Standard permissions ──────────────────────────────────────────────────────

interface PermRow {
  id: string;
  emoji: string;
  label: string;
  description: string;
  required: boolean;
  request: () => Promise<boolean>;
}

export default function PermissionsScreen() {
  const { state } = useData();
  const [, requestCamera] = useCameraPermissions();
  const [loading, setLoading] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, boolean | null>>({});

  const PERMS: PermRow[] = [
    {
      id: "camera",
      emoji: "📷",
      label: "Camera",
      description: "Used for Camera Watch monitoring, chore photo proof, profile pictures, and memory photos.",
      required: false,
      request: async () => { const r = await requestCamera(); return r.status === "granted"; },
    },
    {
      id: "microphone",
      emoji: "🎤",
      label: "Microphone",
      description: "Used for recording Fun Lock voice messages and narrating bedtime stories.",
      required: false,
      request: async () => { const r = await AudioModule.requestRecordingPermissionsAsync(); return r.granted; },
    },
    {
      id: "location",
      emoji: "📍",
      label: "Location (while using app)",
      description: "Used for the SOS button GPS capture and the parent Location map when the app is open.",
      required: false,
      request: async () => { const r = await Location.requestForegroundPermissionsAsync(); return r.status === "granted"; },
    },
    {
      id: "location_bg",
      emoji: "📍",
      label: "Location (background)",
      description: "Used for continuous location tracking and Safe Zone entry/exit alerts when the app is in the background. Grant foreground location first.",
      required: false,
      request: async () => { const r = await Location.requestBackgroundPermissionsAsync(); return r.status === "granted"; },
    },
    {
      id: "notifications",
      emoji: "🔔",
      label: "Notifications",
      description: "Used for homework due-date reminders, chore approval alerts, SOS alerts, ping alerts, and Safe Zone notifications.",
      required: true,
      request: async () => { const r = await Notifications.requestPermissionsAsync(); return r.status === "granted"; },
    },
    {
      id: "photos",
      emoji: "🖼️",
      label: "Photo Library",
      description: "Used for selecting photos for chore proof, profile pictures, memories, and Fun Lock images.",
      required: false,
      request: async () => { const r = await ImagePicker.requestMediaLibraryPermissionsAsync(); return r.status === "granted"; },
    },
    {
      id: "contacts",
      emoji: "📞",
      label: "Contacts",
      description: "Used to populate the child's emergency contact list from your device contacts.",
      required: false,
      request: async () => { const r = await Contacts.requestPermissionsAsync(); return r.status === "granted"; },
    },
  ];

  async function handleRequest(perm: PermRow) {
    if (perm.id === "location_bg") {
      Alert.alert(
        "Background Location",
        "Spinini will track your child's location in the background so you can see it on the map and receive Safe Zone alerts — even when the app is closed.\n\nThis data stays on your device only.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Grant", onPress: async () => {
            setLoading(perm.id);
            const ok = await perm.request();
            setStatuses(s => ({ ...s, [perm.id]: ok }));
            setLoading(null);
          }},
        ]
      );
      return;
    }
    setLoading(perm.id);
    const ok = await perm.request();
    setStatuses(s => ({ ...s, [perm.id]: ok }));
    setLoading(null);
  }

  function openAndroidSettings(action: string, permId: string) {
    Alert.alert(
      "Open Settings",
      ANDROID_SPECIAL.find(p => p.id === permId)?.description ?? "",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Settings →",
          onPress: () => {
            Linking.sendIntent(action).catch(() =>
              Linking.openSettings()
            );
          },
        },
      ]
    );
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🔐 App Permissions</Text>
      <Text style={styles.sub}>
        These permissions let Spinini protect your family. Tap any item to request or learn more.
      </Text>

      {/* Standard permissions */}
      <Text style={styles.sectionHeader}>Standard Permissions</Text>
      {PERMS.map(perm => {
        const status = statuses[perm.id];
        return (
          <TouchableOpacity
            key={perm.id}
            style={styles.card}
            onPress={() => handleRequest(perm)}
            activeOpacity={0.75}
          >
            <Text style={styles.permEmoji}>{perm.emoji}</Text>
            <View style={{ flex: 1 }}>
              <View style={styles.permLabelRow}>
                <Text style={styles.permLabel}>{perm.label}</Text>
                {perm.required && <View style={styles.reqPill}><Text style={styles.reqPillText}>Required</Text></View>}
              </View>
              <Text style={styles.permDesc}>{perm.description}</Text>
            </View>
            {loading === perm.id ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <View style={[styles.badge, { backgroundColor: status === true ? Colors.success + "25" : status === false ? Colors.error + "25" : Colors.border + "80" }]}>
                <Text style={[styles.badgeText, { color: status === true ? Colors.success : status === false ? Colors.error : Colors.textSecondary }]}>
                  {status === true ? "✓ Granted" : status === false ? "✗ Denied" : "Tap →"}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      {/* Android special permissions */}
      {Platform.OS === "android" && (
        <>
          <Text style={styles.sectionHeader}>Special Android Permissions</Text>
          <View style={styles.specialNote}>
            <Text style={styles.specialNoteText}>
              These permissions cannot be requested via a popup — they must be granted manually in your device's Settings. Tap each one for step-by-step instructions.
            </Text>
          </View>

          {ANDROID_SPECIAL.map(perm => (
            <TouchableOpacity
              key={perm.id}
              style={[styles.card, styles.specialCard]}
              onPress={() => openAndroidSettings(perm.settingsAction, perm.id)}
              activeOpacity={0.75}
            >
              <Text style={styles.permEmoji}>{perm.emoji}</Text>
              <View style={{ flex: 1 }}>
                <View style={styles.permLabelRow}>
                  <Text style={styles.permLabel}>{perm.title}</Text>
                  <View style={styles.reqPill}><Text style={styles.reqPillText}>Required</Text></View>
                </View>
                <Text style={styles.permDesc}>Tap to open device Settings and enable this permission.</Text>
              </View>
              <Text style={styles.settingsArrow}>⚙️</Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* Privacy note */}
      <View style={styles.privacyNote}>
        <Text style={styles.privacyNoteTitle}>🔒 Privacy Promise</Text>
        <Text style={styles.privacyNoteText}>
          All data collected via these permissions stays on your device. We do not transmit location, screen time, or app usage to our servers. AI features (Buddy chat) send messages to Anthropic over encrypted HTTPS only.
        </Text>
        <TouchableOpacity onPress={() => Linking.openURL("https://spinini.app/privacy")}>
          <Text style={styles.privacyLink}>Read full Privacy Policy →</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title:            { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub:              { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  sectionHeader:    { fontSize: FontSize.sm, fontWeight: "800", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.8, marginTop: Spacing.md, marginBottom: Spacing.sm },
  card:             { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  specialCard:      { borderWidth: 1, borderColor: Colors.warning + "50", backgroundColor: "#FFFBEB" },
  permEmoji:        { fontSize: 28 },
  permLabelRow:     { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  permLabel:        { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  permDesc:         { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  reqPill:          { backgroundColor: Colors.error + "20", borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  reqPillText:      { fontSize: 10, fontWeight: "700", color: Colors.error },
  badge:            { borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5, minWidth: 80, alignItems: "center" },
  badgeText:        { fontSize: FontSize.xs, fontWeight: "700" },
  settingsArrow:    { fontSize: 22 },
  specialNote:      { backgroundColor: Colors.warning + "20", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8 },
  specialNoteText:  { fontSize: FontSize.sm, color: "#92400E", lineHeight: 20 },
  privacyNote:      { backgroundColor: Colors.primary + "10", borderRadius: Radius.xl, padding: Spacing.md, marginTop: Spacing.lg, gap: 8 },
  privacyNoteTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.primary },
  privacyNoteText:  { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  privacyLink:      { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "700", textDecorationLine: "underline" },
});
