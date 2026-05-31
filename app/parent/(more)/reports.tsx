import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert,
} from "react-native";
import * as MailComposer from "expo-mail-composer";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { getWeekUsage, formatMinutes } from "../../../lib/data/logic";
import {
  aggregateAppUsage, aggregateWebUsage, aggregateFeatureTaps, aggregateHourly,
  daysAgoDate, fmtDuration,
} from "../../../lib/usage-tracker";
import { POINT_VALUE, pointsToMoney } from "../../../lib/utils";
import type { KidState } from "../../../lib/data/types";

const W = Dimensions.get("window").width - 48;

// ─── Period picker ────────────────────────────────────────────────────────────
type Period = "today" | "week" | "month";
const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week",  label: "7 Days" },
  { id: "month", label: "30 Days" },
];

function periodSince(p: Period): string {
  if (p === "today") return new Date().toISOString().split("T")[0];
  if (p === "week")  return daysAgoDate(7);
  return daysAgoDate(30);
}

// ─── Report tabs ──────────────────────────────────────────────────────────────
type Tab = "screentime" | "apps" | "timeofday" | "web" | "features" | "spending" | "mood";
const TABS: { id: Tab; emoji: string; label: string }[] = [
  { id: "screentime", emoji: "📊", label: "Screen Time" },
  { id: "apps",       emoji: "📱", label: "Apps" },
  { id: "timeofday",  emoji: "🕐", label: "Time of Day" },
  { id: "web",        emoji: "🌐", label: "Websites" },
  { id: "features",   emoji: "🎮", label: "Features" },
  { id: "spending",   emoji: "💰", label: "Spending" },
  { id: "mood",       emoji: "😊", label: "Mood" },
];

// ─── Small helpers ────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[s.card, style]}>{children}</View>;
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={{ marginBottom: Spacing.sm }}>
      <Text style={s.sectionTitle}>{title}</Text>
      {sub ? <Text style={s.sectionSub}>{sub}</Text> : null}
    </View>
  );
}

