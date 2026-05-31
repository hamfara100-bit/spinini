import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

function shortDay(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" });
}

function getScreenMinutesForDay(kid: any, date: string): number {
  const day = kid.usage.find((u: any) => u.date === date);
  return day?.totalMinutes ?? 0;
}

function getChoresApprovedOnDay(kid: any, date: string): number {
  return kid.chores.filter((c: any) =>
    c.status === "approved" &&
    c.approvals?.some((a: any) => a.reviewedAt?.startsWith(date))
  ).length;
}

function getBehaviorPointsOnDay(kid: any, date: string): number {
  return (kid.behavior.events ?? [])
    .filter((e: any) => e.date === date)
    .reduce((sum: number, e: any) => sum + e.points, 0);
}

export default function BehaviorInsightsScreen() {
  const { state } = useData();
  const [selectedKidId, setSelectedKidId] = useState(state.kids[0]?.profile.id ?? "");

  const kid = state.kids.find(k => k.profile.id === selectedKidId);
  const days = getLast7Days();

  if (!kid) return null;

  const dayData = days.map(date => ({
    date,
    label: shortDay(date),
    screenMins: getScreenMinutesForDay(kid, date),
    chores: getChoresApprovedOnDay(kid, date),
    points: getBehaviorPointsOnDay(kid, date),
  }));

  const maxScreen = Math.max(...dayData.map(d => d.screenMins), 60);
  const maxChores = Math.max(...dayData.map(d => d.chores), 1);

  // Correlation: days with more chores → less or more screen time?
  const choreDays = dayData.filter(d => d.chores > 0);
  const noCoreDays = dayData.filter(d => d.chores === 0);
  const avgScreenWithChores = choreDays.length > 0
    ? choreDays.reduce((s, d) => s + d.screenMins, 0) / choreDays.length
    : 0;
  const avgScreenWithout = noCoreDays.length > 0
    ? noCoreDays.reduce((s, d) => s + d.screenMins, 0) / noCoreDays.length
    : 0;
  const diff = avgScreenWithChores - avgScreenWithout;

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>📊 Behavior Insights</Text>
      <Text style={styles.sub}>See patterns between chores, screen time, and behavior points.</Text>

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

      {/* Correlation insight */}
      {choreDays.length > 0 && noCoreDays.length > 0 && (
        <View style={[styles.insightCard, { borderColor: diff > 10 ? Colors.error : Colors.success }]}>
          <Text style={styles.insightEmoji}>{diff > 10 ? "🤔" : diff < -10 ? "🎉" : "😐"}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.insightTitle}>
              {diff > 10
                ? "Chore days = more screen time"
                : diff < -10
                ? "Chore days = less screen time 🎉"
                : "No clear screen time pattern"}
            </Text>
            <Text style={styles.insightSub}>
              {`On chore days: avg ${Math.round(avgScreenWithChores)}m · Without chores: avg ${Math.round(avgScreenWithout)}m`}
            </Text>
          </View>
        </View>
      )}

      {/* Daily chart */}
      <Text style={styles.sectionLabel}>LAST 7 DAYS — SCREEN TIME (bars) & CHORES (dots)</Text>
      <View style={styles.chart}>
        {dayData.map(d => {
          const screenPct = maxScreen > 0 ? d.screenMins / maxScreen : 0;
          const chorePct = maxChores > 0 ? d.chores / maxChores : 0;
          return (
            <View key={d.date} style={styles.chartCol}>
              <View style={styles.chartBars}>
                <View style={[styles.screenBar, { height: Math.max(screenPct * 80, 4) }]} />
                <View style={[styles.choreBar, { height: Math.max(chorePct * 80, d.chores > 0 ? 8 : 4) }]} />
              </View>
              <Text style={styles.chartLabel}>{d.label}</Text>
              <Text style={styles.chartMins}>{d.screenMins > 0 ? `${d.screenMins}m` : "—"}</Text>
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.primary }]} /><Text style={styles.legendLabel}>Screen time</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.success }]} /><Text style={styles.legendLabel}>Chores done</Text></View>
      </View>

      {/* Per-day breakdown */}
      <Text style={styles.sectionLabel}>DAILY BREAKDOWN</Text>
      {dayData.map(d => (
        <View key={d.date} style={styles.dayCard}>
          <Text style={styles.dayLabel}>{d.label}</Text>
          <View style={styles.dayStats}>
            <View style={styles.dayStat}>
              <Text style={styles.dayStatValue}>{d.screenMins}</Text>
              <Text style={styles.dayStatLabel}>min screen</Text>
            </View>
            <View style={styles.dayStat}>
              <Text style={[styles.dayStatValue, { color: Colors.success }]}>{d.chores}</Text>
              <Text style={styles.dayStatLabel}>chores</Text>
            </View>
            <View style={styles.dayStat}>
              <Text style={[styles.dayStatValue, { color: d.points >= 0 ? Colors.primary : Colors.error }]}>{d.points > 0 ? `+${d.points}` : d.points}</Text>
              <Text style={styles.dayStatLabel}>pts</Text>
            </View>
          </View>
        </View>
      ))}

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
  insightCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 2, ...Shadow.sm },
  insightEmoji: { fontSize: 32 },
  insightTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  insightSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 120, paddingBottom: 32, marginBottom: Spacing.sm },
  chartCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" },
  chartBars: { flexDirection: "row", alignItems: "flex-end", gap: 2, width: "100%", justifyContent: "center" },
  screenBar: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.sm, opacity: 0.8 },
  choreBar: { flex: 1, backgroundColor: Colors.success, borderRadius: Radius.sm },
  chartLabel: { fontSize: 9, color: Colors.textMuted, marginTop: 4, textAlign: "center" },
  chartMins: { fontSize: 9, color: Colors.primary, fontWeight: "600", textAlign: "center" },
  legend: { flexDirection: "row", gap: 16, marginBottom: Spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  dayCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: 12, marginBottom: 8, ...Shadow.sm },
  dayLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, width: 36 },
  dayStats: { flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: 20 },
  dayStat: { alignItems: "center" },
  dayStatValue: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  dayStatLabel: { fontSize: 9, color: Colors.textMuted },
});
