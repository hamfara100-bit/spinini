import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { POINT_VALUE } from "../../../../lib/utils";
import { aggregateAppUsage, aggregateFeatureTaps, daysAgoDate } from "../../../../lib/usage-tracker";
import { formatMinutes } from "../../../../lib/data/logic";

type Tab = "earnings" | "usage";
type Period = "week" | "month" | "all";

function periodSince(p: Period): string {
  if (p === "week")  return daysAgoDate(7);
  if (p === "month") return daysAgoDate(30);
  return "1970-01-01";
}

function periodLabel(p: Period) {
  return p === "week" ? "Last 7 Days" : p === "month" ? "Last 30 Days" : "All Time";
}

function BarRow({ label, emoji, value, maxValue, color, rightText }: {
  label: string; emoji?: string; value: number; maxValue: number; color: string; rightText: string;
}) {
  const pct = maxValue > 0 ? Math.min(1, value / maxValue) : 0;
  return (
    <View style={s.barRow}>
      <View style={s.barLabelRow}>
        {emoji ? <Text style={{ fontSize: 16, marginRight: 6 }}>{emoji}</Text> : null}
        <Text style={s.barLabel} numberOfLines={1}>{label}</Text>
        <Text style={s.barRight}>{rightText}</Text>
      </View>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function KidMyReportsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const kid = useKid(id);
  const [tab, setTab]       = useState<Tab>("earnings");
  const [period, setPeriod] = useState<Period>("month");

  if (!kid) return null;
  const since = periodSince(period);

  // ── Earnings data ──────────────────────────────────────────────────────────
  const approvedChores = kid.chores.filter(c =>
    c.status === "approved" &&
    c.approvals.some(a => a.kidId === id && a.reviewedAt >= since)
  );
  const chorePoints = approvedChores.reduce((sum, c) =>
    sum + (c.approvals.find(a => a.kidId === id)?.awardedPoints ?? c.points), 0
  );
  const choreCash = approvedChores.reduce((sum, c) =>
    sum + (c.approvals.find(a => a.kidId === id)?.awardedCash ?? 0), 0
  );

  const behaviorBonuses = (kid.behavior?.events ?? []).filter(e => e.points > 0 && e.date >= since);
  const behaviorPoints  = behaviorBonuses.reduce((sum, e) => sum + e.points, 0);

  const allowanceTxns = (kid.money?.transactions ?? []).filter(t =>
    t.type === "auto-earn" && t.date >= since
  );
  const allowanceTotal = allowanceTxns.reduce((sum, t) => sum + t.amount, 0);

  const payouts = (kid.pointPayouts ?? []).filter(p => p.date >= since);
  const payoutTotal = payouts.reduce((sum, p) => sum + p.amount, 0);

  const totalEarnings = chorePoints * POINT_VALUE + choreCash + behaviorPoints * POINT_VALUE + allowanceTotal + payoutTotal;

  // ── Usage data ────────────────────────────────────────────────────────────
  const filteredUsage = kid.usage.filter(u => u.date >= since);
  const totalMinutes  = filteredUsage.reduce((s, d) => s + d.totalMinutes, 0);
  const days          = filteredUsage.length || 1;
  const avgMinutes    = Math.round(totalMinutes / days);
  const apps          = useMemo(() => aggregateAppUsage(kid.usage, since).slice(0, 8), [kid.usage, since]);
  const features      = useMemo(() => aggregateFeatureTaps(kid.usage, since).slice(0, 6), [kid.usage, since]);
  const maxApp        = apps[0]?.minutes ?? 1;
  const maxFeat       = features[0]?.count ?? 1;

  const APP_COLORS  = [Colors.primary, "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];
  const FEAT_COLORS = ["#8B5CF6", "#F59E0B", "#10B981", "#EF4444", Colors.primary, "#EC4899"];

  return (
    <ScreenContainer scroll>
      <Text style={s.title}>📊 My Reports</Text>

      {/* Tabs */}
      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tab, tab === "earnings" && s.tabActive]} onPress={() => setTab("earnings")}>
          <Text style={[s.tabText, tab === "earnings" && s.tabTextActive]}>⭐ My Earnings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === "usage" && s.tabActive]} onPress={() => setTab("usage")}>
          <Text style={[s.tabText, tab === "usage" && s.tabTextActive]}>📊 My Usage</Text>
        </TouchableOpacity>
      </View>

      {/* Period chips */}
      <View style={s.periodRow}>
        {(["week","month","all"] as Period[]).map(p => (
          <TouchableOpacity key={p} style={[s.periodChip, period === p && s.periodChipActive]} onPress={() => setPeriod(p)}>
            <Text style={[s.periodChipText, period === p && s.periodChipTextActive]}>{periodLabel(p)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── EARNINGS TAB ── */}
      {tab === "earnings" && (
        <>
          {/* Hero total */}
          <View style={s.heroCard}>
            <Text style={s.heroEmoji}>🏆</Text>
            <Text style={s.heroLabel}>Total Earnings</Text>
            <Text style={s.heroAmt}>${totalEarnings.toFixed(2)}</Text>
            <Text style={s.heroPeriod}>{periodLabel(period)}</Text>
            <View style={s.heroBreak}>
              <View style={s.heroBreakItem}>
                <Text style={s.heroBreakEmoji}>🧹</Text>
                <Text style={s.heroBreakAmt}>{chorePoints} pts</Text>
                <Text style={s.heroBreakLabel}>Chores</Text>
              </View>
              <View style={s.heroBreakItem}>
                <Text style={s.heroBreakEmoji}>🌟</Text>
                <Text style={s.heroBreakAmt}>{behaviorPoints} pts</Text>
                <Text style={s.heroBreakLabel}>Behavior</Text>
              </View>
              <View style={s.heroBreakItem}>
                <Text style={s.heroBreakEmoji}>💵</Text>
                <Text style={s.heroBreakAmt}>${allowanceTotal.toFixed(2)}</Text>
                <Text style={s.heroBreakLabel}>Allowance</Text>
              </View>
              <View style={s.heroBreakItem}>
                <Text style={s.heroBreakEmoji}>💳</Text>
                <Text style={s.heroBreakAmt}>${payoutTotal.toFixed(2)}</Text>
                <Text style={s.heroBreakLabel}>Paid Out</Text>
              </View>
            </View>
          </View>

          {/* Approved chores */}
          {approvedChores.length > 0 ? (
            <View style={s.card}>
              <Text style={s.sectionTitle}>🧹 Chores I Completed</Text>
              {approvedChores.slice(0, 10).map(c => {
                const approval = c.approvals.find(a => a.kidId === id);
                const pts = approval?.awardedPoints ?? c.points;
                const cash = approval?.awardedCash ?? 0;
                return (
                  <View key={c.id} style={s.listRow}>
                    <View style={[s.listDot, { backgroundColor: Colors.success }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.listTitle}>{c.title}</Text>
                      <Text style={s.listSub}>{approval?.reviewedAt ? new Date(approval.reviewedAt).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={s.listAmt}>+{pts} ⭐</Text>
                      {cash > 0 && <Text style={s.listAmtCash}>+${cash.toFixed(2)}</Text>}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={s.emptyCard}>
              <Text style={s.emptyEmoji}>🧹</Text>
              <Text style={s.emptyTitle}>No chores completed yet</Text>
              <Text style={s.emptySub}>Complete chores to earn points!</Text>
            </View>
          )}

          {/* Behavior bonuses */}
          {behaviorBonuses.length > 0 && (
            <View style={s.card}>
              <Text style={s.sectionTitle}>🌟 Behavior Bonuses</Text>
              {behaviorBonuses.slice(0, 8).map(e => (
                <View key={e.id} style={s.listRow}>
                  <View style={[s.listDot, { backgroundColor: "#F59E0B" }]} />
                  <Text style={[s.listTitle, { flex: 1 }]}>{e.reason}</Text>
                  <Text style={s.listAmt}>+{e.points} ⭐</Text>
                </View>
              ))}
            </View>
          )}

          {/* Allowance */}
          {allowanceTxns.length > 0 && (
            <View style={s.card}>
              <Text style={s.sectionTitle}>💵 Allowance Received</Text>
              {allowanceTxns.map((t, i) => (
                <View key={i} style={s.listRow}>
                  <View style={[s.listDot, { backgroundColor: "#10B981" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.listTitle}>{t.description || "Allowance"}</Text>
                    <Text style={s.listSub}>{new Date(t.date).toLocaleDateString([], { month: "short", day: "numeric" })}</Text>
                  </View>
                  <Text style={s.listAmtCash}>+${t.amount.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* All zero empty state */}
          {totalEarnings === 0 && approvedChores.length === 0 && behaviorBonuses.length === 0 && (
            <View style={s.emptyCard}>
              <Text style={s.emptyEmoji}>⭐</Text>
              <Text style={s.emptyTitle}>No earnings yet this period</Text>
              <Text style={s.emptySub}>Complete chores, earn behavior bonuses, or get allowance to see your earnings here!</Text>
            </View>
          )}
        </>
      )}

      {/* ── USAGE TAB ── */}
      {tab === "usage" && (
        <>
          {/* Summary */}
          <View style={s.usageSummary}>
            <View style={s.usageStat}>
              <Text style={s.usageStatNum}>{formatMinutes(totalMinutes)}</Text>
              <Text style={s.usageStatLabel}>Total Time</Text>
            </View>
            <View style={[s.usageStat, { borderLeftWidth: 1, borderLeftColor: "#ffffff44" }]}>
              <Text style={s.usageStatNum}>{formatMinutes(avgMinutes)}</Text>
              <Text style={s.usageStatLabel}>Daily Avg</Text>
            </View>
            <View style={[s.usageStat, { borderLeftWidth: 1, borderLeftColor: "#ffffff44" }]}>
              <Text style={s.usageStatNum}>{filteredUsage.length}</Text>
              <Text style={s.usageStatLabel}>Days Tracked</Text>
            </View>
          </View>

          {/* Top apps */}
          {apps.length > 0 ? (
            <View style={s.card}>
              <Text style={s.sectionTitle}>📱 My Top Apps</Text>
              {apps.map((app, i) => (
                <BarRow
                  key={app.appId}
                  label={app.appName}
                  emoji={app.appEmoji}
                  value={app.minutes}
                  maxValue={maxApp}
                  color={APP_COLORS[i % APP_COLORS.length]}
                  rightText={formatMinutes(app.minutes)}
                />
              ))}
            </View>
          ) : (
            <View style={s.emptyCard}>
              <Text style={s.emptyEmoji}>📱</Text>
              <Text style={s.emptyTitle}>No app data yet</Text>
              <Text style={s.emptySub}>Your app usage will show up here as you use your phone.</Text>
            </View>
          )}

          {/* Features used */}
          {features.length > 0 && (
            <View style={s.card}>
              <Text style={s.sectionTitle}>🎮 Features I Use Most</Text>
              {features.map((f, i) => (
                <BarRow
                  key={f.featureId}
                  label={f.featureName}
                  emoji={f.featureEmoji}
                  value={f.count}
                  maxValue={maxFeat}
                  color={FEAT_COLORS[i % FEAT_COLORS.length]}
                  rightText={`${f.count}×`}
                />
              ))}
            </View>
          )}

          {/* 7-day mini chart */}
          {filteredUsage.length > 0 && (
            <View style={s.card}>
              <Text style={s.sectionTitle}>📅 Daily Screen Time</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.miniChart}>
                  {filteredUsage.slice(-14).map(d => {
                    const pct = Math.min(1, d.totalMinutes / Math.max(...filteredUsage.map(u => u.totalMinutes), 1));
                    const dayLabel = new Date(d.date + "T12:00:00").toLocaleDateString([], { weekday: "short" });
                    return (
                      <View key={d.date} style={s.miniBar}>
                        <Text style={s.miniBarMins}>{d.totalMinutes > 0 ? `${d.totalMinutes}m` : ""}</Text>
                        <View style={[s.miniBarFill, { height: Math.max(4, pct * 80), backgroundColor: Colors.primary }]} />
                        <Text style={s.miniBarLabel}>{dayLabel}</Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.sm },
  tabBar: { flexDirection: "row", gap: 0, backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: 3, marginBottom: Spacing.sm },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: Radius.md },
  tabActive: { backgroundColor: "#fff", ...Shadow.sm },
  tabText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textMuted },
  tabTextActive: { color: Colors.primary },

  periodRow: { flexDirection: "row", gap: 8, marginBottom: Spacing.md },
  periodChip: { flex: 1, alignItems: "center", paddingVertical: 8, backgroundColor: Colors.cardLight, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border },
  periodChipActive: { backgroundColor: Colors.primary + "20", borderColor: Colors.primary },
  periodChipText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  periodChipTextActive: { color: Colors.primary },

  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm },
  sectionTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary, marginBottom: Spacing.sm },

  heroCard: {
    backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: Spacing.lg,
    alignItems: "center", marginBottom: Spacing.md, ...Shadow.md,
  },
  heroEmoji: { fontSize: 40, marginBottom: 4 },
  heroLabel: { fontSize: FontSize.sm, color: "#ffffff99", fontWeight: "600" },
  heroAmt: { fontSize: 44, fontWeight: "900", color: "#fff", marginVertical: 4 },
  heroPeriod: { fontSize: FontSize.xs, color: "#ffffff88", marginBottom: Spacing.sm },
  heroBreak: { flexDirection: "row", gap: 0, width: "100%" },
  heroBreakItem: { flex: 1, alignItems: "center", gap: 2 },
  heroBreakEmoji: { fontSize: 20 },
  heroBreakAmt: { fontSize: FontSize.sm, fontWeight: "800", color: "#fff" },
  heroBreakLabel: { fontSize: 10, color: "#ffffff88" },

  listRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  listDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  listTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  listSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  listAmt: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primary },
  listAmtCash: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.success },

  emptyCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: "center", gap: 8, marginBottom: Spacing.md, ...Shadow.sm },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },

  usageSummary: {
    flexDirection: "row", backgroundColor: Colors.primary, borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.md,
  },
  usageStat: { flex: 1, alignItems: "center" },
  usageStatNum: { fontSize: FontSize.xl, fontWeight: "800", color: "#fff" },
  usageStatLabel: { fontSize: FontSize.xs, color: "#ffffff99", marginTop: 2 },

  barRow: { marginBottom: 12 },
  barLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  barLabel: { flex: 1, fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary },
  barRight: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: "600" },
  barTrack: { height: 8, backgroundColor: Colors.cardLight, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4, minWidth: 4 },

  miniChart: { flexDirection: "row", alignItems: "flex-end", height: 110, gap: 8, paddingBottom: 20 },
  miniBar: { alignItems: "center", justifyContent: "flex-end", width: 36, gap: 2 },
  miniBarFill: { width: 28, borderRadius: 4 },
  miniBarMins: { fontSize: 9, color: Colors.textSecondary },
  miniBarLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: "600", position: "absolute", bottom: 0 },
});
