import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { MOOD_LABELS, type MoodLevel } from "../../../lib/data/types";
import { today } from "../../../lib/utils";

function getLast14Days(): string[] {
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

function shortDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

export default function MoodGraphScreen() {
  const { state } = useData();
  const [selectedKidId, setSelectedKidId] = useState(state.kids[0]?.profile.id ?? "");

  const kid = state.kids.find(k => k.profile.id === selectedKidId);
  const entries = kid?.moodEntries ?? [];
  const days = getLast14Days();

  const moodByDate = new Map<string, MoodLevel>();
  entries.forEach(e => moodByDate.set(e.date, e.mood));

  const avg = entries.length > 0
    ? (entries.reduce((sum, e) => sum + e.mood, 0) / entries.length).toFixed(1)
    : "—";

  const recentNote = entries[0];

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>😊 Mood Tracker</Text>
      <Text style={styles.sub}>See how your kid has been feeling over the past 2 weeks.</Text>

      {/* Kid picker */}
      {state.kids.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
          {state.kids.map(k => (
            <TouchableOpacity
              key={k.profile.id}
              style={[styles.kidChip, selectedKidId === k.profile.id && styles.kidChipActive]}
              onPress={() => setSelectedKidId(k.profile.id)}
            >
              <Text style={[styles.kidChipText, selectedKidId === k.profile.id && styles.kidChipTextActive]}>
                {k.profile.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyText}>No mood data yet.{"\n"}{kid?.profile.name} hasn't checked in.</Text>
        </View>
      ) : (
        <>
          {/* Summary card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{avg}</Text>
              <Text style={styles.summaryLabel}>Avg mood</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{entries.length}</Text>
              <Text style={styles.summaryLabel}>Check-ins</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{recentNote?.mood ? MOOD_LABELS[recentNote.mood].emoji : "—"}</Text>
              <Text style={styles.summaryLabel}>Latest</Text>
            </View>
          </View>

          {/* 14-day bar chart */}
          <Text style={styles.sectionLabel}>LAST 14 DAYS</Text>
          <View style={styles.chart}>
            {days.map(dateStr => {
              const mood = moodByDate.get(dateStr);
              const info = mood ? MOOD_LABELS[mood] : null;
              const barHeight = mood ? mood * 16 : 0;
              const isToday = dateStr === today();
              return (
                <View key={dateStr} style={styles.chartBar}>
                  {info ? (
                    <View style={[styles.bar, { height: barHeight, backgroundColor: info.color }]}>
                      <Text style={styles.barEmoji}>{info.emoji}</Text>
                    </View>
                  ) : (
                    <View style={[styles.bar, { height: 8, backgroundColor: Colors.border }]} />
                  )}
                  <Text style={[styles.barDate, isToday && styles.barDateToday]}>{shortDate(dateStr)}</Text>
                </View>
              );
            })}
          </View>

          {/* Recent entries */}
          <Text style={styles.sectionLabel}>RECENT ENTRIES</Text>
          {entries.slice(0, 10).map(e => {
            const info = MOOD_LABELS[e.mood];
            return (
              <View key={e.id} style={[styles.entryCard, { borderLeftColor: info.color }]}>
                <Text style={styles.entryEmoji}>{info.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.entryMood, { color: info.color }]}>{info.label}</Text>
                  <Text style={styles.entryDate}>{new Date(e.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</Text>
                  {e.note && <Text style={styles.entryNote}>"{e.note}"</Text>}
                </View>
              </View>
            );
          })}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
  kidChip: { borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  kidChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  kidChipText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  kidChipTextActive: { color: "#fff" },
  summaryCard: { flexDirection: "row", backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: Colors.border },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 4, marginBottom: Spacing.lg, height: 110, paddingBottom: 24 },
  chartBar: { flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" },
  bar: { width: "100%", borderRadius: Radius.sm, alignItems: "center", justifyContent: "flex-start", paddingTop: 2, minHeight: 8 },
  barEmoji: { fontSize: 10 },
  barDate: { fontSize: 8, color: Colors.textMuted, marginTop: 4, textAlign: "center" },
  barDateToday: { color: Colors.primary, fontWeight: "700" },
  entryCard: { flexDirection: "row", alignItems: "flex-start", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: 12, marginBottom: 8, borderLeftWidth: 4, ...Shadow.sm },
  entryEmoji: { fontSize: 24, marginRight: 12, marginTop: 2 },
  entryMood: { fontSize: FontSize.base, fontWeight: "700" },
  entryDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  entryNote: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: "italic", marginTop: 4 },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyEmoji: { fontSize: 52, marginBottom: 12 },
  emptyText: { color: Colors.textMuted, textAlign: "center", fontSize: FontSize.base, lineHeight: 24 },
});
