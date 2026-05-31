import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Mascot } from "../../../components/mascot";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { PASTEL_COLORS } from "../../../lib/data/types";
import {
  getTodayUsage, getWeekUsage, getThrivingScore, getThrivingLabel, getStreak, formatMinutes,
} from "../../../lib/data/logic";

function WeekBar({ data, limit }: { data: { date: string; minutes: number }[]; limit: number }) {
  const max = Math.max(...data.map(d => d.minutes), limit, 1);
  const days = ["S","M","T","W","T","F","S"];
  return (
    <View style={bar.row}>
      {data.map((d, i) => {
        const pct = d.minutes / max;
        const over = d.minutes > limit;
        const today = i === data.length - 1;
        return (
          <View key={d.date} style={bar.col}>
            <View style={bar.barBg}>
              <View style={[bar.barFill, {
                height: `${Math.round(pct * 100)}%` as any,
                backgroundColor: over ? Colors.error : today ? Colors.primary : Colors.primary + "60",
              }]} />
            </View>
            <Text style={[bar.label, today && { fontWeight: "800", color: Colors.primary }]}>
              {days[new Date(d.date + "T12:00:00").getDay()]}
            </Text>
            <Text style={bar.mins}>{d.minutes > 0 ? formatMinutes(d.minutes) : "–"}</Text>
          </View>
        );
      })}
    </View>
  );
}

