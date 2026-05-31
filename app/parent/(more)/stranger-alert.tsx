/**
 * Feature 16: Stranger Alert
 * Shows parent when an unknown/unlisted number contacts their kid.
 * Parent can add the number to allowed list, block it, or dismiss.
 */
import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso } from "../../../lib/utils";
import type { StrangerAlert } from "../../../lib/data/types";

// Simulate some sample alerts for demo (in production these come from the kid's device)
const DEMO_ALERTS: StrangerAlert[] = [
  {
    id: "demo-1",
    kidId: "",
    kidName: "Alex",
    contactType: "text",
    numberMasked: "***-***-4921",
    detectedAt: new Date(Date.now() - 3600000).toISOString(),
    acknowledged: false,
    note: "Sent 3 messages",
  },
  {
    id: "demo-2",
    kidId: "",
    kidName: "Alex",
    contactType: "call",
    numberMasked: "Unknown",
    detectedAt: new Date(Date.now() - 86400000).toISOString(),
    acknowledged: false,
  },
];

export default function StrangerAlertScreen() {
  const { state, dispatch } = useData();
  const [guardEnabled, setGuardEnabled] = useState(true);
  const [alertOnCall, setAlertOnCall] = useState(true);
  const [alertOnText, setAlertOnText] = useState(true);
  const [showDemo, setShowDemo] = useState(true);

  const realAlerts = (state.strangerAlerts ?? []);
  const allAlerts: StrangerAlert[] = showDemo && realAlerts.length === 0
    ? DEMO_ALERTS
    : realAlerts;

  const unacked = allAlerts.filter(a => !a.acknowledged);
  const acked = allAlerts.filter(a => a.acknowledged);

  function acknowledge(alertId: string) {
    if (alertId.startsWith("demo-")) { setShowDemo(false); return; }
    dispatch({ type: "STRANGER_ALERT_ACK", alertId });
  }

  function acknowledgeAll() {
    realAlerts.forEach(a => {
      if (!a.acknowledged) dispatch({ type: "STRANGER_ALERT_ACK", alertId: a.id });
    });
    setShowDemo(false);
  }

  function clearAll() {
    Alert.alert("Clear all alerts?", "This removes all stranger contact history.", [
      { text: "Cancel" },
      { text: "Clear All", style: "destructive", onPress: () => {
        dispatch({ type: "STRANGER_ALERT_CLEAR_ALL" });
        setShowDemo(false);
      }},
    ]);
  }

  function addToAllowedList(alert: StrangerAlert) {
    Alert.alert(
      "Add to Allowed List?",
      `This number (${alert.numberMasked}) will be added to ${alert.kidName}'s allowed contacts list in Call & Text Guard.`,
      [
        { text: "Cancel" },
        { text: "Add to Allowed List", onPress: () => {
          // Dispatch to the real Call & Text Guard allowlist if we have a real kid ID
          if (alert.kidId && !alert.id.startsWith("demo-")) {
            // Strip masked formatting — store the raw number
            const raw = alert.numberMasked.replace(/[^0-9+]/g, "");
            if (raw.length > 3) {
              dispatch({ type: "COMM_WHITELIST_ADD", kidId: alert.kidId, number: raw });
            }
          }
          acknowledge(alert.id);
          Alert.alert("✅ Done", `Number added to ${alert.kidName}'s allowed contacts.`);
        }},
      ]
    );
  }

  function howItWorks() {
    Alert.alert(
      "How Stranger Alert Works",
      "When your kid's device receives a call or text from a number NOT in their allowed contacts list, Spinini logs it and notifies you.\n\nThis helps you know if someone unknown is trying to reach your child — without blocking all communication.\n\nRequires the kid app to be running and Call & Text Guard to be enabled.",
      [{ text: "OK" }]
    );
  }

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <ScreenContainer scroll>
      <Text style={s.title}>🚨 Stranger Alert</Text>
      <Text style={s.sub}>Get notified when an unknown number contacts your kid.</Text>

      <TouchableOpacity style={s.howBtn} onPress={howItWorks}>
        <Text style={s.howBtnText}>ℹ️ How this works →</Text>
      </TouchableOpacity>

      {/* Settings */}
      <View style={s.settingsCard}>
        <Text style={s.settingsTitle}>⚙️ Alert Settings</Text>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>Stranger Alert Guard</Text>
            <Text style={s.rowSub}>Monitor for unknown contacts on all kids' devices</Text>
          </View>
          <Switch value={guardEnabled} onValueChange={setGuardEnabled} trackColor={{ true: Colors.primary }} />
        </View>
        {guardEnabled && (
          <>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>📞 Alert on Unknown Calls</Text>
                <Text style={s.rowSub}>Notify you when an unknown number calls</Text>
              </View>
              <Switch value={alertOnCall} onValueChange={setAlertOnCall} trackColor={{ true: Colors.primary }} />
            </View>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>💬 Alert on Unknown Texts</Text>
                <Text style={s.rowSub}>Notify you when an unknown number texts</Text>
              </View>
              <Switch value={alertOnText} onValueChange={setAlertOnText} trackColor={{ true: Colors.primary }} />
            </View>
          </>
        )}
      </View>

      {/* Unacknowledged alerts */}
      {unacked.length > 0 && (
        <>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>🔴 New Alerts ({unacked.length})</Text>
            <TouchableOpacity onPress={acknowledgeAll}>
              <Text style={s.ackAllText}>Mark all reviewed</Text>
            </TouchableOpacity>
          </View>
          {unacked.map(alert => (
            <View key={alert.id} style={[s.alertCard, s.alertCardNew]}>
              <View style={s.alertIcon}>
                <Text style={{ fontSize: 24 }}>{alert.contactType === "call" ? "📞" : "💬"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.alertHeadline}>
                  Unknown {alert.contactType === "call" ? "call" : "text"} to {alert.kidName}
                </Text>
                <Text style={s.alertNumber}>{alert.numberMasked}</Text>
                {alert.note && <Text style={s.alertNote}>{alert.note}</Text>}
                <Text style={s.alertTime}>{timeAgo(alert.detectedAt)}</Text>
              </View>
              <View style={s.alertActions}>
                <TouchableOpacity style={s.allowBtn} onPress={() => addToAllowedList(alert)}>
                  <Text style={s.allowBtnText}>Allow</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.ackBtn} onPress={() => acknowledge(alert.id)}>
                  <Text style={s.ackBtnText}>✓</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {/* No alerts state */}
      {unacked.length === 0 && acked.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>✅</Text>
          <Text style={s.emptyText}>All clear!</Text>
          <Text style={s.emptySub}>No unknown contacts have tried to reach your kids.</Text>
        </View>
      )}

      {/* History */}
      {acked.length > 0 && (
        <>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>History</Text>
            <TouchableOpacity onPress={clearAll}>
              <Text style={s.clearText}>Clear all</Text>
            </TouchableOpacity>
          </View>
          {acked.map(alert => (
            <View key={alert.id} style={s.alertCard}>
              <View style={s.alertIcon}>
                <Text style={{ fontSize: 20, opacity: 0.5 }}>{alert.contactType === "call" ? "📞" : "💬"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.alertHeadline, { color: Colors.textSecondary }]}>
                  {alert.contactType === "call" ? "Call" : "Text"} to {alert.kidName}
                </Text>
                <Text style={[s.alertNumber, { color: Colors.textMuted }]}>{alert.numberMasked}</Text>
                <Text style={s.alertTime}>{timeAgo(alert.detectedAt)}</Text>
              </View>
              <Text style={s.reviewedText}>Reviewed</Text>
            </View>
          ))}
        </>
      )}

      <View style={s.footer}>
        <Text style={s.footerText}>
          💡 To block specific numbers, go to Call &amp; Text Guard and add them to your kid's blocked list.
          To see all contact activity, check the Reports screen.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.error, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm, lineHeight: 20 },
  howBtn: { alignSelf: "flex-start", backgroundColor: Colors.info + "15", borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6, marginBottom: Spacing.md },
  howBtnText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.info },
  settingsCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm, gap: 10 },
  settingsTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.textPrimary, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowLabel: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary },
  rowSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, marginTop: 4 },
  sectionTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  ackAllText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600" },
  clearText: { fontSize: FontSize.sm, color: Colors.error, fontWeight: "600" },
  alertCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12, ...Shadow.sm },
  alertCardNew: { borderWidth: 1.5, borderColor: Colors.error + "40", backgroundColor: Colors.error + "06" },
  alertIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  alertHeadline: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.textPrimary },
  alertNumber: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, fontFamily: "monospace" },
  alertNote: { fontSize: FontSize.xs, color: Colors.warning, marginTop: 2 },
  alertTime: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  alertActions: { gap: 6 },
  allowBtn: { backgroundColor: Colors.success, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 6 },
  allowBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.xs },
  ackBtn: { backgroundColor: Colors.primary + "15", borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 6 },
  ackBtnText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.sm },
  reviewedText: { fontSize: FontSize.xs, color: Colors.textMuted, fontStyle: "italic" },
  empty: { alignItems: "center", padding: Spacing.xl },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyText: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", marginTop: 4, lineHeight: 20 },
  footer: { backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md },
  footerText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
});
