/**
 * Social Media Monitoring — parent view.
 * Shows alerts when dangerous keywords are detected on kids' screens
 * (Instagram, TikTok, Snapchat, WhatsApp, etc.).
 *
 * Detection happens locally via the AppMonitorService accessibility service
 * — no content leaves the device.
 */

import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Switch, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Spacing } from "../../../lib/theme";
import type { SocialAlert } from "../../../lib/data/types";

const SEVERITY_COLOR: Record<string, string> = {
  warning: "#D97706",
  danger:  "#DC2626",
  critical:"#7C3AED",
};

const SEVERITY_BG: Record<string, string> = {
  warning: "#FFFBEB",
  danger:  "#FEF2F2",
  critical:"#F5F3FF",
};

const SOCIAL_APPS: Record<string, { name: string; emoji: string }> = {
  "com.instagram.android":       { name: "Instagram",  emoji: "📸" },
  "com.zhiliaoapp.musically":    { name: "TikTok",     emoji: "🎵" },
  "com.snapchat.android":        { name: "Snapchat",   emoji: "👻" },
  "com.whatsapp":                { name: "WhatsApp",   emoji: "💬" },
  "com.facebook.katana":         { name: "Facebook",   emoji: "👍" },
  "com.twitter.android":         { name: "X (Twitter)",emoji: "🐦" },
  "com.discord":                 { name: "Discord",    emoji: "🎮" },
  "com.reddit.frontpage":        { name: "Reddit",     emoji: "🤖" },
};

export default function SocialMonitorScreen() {
  const { state, dispatch } = useData();
  const router = useRouter();
  const alerts = (state.socialAlerts ?? []);
  const unacked = alerts.filter(a => !a.acknowledged);

  function ackAll() {
    dispatch({ type: "SOCIAL_ALERT_CLEAR_ALL" });
  }

  function ackOne(id: string) {
    dispatch({ type: "SOCIAL_ALERT_ACK", alertId: id });
  }

  function renderAlert({ item }: { item: SocialAlert }) {
    const appMeta = SOCIAL_APPS[item.appPackage] ?? { name: item.appName, emoji: "📱" };
    const kid = state.kids.find(k => k.profile.id === item.kidId);
    const ts = new Date(item.timestamp).toLocaleString();

    return (
      <View style={[s.alertCard, { backgroundColor: SEVERITY_BG[item.severity] ?? "#FFF", borderColor: SEVERITY_COLOR[item.severity] ?? Colors.border }, item.acknowledged && s.alertAcked]}>
        <View style={s.alertHeader}>
          <Text style={s.alertApp}>{appMeta.emoji} {appMeta.name}</Text>
          <View style={[s.severityBadge, { backgroundColor: SEVERITY_COLOR[item.severity] ?? Colors.border }]}>
            <Text style={s.severityText}>{item.severity.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={s.alertKid}>👤 {kid?.profile.name ?? item.kidName}  ·  {ts}</Text>
        <Text style={s.alertKeyword}>Keyword: <Text style={{ color: SEVERITY_COLOR[item.severity], fontWeight: "800" }}>"{item.matchedKeyword}"</Text></Text>
        <Text style={s.alertContext}>{item.context}</Text>
        {!item.acknowledged && (
          <TouchableOpacity style={s.ackBtn} onPress={() => ackOne(item.id)}>
            <Text style={s.ackText}>✓ Mark as reviewed</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <ScreenContainer>
      <View style={s.header}>
        <View>
          <Text style={s.title}>🔍 Social Monitoring</Text>
          <Text style={s.sub}>Local AI scans kids' screens for dangerous content</Text>
        </View>
        {unacked.length > 0 && (
          <TouchableOpacity onPress={ackAll} style={s.clearBtn}>
            <Text style={s.clearText}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      <PrivacyNote />
      <MonitoringStatus />

      {alerts.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>✅</Text>
          <Text style={s.emptyTitle}>All Clear</Text>
          <Text style={s.emptySub}>No dangerous content detected in the last 30 days.</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={a => a.id}
          renderItem={renderAlert}
          contentContainerStyle={{ gap: 10, paddingBottom: 80 }}
        />
      )}
    </ScreenContainer>
  );
}

function PrivacyNote() {
  return (
    <View style={s.privacyBox}>
      <Text style={s.privacyText}>
        🔒 <Text style={{ fontWeight: "700" }}>Privacy-first:</Text> Content is scanned on-device only. Keywords are detected locally and no message content is uploaded to any server.
      </Text>
    </View>
  );
}

function MonitoringStatus() {
  const { state, dispatch } = useData();

  // Per-kid monitoring toggle
  return (
    <View style={s.statusBox}>
      <Text style={s.statusTitle}>Monitoring Status</Text>
      {state.kids.length === 0 && <Text style={s.statusEmpty}>No kids added yet</Text>}
      {state.kids.map(k => {
        const enabled = k.rules.webFilter?.enabled ?? false;
        return (
          <View key={k.profile.id} style={s.kidRow}>
            <Text style={s.kidName}>{k.profile.name}</Text>
            <Switch
              value={enabled}
              onValueChange={val => dispatch({ type: "WEB_FILTER_UPDATE", kidId: k.profile.id, payload: { enabled: val } })}
              trackColor={{ true: Colors.primary }}
            />
          </View>
        );
      })}
      <Text style={s.statusNote}>
        Requires Accessibility Service to be enabled on kid's device.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: Spacing.md },
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  sub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  clearText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: "700" },
  alertCard: { borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1.5, gap: 6 },
  alertAcked: { opacity: 0.5 },
  alertHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  alertApp: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  severityBadge: { borderRadius: Radius.md, paddingHorizontal: 8, paddingVertical: 3 },
  severityText: { fontSize: 10, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  alertKid: { fontSize: FontSize.xs, color: Colors.textSecondary },
  alertKeyword: { fontSize: FontSize.sm, color: Colors.textPrimary },
  alertContext: { fontSize: FontSize.xs, color: Colors.textSecondary, fontStyle: "italic", lineHeight: 18 },
  ackBtn: { alignSelf: "flex-end", backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 6 },
  ackText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: "800", color: "#16A34A" },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", maxWidth: 260 },
  privacyBox: { backgroundColor: "#F0FDF4", borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
  privacyText: { fontSize: FontSize.xs, color: "#15803D", lineHeight: 18 },
  statusBox: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, gap: 8 },
  statusTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  statusEmpty: { fontSize: FontSize.sm, color: Colors.textMuted },
  kidRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kidName: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: "600" },
  statusNote: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
});