const bar = StyleSheet.create({
  row:    { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 100 },
  col:    { flex: 1, alignItems: "center", gap: 4 },
  barBg:  { flex: 1, width: "100%", backgroundColor: Colors.border, borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
  barFill:{ width: "100%", borderRadius: 4 },
  label:  { fontSize: 11, color: Colors.textSecondary, fontWeight: "600" },
  mins:   { fontSize: 9, color: Colors.textSecondary },
});

function StatPill({ emoji, value, label, color }: { emoji: string; value: string; label: string; color: string }) {
  return (
    <View style={[pill.wrap, { borderColor: color + "40", backgroundColor: color + "10" }]}>
      <Text style={pill.emoji}>{emoji}</Text>
      <Text style={[pill.value, { color }]}>{value}</Text>
      <Text style={pill.label}>{label}</Text>
    </View>
  );
}
const pill = StyleSheet.create({
  wrap:  { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.sm, alignItems: "center", flex: 1 },
  emoji: { fontSize: 22 },
  value: { fontSize: FontSize.lg, fontWeight: "900", marginTop: 2 },
  label: { fontSize: 10, color: Colors.textSecondary, textAlign: "center", marginTop: 2 },
});

export default function WeeklySnapshotScreen() {
  const { state } = useData();
  const router = useRouter();

  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>📊 Weekly Snapshot</Text>
      <Text style={styles.sub}>
        {new Date(weekAgo).toLocaleDateString(undefined, { month: "short", day: "numeric" })} –{" "}
        {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
      </Text>

      {state.kids.length === 0 && (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>👨‍👩‍👧‍👦</Text>
          <Text style={styles.emptyText}>Add kids to see their weekly snapshot</Text>
          <TouchableOpacity onPress={() => router.push("/setup/add-kid" as any)}>
            <Text style={styles.emptyLink}>+ Add a Kid</Text>
          </TouchableOpacity>
        </View>
      )}

      {state.kids.map(kid => {
        const weekData = getWeekUsage(kid);
        const totalMins = weekData.reduce((s, d) => s + d.minutes, 0);
        const avgMins   = Math.round(totalMins / 7);
        const overDays  = weekData.filter(d => d.minutes > kid.rules.dailyLimitMinutes).length;
        const score     = getThrivingScore(kid);
        const thriving  = getThrivingLabel(score);
        const streak    = getStreak(kid);
        const weekChores = kid.chores.filter(c => new Date(c.createdAt) >= weekAgo);
        const doneChores = weekChores.filter(c => c.status === "approved").length;
        const behaviorPts = kid.behavior?.totalPoints ?? 0;
        const pastel = PASTEL_COLORS[kid.profile.color];

        return (
          <View key={kid.profile.id} style={[styles.kidSection, { borderTopColor: pastel }]}>
            {/* Header */}
            <View style={styles.kidHeader}>
              <Mascot type={kid.profile.mascot} size={44} animate={false} />
              <View style={{ flex: 1 }}>
                <Text style={styles.kidName}>{kid.profile.name}</Text>
                <View style={[styles.thrivingBadge, { backgroundColor: thriving.color + "20" }]}>
                  <Text style={[styles.thrivingText, { color: thriving.color }]}>
                    {thriving.emoji} {thriving.label} · {score}/100
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.detailBtn}
                onPress={() => router.push(`/parent/(more)/kid/${kid.profile.id}` as any)}
              >
                <Text style={styles.detailBtnText}>Details →</Text>
              </TouchableOpacity>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <StatPill emoji="⏱️" value={formatMinutes(avgMins)} label="avg/day" color={Colors.primary} />
              <StatPill emoji="🔥" value={`${streak}d`} label="streak" color={Colors.warning} />
              <StatPill emoji="✅" value={`${doneChores}/${weekChores.length}`} label="chores" color={Colors.success} />
              <StatPill emoji="⭐" value={`${behaviorPts}`} label="pts" color={Colors.secondary} />
            </View>

            {/* Bar chart */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Screen Time This Week</Text>
                {overDays > 0 && (
                  <View style={styles.overBadge}>
                    <Text style={styles.overBadgeText}>⚠️ Over limit {overDays}d</Text>
                  </View>
                )}
              </View>
              <WeekBar data={weekData} limit={kid.rules.dailyLimitMinutes} />
              <View style={styles.chartLegend}>
                <View style={styles.legendDot} />
                <Text style={styles.legendText}>Daily limit: {formatMinutes(kid.rules.dailyLimitMinutes)}</Text>
              </View>
            </View>

            {/* Insight card */}
            <View style={[styles.insightCard, { borderLeftColor: thriving.color }]}>
              <Text style={styles.insightTitle}>💡 This Week's Insight</Text>
              <Text style={styles.insightText}>
                {score >= 85
                  ? `${kid.profile.name} is having a fantastic week! ${streak > 3 ? `${streak}-day streak — keep it up!` : "Great behavior and chore completion."}`
                  : score >= 65
                  ? `${kid.profile.name} is doing well. ${overDays > 0 ? `Went over screen time ${overDays} day${overDays > 1 ? "s" : ""} this week.` : "Screen time is on track."}`
                  : score >= 45
                  ? `${kid.profile.name} could use some extra encouragement. ${doneChores === 0 ? "No chores completed this week — try setting smaller tasks." : "Chores are being done, keep reinforcing positive behavior."}`
                  : `${kid.profile.name} might need a check-in. Consider a one-on-one conversation about screen time and responsibilities.`}
              </Text>
            </View>
          </View>
        );
      })}

      {/* Family total */}
      {state.kids.length > 1 && (
        <View style={styles.familyTotal}>
          <Text style={styles.familyTotalTitle}>👨‍👩‍👧‍👦 Family This Week</Text>
          <Text style={styles.familyTotalValue}>
            {formatMinutes(state.kids.reduce((s, k) => s + getWeekUsage(k).reduce((a, d) => a + d.minutes, 0), 0))} total screen time
          </Text>
          <Text style={styles.familyTotalSub}>
            Avg thriving score: {Math.round(state.kids.reduce((s, k) => s + getThrivingScore(k), 0) / state.kids.length)}/100
          </Text>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  sub:   { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg },

  emptyWrap: { alignItems: "center", paddingVertical: Spacing.xl, gap: 12 },
  emptyEmoji: { fontSize: 56 },
  emptyText: { color: Colors.textSecondary, fontSize: FontSize.base, textAlign: "center" },
  emptyLink: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.base },

  kidSection: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: Spacing.md, borderTopWidth: 4, ...Shadow.sm, gap: Spacing.md,
  },
  kidHeader:  { flexDirection: "row", alignItems: "center", gap: 12 },
  kidName:    { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },
  thrivingBadge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4, alignSelf: "flex-start" },
  thrivingText:  { fontSize: 11, fontWeight: "700" },
  detailBtn:     { backgroundColor: Colors.primary + "15", borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 8 },
  detailBtnText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.sm },

  statsRow: { flexDirection: "row", gap: 8 },

  chartCard:   { backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: Spacing.sm, gap: Spacing.sm },
  chartHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chartTitle:  { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  overBadge:   { backgroundColor: Colors.error + "20", borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  overBadgeText: { fontSize: 10, fontWeight: "700", color: Colors.error },
  chartLegend: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  legendDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  legendText:  { fontSize: 10, color: Colors.textSecondary },

  insightCard:  { backgroundColor: Colors.primary + "08", borderRadius: Radius.lg, padding: Spacing.sm, borderLeftWidth: 3 },
  insightTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary, marginBottom: 4 },
  insightText:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  familyTotal: {
    backgroundColor: Colors.primary, borderRadius: Radius.xl,
    padding: Spacing.lg, alignItems: "center", marginBottom: Spacing.xl, gap: 4,
  },
  familyTotalTitle: { color: "#fff", fontWeight: "800", fontSize: FontSize.lg },
  familyTotalValue: { color: "#fff", fontSize: FontSize.xl, fontWeight: "900" },
  familyTotalSub:   { color: "rgba(255,255,255,0.7)", fontSize: FontSize.sm },
});