function BarRow({
  label, emoji, value, maxValue, color, rightText,
}: {
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

// ─── Screen Time Tab ──────────────────────────────────────────────────────────
function ScreenTimeTab({ kid, period }: { kid: KidState; period: Period }) {
  const weekData = getWeekUsage(kid);
  const since    = periodSince(period);
  const filtered = kid.usage.filter(u => u.date >= since);

  const total   = filtered.reduce((s, d) => s + d.totalMinutes, 0);
  const days    = filtered.length || 1;
  const avg     = Math.round(total / days);
  const limit   = kid.rules.dailyLimitMinutes;
  const overDays = filtered.filter(d => d.totalMinutes > limit).length;
  // Use weekly chart always (7 days)
  const maxMins = Math.max(...weekData.map((d: any) => d.minutes), 1);

  return (
    <>
      {/* Stats row */}
      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={s.statNum}>{formatMinutes(total)}</Text>
          <Text style={s.statLabel}>Total</Text>
        </View>
        <View style={[s.statBox, { borderLeftWidth: 1, borderColor: Colors.border }]}>
          <Text style={s.statNum}>{formatMinutes(avg)}</Text>
          <Text style={s.statLabel}>Daily Avg</Text>
        </View>
        <View style={[s.statBox, { borderLeftWidth: 1, borderColor: Colors.border }]}>
          <Text style={[s.statNum, overDays > 0 && { color: Colors.error }]}>{overDays}d</Text>
          <Text style={s.statLabel}>Over Limit</Text>
        </View>
      </View>

      {/* 7-day bar chart */}
      <Card>
        <SectionTitle title="📅 This Week" sub="Daily screen time vs limit" />
        <View style={s.chartArea}>
          {weekData.map((d: any) => {
            const pct = Math.min(1, d.minutes / Math.max(maxMins, limit));
            const overLimit = d.minutes > limit;
            return (
              <View key={d.date} style={s.chartBar}>
                <Text style={s.chartBarMins}>{d.minutes > 0 ? `${d.minutes}m` : ""}</Text>
                <View style={[
                  s.chartFill,
                  {
                    height: Math.max(4, pct * 120),
                    backgroundColor: overLimit ? Colors.error : Colors.primary,
                  },
                ]} />
                <Text style={s.chartBarLabel}>{d.label}</Text>
              </View>
            );
          })}
        </View>
        {/* Limit line label */}
        <View style={s.limitLine}>
          <View style={{ flex: 1, height: 1, backgroundColor: Colors.warning + "88" }} />
          <Text style={s.limitLabel}>⏱ {limit}m limit</Text>
        </View>
      </Card>

      {/* Insight cards */}
      <View style={s.insightRow}>
        <View style={[s.insightCard, { backgroundColor: "#EDE9FE" }]}>
          <Text style={s.insightEmoji}>📈</Text>
          <Text style={s.insightNum}>{total > 0 ? Math.round((total / (days * limit)) * 100) : 0}%</Text>
          <Text style={s.insightLabel}>Limit used</Text>
        </View>
        <View style={[s.insightCard, { backgroundColor: overDays > 2 ? "#FEE2E2" : "#D1FAE5" }]}>
          <Text style={s.insightEmoji}>{overDays > 2 ? "⚠️" : "✅"}</Text>
          <Text style={s.insightNum}>{overDays > 2 ? "High" : "Good"}</Text>
          <Text style={s.insightLabel}>Usage pattern</Text>
        </View>
      </View>
    </>
  );
}

// ─── Apps Tab ─────────────────────────────────────────────────────────────────
function AppsTab({ kid, period }: { kid: KidState; period: Period }) {
  const since = periodSince(period);
  const apps  = useMemo(() => aggregateAppUsage(kid.usage, since), [kid.usage, since]);
  const max   = apps[0]?.minutes ?? 1;

  // Also pull real app data from usage stats module if available
  const COLORS = [Colors.primary, "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#EC4899"];

  if (apps.length === 0) {
    return (
      <Card>
        <View style={s.emptyState}>
          <Text style={{ fontSize: 40 }}>📱</Text>
          <Text style={s.emptyTitle}>No app usage yet</Text>
          <Text style={s.emptySub}>Usage is tracked when the kid opens apps through the app screen.</Text>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle title="📱 App Usage" sub={`Top apps — ${period === "today" ? "today" : period === "week" ? "last 7 days" : "last 30 days"}`} />
      {apps.slice(0, 10).map((app, i) => (
        <BarRow
          key={app.appId}
          label={app.appName}
          emoji={app.appEmoji}
          value={app.minutes}
          maxValue={max}
          color={COLORS[i % COLORS.length]}
          rightText={`${formatMinutes(app.minutes)} · ${app.sessions}x`}
        />
      ))}
    </Card>
  );
}

// ─── Time of Day Tab ──────────────────────────────────────────────────────────
const HOUR_SEGMENTS = [
  { label: "🌅 Morning",   emoji: "🌅", start: 5,  end: 12, color: "#F59E0B" },
  { label: "☀️ Afternoon", emoji: "☀️", start: 12, end: 17, color: "#10B981" },
  { label: "🌆 Evening",   emoji: "🌆", start: 17, end: 22, color: "#8B5CF6" },
  { label: "🌙 Night",     emoji: "🌙", start: 22, end: 29, color: "#3B82F6" }, // 22–23 + 0–4 (wraps)
];

function hourLabel(h: number): string {
  const hr = ((h % 24) + 24) % 24;
  if (hr === 0) return "12a";
  if (hr === 12) return "12p";
  return hr < 12 ? `${hr}a` : `${hr - 12}p`;
}

function TimeOfDayTab({ kid, period }: { kid: KidState; period: Period }) {
  const since   = periodSince(period);
  const hourly  = useMemo(() => aggregateHourly(kid.usage, since), [kid.usage, since]);
  const total   = hourly.reduce((s, m) => s + m, 0);
  const max     = Math.max(...hourly, 1);

  if (total === 0) {
    return (
      <Card>
        <View style={s.emptyState}>
          <Text style={{ fontSize: 40 }}>🕐</Text>
          <Text style={s.emptyTitle}>No time-of-day data yet</Text>
          <Text style={s.emptySub}>Once {kid.profile.name} uses apps, you'll see which hours of the day they're most active.</Text>
        </View>
      </Card>
    );
  }

  // Peak hour
  const peakHour = hourly.indexOf(Math.max(...hourly));

  // Segment totals (Night wraps past midnight)
  const segTotals = HOUR_SEGMENTS.map(seg => {
    let sum = 0;
    for (let h = seg.start; h < seg.end; h++) sum += hourly[h % 24] ?? 0;
    return { ...seg, minutes: sum };
  });
  const busiestSeg = segTotals.reduce((a, b) => (b.minutes > a.minutes ? b : a), segTotals[0]);
  const maxSeg = Math.max(...segTotals.map(x => x.minutes), 1);

  return (
    <>
      {/* Peak callout */}
      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={s.statNum}>{hourLabel(peakHour)}</Text>
          <Text style={s.statLabel}>Peak Hour</Text>
        </View>
        <View style={[s.statBox, { borderLeftWidth: 1, borderColor: Colors.border }]}>
          <Text style={s.statNum}>{busiestSeg.emoji}</Text>
          <Text style={s.statLabel}>{busiestSeg.label.replace(/^.\s?/, "")}</Text>
        </View>
        <View style={[s.statBox, { borderLeftWidth: 1, borderColor: Colors.border }]}>
          <Text style={s.statNum}>{formatMinutes(total)}</Text>
          <Text style={s.statLabel}>Total</Text>
        </View>
      </View>

      {/* 24-hour chart */}
      <Card>
        <SectionTitle title="🕐 Activity by Hour" sub={`When ${kid.profile.name} uses their device`} />
        <View style={todS.chart}>
          {hourly.map((m, h) => {
            const pct = Math.min(1, m / max);
            const isPeak = h === peakHour && m > 0;
            return (
              <View key={h} style={todS.col}>
                <View style={[
                  todS.bar,
                  { height: Math.max(2, pct * 110), backgroundColor: isPeak ? Colors.error : Colors.primary },
                ]} />
                {h % 3 === 0 ? <Text style={todS.hourLabel}>{hourLabel(h)}</Text> : <Text style={todS.hourLabel}> </Text>}
              </View>
            );
          })}
        </View>
      </Card>

      {/* Segments */}
      <Card>
        <SectionTitle title="🌗 Parts of the Day" sub="Total activity in each window" />
        {segTotals.map((seg, i) => (
          <BarRow
            key={seg.label}
            label={seg.label}
            value={seg.minutes}
            maxValue={maxSeg}
            color={seg.color}
            rightText={formatMinutes(seg.minutes)}
          />
        ))}
      </Card>
    </>
  );
}

// ─── Website Tab ──────────────────────────────────────────────────────────────
function WebTab({ kid, period }: { kid: KidState; period: Period }) {
  const since = periodSince(period);
  const sites = useMemo(() => aggregateWebUsage(kid.usage, since), [kid.usage, since]);
  const max   = sites[0]?.totalSeconds ?? 1;

  const COLORS = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EC4899", "#14B8A6"];

  if (sites.length === 0) {
    return (
      <Card>
        <View style={s.emptyState}>
          <Text style={{ fontSize: 40 }}>🌐</Text>
          <Text style={s.emptyTitle}>No website visits yet</Text>
          <Text style={s.emptySub}>Time is tracked automatically when {kid.profile.name} visits approved websites.</Text>
        </View>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <SectionTitle title="🌐 Website Time" sub="Time spent on each approved site" />
        {sites.slice(0, 10).map((site, i) => (
          <BarRow
            key={site.domain}
            label={site.title || site.domain}
            emoji="🌐"
            value={site.totalSeconds}
            maxValue={max}
            color={COLORS[i % COLORS.length]}
            rightText={`${fmtDuration(site.totalSeconds)} · ${site.visits}x`}
          />
        ))}
      </Card>

      {/* Visit log */}
      <Card style={{ marginTop: 12 }}>
        <SectionTitle title="📋 Recent Visits" />
        {(kid.usage
          .filter(u => u.date >= since)
          .flatMap(u => u.visitedUrls ?? [])
          .slice(-20)
          .reverse()
        ).map((v, i) => {
          let domain = v.url;
          try { domain = new URL(v.url).hostname.replace(/^www\./, ""); } catch {}
          return (
            <View key={i} style={s.visitRow}>
              <Text style={s.visitDomain} numberOfLines={1}>{domain}</Text>
              <View style={s.visitMeta}>
                <Text style={s.visitTime}>{fmtDuration(v.durationSeconds)}</Text>
                <Text style={s.visitDate}>{new Date(v.visitedAt).toLocaleDateString([], { month: "short", day: "numeric" })}</Text>
              </View>
            </View>
          );
        })}
      </Card>
    </>
  );
}

// ─── Features Tab ─────────────────────────────────────────────────────────────
function FeaturesTab({ kid, period }: { kid: KidState; period: Period }) {
  const since    = periodSince(period);
  const features = useMemo(() => aggregateFeatureTaps(kid.usage, since), [kid.usage, since]);
  const max      = features[0]?.count ?? 1;
  const COLORS   = [Colors.primary, "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#EC4899"];

  if (features.length === 0) {
    return (
      <Card>
        <View style={s.emptyState}>
          <Text style={{ fontSize: 40 }}>🎮</Text>
          <Text style={s.emptyTitle}>No feature data yet</Text>
          <Text style={s.emptySub}>Feature taps are counted as {kid.profile.name} uses different parts of the app.</Text>
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle title="🎮 Feature Usage" sub="Most-used buttons & features" />
      {features.slice(0, 10).map((feat, i) => (
        <BarRow
          key={feat.featureId}
          label={feat.featureName}
          emoji={feat.featureEmoji}
          value={feat.count}
          maxValue={max}
          color={COLORS[i % COLORS.length]}
          rightText={`${feat.count}×`}
        />
      ))}
    </Card>
  );
}

// ─── Mood Tab ─────────────────────────────────────────────────────────────────
const MOOD_EMOJI = ["", "😢", "😕", "😐", "😊", "😄"] as const;
const MOOD_COLOR = ["", "#EF4444", "#F97316", "#FACC15", "#34D399", "#10B981"] as const;
const MOOD_LABEL = ["", "Terrible", "Bad", "Okay", "Good", "Great"] as const;

function MoodTab({ kid, period }: { kid: KidState; period: Period }) {
  const since = periodSince(period);
  const entries = useMemo(
    () => (kid.moodEntries ?? []).filter(e => e.date >= since).sort((a, b) => a.date.localeCompare(b.date)),
    [kid.moodEntries, since]
  );

  if (entries.length === 0) {
    return (
      <Card>
        <View style={s.emptyState}>
          <Text style={{ fontSize: 40 }}>😊</Text>
          <Text style={s.emptyTitle}>No mood entries yet</Text>
          <Text style={s.emptySub}>{kid.profile.name} hasn't logged any moods in this period.</Text>
        </View>
      </Card>
    );
  }

  // Stats
  const avg = entries.reduce((sum, e) => sum + e.mood, 0) / entries.length;
  const lowDays   = entries.filter(e => e.mood <= 2).length;
  const greatDays = entries.filter(e => e.mood >= 4).length;

  // Distribution
  const dist = [0, 0, 0, 0, 0]; // indices 0-4 map to mood 1-5
  for (const e of entries) dist[e.mood - 1]++;
  const maxDist = Math.max(...dist, 1);

  // Trend — last 14 entries for sparkline
  const recent = entries.slice(-14);

  return (
    <>
      {/* Stats row */}
      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={[s.statNum, { color: MOOD_COLOR[Math.round(avg)] }]}>
            {MOOD_EMOJI[Math.round(avg)]} {avg.toFixed(1)}
          </Text>
          <Text style={s.statLabel}>Avg Mood</Text>
        </View>
        <View style={[s.statBox, { borderLeftWidth: 1, borderColor: Colors.border }]}>
          <Text style={[s.statNum, lowDays > 0 && { color: Colors.error }]}>{lowDays}d</Text>
          <Text style={s.statLabel}>Low Days</Text>
        </View>
        <View style={[s.statBox, { borderLeftWidth: 1, borderColor: Colors.border }]}>
          <Text style={[s.statNum, { color: Colors.success }]}>{greatDays}d</Text>
          <Text style={s.statLabel}>Great Days</Text>
        </View>
      </View>

      {/* Sparkline */}
      <Card>
        <SectionTitle title="📅 Mood Trend" sub="Recent mood check-ins" />
        <View style={moodS.sparkline}>
          {recent.map((e, i) => (
            <View key={i} style={moodS.sparkCol}>
              <Text style={{ fontSize: 16 }}>{MOOD_EMOJI[e.mood]}</Text>
              <View style={[moodS.sparkBar, {
                height: Math.max(4, (e.mood / 5) * 60),
                backgroundColor: MOOD_COLOR[e.mood],
              }]} />
              <Text style={moodS.sparkLabel}>
                {new Date(e.date + "T00:00:00").toLocaleDateString([], { weekday: "narrow" })}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Distribution */}
      <Card>
        <SectionTitle title="📊 Distribution" sub="How often each mood was logged" />
        {[5, 4, 3, 2, 1].map(level => (
          <View key={level} style={moodS.distRow}>
            <Text style={moodS.distEmoji}>{MOOD_EMOJI[level]}</Text>
            <Text style={moodS.distLabel}>{MOOD_LABEL[level]}</Text>
            <View style={moodS.distTrack}>
              <View style={[moodS.distFill, {
                width: `${Math.round((dist[level - 1] / maxDist) * 100)}%`,
                backgroundColor: MOOD_COLOR[level],
              }]} />
            </View>
            <Text style={moodS.distCount}>{dist[level - 1]}d</Text>
          </View>
        ))}
      </Card>

      {/* Recent log */}
      {entries.length > 0 && (
        <Card>
          <SectionTitle title="📝 Recent Log" />
          {entries.slice().reverse().slice(0, 10).map((e, i) => (
            <View key={i} style={[s.txRow, { alignItems: "flex-start" }]}>
              <Text style={{ fontSize: 28, marginRight: 10, marginTop: 2 }}>{MOOD_EMOJI[e.mood]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.txTitle}>
                  {MOOD_LABEL[e.mood]}
                  {e.note ? ` — ${e.note}` : ""}
                </Text>
                <Text style={s.txDate}>
                  {new Date(e.date + "T00:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

const todS = StyleSheet.create({
  chart: { flexDirection: "row", alignItems: "flex-end", height: 140, gap: 1, paddingTop: 8 },
  col: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4 },
  bar: { width: "70%", borderRadius: 2, minHeight: 2 },
  hourLabel: { fontSize: 7, color: Colors.textMuted, fontWeight: "600" },
});

const moodS = StyleSheet.create({
  sparkline: {
    flexDirection: "row", alignItems: "flex-end", height: 100, gap: 2, paddingTop: 8,
  },
  sparkCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 3 },
  sparkBar: { width: "75%", borderRadius: 3, minHeight: 4 },
  sparkLabel: { fontSize: 8, color: Colors.textMuted, fontWeight: "600" },
  distRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10,
  },
  distEmoji: { fontSize: 18, width: 24, textAlign: "center" },
  distLabel: { width: 54, fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary },
  distTrack: {
    flex: 1, height: 10, backgroundColor: Colors.cardLight, borderRadius: 5, overflow: "hidden",
  },
  distFill: { height: "100%", borderRadius: 5, minWidth: 4 },
  distCount: { width: 24, fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textAlign: "right" },
});

// ─── Spending Tab ─────────────────────────────────────────────────────────────
function SpendingTab({ kid, period }: { kid: KidState; period: Period }) {
  const since = periodSince(period);
  const periodLabel = period === "today" ? "today" : period === "week" ? "last 7 days" : "last 30 days";

  // Approved chores with rewards
  const approvedChores = kid.chores.filter(c =>
    c.status === "approved" &&
    c.approvals.some(a => a.kidId === kid.profile.id && a.reviewedAt >= since)
  );
  const chorePoints = approvedChores.reduce((sum, c) => sum + (c.approvals.find(a => a.kidId === kid.profile.id)?.awardedPoints ?? c.points), 0);
  const choreCash   = approvedChores.reduce((sum, c) => sum + (c.approvals.find(a => a.kidId === kid.profile.id)?.awardedCash ?? 0), 0);
  const choreTotal  = chorePoints * POINT_VALUE + choreCash;

  // Point payouts (parent paid out kid's earned points)
  const payouts = (kid.pointPayouts ?? []).filter(p => p.date >= since);
  const payoutTotal = payouts.reduce((sum, p) => sum + p.amount, 0);
  const payoutPoints = payouts.reduce((sum, p) => sum + p.points, 0);

  // Allowance payments
  const allowanceTxns = (kid.money?.transactions ?? []).filter(t =>
    t.type === "auto-earn" && t.date >= since
  );
  const allowanceTotal = allowanceTxns.reduce((sum, t) => sum + t.amount, 0);

  // Behavior bonuses (positive events in period)
  const behaviorBonuses = (kid.behavior?.events ?? []).filter(e => e.points > 0 && e.date >= since);
  const behaviorPoints = behaviorBonuses.reduce((sum, e) => sum + e.points, 0);
  const behaviorTotal  = behaviorPoints * POINT_VALUE;

  const grandTotal = choreTotal + payoutTotal + allowanceTotal + behaviorTotal;

  const rows = [
    { label: "Chore Rewards",    emoji: "🧹", amount: choreTotal,    count: approvedChores.length, unit: "chores" },
    { label: "Point Payouts",    emoji: "⭐", amount: payoutTotal,   count: payoutPoints,          unit: "pts paid" },
    { label: "Allowance",        emoji: "💵", amount: allowanceTotal, count: allowanceTxns.length, unit: "payments" },
    { label: "Behavior Bonuses", emoji: "🌟", amount: behaviorTotal, count: behaviorBonuses.length, unit: "bonuses" },
  ].filter(r => r.amount > 0 || r.count > 0);

  const maxAmount = Math.max(...rows.map(r => r.amount), 1);
  const COLORS = ["#10B981", "#6366F1", "#F59E0B", "#8B5CF6"];

  return (
    <>
      {/* Grand total summary */}
      <View style={s.spendSummary}>
        <View style={s.spendTotal}>
          <Text style={s.spendTotalLabel}>Total Spent on {kid.profile.name}</Text>
          <Text style={s.spendTotalAmt}>${grandTotal.toFixed(2)}</Text>
          <Text style={s.spendTotalPeriod}>{periodLabel}</Text>
        </View>
        <View style={s.spendBreakRow}>
          <View style={s.spendBreakItem}>
            <Text style={s.spendBreakEmoji}>🧹</Text>
            <Text style={s.spendBreakAmt}>${choreTotal.toFixed(2)}</Text>
            <Text style={s.spendBreakLabel}>Chores</Text>
          </View>
          <View style={s.spendBreakItem}>
            <Text style={s.spendBreakEmoji}>⭐</Text>
            <Text style={s.spendBreakAmt}>${payoutTotal.toFixed(2)}</Text>
            <Text style={s.spendBreakLabel}>Payouts</Text>
          </View>
          <View style={s.spendBreakItem}>
            <Text style={s.spendBreakEmoji}>💵</Text>
            <Text style={s.spendBreakAmt}>${allowanceTotal.toFixed(2)}</Text>
            <Text style={s.spendBreakLabel}>Allowance</Text>
          </View>
          <View style={s.spendBreakItem}>
            <Text style={s.spendBreakEmoji}>🌟</Text>
            <Text style={s.spendBreakAmt}>${behaviorTotal.toFixed(2)}</Text>
            <Text style={s.spendBreakLabel}>Bonuses</Text>
          </View>
        </View>
      </View>

      {/* Bar breakdown */}
      {rows.length > 0 ? (
        <Card>
          <SectionTitle title="💰 Breakdown" sub={`Where the money went — ${periodLabel}`} />
          {rows.map((row, i) => (
            <BarRow
              key={row.label}
              label={row.label}
              emoji={row.emoji}
              value={row.amount}
              maxValue={maxAmount}
              color={COLORS[i % COLORS.length]}
              rightText={`$${row.amount.toFixed(2)} · ${row.count} ${row.unit}`}
            />
          ))}
        </Card>
      ) : (
        <Card>
          <View style={s.emptyState}>
            <Text style={{ fontSize: 40 }}>💰</Text>
            <Text style={s.emptyTitle}>No spending {periodLabel}</Text>
            <Text style={s.emptySub}>Chore rewards, allowances, point payouts, and behavior bonuses will appear here.</Text>
          </View>
        </Card>
      )}

      {/* Chore detail */}
      {approvedChores.length > 0 && (
        <Card style={{ marginTop: 4 }}>
          <SectionTitle title="🧹 Approved Chores" sub="Chores completed and rewarded" />
          {approvedChores.slice(0, 10).map(c => {
            const approval = c.approvals.find(a => a.kidId === kid.profile.id);
            const pts = approval?.awardedPoints ?? c.points;
            const cash = approval?.awardedCash ?? 0;
            return (
              <View key={c.id} style={s.txRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.txTitle}>{c.title}</Text>
                  <Text style={s.txDate}>{approval?.reviewedAt ? new Date(approval.reviewedAt).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={s.txAmt}>+{pts} pts</Text>
                  {cash > 0 && <Text style={s.txAmtCash}>+${cash.toFixed(2)}</Text>}
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {/* Point payout detail */}
      {payouts.length > 0 && (
        <Card style={{ marginTop: 4 }}>
          <SectionTitle title="⭐ Point Payouts" sub="Points converted to real money" />
          {payouts.map(p => (
            <View key={p.id} style={s.txRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.txTitle}>{p.note || `Payout — ${p.method}`}</Text>
                <Text style={s.txDate}>{new Date(p.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.txAmt}>{p.points} pts</Text>
                <Text style={s.txAmtCash}>${p.amount.toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </Card>
      )}

      {/* Allowance detail */}
      {allowanceTxns.length > 0 && (
        <Card style={{ marginTop: 4 }}>
          <SectionTitle title="💵 Allowance Payments" />
          {allowanceTxns.map((t, i) => (
            <View key={i} style={s.txRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.txTitle}>{t.description || "Allowance"}</Text>
                <Text style={s.txDate}>{new Date(t.date).toLocaleDateString([], { month: "short", day: "numeric" })}</Text>
              </View>
              <Text style={s.txAmtCash}>+${t.amount.toFixed(2)}</Text>
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
async function sendEmailDigest(kids: KidState[]) {
  const since = daysAgoDate(7);
  const today = new Date().toLocaleDateString();

  const body = kids.map(kid => {
    const apps  = aggregateAppUsage(kid.usage, since).slice(0, 5);
    const sites = aggregateWebUsage(kid.usage, since).slice(0, 5);
    const total = kid.usage.filter(u => u.date >= since).reduce((s, d) => s + d.totalMinutes, 0);
    const lines = [
      `── ${kid.profile.name} ──`,
      `Total screen time (7 days): ${formatMinutes(total)}`,
      apps.length  ? `Top apps:  ${apps.map(a  => `${a.appName} (${formatMinutes(a.minutes)})`).join(", ")}` : "",
      sites.length ? `Top sites: ${sites.map(s => `${s.domain} (${fmtDuration(s.totalSeconds)})`).join(", ")}` : "",
    ];
    return lines.filter(Boolean).join("\n");
  }).join("\n\n");

  const isAvailable = await MailComposer.isAvailableAsync();
  if (!isAvailable) {
    Alert.alert("Mail not available", "No mail app is configured on this device.");
    return;
  }
  await MailComposer.composeAsync({
    subject: `📊 Weekly Family Screen-Time Report — ${today}`,
    body: `Weekly Usage Digest\nGenerated: ${today}\n\n${body}\n\nSent from Spinini App`,
  });
}

export default function ReportsScreen() {
  const { state } = useData();
  const [selectedKidId, setSelectedKidId] = useState<string>(state.kids[0]?.profile.id ?? "");
  const [tab, setTab]       = useState<Tab>("screentime");
  const [period, setPeriod] = useState<Period>("week");

  const kid = state.kids.find(k => k.profile.id === selectedKidId);

  return (
    <ScreenContainer scroll>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.md }}>
        <Text style={s.pageTitle}>📊 Usage Reports</Text>
        <TouchableOpacity
          style={s.emailBtn}
          onPress={() => sendEmailDigest(state.kids)}
        >
          <Text style={s.emailBtnText}>📧 Email</Text>
        </TouchableOpacity>
      </View>

      {/* ── Kid selector ── */}
      {state.kids.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
          {state.kids.map(k => (
            <TouchableOpacity
              key={k.profile.id}
              style={[s.kidChip, selectedKidId === k.profile.id && s.kidChipActive]}
              onPress={() => setSelectedKidId(k.profile.id)}
            >
              <Text style={{ fontSize: 20 }}>
                {k.profile.photoUri ? "👤" : "😊"}
              </Text>
              <Text style={[s.kidChipLabel, selectedKidId === k.profile.id && s.kidChipLabelActive]}>
                {k.profile.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {!kid ? (
        <Card>
          <Text style={s.emptyTitle}>No kids added yet</Text>
        </Card>
      ) : (
        <>
          {/* ── Period picker ── */}
          <View style={s.periodRow}>
            {PERIODS.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[s.periodBtn, period === p.id && s.periodBtnActive]}
                onPress={() => setPeriod(p.id)}
              >
                <Text style={[s.periodLabel, period === p.id && s.periodLabelActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Tab bar ── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
            {TABS.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[s.tabBtn, tab === t.id && s.tabBtnActive]}
                onPress={() => setTab(t.id)}
              >
                <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
                <Text style={[s.tabLabel, tab === t.id && s.tabLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── Content ── */}
          {tab === "screentime" && <ScreenTimeTab kid={kid} period={period} />}
          {tab === "apps"       && <AppsTab kid={kid} period={period} />}
          {tab === "timeofday"  && <TimeOfDayTab kid={kid} period={period} />}
          {tab === "web"        && <WebTab kid={kid} period={period} />}
          {tab === "features"   && <FeaturesTab kid={kid} period={period} />}
          {tab === "spending"   && <SpendingTab kid={kid} period={period} />}
          {tab === "mood"       && <MoodTab kid={kid} period={period} />}
        </>
      )}
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  pageTitle: { fontSize: FontSize.xxl, fontWeight: "800", color: Colors.textPrimary },
  emailBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  emailBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },

  kidChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.cardLight, borderRadius: Radius.full,
    paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  kidChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  kidChipLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  kidChipLabelActive: { color: "#fff" },

  periodRow: { flexDirection: "row", gap: 8, marginBottom: Spacing.md },
  periodBtn: {
    flex: 1, alignItems: "center", paddingVertical: 8,
    backgroundColor: Colors.cardLight, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  periodBtnActive: { backgroundColor: Colors.primary + "20", borderColor: Colors.primary },
  periodLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  periodLabelActive: { color: Colors.primary },

  tabBtn: {
    alignItems: "center", paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: Colors.cardLight, borderRadius: Radius.lg,
    marginRight: 8, gap: 2,
  },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabLabel: { fontSize: 10, fontWeight: "700", color: Colors.textSecondary },
  tabLabelActive: { color: "#fff" },

  card: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm,
  },
  sectionTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  sectionSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  statsRow: {
    flexDirection: "row", backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.xl, marginBottom: Spacing.md,
    overflow: "hidden", ...Shadow.sm,
  },
  statBox: { flex: 1, alignItems: "center", paddingVertical: Spacing.md },
  statNum: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  // Bar chart
  chartArea: { flexDirection: "row", alignItems: "flex-end", height: 140, gap: 4, marginBottom: 4 },
  chartBar: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 3 },
  chartFill: { width: "80%", borderRadius: 4, minHeight: 4 },
  chartBarLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: "600" },
  chartBarMins: { fontSize: 8, color: Colors.textSecondary },
  limitLine: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4,
  },
  limitLabel: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: "700" },

  insightRow: { flexDirection: "row", gap: 10, marginBottom: Spacing.md },
  insightCard: {
    flex: 1, borderRadius: Radius.xl, padding: Spacing.md, alignItems: "center", gap: 4,
  },
  insightEmoji: { fontSize: 28 },
  insightNum: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  insightLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },

  // Bar rows
  barRow: { marginBottom: 14 },
  barLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  barLabel: { flex: 1, fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary },
  barRight: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: "600" },
  barTrack: { height: 8, backgroundColor: Colors.cardLight, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4, minWidth: 4 },

  // Web
  visitRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 8, borderBottomWidth: 1, borderColor: Colors.border,
  },
  visitDomain: { flex: 1, fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary },
  visitMeta: { flexDirection: "row", gap: 8, alignItems: "center" },
  visitTime: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.primary },
  visitDate: { fontSize: FontSize.xs, color: Colors.textMuted },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: Spacing.xl, gap: 8 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },

  // Spending tab
  spendSummary: {
    backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: Spacing.md,
    marginBottom: Spacing.md, ...Shadow.md,
  },
  spendTotal: { alignItems: "center", marginBottom: Spacing.sm },
  spendTotalLabel: { fontSize: FontSize.sm, color: "#ffffff99", fontWeight: "600" },
  spendTotalAmt: { fontSize: 40, fontWeight: "900", color: "#fff", marginVertical: 4 },
  spendTotalPeriod: { fontSize: FontSize.xs, color: "#ffffff88" },
  spendBreakRow: { flexDirection: "row" },
  spendBreakItem: { flex: 1, alignItems: "center", gap: 2 },
  spendBreakEmoji: { fontSize: 22 },
  spendBreakAmt: { fontSize: FontSize.sm, fontWeight: "800", color: "#fff" },
  spendBreakLabel: { fontSize: 10, color: "#ffffff99" },
  txRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  txTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  txDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  txAmt: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.primary },
  txAmtCash: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.success },
});
