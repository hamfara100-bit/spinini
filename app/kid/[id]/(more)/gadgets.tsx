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
import { GadgetItem } from "../../../../lib/data/types";

export default function GadgetsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<GadgetItem | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<GadgetItem | null>(null);

  const gadgets = kid?.gadgets ?? [];

  function openAdd() {
    setEditItem(null); setTitle(""); setNote(""); setPhotoUri(null);
    setShowForm(true);
  }

  function openEdit(item: GadgetItem) {
    setEditItem(item); setTitle(item.title); setNote(item.note ?? ""); setPhotoUri(item.photoUri ?? null);
    setShowForm(true);
  }

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.8 });
    if (!r.canceled) setPhotoUri(r.assets[0].uri);
  }

  async function takePhoto() {
    const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!r.canceled) setPhotoUri(r.assets[0].uri);
  }

  function pickPhotoOptions() {
    Alert.alert("Add a photo", "Show off your cool thing!", [
      { text: "📷 Take Photo", onPress: takePhoto },
      { text: "🖼️ Choose from Library", onPress: pickPhoto },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function save() {
    if (!title.trim()) { Alert.alert("Give it a name!"); return; }
    if (editItem) {
      dispatch({
        type: "GADGET_ADD",
        kidId: id,
        item: { ...editItem, title: title.trim(), note: note.trim() || undefined, photoUri: photoUri ?? undefined },
      });
      // Remove old and re-add (simplest update since no GADGET_UPDATE)
      dispatch({ type: "GADGET_REMOVE", kidId: id, itemId: editItem.id });
    }
    dispatch({
      type: "GADGET_ADD",
      kidId: id,
      item: {
        id: editItem?.id ?? uid(),
        kidId: id,
        title: title.trim(),
        note: note.trim() || undefined,
        photoUri: photoUri ?? undefined,
        createdAt: editItem?.createdAt ?? nowIso(),
      },
    });
    setShowForm(false);
  }

  function deleteItem(item: GadgetItem) {
    Alert.alert("Remove this?", `"${item.title}"`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => dispatch({ type: "GADGET_REMOVE", kidId: id, itemId: item.id }) },
    ]);
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>🏆 My Cool Things</Text>
      <Text style={styles.sub}>Your lego creations, cool toys, and awesome stuff you made!</Text>

      {gadgets.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 64 }}>🏆</Text>
          <Text style={styles.emptyTitle}>Nothing here yet!</Text>
          <Text style={styles.emptySub}>Take a photo of your coolest lego build, toy collection, or something awesome you made!</Text>
        </View>
      ) : (
        <FlatList
          data={gadgets}
          keyExtractor={g => g.id}
          numColumns={2}
          style={{ flex: 1 }}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ gap: 10, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setViewItem(item)}
              onLongPress={() => deleteItem(item)}
              delayLongPress={600}
            >
              {item.photoUri ? (
                <Image source={{ uri: item.photoUri }} style={styles.cardPhoto} resizeMode="cover" />
              ) : (
                <View style={[styles.cardPhoto, styles.cardPhotoPlaceholder]}>
                  <Text style={{ fontSize: 40 }}>🏆</Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                {item.note ? <Text style={styles.cardNote} numberOfLines={2}>{item.note}</Text> : null}
                <Text style={styles.cardDate}>{new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={openAdd}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* View Item Modal */}
      <Modal visible={!!viewItem} animationType="fade" transparent onRequestClose={() => setViewItem(null)}>
        <TouchableOpacity style={styles.viewOverlay} activeOpacity={1} onPress={() => setViewItem(null)}>
          <View style={styles.viewCard}>
            {viewItem?.photoUri && (
              <Image source={{ uri: viewItem.photoUri }} style={styles.viewPhoto} resizeMode="contain" />
            )}
            <Text style={styles.viewTitle}>{viewItem?.title}</Text>
            {viewItem?.note ? <Text style={styles.viewNote}>{viewItem.note}</Text> : null}
            <Text style={styles.viewDate}>{viewItem ? new Date(viewItem.createdAt).toLocaleDateString() : ""}</Text>
            <View style={styles.viewBtns}>
              <TouchableOpacity style={styles.editBtn} onPress={() => { setViewItem(null); if (viewItem) openEdit(viewItem); }}>
                <Text style={styles.editBtnText}>✏️ Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.delBtn} onPress={() => { setViewItem(null); if (viewItem) deleteItem(viewItem); }}>
                <Text style={styles.delBtnText}>🗑 Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add/Edit Modal */}
      <Modal visible={showForm} animationType="slide" onRequestClose={() => setShowForm(false)}>
        <SafeAreaView style={styles.modal}>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{editItem ? "✏️ Edit" : "🏆 Add Cool Thing"}</Text>

            {photoUri ? (
              <TouchableOpacity onPress={pickPhotoOptions}>
                <Image source={{ uri: photoUri }} style={styles.previewPhoto} resizeMode="cover" />
                <Text style={styles.changePhotoText}>Tap to change photo</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.photoBtn} onPress={pickPhotoOptions}>
                <Text style={{ fontSize: 40 }}>📷</Text>
                <Text style={styles.photoBtnText}>Add a Photo</Text>
                <Text style={styles.photoBtnSub}>Show off your cool creation!</Text>
              </TouchableOpacity>
            )}

            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="What is it? (e.g. LEGO Spaceship 🚀)"
              autoFocus
            />
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
              value={note}
              onChangeText={setNote}
              placeholder="Tell me more about it… (optional)"
              multiline
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={save}>
                <Text style={styles.saveBtnText}>💾 Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: Spacing.xl },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", maxWidth: 280, lineHeight: 20 },
  card: { flex: 1, backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, overflow: "hidden", ...Shadow.sm },
  cardPhoto: { width: "100%", height: 130 },
  cardPhotoPlaceholder: { backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  cardBody: { padding: 10, gap: 4 },
  cardTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  cardNote: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16 },
  cardDate: { fontSize: 10, color: Colors.textMuted },
  fab: { position: "absolute", bottom: 24, right: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", ...Shadow.md },
  fabText: { color: "#fff", fontSize: 32, fontWeight: "300", lineHeight: 36 },
  // View modal
  viewOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", alignItems: "center", justifyContent: "center", padding: Spacing.md },
  viewCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, width: "100%", overflow: "hidden" },
  viewPhoto: { width: "100%", height: 280 },
  viewTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary, padding: Spacing.md, paddingBottom: 4 },
  viewNote: { fontSize: FontSize.sm, color: Colors.textSecondary, paddingHorizontal: Spacing.md, lineHeight: 20 },
  viewDate: { fontSize: FontSize.xs, color: Colors.textMuted, paddingHorizontal: Spacing.md, paddingBottom: 8 },
  viewBtns: { flexDirection: "row", borderTopWidth: 1, borderTopColor: Colors.border },
  editBtn: { flex: 1, alignItems: "center", padding: Spacing.md },
  editBtnText: { color: Colors.primary, fontWeight: "700" },
  delBtn: { flex: 1, alignItems: "center", padding: Spacing.md },
  delBtnText: { color: Colors.error, fontWeight: "700" },
  // Add/Edit modal
  modal: { flex: 1, backgroundColor: Colors.bgLight },
  modalContent: { padding: Spacing.lg, gap: 12 },
  modalTitle: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, textAlign: "center", marginBottom: 8 },
  photoBtn: { backgroundColor: Colors.cardLight, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: "center", gap: 8, borderWidth: 2, borderColor: Colors.border, borderStyle: "dashed" },
  photoBtnText: { fontSize: FontSize.md, fontWeight: "700", color: Colors.primary },
  photoBtnSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  previewPhoto: { width: "100%", height: 220, borderRadius: Radius.lg },
  changePhotoText: { textAlign: "center", color: Colors.primary, fontWeight: "600", marginTop: 6, fontSize: FontSize.sm },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.md, fontSize: FontSize.base, backgroundColor: Colors.surfaceLight },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  cancelBtnText: { fontWeight: "700", color: Colors.textSecondary },
  saveBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, ...Shadow.md },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
});
