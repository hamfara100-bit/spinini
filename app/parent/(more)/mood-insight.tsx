/**
 * Feature 18: Kid Mood → Parent Insight
 * Analyzes each kid's mood history and surfaces patterns:
 * - Alerts when a kid logs low mood 4+ days in a row
 * - Shows mood trends over the past 14 / 30 days
 * - Provides conversation starters tailored to the pattern
 */
import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { MOOD_LABELS, type MoodEntry, type MoodLevel } from "../../../lib/data/types";

// ─── Conversation Starters by pattern ───────────────────────────────────────

const STARTERS_LOW: string[] = [
  "Hey, I noticed you've seemed a bit down lately — want to grab some time together today?",
  "I'm not trying to pry, but if something's on your mind, I'm all ears. No pressure.",
  "What was the best part of your day, even if it was just a tiny thing?",
  "Sometimes it helps to just get out of the house. Want to take a walk with me?",
  "Is there anything I can do differently to make things feel better at home?",
  "I love you no matter what — and I'm always here when you're ready to talk.",
];

const STARTERS_ANXIOUS: string[] = [
  "It sounds like things feel a bit overwhelming right now — what's weighing on you most?",
  "Let's figure out one small thing we can do today to make tomorrow feel less stressful.",
  "You don't have to solve everything at once. What can we take off your plate?",
  "When I was your age I felt anxious too — it gets easier. Want to hear about it?",
];

const STARTERS_GREAT: string[] = [
  "You've been in such a great mood lately — what's been going on?",
  "I love seeing you happy. What's something you're really looking forward to?",
  "You seem really energized this week — is there something new you're excited about?",
];

// ─── Analysis helpers ────────────────────────────────────────────────────────

interface MoodPattern {
  type: "low_streak" | "anxious_streak" | "great_streak" | "improving" | "declining" | "stable";
  streakDays: number;
  avgMood: number;
  totalEntries: number;
  last14: MoodEntry[];
  recentAvg: number;   // last 7 days avg
  olderAvg: number;    // 7-14 days avg
}

function analyzeMood(entries: MoodEntry[]): MoodPattern {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const now = new Date();

  const cutoff14 = new Date(now); cutoff14.setDate(cutoff14.getDate() - 14);
  const cutoff7  = new Date(now); cutoff7.setDate(cutoff7.getDate() - 7);

  const last14 = sorted.filter(e => new Date(e.date) >= cutoff14);
  const last7  = last14.filter(e => new Date(e.date) >= cutoff7);
  const older  = last14.filter(e => new Date(e.date) < cutoff7);

  const avg = (arr: MoodEntry[]) =>
    arr.length ? arr.reduce((s, e) => s + e.mood, 0) / arr.length : 0;

  const recentAvg = avg(last7);
  const olderAvg  = avg(older);
  const totalAvg  = avg(last14);

  // Count consecutive low-mood days (mood ≤ 2) starting from most recent
  let lowStreak = 0;
  for (const e of sorted) {
    if (e.mood <= 2) lowStreak++;
    else break;
  }

  // Determine pattern type
  let type: MoodPattern["type"] = "stable";
  if (lowStreak >= 4)                            type = "low_streak";
  else if (recentAvg >= 4.2)                     type = "great_streak";
  else if (older.length >= 2 && recentAvg - olderAvg > 0.8) type = "improving";
  else if (older.length >= 2 && olderAvg - recentAvg > 0.8) type = "declining";

  return {
    type,
    streakDays: lowStreak,
    avgMood: totalAvg,
    totalEntries: entries.length,
    last14,
    recentAvg,
    olderAvg,
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MoodBar({ level, count, max }: { level: MoodLevel; count: number; max: number }) {
  const m = MOOD_LABELS[level];
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <View style={bar.row}>
      <Text style={bar.emoji}>{m.emoji}</Text>
      <View style={bar.track}>
        <View style={[bar.fill, { width: `${pct}%` as any, backgroundColor: m.color }]} />
      </View>
      <Text style={bar.count}>{count}</Text>
    </View>
  );
}

const bar = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  emoji: { fontSize: 18, width: 28, textAlign: "center" },
  track: { flex: 1, height: 10, backgroundColor: "#E5E7EB", borderRadius: 5, overflow: "hidden" },
  fill:  { height: 10, borderRadius: 5 },
  count: { fontSize: FontSize.xs, color: Colors.textMuted, width: 22, textAlign: "right" },
});

function MiniCalendar({ entries }: { entries: MoodEntry[] }) {
  // Show last 14 days as coloured dots
  const days: { date: string; mood: MoodLevel | null }[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const entry = entries.find(e => e.date === key);
    days.push({ date: key, mood: entry?.mood ?? null });
  }
  return (
    <View style={cal.grid}>
      {days.map(d => {
        const color = d.mood ? MOOD_LABELS[d.mood].color : "#E5E7EB";
        return (
          <View key={d.date} style={[cal.dot, { backgroundColor: color }]} />
        );
      })}
    </View>
  );
}

