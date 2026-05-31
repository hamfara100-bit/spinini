import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Switch, Alert } from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { nowIso } from "../../../lib/utils";

function formatDate(iso?: string) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function generateDigestText(state: any): string {
  const kids = state.kids;
  const lines: string[] = [`📊 Spinini Weekly Digest — ${new Date().toLocaleDateString()}\n`];

  kids.forEach((k: any) => {
    lines.push(`\n── ${k.profile.name} ──`);

    // Screen time
    const last7 = k.usage.slice(0, 7);
    const totalMins = last7.reduce((sum: number, d: any) => sum + d.totalMinutes, 0);
    lines.push(`📱 Screen time: ${Math.round(totalMins / 60)}h ${totalMins % 60}m this week`);

    // Chores
    const approved = k.chores.filter((c: any) => c.status === "approved").length;
    lines.push(`✅ Chores completed: ${approved}`);

    // Streak
    lines.push(`🔥 Current streak: ${k.streak.currentDays} days (best: ${k.streak.longestDays})`);

    // Points
    lines.push(`⭐ Behavior points: ${k.behavior.totalPoints}`);

    // Bank
    lines.push(`💰 Piggy bank: $${k.money.balance.toFixed(2)}`);
  });

  lines.push(`\n📅 Next digest: Sunday\nSent by Spinini — famkids.app`);
  return lines.join("\n");
}

export default function DigestScreen() {
  const { state, dispatch } = useData();
  const [email, setEmail] = useState(state.parentSettings.digestEmail ?? "");
  const enabled = state.parentSettings.digestEnabled ?? false;

  function save() {
    if (enabled && !email.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    dispatch({ type: "SET_DIGEST_SETTINGS", email: email.trim(), enabled });
    Alert.alert("Saved!", "Digest settings updated.");
  }

  function toggleEnabled(val: boolean) {
    dispatch({ type: "SET_DIGEST_SETTINGS", email: email.trim(), enabled: val });
  }

  function previewDigest() {
    const text = generateDigestText(state);
    Alert.alert("Digest Preview", text);
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>📧 Weekly Digest</Text>
      <Text style={styles.sub}>
        Get a plain-language summary of your family's week every Sunday — screen time, chores, streaks, points, and more.
      </Text>

      {/* Enable toggle */}
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Enable Weekly Digest</Text>
            <Text style={styles.cardSub}>Sent every Sunday morning</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={toggleEnabled}
            trackColor={{ true: Colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Email input */}
      <Text style={styles.fieldLabel}>Email address</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.saveBtn} onPress={save}>
        <Text style={styles.saveBtnText}>Save Settings</Text>
      </TouchableOpacity>

      {/* Last sent */}
      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          Last digest sent: {formatDate(state.parentSettings.digestLastSentAt)}
        </Text>
      </View>

      {/* What's included */}
      <Text style={styles.sectionLabel}>WHAT'S IN THE DIGEST</Text>
      {[
        { emoji: "📱", text: "Total screen time for the week" },
        { emoji: "✅", text: "Chores completed and approved" },
        { emoji: "🔥", text: "Streak progress" },
        { emoji: "⭐", text: "Behavior points earned" },
        { emoji: "💰", text: "Piggy bank balance" },
        { emoji: "😊", text: "Mood trends (if enabled)" },
      ].map(item => (
        <View key={item.text} style={styles.includeItem}>
          <Text style={styles.includeEmoji}>{item.emoji}</Text>
          <Text style={styles.includeText}>{item.text}</Text>
        </View>
      ))}

      <TouchableOpacity style={styles.previewBtn} onPress={previewDigest}>
        <Text style={styles.previewBtnText}>Preview This Week's Digest</Text>
      </TouchableOpacity>

      <View style={styles.noteCard}>
        <Text style={styles.noteText}>
          Note: Digest emails are sent from your device. Make sure you have a mail client configured, or copy the preview text to send manually.
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadow.sm },
  cardRow: { flexDirection: "row", alignItems: "center" },
  cardTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg, padding: 12, fontSize: FontSize.base, marginBottom: Spacing.md },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, ...Shadow.md, marginBottom: Spacing.md },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  infoCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: 12, marginBottom: Spacing.md, alignItems: "center" },
  infoText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  includeItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  includeEmoji: { fontSize: 20, width: 28, textAlign: "center" },
  includeText: { fontSize: FontSize.base, color: Colors.textPrimary },
  previewBtn: { borderWidth: 2, borderColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, marginTop: Spacing.md, marginBottom: Spacing.sm },
  previewBtnText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.sm },
  noteCard: { backgroundColor: Colors.background, borderRadius: Radius.lg, padding: 12, borderWidth: 1, borderColor: Colors.border },
  noteText: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18 },
});
