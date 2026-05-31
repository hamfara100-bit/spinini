import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { getTodayUsage, getRemainingMinutes, formatMinutes } from "../../../lib/data/logic";

function ParentWidgetPreview({ state }: { state: any }) {
  const pending = state.kids.reduce((sum: number, k: any) =>
    sum + k.chores.filter((c: any) => c.status === "submitted").length, 0);
  const totalScreen = state.kids.reduce((sum: number, k: any) =>
    sum + getTodayUsage(k), 0);

  return (
    <View style={styles.widgetPreview}>
      <View style={styles.widgetHeader}>
        <Text style={styles.widgetEmoji}>👨‍👩‍👧</Text>
        <Text style={styles.widgetTitle}>Spinini Parent</Text>
      </View>
      <View style={styles.widgetRow}>
        <View style={styles.widgetStat}>
          <Text style={styles.widgetStatValue}>{pending}</Text>
          <Text style={styles.widgetStatLabel}>Pending</Text>
        </View>
        <View style={styles.widgetStat}>
          <Text style={styles.widgetStatValue}>{formatMinutes(totalScreen)}</Text>
          <Text style={styles.widgetStatLabel}>Screen today</Text>
        </View>
        <View style={styles.widgetStat}>
          <Text style={styles.widgetStatValue}>{state.kids.length}</Text>
          <Text style={styles.widgetStatLabel}>Kids</Text>
        </View>
      </View>
      <Text style={styles.widgetNote}>Tap to open Spinini</Text>
    </View>
  );
}

function KidWidgetPreview({ kid }: { kid: any }) {
  const remaining = getRemainingMinutes(kid);
  const pending = kid.chores.filter((c: any) => c.status === "open").length;
  return (
    <View style={[styles.widgetPreview, { backgroundColor: "#EDE9FE" }]}>
      <View style={styles.widgetHeader}>
        <Text style={styles.widgetEmoji}>✨</Text>
        <Text style={styles.widgetTitle}>{kid.profile.name}'s Widget</Text>
      </View>
      <View style={styles.widgetRow}>
        <View style={styles.widgetStat}>
          <Text style={[styles.widgetStatValue, { color: remaining > 30 ? Colors.success : Colors.error }]}>
            {remaining > 0 ? `${remaining}m` : "Done"}
          </Text>
          <Text style={styles.widgetStatLabel}>Time left</Text>
        </View>
        <View style={styles.widgetStat}>
          <Text style={styles.widgetStatValue}>{pending}</Text>
          <Text style={styles.widgetStatLabel}>Chores</Text>
        </View>
        <View style={styles.widgetStat}>
          <Text style={styles.widgetStatValue}>${kid.money.balance.toFixed(0)}</Text>
          <Text style={styles.widgetStatLabel}>Balance</Text>
        </View>
      </View>
      <Text style={styles.widgetNote}>Tap to open Spinini</Text>
    </View>
  );
}

export default function WidgetsScreen() {
  const { state } = useData();

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>📱 Home Screen Widgets</Text>
      <Text style={styles.sub}>
        Spinini widgets show at-a-glance info on your phone's home screen without opening the app.
      </Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>ℹ️ How to add widgets</Text>
        <Text style={styles.infoText}>
          {`Android: Long-press your home screen → Widgets → Find Spinini\n\niOS: Long-press home screen → tap + button → search Spinini`}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>PARENT WIDGET PREVIEW</Text>
      <Text style={styles.previewSub}>Shows pending approvals and daily screen time at a glance</Text>
      <ParentWidgetPreview state={state} />

      <Text style={styles.sectionLabel}>KID WIDGET PREVIEWS</Text>
      <Text style={styles.previewSub}>Shows remaining screen time, open chores, and bank balance</Text>
      {state.kids.map(k => (
        <KidWidgetPreview key={k.profile.id} kid={k} />
      ))}

      {state.kids.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Add kids to see their widget previews.</Text>
        </View>
      )}

      <View style={styles.requiresNativeCard}>
        <Text style={styles.requiresNativeTitle}>🔧 Native Widget Requirements</Text>
        <Text style={styles.requiresNativeText}>
          {`Home screen widgets run outside the app and require a compiled app build. Widgets are included in Spinini+ and appear in your device's widget gallery after installing the app from the App Store / Google Play.`}
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
  infoCard: { backgroundColor: "#F0F9FF", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: "#BAE6FD" },
  infoTitle: { fontSize: FontSize.sm, fontWeight: "700", color: "#0369A1", marginBottom: 6 },
  infoText: { fontSize: FontSize.xs, color: "#075985", lineHeight: 20 },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  previewSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 10 },
  widgetPreview: { backgroundColor: "#EEF2FF", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm },
  widgetHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  widgetEmoji: { fontSize: 20 },
  widgetTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  widgetRow: { flexDirection: "row", marginBottom: 8 },
  widgetStat: { flex: 1, alignItems: "center" },
  widgetStatValue: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary },
  widgetStatLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  widgetNote: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "center" },
  emptyCard: { alignItems: "center", paddingVertical: 24 },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm },
  requiresNativeCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.border, ...Shadow.sm },
  requiresNativeTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary, marginBottom: 6 },
  requiresNativeText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
});