const cal = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
  dot:  { width: 16, height: 16, borderRadius: 8 },
});

// ─── Starter modal ───────────────────────────────────────────────────────────

function StarterModal({
  visible, onClose, name, pattern,
}: {
  visible: boolean; onClose: () => void; name: string; pattern: MoodPattern;
}) {
  const starters =
    pattern.type === "great_streak" ? STARTERS_GREAT :
    pattern.type === "declining"    ? STARTERS_ANXIOUS :
    STARTERS_LOW;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={mod.overlay}>
        <View style={mod.sheet}>
          <Text style={mod.title}>💬 Conversation Starters</Text>
          <Text style={mod.sub}>Things to say to {name}</Text>
          <ScrollView style={{ maxHeight: 380 }}>
            {starters.map((s, i) => (
              <View key={i} style={mod.card}>
                <Text style={mod.cardNum}>{i + 1}</Text>
                <Text style={mod.cardText}>{s}</Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={mod.closeBtn} onPress={onClose}>
            <Text style={mod.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const mod = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:        { backgroundColor: "#fff", borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: 36 },
  title:        { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub:          { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  card:         { flexDirection: "row", gap: 12, backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: 8 },
  cardNum:      { fontSize: FontSize.base, fontWeight: "800", color: Colors.primary, width: 24 },
  cardText:     { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  closeBtn:     { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", padding: 14, marginTop: 4 },
  closeBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
});

// ─── Per-kid card ─────────────────────────────────────────────────────────────

function KidMoodCard({ kid }: { kid: ReturnType<typeof useData>["state"]["kids"][0] }) {
  const entries = kid.moodEntries ?? [];
  const pattern = useMemo(() => analyzeMood(entries), [entries]);
  const [showStarters, setShowStarters] = useState(false);

  const hasAlert =
    pattern.type === "low_streak" ||
    pattern.type === "declining";

  const alertConfig = {
    low_streak: {
      bg: "#FEF2F2", border: "#FECACA",
      emoji: "😢", text: `${kid.profile.name} has logged low mood ${pattern.streakDays} days in a row`,
      badge: `${pattern.streakDays}-day streak`,
      badgeColor: Colors.error,
    },
    declining: {
      bg: "#FFFBEB", border: "#FDE68A",
      emoji: "📉", text: `${kid.profile.name}'s mood has been declining this week`,
      badge: "Declining",
      badgeColor: Colors.warning,
    },
    great_streak: {
      bg: "#F0FDF4", border: "#BBF7D0",
      emoji: "🌟", text: `${kid.profile.name} has been in great spirits lately!`,
      badge: "Great!",
      badgeColor: Colors.success,
    },
    improving: {
      bg: "#F0FDF4", border: "#BBF7D0",
      emoji: "📈", text: `${kid.profile.name}'s mood is improving — nice!`,
      badge: "Improving",
      badgeColor: Colors.success,
    },
    stable: null,
    anxious_streak: null,
  }[pattern.type];

  // Distribution over last 14 days
  const dist: Record<MoodLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  pattern.last14.forEach(e => { dist[e.mood] = (dist[e.mood] ?? 0) + 1; });
  const maxCount = Math.max(...Object.values(dist), 1);

  if (entries.length === 0) {
    return (
      <View style={s.kidCard}>
        <Text style={s.kidName}>{kid.profile.name}</Text>
        <Text style={s.noData}>No mood entries yet. Ask {kid.profile.name} to log their first mood in the kid app.</Text>
      </View>
    );
  }

  return (
    <View style={[s.kidCard, hasAlert && { borderColor: alertConfig!.border, borderWidth: 1.5 }]}>
      {/* Alert banner */}
      {alertConfig && (
        <View style={[s.alertBanner, { backgroundColor: alertConfig.bg, borderColor: alertConfig.border }]}>
          <Text style={{ fontSize: 22 }}>{alertConfig.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.alertText}>{alertConfig.text}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: alertConfig.badgeColor }]}>
            <Text style={s.badgeText}>{alertConfig.badge}</Text>
          </View>
        </View>
      )}

      {/* Name + avg */}
      <View style={s.kidHeader}>
        <Text style={s.kidName}>{kid.profile.name}</Text>
        <View style={s.avgChip}>
          <Text style={s.avgText}>
            {pattern.avgMood > 0
              ? `Avg ${pattern.avgMood.toFixed(1)} ${MOOD_LABELS[Math.round(pattern.avgMood) as MoodLevel]?.emoji ?? ""}`
              : "No data"}
          </Text>
        </View>
      </View>

      {/* 14-day calendar dots */}
      <Text style={s.calLabel}>Last 14 days</Text>
      <MiniCalendar entries={pattern.last14} />

      {/* Mood distribution bars */}
      <Text style={[s.calLabel, { marginTop: 14 }]}>Distribution</Text>
      {([5, 4, 3, 2, 1] as MoodLevel[]).map(lvl => (
        <MoodBar key={lvl} level={lvl} count={dist[lvl]} max={maxCount} />
      ))}

      {/* Week-over-week delta */}
      {pattern.olderAvg > 0 && pattern.recentAvg > 0 && (
        <View style={s.deltaRow}>
          <Text style={s.deltaLabel}>This week vs last week</Text>
          <Text style={[s.deltaValue, {
            color: pattern.recentAvg >= pattern.olderAvg ? Colors.success : Colors.error
          }]}>
            {pattern.recentAvg >= pattern.olderAvg ? "▲" : "▼"}{" "}
            {Math.abs(pattern.recentAvg - pattern.olderAvg).toFixed(1)} pts
          </Text>
        </View>
      )}

      {/* CTA */}
      <TouchableOpacity
        style={[s.starterBtn, hasAlert && { backgroundColor: Colors.primary }]}
        onPress={() => setShowStarters(true)}
      >
        <Text style={[s.starterBtnText, hasAlert && { color: "#fff" }]}>
          💬 {hasAlert ? "Get Conversation Starters" : "View Conversation Tips"}
        </Text>
      </TouchableOpacity>

      <StarterModal
        visible={showStarters}
        onClose={() => setShowStarters(false)}
        name={kid.profile.name}
        pattern={pattern}
      />
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function MoodInsightScreen() {
  const { state } = useData();

  const alertCount = state.kids.filter(k => {
    const p = analyzeMood(k.moodEntries ?? []);
    return p.type === "low_streak" || p.type === "declining";
  }).length;

  return (
    <ScreenContainer scroll>
      <Text style={s.title}>💡 Mood Insights</Text>
      <Text style={s.sub}>
        Track how your kids are feeling over time. You'll get an alert when a
        consistent low-mood pattern is detected so you can check in early.
      </Text>

      {alertCount > 0 && (
        <View style={s.globalAlert}>
          <Text style={s.globalAlertEmoji}>🔔</Text>
          <Text style={s.globalAlertText}>
            {alertCount === 1
              ? "1 kid may need extra attention right now"
              : `${alertCount} kids may need extra attention right now`}
          </Text>
        </View>
      )}

      {/* Legend */}
      <View style={s.legendRow}>
        {([5, 4, 3, 2, 1] as MoodLevel[]).map(l => (
          <View key={l} style={s.legendItem}>
            <Text style={s.legendDot}>{MOOD_LABELS[l].emoji}</Text>
            <Text style={s.legendLabel}>{MOOD_LABELS[l].label}</Text>
          </View>
        ))}
      </View>

      {state.kids.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>👶</Text>
          <Text style={s.emptyText}>No kids added yet</Text>
          <Text style={s.emptySub}>Add kids to your account to start tracking mood insights.</Text>
        </View>
      ) : (
        state.kids.map(k => <KidMoodCard key={k.profile.id} kid={k} />)
      )}

      <View style={s.footer}>
        <Text style={s.footerText}>
          💡 Mood data is logged by your kids in the kid app (the mood check-in
          feature). Alerts fire when a kid logs mood 1–2 ("Awful" or "Bad") for
          4 or more consecutive days.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  title:            { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub:              { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  globalAlert:      { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FEF2F2", borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: Spacing.md, borderWidth: 1, borderColor: "#FECACA" },
  globalAlertEmoji: { fontSize: 24 },
  globalAlertText:  { fontSize: FontSize.sm, fontWeight: "700", color: Colors.error, flex: 1 },
  legendRow:        { flexDirection: "row", gap: 10, marginBottom: Spacing.md, flexWrap: "wrap" },
  legendItem:       { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot:        { fontSize: 16 },
  legendLabel:      { fontSize: FontSize.xs, color: Colors.textSecondary },
  kidCard:          { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 16, ...Shadow.sm, borderWidth: 1, borderColor: Colors.border },
  alertBanner:      { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: Spacing.sm, borderWidth: 1 },
  alertText:        { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary, flex: 1 },
  badge:            { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:        { fontSize: FontSize.xs, fontWeight: "800", color: "#fff" },
  kidHeader:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  kidName:          { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  avgChip:          { backgroundColor: Colors.cardLight, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  avgText:          { fontSize: FontSize.xs, fontWeight: "600", color: Colors.textSecondary },
  calLabel:         { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 },
  deltaRow:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.cardLight, borderRadius: Radius.md, padding: Spacing.sm, marginTop: 8 },
  deltaLabel:       { fontSize: FontSize.xs, color: Colors.textSecondary },
  deltaValue:       { fontSize: FontSize.sm, fontWeight: "800" },
  starterBtn:       { borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.primary, alignItems: "center", padding: 12, marginTop: 12 },
  starterBtnText:   { fontWeight: "700", fontSize: FontSize.sm, color: Colors.primary },
  noData:           { fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: "italic", marginTop: 4 },
  empty:            { alignItems: "center", padding: Spacing.xl },
  emptyEmoji:       { fontSize: 48, marginBottom: 8 },
  emptyText:        { fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary },
  emptySub:         { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", marginTop: 4, lineHeight: 20 },
  footer:           { backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.sm },
  footerText:       { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18 },
});
