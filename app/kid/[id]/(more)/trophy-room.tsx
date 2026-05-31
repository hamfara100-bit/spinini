import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";

const LEVELS = [
  { name: "Bronze",   min: 0,    max: 499,  emoji: "🥉", color: "#CD7F32", bg: "#FEF3E2" },
  { name: "Silver",   min: 500,  max: 1999, emoji: "🥈", color: "#9CA3AF", bg: "#F3F4F6" },
  { name: "Gold",     min: 2000, max: 4999, emoji: "🥇", color: "#F59E0B", bg: "#FFFBEB" },
  { name: "Platinum", min: 5000, max: Infinity, emoji: "💎", color: "#8B5CF6", bg: "#F5F3FF" },
];

const BADGES = [
  { id: "first_chore",    emoji: "✅", title: "First Chore",      desc: "Completed your first chore",    check: (k: any) => k.streak.totalChoresDone >= 1 },
  { id: "streak_3",       emoji: "🔥", title: "3-Day Streak",     desc: "3 days in a row",               check: (k: any) => k.streak.longestDays >= 3 },
  { id: "streak_7",       emoji: "⚡", title: "Week Warrior",     desc: "7-day streak achieved",         check: (k: any) => k.streak.longestDays >= 7 },
  { id: "streak_30",      emoji: "🌟", title: "Month Master",     desc: "30-day streak",                 check: (k: any) => k.streak.longestDays >= 30 },
  { id: "chores_10",      emoji: "💪", title: "Hard Worker",      desc: "10 chores completed",           check: (k: any) => k.streak.totalChoresDone >= 10 },
  { id: "chores_50",      emoji: "🏆", title: "Chore Champion",   desc: "50 chores completed",           check: (k: any) => k.streak.totalChoresDone >= 50 },
  { id: "chores_100",     emoji: "👑", title: "Chore Legend",     desc: "100 chores completed",          check: (k: any) => k.streak.totalChoresDone >= 100 },
  { id: "saver",          emoji: "🐷", title: "Super Saver",      desc: "Saved $10 or more",             check: (k: any) => k.money.balance >= 10 },
  { id: "mood_log_5",     emoji: "😊", title: "Mood Tracker",     desc: "Logged mood 5 days",            check: (k: any) => (k.moodEntries?.length ?? 0) >= 5 },
  { id: "morning_done",   emoji: "🌅", title: "Morning Star",     desc: "Completed morning routine",     check: (k: any) => (k.morningCompletedItems?.length ?? 0) > 0 },
  { id: "story_heard",    emoji: "📖", title: "Bookworm",         desc: "Read 3 books",                  check: (k: any) => k.readingBooks.length >= 3 },
  { id: "discovery",      emoji: "🔭", title: "Explorer",         desc: "Made 5 discoveries",            check: (k: any) => k.discoveries.length >= 5 },
];

export default function TrophyRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const kid = useKid(id);

  if (!kid) return null;

  const totalPoints = kid.behavior.totalPoints;
  const level = LEVELS.find(l => totalPoints >= l.min && totalPoints <= l.max) ?? LEVELS[0];
  const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
  const progressPct = nextLevel
    ? Math.min(1, (totalPoints - level.min) / (nextLevel.min - level.min))
    : 1;

  const earnedBadges = BADGES.filter(b => b.check(kid));
  const lockedBadges = BADGES.filter(b => !b.check(kid));

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🏆 Trophy Room</Text>

      {/* Level card */}
      <View style={[styles.levelCard, { backgroundColor: level.bg, borderColor: level.color }]}>
        <Text style={styles.levelEmoji}>{level.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.levelName, { color: level.color }]}>{level.name} Level</Text>
          <Text style={styles.levelPoints}>{totalPoints.toLocaleString()} behavior points</Text>
          {nextLevel && (
            <>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${progressPct * 100}%` as any, backgroundColor: level.color }]} />
              </View>
              <Text style={styles.progressLabel}>
                {(nextLevel.min - totalPoints).toLocaleString()} pts to {nextLevel.name} {nextLevel.emoji}
              </Text>
            </>
          )}
          {!nextLevel && <Text style={[styles.progressLabel, { color: level.color }]}>Max level reached! 🎉</Text>}
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{kid.streak.totalChoresDone}</Text>
          <Text style={styles.statLabel}>Chores Done</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{kid.streak.longestDays}</Text>
          <Text style={styles.statLabel}>Best Streak</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{kid.streak.currentDays}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
      </View>

      {/* Earned badges */}
      {earnedBadges.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>BADGES EARNED ({earnedBadges.length})</Text>
          <View style={styles.badgeGrid}>
            {earnedBadges.map(b => (
              <View key={b.id} style={[styles.badge, styles.badgeEarned]}>
                <Text style={styles.badgeEmoji}>{b.emoji}</Text>
                <Text style={styles.badgeTitle}>{b.title}</Text>
                <Text style={styles.badgeDesc}>{b.desc}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Locked badges */}
      {lockedBadges.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>BADGES TO UNLOCK</Text>
          <View style={styles.badgeGrid}>
            {lockedBadges.map(b => (
              <View key={b.id} style={[styles.badge, styles.badgeLocked]}>
                <Text style={[styles.badgeEmoji, { opacity: 0.3 }]}>{b.emoji}</Text>
                <Text style={[styles.badgeTitle, { color: Colors.textMuted }]}>{b.title}</Text>
                <Text style={styles.badgeDesc}>{b.desc}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  levelCard: { flexDirection: "row", alignItems: "center", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 2, gap: 12 },
  levelEmoji: { fontSize: 48 },
  levelName: { fontSize: FontSize.lg, fontWeight: "800" },
  levelPoints: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  progressBg: { height: 8, backgroundColor: "rgba(0,0,0,0.1)", borderRadius: Radius.full, marginTop: 8, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: Radius.full },
  progressLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: Spacing.md },
  statCard: { flex: 1, backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, alignItems: "center", ...Shadow.sm },
  statValue: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, textAlign: "center" },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: Spacing.md },
  badge: { width: "47%", borderRadius: Radius.xl, padding: Spacing.md, alignItems: "center", ...Shadow.sm },
  badgeEarned: { backgroundColor: Colors.surfaceLight, borderWidth: 2, borderColor: Colors.primary + "30" },
  badgeLocked: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, opacity: 0.7 },
  badgeEmoji: { fontSize: 32, marginBottom: 6 },
  badgeTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary, textAlign: "center" },
  badgeDesc: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "center", marginTop: 2 },
});
