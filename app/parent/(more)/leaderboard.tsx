import React, { useState } from "react";
import { View, Text, StyleSheet, Switch } from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { pointsToMoney } from "../../../lib/utils";

const MEDALS = ["🥇", "🥈", "🥉"];

function getWeekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0];
}

function weeklyChoresCompleted(kid: any): number {
  const weekStart = getWeekStart();
  return kid.chores.filter((c: any) =>
    (c.status === "approved") &&
    c.approvals?.some((a: any) => a.reviewedAt >= weekStart)
  ).length;
}

function weeklyPoints(kid: any): number {
  const weekStart = getWeekStart();
  return (kid.behavior.events ?? [])
    .filter((e: any) => e.date >= weekStart && e.points > 0)
    .reduce((sum: number, e: any) => sum + e.points, 0);
}

export default function LeaderboardScreen() {
  const { state } = useData();
  const [showPoints, setShowPoints] = useState(false);

  if (state.kids.length < 2) {
    return (
      <ScreenContainer>
        <Text style={styles.title}>🏅 Sibling Leaderboard</Text>
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>👨‍👩‍👧‍👦</Text>
          <Text style={styles.emptyText}>You need at least 2 kids for a leaderboard.</Text>
        </View>
      </ScreenContainer>
    );
  }

  const ranked = [...state.kids]
    .map(k => ({
      kid: k,
      score: showPoints ? weeklyPoints(k) : weeklyChoresCompleted(k),
      streak: k.streak.currentDays,
      total: k.streak.totalChoresDone,
    }))
    .sort((a, b) => b.score - a.score || b.streak - a.streak);

  const topScore = ranked[0]?.score ?? 0;

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🏅 Sibling Leaderboard</Text>
      <Text style={styles.sub}>Weekly comparison — resets every Sunday.</Text>

      <View style={styles.toggleRow}>
        <Text style={[styles.toggleLabel, !showPoints && styles.toggleLabelActive]}>Chores</Text>
        <Switch
          value={showPoints}
          onValueChange={setShowPoints}
          trackColor={{ true: Colors.primary, false: Colors.border }}
          thumbColor="#fff"
        />
        <Text style={[styles.toggleLabel, showPoints && styles.toggleLabelActive]}>Points</Text>
      </View>

      {ranked.map((entry, idx) => {
        const pct = topScore > 0 ? entry.score / topScore : 0;
        const medal = MEDALS[idx];
        return (
          <View key={entry.kid.profile.id} style={[styles.card, idx === 0 && styles.cardFirst]}>
            <Text style={styles.medal}>{medal ?? `#${idx + 1}`}</Text>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{entry.kid.profile.name}</Text>
                <Text style={styles.score}>
                  {entry.score} {showPoints ? `pts (${pointsToMoney(entry.score)})` : "chores"}
                </Text>
              </View>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${Math.max(pct * 100, 4)}%` as any }]} />
              </View>
              <Text style={styles.subStats}>
                🔥 {entry.streak} day streak · 🏆 {entry.total} total chores
              </Text>
            </View>
          </View>
        );
      })}

      <View style={styles.infoCard}>
        <Text style={styles.infoText}>
          💡 Leaderboard is only visible to parents. Kids do not see this comparison unless you share it with them.
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: Spacing.md, justifyContent: "center" },
  toggleLabel: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textMuted },
  toggleLabelActive: { color: Colors.primary },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 10, ...Shadow.sm },
  cardFirst: { borderWidth: 2, borderColor: "#F59E0B", backgroundColor: "#FFFBEB" },
  medal: { fontSize: 32, width: 40, textAlign: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  name: { flex: 1, fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  score: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary },
  barBg: { height: 8, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: "hidden", marginBottom: 4 },
  barFill: { height: "100%", backgroundColor: Colors.primary, borderRadius: Radius.full },
  subStats: { fontSize: FontSize.xs, color: Colors.textMuted },
  infoCard: { backgroundColor: "#F0F9FF", borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.sm, borderWidth: 1, borderColor: "#BAE6FD" },
  infoText: { fontSize: FontSize.xs, color: "#0369A1", lineHeight: 18 },
  empty: { alignItems: "center", paddingVertical: 48 },
  emptyEmoji: { fontSize: 52, marginBottom: 12 },
  emptyText: { color: Colors.textMuted, textAlign: "center", fontSize: FontSize.base, lineHeight: 24 },
});
