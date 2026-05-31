import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Image, Alert, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";

export default function WishesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useData();
  const kid = useKid(id);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.7 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function takePhoto() {
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  function openPhotoOptions() {
    Alert.alert("Add a photo", "Show what you're wishing for!", [
      { text: "📷 Take Photo", onPress: takePhoto },
      { text: "🖼️ Choose from Library", onPress: pickPhoto },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function addWish() {
    if (!title.trim()) { Alert.alert("Give your wish a title!"); return; }
    const wish = {
      id: uid(), kidId: id,
      title: title.trim(),
      note: note.trim() || undefined,
      photoUri: photoUri ?? undefined,
      category: "general",
      decision: "pending" as const,
      createdAt: nowIso(),
    };
    dispatch({ type: "WISH_ADD", kidId: id, wish });

    // Alert parent
    dispatch({
      type: "NOTIFICATION_ADD",
      kidId: id,
      notification: {
        id: uid(), kidId: id,
        kind: "wish_decision",
        title: `🌟 ${kid?.profile.name} added a new wish!`,
        body: `"${title.trim()}"`,
        read: false,
        createdAt: nowIso(),
      },
    });

    setTitle(""); setNote(""); setPhotoUri(null);
    setShowForm(false);
  }

  function deleteWish(wishId: string) {
    Alert.alert("Remove wish?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => dispatch({ type: "WISH_REMOVE", kidId: id, wishId }) },
    ]);
  }

  const wishes = kid?.wishes ?? [];

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🌟 My Wish List</Text>

      {wishes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 64 }}>🌟</Text>
          <Text style={styles.emptyTitle}>Make a wish!</Text>
          <Text style={styles.emptySub}>Write down things you'd love to have or do. Your parent will see your wishes!</Text>
        </View>
      ) : (
        wishes.map(w => (
          <View key={w.id} style={styles.wishCard}>
            {w.photoUri && (
              <Image source={{ uri: w.photoUri }} style={styles.wishPhoto} resizeMode="cover" />
            )}
            <View style={styles.wishBody}>
              <View style={styles.wishRow}>
                <Text style={styles.wishTitle}>{w.title}</Text>
                <TouchableOpacity onPress={() => deleteWish(w.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              {w.note ? <Text style={styles.wishNote}>{w.note}</Text> : null}
              <View style={styles.wishFooter}>
                <Text style={styles.wishDate}>{new Date(w.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</Text>
                {w.decision === "approved" && <Text style={styles.wishApproved}>✅ Approved!</Text>}
                {w.decision === "denied" && <Text style={styles.wishDenied}>💙 Not this time</Text>}
                {w.parentComment && <Text style={styles.wishComment}>"{w.parentComment}"</Text>}
              </View>
            </View>
          </View>
        ))
      )}

      <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
        <Text style={styles.addBtnText}>✨ Add a Wish</Text>
      </TouchableOpacity>

      {/* Add wish modal */}
      <Modal visible={showForm} animationType="slide" onRequestClose={() => setShowForm(false)}>
        <SafeAreaView style={styles.modal}>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>🌟 New Wish</Text>

            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="I wish for…"
              autoFocus
            />

            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
              value={note}
              onChangeText={setNote}
              placeholder="Why do you want it? (optional)"
              multiline
            />

            {photoUri ? (
              <TouchableOpacity onPress={openPhotoOptions}>
                <Image source={{ uri: photoUri }} style={styles.previewPhoto} resizeMode="cover" />
                <Text style={styles.changePhoto}>Tap to change photo</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.photoBtn} onPress={openPhotoOptions}>
                <Text style={styles.photoBtnText}>📷 Add a Photo</Text>
              </TouchableOpacity>
            )}

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowForm(false); setTitle(""); setNote(""); setPhotoUri(null); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={addWish}>
                <Text style={styles.saveBtnText}>Make a Wish ✨</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  empty: { alignItems: "center", paddingVertical: Spacing.xl, gap: 10 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", maxWidth: 280, lineHeight: 20 },
  wishCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, marginBottom: 12, overflow: "hidden", ...Shadow.sm },
  wishPhoto: { width: "100%", height: 180 },
  wishBody: { padding: Spacing.md },
  wishRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  wishTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary, flex: 1, marginRight: 8 },
  wishNote: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, lineHeight: 20 },
  wishFooter: { marginTop: 8, gap: 4 },
  wishDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  wishApproved: { fontSize: FontSize.sm, color: Colors.success, fontWeight: "700" },
  wishDenied: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "700" },
  wishComment: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: "italic" },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: Colors.textMuted, fontSize: 16 },
  addBtn: { alignSelf: "center", backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 32, paddingVertical: 14, marginTop: Spacing.md, ...Shadow.md },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },
  // Modal
  modal: { flex: 1, backgroundColor: Colors.bgLight },
  modalContent: { padding: Spacing.lg, gap: 12 },
  modalTitle: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, textAlign: "center", marginBottom: 8 },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.md, fontSize: FontSize.base, backgroundColor: Colors.surfaceLight },
  photoBtn: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.lg, alignItems: "center", backgroundColor: Colors.cardLight },
  photoBtnText: { color: Colors.primary, fontWeight: "600", fontSize: FontSize.base },
  previewPhoto: { width: "100%", height: 200, borderRadius: Radius.lg },
  changePhoto: { textAlign: "center", color: Colors.primary, fontWeight: "600", marginTop: 6, fontSize: FontSize.sm },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  cancelBtnText: { fontWeight: "700", color: Colors.textSecondary },
  saveBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, ...Shadow.md },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
});
