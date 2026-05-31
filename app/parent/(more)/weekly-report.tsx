/**
 * Weekly Family Report — parent screen.
 * Generates an HTML summary of each kid's activity and opens
 * the device email client with the report pre-filled.
 */

import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Spacing } from "../../../lib/theme";
import { getTodayUsage, getStreak } from "../../../lib/data/logic";
import * as MailComposer from "expo-mail-composer";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function buildHtmlReport(state: any, parentName: string): string {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const weekStart = daysAgo(7);

  const kidSections = state.kids.map((kid: any) => {
    const weekUsage = kid.usage.filter((u: any) => u.date >= weekStart);
    const totalMins = weekUsage.reduce((s: number, u: any) => s + u.totalMinutes, 0);
    const topApps = weekUsage
      .flatMap((u: any) => u.byApp as any[])
      .reduce((acc: Record<string, number>, a: any) => ({ ...acc, [a.appName]: (acc[a.appName] ?? 0) + a.minutes }), {});
    const sortedApps = Object.entries(topApps).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 5);

    const weekChores = kid.chores.filter((c: any) => c.approvals.some((a: any) => a.reviewedAt >= weekStart));
    const approvedChores = weekChores.filter((c: any) => c.approvals.some((a: any) => a.approved));
    const moodEntries = (kid.moodEntries ?? []).filter((m: any) => m.date >= weekStart);
    const avgMood = moodEntries.length
      ? (moodEntries.reduce((s: number, m: any) => s + m.mood, 0) / moodEntries.length).toFixed(1)
      : null;
    const streak = kid.streak?.currentDays ?? 0;
    const limit = kid.rules.screenTimeSchedule?.dailyLimitMinutes ?? kid.rules.dailyLimitMinutes ?? 120;

    return `
    <div style="background:#f9f9f9;border-radius:12px;padding:20px;margin-bottom:20px;border-left:4px solid #7C5CFF">
      <h2 style="color:#7C5CFF;margin:0 0 12px">${kid.profile.name} (age ${kid.profile.age})</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:6px 12px;background:#fff;border-radius:8px;margin:4px">
            📱 <b>Screen time:</b> ${Math.round(totalMins / 60)}h ${totalMins % 60}m
            (limit: ${Math.round((limit * 7) / 60)}h/week)
          </td>
          <td style="padding:6px 12px;background:#fff;border-radius:8px;margin:4px">
            ✅ <b>Chores done:</b> ${approvedChores.length} of ${weekChores.length}
          </td>
        </tr>
        <tr>
          <td style="padding:6px 12px;background:#fff;border-radius:8px;margin:4px">
            🔥 <b>Chore streak:</b> ${streak} day${streak !== 1 ? "s" : ""}
          </td>
          <td style="padding:6px 12px;background:#fff;border-radius:8px;margin:4px">
            😊 <b>Avg mood:</b> ${avgMood ? `${avgMood}/5` : "Not logged"}
          </td>
        </tr>
      </table>
      ${sortedApps.length > 0 ? `
      <h3 style="color:#555;margin:12px 0 6px">Top Apps This Week</h3>
      <ul style="margin:0;padding-left:20px">
        ${sortedApps.map(([name, mins]) => `<li>${name}: ${Math.round(mins as number)} min</li>`).join("")}
      </ul>` : ""}
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
  h1 { color: #7C5CFF; }
</style></head>
<body>
  <h1>🏠 Spinini Family Report</h1>
  <p style="color:#666">Generated ${today} · Parent: ${parentName}</p>
  ${kidSections}
  <p style="color:#999;font-size:12px;margin-top:24px">
    Sent from Spinini Parental Control · <a href="https://spinini.app">spinini.app</a>
  </p>
</body>
</html>`;
}

export default function WeeklyReportScreen() {
  const { state } = useData();
  const [email, setEmail] = useState(state.parentSettings.digestEmail ?? "");
  const [loading, setLoading] = useState(false);

  async function sendReport() {
    if (!email.trim()) {
      Alert.alert("Email required", "Enter an email address to send the report to.");
      return;
    }
    const isAvailable = await MailComposer.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert("Email not available", "No email app found on this device.");
      return;
    }
    setLoading(true);
    try {
      const html = buildHtmlReport(state, state.parentSettings.name ?? "Parent");
      const plain = html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      await MailComposer.composeAsync({
        recipients: [email.trim()],
        subject: `📊 Spinini Weekly Family Report — ${new Date().toLocaleDateString()}`,
        body: html,
        isHtml: true,
      });
    } catch (e) {
      Alert.alert("Error", "Could not open email composer.");
    }
    setLoading(false);
  }

  const kids = state.kids;

  return (
    <ScreenContainer scroll>
      <Text style={s.title}>📊 Weekly Family Report</Text>
      <Text style={s.sub}>A summary of each kid's screen time, chores, mood, and top apps.</Text>

      {/* Preview cards */}
      {kids.length === 0 ? (
        <View style={s.empty}><Text style={s.emptyText}>No kids added yet.</Text></View>
      ) : (
        kids.map(kid => {
          const weekStart = daysAgo(7);
          const weekUsage = kid.usage.filter(u => u.date >= weekStart);
          const totalMins = weekUsage.reduce((s, u) => s + u.totalMinutes, 0);
          const weekChores = kid.chores.filter(c => c.approvals.some(a => a.reviewedAt >= weekStart));
          const approved = weekChores.filter(c => c.approvals.some(a => a.approved));
          const moodEntries = (kid.moodEntries ?? []).filter(m => m.date >= weekStart);
          const avgMood = moodEntries.length
            ? (moodEntries.reduce((s, m) => s + m.mood, 0) / moodEntries.length).toFixed(1) : null;

          return (
            <View key={kid.profile.id} style={s.kidCard}>
              <Text style={s.kidName}>{kid.profile.name}</Text>
              <View style={s.statsRow}>
                <View style={s.stat}><Text style={s.statVal}>{Math.round(totalMins / 60)}h {totalMins % 60}m</Text><Text style={s.statLabel}>Screen time</Text></View>
                <View style={s.stat}><Text style={s.statVal}>{approved.length}/{weekChores.length}</Text><Text style={s.statLabel}>Chores done</Text></View>
                <View style={s.stat}><Text style={s.statVal}>{avgMood ? `${avgMood}/5` : "—"}</Text><Text style={s.statLabel}>Avg mood</Text></View>
                <View style={s.stat}><Text style={s.statVal}>{kid.streak?.currentDays ?? 0}🔥</Text><Text style={s.statLabel}>Streak</Text></View>
              </View>
            </View>
          );
        })
      )}

      <Text style={s.sectionTitle}>Send Report By Email</Text>
      <TextInput
        style={s.emailInput}
        placeholder="parent@email.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TouchableOpacity style={s.sendBtn} onPress={sendReport} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.sendText}>📧 Open Email App with Report</Text>}
      </TouchableOpacity>
      <Text style={s.note}>
        This opens your email app with the report pre-filled. The report is generated on-device and not uploaded anywhere.
      </Text>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  empty: { padding: Spacing.xl, alignItems: "center" },
  emptyText: { color: Colors.textMuted },
  kidCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  kidName: { fontSize: FontSize.base, fontWeight: "800", color: Colors.primary, marginBottom: 8 },
  statsRow: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, alignItems: "center", backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 8 },
  statVal: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  statLabel: { fontSize: 9, color: Colors.textMuted, marginTop: 2 },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary, marginTop: Spacing.md, marginBottom: 6 },
  emailInput: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.base, marginBottom: Spacing.sm, backgroundColor: Colors.surface },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: Spacing.md, alignItems: "center" },
  sendText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  note: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "center", marginTop: Spacing.sm, lineHeight: 18 },
});
