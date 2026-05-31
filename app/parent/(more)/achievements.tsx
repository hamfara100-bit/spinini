import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Alert, Modal, TextInput, ScrollView,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { Achievement, AchievementCategory } from "../../../lib/data/types";
import { uid, nowIso } from "../../../lib/utils";
import { PointsInput } from "../../../components/points-input";

const CATEGORIES: Record<AchievementCategory, { emoji: string; label: string; color: string }> = {
  sports:    { emoji: "🏅", label: "Sports",    color: "#EF4444" },
  academic:  { emoji: "📚", label: "Academic",  color: "#3B82F6" },
  creative:  { emoji: "🎨", label: "Creative",  color: "#EC4899" },
  financial: { emoji: "💰", label: "Financial", color: "#F59E0B" },
  personal:  { emoji: "💪", label: "Personal",  color: "#8B5CF6" },
  milestone: { emoji: "🏆", label: "Milestone", color: "#10B981" },
  other:     { emoji: "⭐", label: "Other",     color: "#64748B" },
};

function catFor(id: AchievementCategory) {
  return CATEGORIES[id] ?? CATEGORIES.other;
}

export default function ParentAchievementsScreen() {
  const { state, dispatch } = useData();
  const [awardTarget, setAwardTarget] = useState<{ kidId: string; achievement: Achievement } | null>(null);
  const [points, setPoints] = useState("10");
  const [comment, setComment] = useState("");

  // Collect all achievements across all kids, sorted newest first
  const allAchievements: { kidId: string; kidName: string; achievement: Achievement }[] = [];
  for (const kid of state.kids) {
    for (const a of (kid.achievements ?? [])) {
      allAchievements.push({ kidId: kid.profile.id, kidName: kid.profile.name, achievement: a });
    }
  }
  allAchievements.sort((a, b) => new Date(b.achievement.createdAt).getTime() - new Date(a.achievement.createdAt).getTime());

  function openAward(kidId: string, achievement: Achievement) {
    setAwardTarget({ kidId, achievement });
    setPoints(achievement.pointsAwarded != null ? String(achievement.pointsAwarded) : "10");
    setComment(achievement.parentComment ?? "");
  }

  function confirmAward() {
    if (!awardTarget) return;
    const pts = parseInt(points) || 0;
    if (pts < 1) { Alert.alert("Enter at least 1 point."); return; }
    dispatch({
      type: "ACHIEVEMENT_AWARD_POINTS",
      kidId: awardTarget.kidId,
      achievementId: awardTarget.achievement.id,
      points: pts,
      comment: comment.trim() || undefined,
    });
    dispatch({
      type: "NOTIFICATION_ADD",
      kidId: awardTarget.kidId,
      notification: {
        id: uid(),
        kidId: awardTarget.kidId,
        kind: "achievement_awarded",
        title: `⭐ You earned ${pts} points for your achievement!`,
        body: comment.trim() || `Great job: "${awardTarget.achievement.title}"`,
        read: false,
        createdAt: nowIso(),
      },
    });
    setAwardTarget(null);
    Alert.alert("🎉 Points Awarded!", `${pts} points sent to ${awardTarget.kidId === state.kids.find(k => k.profile.id === awardTarget.kidId)?.profile.id ? state.kids.find(k => k.profile.id === awardTarget.kidId)?.profile.name : "kid"}.`);
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🏆 Kids' Achievements</Text>
      <Text style={styles.sub}>Review your kids' achievements and award bonus points to celebrate their wins!</Text>

      {allAchievements.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 52 }}>🏆</Text>
          <Text style={styles.emptyTitle}>No achievements yet</Text>
          <Text style={styles.emptySub}>When your kids add achievements, they'll show up here for you to review and reward.</Text>
        </View>
      ) : (
        allAchievements.map(({ kidId, kidName, achievement: a }) => {
          const cat = catFor(a.category);
          const awarded = a.pointsAwarded != null;
          return (
            <View key={a.id} style={[styles.card, { borderLeftColor: cat.color }]}>
              {a.photoUri && (
                <Image source={{ uri: a.photoUri }} style={styles.cardPhoto} resizeMode="cover" />
              )}
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={{ fontSize: 20 }}>{cat.emoji}</Text>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.kidName}>{kidName}</Text>
                    <Text style={styles.achieveTitle}>{a.title}</Text>
                    <Text style={[styles.catLabel, { color: cat.color }]}>{cat.label}</Text>
                  </View>
                  {awarded ? (
                    <View style={styles.awardedBadge}>
                      <Text style={styles.awardedBadgeText}>+{a.pointsAwarded} pts ✅</Text>
                    </View>
                  ) : (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>Pending</Text>
                    </View>
                  )}
                </View>
                {a.note ? <Text style={styles.note} numberOfLines={3}>{a.note}</Text> : null}
                <Text style={styles.date}>{new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</Text>
                {a.parentComment ? (
                  <Text style={styles.commentPreview}>💬 You said: "{a.parentComment}"</Text>
                ) : null}
                <TouchableOpacity
                  style={[styles.awardBtn, awarded && styles.awardBtnSecondary]}
                  onPress={() => openAward(kidId, a)}
                >
                  <Text style={[styles.awardBtnText, awarded && styles.awardBtnTextSecondary]}>
                    {awarded ? "✏️ Edit Award" : "⭐ Award Points"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {/* Award Modal */}
      <Modal visible={!!awardTarget} animationType="slide" transparent onRequestClose={() => setAwardTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>⭐ Award Points</Text>
            <Text style={styles.modalAchieve}>"{awardTarget?.achievement.title}"</Text>
            <Text style={styles.fieldLabel}>Points to award</Text>
            <View style={styles.pointsRow}>
              {[5, 10, 25, 50, 100].map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.pointChip, points === String(p) && styles.pointChipActive]}
                  onPress={() => setPoints(String(p))}
                >
                  <Text style={[styles.pointChipText, points === String(p) && styles.pointChipTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <PointsInput
              inputStyle={styles.input}
              value={points}
              onChangeText={setPoints}
              placeholder="Custom amount"
            />
            <Text style={styles.fieldLabel}>Message to your kid (optional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]}
              value={comment}
              onChangeText={setComment}
              placeholder='e.g. "I am so proud of you! Keep it up! 🎉"'
              multiline
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAwardTarget(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmAward}>
                <Text style={styles.confirmBtnText}>⭐ Award!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
  empty: { alignItems: "center", paddingVertical: Spacing.xl, gap: 10 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", maxWidth: 280, lineHeight: 20 },
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, marginBottom: 12, overflow: "hidden", borderLeftWidth: 5, ...Shadow.sm },
  cardPhoto: { width: "100%", height: 150 },
  cardBody: { padding: Spacing.md },
  cardTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  kidName: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.primary, textTransform: "uppercase", letterSpacing: 0.4 },
  achieveTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary, marginTop: 2 },
  catLabel: { fontSize: FontSize.xs, fontWeight: "600", marginTop: 1 },
  awardedBadge: { backgroundColor: Colors.success + "20", borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  awardedBadgeText: { fontSize: FontSize.xs, fontWeight: "800", color: Colors.success },
  pendingBadge: { backgroundColor: Colors.warning + "20", borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  pendingBadgeText: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.warning },
  note: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: 4 },
  date: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 8 },
  commentPreview: { fontSize: FontSize.sm, color: Colors.primary, fontStyle: "italic", marginBottom: 8 },
  awardBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 10, ...Shadow.sm },
  awardBtnSecondary: { backgroundColor: "transparent", borderWidth: 2, borderColor: Colors.primary },
  awardBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  awardBtnTextSecondary: { color: Colors.primary },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: Spacing.lg },
  modalCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.lg, gap: 10 },
  modalTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  modalAchieve: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: "italic", marginBottom: 4 },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  pointsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pointChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight, borderWidth: 2, borderColor: Colors.border },
  pointChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pointChipText: { fontWeight: "700", color: Colors.textSecondary, fontSize: FontSize.sm },
  pointChipTextActive: { color: "#fff" },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, padding: 12, fontSize: FontSize.base, backgroundColor: Colors.cardLight },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12 },
  cancelBtnText: { fontWeight: "700", color: Colors.textSecondary },
  confirmBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12, ...Shadow.sm },
  confirmBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
});
