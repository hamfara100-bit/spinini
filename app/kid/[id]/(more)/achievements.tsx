import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Image, Alert, Modal, ScrollView, FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import { uploadMedia } from "../../../../lib/media-upload";
import { Achievement, AchievementCategory } from "../../../../lib/data/types";

const CATEGORIES: { id: AchievementCategory; emoji: string; label: string; color: string }[] = [
  { id: "sports",    emoji: "🏅", label: "Sports",     color: "#EF4444" },
  { id: "academic",  emoji: "📚", label: "Academic",   color: "#3B82F6" },
  { id: "creative",  emoji: "🎨", label: "Creative",   color: "#EC4899" },
  { id: "financial", emoji: "💰", label: "Financial",  color: "#F59E0B" },
  { id: "personal",  emoji: "💪", label: "Personal",   color: "#8B5CF6" },
  { id: "milestone", emoji: "🏆", label: "Milestone",  color: "#10B981" },
  { id: "other",     emoji: "⭐", label: "Other",      color: "#64748B" },
];

function catFor(id: AchievementCategory) {
  return CATEGORIES.find(c => c.id === id) ?? CATEGORIES[6];
}

export default function AchievementsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<AchievementCategory>("milestone");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<Achievement | null>(null);

  const achievements = kid?.achievements ?? [];

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.8 });
    if (!r.canceled) setPhotoUri(r.assets[0].uri);
  }

  async function takePhoto() {
    const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!r.canceled) setPhotoUri(r.assets[0].uri);
  }

  function photoOptions() {
    Alert.alert("Add Photo", "Show off your achievement!", [
      { text: "📷 Take Photo", onPress: takePhoto },
      { text: "🖼️ Choose from Library", onPress: pickPhoto },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function submit() {
    if (!title.trim()) { Alert.alert("Give your achievement a title!"); return; }
    const sharedPhoto = photoUri ? (await uploadMedia(photoUri, { folder: "achievements" })) ?? photoUri : undefined;
    const achievement: Achievement = {
      id: uid(),
      kidId: id,
      title: title.trim(),
      note: note.trim() || undefined,
      photoUri: sharedPhoto,
      category,
      createdAt: nowIso(),
    };
    dispatch({ type: "ACHIEVEMENT_ADD", kidId: id, achievement });
    dispatch({
      type: "NOTIFICATION_ADD",
      kidId: id,
      notification: {
        id: uid(), kidId: id,
        kind: "achievement_awarded",
        title: `🏆 ${kid?.profile.name} added a new achievement!`,
        body: title.trim(),
        read: false,
        createdAt: nowIso(),
      },
    });
    setTitle(""); setNote(""); setPhotoUri(null); setCategory("milestone");
    setShowForm(false);
    Alert.alert("🎉 Amazing!", "Your achievement has been saved and your parent has been notified!");
  }

  function deleteAchievement(a: Achievement) {
    Alert.alert("Remove achievement?", `"${a.title}"`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => dispatch({ type: "ACHIEVEMENT_REMOVE", kidId: id, achievementId: a.id }) },
    ]);
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🏆 My Achievements</Text>
      <Text style={styles.sub}>Record your wins — big and small. Your parent can award you bonus points!</Text>

      {achievements.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 64 }}>🏆</Text>
          <Text style={styles.emptyTitle}>No achievements yet!</Text>
          <Text style={styles.emptySub}>Did you win a medal? Save your first $10? Learn something new? Add it here!</Text>
        </View>
      ) : (
        achievements.map(a => {
          const cat = catFor(a.category);
          return (
            <TouchableOpacity key={a.id} style={[styles.card, { borderLeftColor: cat.color }]} onPress={() => setViewItem(a)}>
              {a.photoUri && <Image source={{ uri: a.photoUri }} style={styles.cardPhoto} resizeMode="cover" />}
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={{ fontSize: 22 }}>{cat.emoji}</Text>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.cardTitle}>{a.title}</Text>
                    <Text style={[styles.catLabel, { color: cat.color }]}>{cat.label}</Text>
                  </View>
                  {a.pointsAwarded != null && (
                    <View style={styles.pointsBadge}>
                      <Text style={styles.pointsBadgeText}>+{a.pointsAwarded} pts</Text>
                    </View>
                  )}
                </View>
                {a.note ? <Text style={styles.cardNote} numberOfLines={2}>{a.note}</Text> : null}
                <Text style={styles.cardDate}>{new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</Text>
                {a.parentComment ? (
                  <View style={styles.parentComment}>
                    <Text style={styles.parentCommentText}>💬 "{a.parentComment}"</Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })
      )}

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
        <Text style={styles.addBtnText}>🏅 Add Achievement</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />

      {/* View Detail Modal */}
      <Modal visible={!!viewItem} animationType="fade" transparent onRequestClose={() => setViewItem(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setViewItem(null)}>
          <View style={styles.viewCard}>
            {viewItem?.photoUri && (
              <Image source={{ uri: viewItem.photoUri }} style={styles.viewPhoto} resizeMode="cover" />
            )}
            <View style={{ padding: Spacing.md }}>
              <Text style={[styles.viewCat, { color: catFor(viewItem?.category ?? "other").color }]}>
                {catFor(viewItem?.category ?? "other").emoji} {catFor(viewItem?.category ?? "other").label}
              </Text>
              <Text style={styles.viewTitle}>{viewItem?.title}</Text>
              {viewItem?.note ? <Text style={styles.viewNote}>{viewItem.note}</Text> : null}
              <Text style={styles.viewDate}>{viewItem ? new Date(viewItem.createdAt).toLocaleDateString() : ""}</Text>
              {viewItem?.pointsAwarded != null && (
                <View style={styles.viewPoints}>
                  <Text style={styles.viewPointsText}>⭐ {viewItem.pointsAwarded} bonus points awarded!</Text>
                </View>
              )}
              {viewItem?.parentComment ? (
                <View style={styles.parentComment}>
                  <Text style={styles.parentCommentText}>💬 Parent: "{viewItem.parentComment}"</Text>
                </View>
              ) : (
                <Text style={styles.awaitingText}>⏳ Waiting for parent to review…</Text>
              )}
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => { setViewItem(null); if (viewItem) deleteAchievement(viewItem); }}
              >
                <Text style={styles.deleteBtnText}>🗑 Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Achievement Modal */}
      <Modal visible={showForm} animationType="slide" onRequestClose={() => setShowForm(false)}>
        <SafeAreaView style={styles.modal}>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>🏆 New Achievement</Text>

            <Text style={styles.label}>Category</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.catBtn, category === c.id && { backgroundColor: c.color + "25", borderColor: c.color }]}
                  onPress={() => setCategory(c.id)}
                >
                  <Text style={{ fontSize: 22 }}>{c.emoji}</Text>
                  <Text style={[styles.catBtnLabel, category === c.id && { color: c.color }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>What did you achieve?</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Won gold medal at school track meet!"
              autoFocus
            />

            <Text style={styles.label}>Tell me more (optional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 90, textAlignVertical: "top" }]}
              value={note}
              onChangeText={setNote}
              placeholder="What happened? How did it feel? How long did it take?"
              multiline
            />

            <Text style={styles.label}>Add a Photo (optional)</Text>
            {photoUri ? (
              <TouchableOpacity onPress={photoOptions}>
                <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
                <Text style={styles.changePhoto}>Tap to change</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.photoBtn} onPress={photoOptions}>
                <Text style={{ fontSize: 36 }}>📷</Text>
                <Text style={styles.photoBtnText}>Add a Photo</Text>
              </TouchableOpacity>
            )}

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={submit}>
                <Text style={styles.submitBtnText}>🏆 Save Achievement</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
  empty: { alignItems: "center", paddingVertical: Spacing.xl, gap: 12 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", maxWidth: 280, lineHeight: 20 },
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, marginBottom: 12, overflow: "hidden", borderLeftWidth: 5, ...Shadow.sm },
  cardPhoto: { width: "100%", height: 160 },
  cardBody: { padding: Spacing.md },
  cardTop: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  cardTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  catLabel: { fontSize: FontSize.xs, fontWeight: "600", marginTop: 1 },
  pointsBadge: { backgroundColor: Colors.warning + "25", borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  pointsBadgeText: { fontSize: FontSize.xs, fontWeight: "800", color: Colors.warning },
  cardNote: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: 4 },
  cardDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  parentComment: { marginTop: 8, backgroundColor: Colors.primary + "12", borderRadius: Radius.md, padding: 8 },
  parentCommentText: { fontSize: FontSize.sm, color: Colors.primary, fontStyle: "italic" },
  addBtn: { alignSelf: "center", backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 32, paddingVertical: 14, marginTop: Spacing.md, ...Shadow.md },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },
  // View modal
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: Spacing.md },
  viewCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, overflow: "hidden" },
  viewPhoto: { width: "100%", height: 220 },
  viewCat: { fontSize: FontSize.sm, fontWeight: "700", marginBottom: 4 },
  viewTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary, marginBottom: 6 },
  viewNote: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: 6 },
  viewDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 8 },
  viewPoints: { backgroundColor: Colors.warning + "20", borderRadius: Radius.md, padding: 10, marginBottom: 8 },
  viewPointsText: { fontSize: FontSize.base, fontWeight: "800", color: Colors.warning, textAlign: "center" },
  awaitingText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: "italic", marginBottom: 8 },
  deleteBtn: { borderWidth: 1, borderColor: Colors.error + "50", borderRadius: Radius.full, alignItems: "center", paddingVertical: 10, marginTop: 4 },
  deleteBtnText: { color: Colors.error, fontWeight: "700" },
  // Add modal
  modal: { flex: 1, backgroundColor: Colors.bgLight },
  modalContent: { padding: Spacing.lg, gap: 4 },
  modalTitle: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, textAlign: "center", marginBottom: Spacing.sm },
  label: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catBtn: { width: "30%", borderRadius: Radius.lg, borderWidth: 2, borderColor: Colors.border, padding: 8, alignItems: "center", gap: 4, backgroundColor: Colors.surfaceLight },
  catBtnLabel: { fontSize: 10, fontWeight: "700", color: Colors.textSecondary, textAlign: "center" },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, padding: 14, fontSize: FontSize.base, backgroundColor: Colors.surfaceLight },
  photoBtn: { backgroundColor: Colors.cardLight, borderRadius: Radius.xl, padding: Spacing.lg, alignItems: "center", gap: 8, borderWidth: 2, borderColor: Colors.border, borderStyle: "dashed" },
  photoBtnText: { fontSize: FontSize.base, fontWeight: "700", color: Colors.primary },
  preview: { width: "100%", height: 200, borderRadius: Radius.lg },
  changePhoto: { textAlign: "center", color: Colors.primary, fontWeight: "600", marginTop: 6, fontSize: FontSize.sm },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: Spacing.md },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  cancelBtnText: { fontWeight: "700", color: Colors.textSecondary },
  submitBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, ...Shadow.md },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
});
