import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Image, Alert, Modal, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import { Discovery, DiscoveryCategory } from "../../../../lib/data/types";

const CATEGORIES: { id: DiscoveryCategory; emoji: string; label: string; color: string }[] = [
  { id: "nature",   emoji: "🌿", label: "Nature",   color: "#16A34A" },
  { id: "animals",  emoji: "🐾", label: "Animals",  color: "#F97316" },
  { id: "science",  emoji: "🔬", label: "Science",  color: "#2563EB" },
  { id: "health",   emoji: "💚", label: "Health",   color: "#10B981" },
  { id: "food",     emoji: "🍎", label: "Food",     color: "#EF4444" },
  { id: "space",    emoji: "🚀", label: "Space",    color: "#7C3AED" },
  { id: "history",  emoji: "📜", label: "History",  color: "#92400E" },
  { id: "people",   emoji: "🧠", label: "People",   color: "#0891B2" },
  { id: "random",   emoji: "🎲", label: "Random",   color: "#64748B" },
];

const EXAMPLES: { emoji: string; title: string; category: DiscoveryCategory }[] = [
  { emoji: "🦶", title: "Walking barefoot on grass is healthy — it helps reduce stress and connect to the earth's energy!", category: "health" },
  { emoji: "🐦", title: "Magpies swoop and chase people during nesting season to protect their babies!", category: "animals" },
  { emoji: "🍯", title: "Honey never expires — archaeologists found 3,000-year-old honey in Egyptian tombs and it was still good!", category: "food" },
  { emoji: "🌊", title: "The ocean makes up 71% of Earth's surface but over 80% of it has never been explored!", category: "nature" },
  { emoji: "⚡", title: "Lightning strikes the Earth about 100 times every single second!", category: "science" },
  { emoji: "🦈", title: "Sharks are older than trees — they've been swimming in the ocean for over 450 million years!", category: "animals" },
  { emoji: "🍌", title: "Bananas are technically berries, but strawberries are NOT berries — science is weird!", category: "food" },
  { emoji: "🧲", title: "A day on Venus is longer than a year on Venus — it spins so slowly!", category: "space" },
];

function catFor(id: DiscoveryCategory) {
  return CATEGORIES.find(c => c.id === id) ?? CATEGORIES[8];
}

export default function DiscoveriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);

  const [showForm, setShowForm] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<DiscoveryCategory>("random");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<Discovery | null>(null);

  const discoveries = kid?.discoveries ?? [];

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.8 });
    if (!r.canceled) setPhotoUri(r.assets[0].uri);
  }

  async function takePhoto() {
    const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!r.canceled) setPhotoUri(r.assets[0].uri);
  }

  function photoOptions() {
    Alert.alert("Add Photo", "Show what you discovered!", [
      { text: "📷 Take Photo", onPress: takePhoto },
      { text: "🖼️ Choose from Library", onPress: pickPhoto },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function openForm(prefill?: { title: string; category: DiscoveryCategory }) {
    setTitle(prefill?.title ?? "");
    setNote("");
    setPhotoUri(null);
    setCategory(prefill?.category ?? "random");
    setShowExamples(false);
    setShowForm(true);
  }

  function save() {
    if (!title.trim()) { Alert.alert("Tell me what you discovered!"); return; }
    const discovery: Discovery = {
      id: uid(),
      kidId: id,
      title: title.trim(),
      note: note.trim() || undefined,
      photoUri: photoUri ?? undefined,
      category,
      createdAt: nowIso(),
    };
    dispatch({ type: "DISCOVERY_ADD", kidId: id, discovery });
    setShowForm(false);
  }

  function deleteDiscovery(d: Discovery) {
    Alert.alert("Remove this discovery?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => dispatch({ type: "DISCOVERY_REMOVE", kidId: id, discoveryId: d.id }) },
    ]);
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🔍 Things I Discovered</Text>
      <Text style={styles.sub}>Write down cool facts and things you learn every day. The world is full of amazing surprises!</Text>

      {/* Example inspiration banner */}
      <TouchableOpacity style={styles.exampleBanner} onPress={() => setShowExamples(true)}>
        <Text style={styles.exampleBannerEmoji}>💡</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.exampleBannerTitle}>Need inspiration?</Text>
          <Text style={styles.exampleBannerSub}>See example discoveries to get started!</Text>
        </View>
        <Text style={styles.exampleBannerArrow}>→</Text>
      </TouchableOpacity>

      {/* Discovery cards */}
      {discoveries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 60 }}>🔭</Text>
          <Text style={styles.emptyTitle}>Start exploring!</Text>
          <Text style={styles.emptySub}>
            Did you know walking barefoot is healthy? Or that a certain bird chases people?
            {"\n\n"}Write it down and never forget it!
          </Text>
        </View>
      ) : (
        discoveries.map(d => {
          const cat = catFor(d.category);
          return (
            <TouchableOpacity key={d.id} style={[styles.card, { borderTopColor: cat.color }]} onPress={() => setViewItem(d)}>
              {d.photoUri && <Image source={{ uri: d.photoUri }} style={styles.cardPhoto} resizeMode="cover" />}
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <View style={[styles.catChip, { backgroundColor: cat.color + "20" }]}>
                    <Text style={styles.catChipEmoji}>{cat.emoji}</Text>
                    <Text style={[styles.catChipLabel, { color: cat.color }]}>{cat.label}</Text>
                  </View>
                  <Text style={styles.cardDate}>
                    {new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </Text>
                </View>
                <Text style={styles.cardTitle}>{d.title}</Text>
                {d.note ? <Text style={styles.cardNote} numberOfLines={2}>{d.note}</Text> : null}
              </View>
            </TouchableOpacity>
          );
        })
      )}

      <TouchableOpacity style={styles.addBtn} onPress={() => openForm()}>
        <Text style={styles.addBtnText}>🔍 Add a Discovery</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />

      {/* Examples Modal */}
      <Modal visible={showExamples} animationType="slide" onRequestClose={() => setShowExamples(false)}>
        <SafeAreaView style={styles.modal}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>💡 Example Discoveries</Text>
            <Text style={styles.modalSub}>Tap one to use it as a starting point!</Text>
            {EXAMPLES.map((ex, i) => {
              const cat = catFor(ex.category);
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.exampleCard, { borderLeftColor: cat.color }]}
                  onPress={() => openForm({ title: ex.title, category: ex.category })}
                >
                  <Text style={styles.exampleEmoji}>{ex.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={[styles.catChip, { backgroundColor: cat.color + "20", alignSelf: "flex-start", marginBottom: 4 }]}>
                      <Text style={styles.catChipEmoji}>{cat.emoji}</Text>
                      <Text style={[styles.catChipLabel, { color: cat.color }]}>{cat.label}</Text>
                    </View>
                    <Text style={styles.exampleText}>{ex.title}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowExamples(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* View Detail Modal */}
      <Modal visible={!!viewItem} animationType="fade" transparent onRequestClose={() => setViewItem(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setViewItem(null)}>
          <View style={styles.viewCard}>
            {viewItem?.photoUri && (
              <Image source={{ uri: viewItem.photoUri }} style={styles.viewPhoto} resizeMode="cover" />
            )}
            <View style={{ padding: Spacing.md }}>
              {viewItem && (
                <View style={[styles.catChip, { backgroundColor: catFor(viewItem.category).color + "20", alignSelf: "flex-start", marginBottom: 8 }]}>
                  <Text style={styles.catChipEmoji}>{catFor(viewItem.category).emoji}</Text>
                  <Text style={[styles.catChipLabel, { color: catFor(viewItem.category).color }]}>{catFor(viewItem.category).label}</Text>
                </View>
              )}
              <Text style={styles.viewTitle}>{viewItem?.title}</Text>
              {viewItem?.note ? <Text style={styles.viewNote}>{viewItem.note}</Text> : null}
              <Text style={styles.viewDate}>{viewItem ? new Date(viewItem.createdAt).toLocaleDateString() : ""}</Text>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => { setViewItem(null); if (viewItem) deleteDiscovery(viewItem); }}
              >
                <Text style={styles.deleteBtnText}>🗑 Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Form Modal */}
      <Modal visible={showForm} animationType="slide" onRequestClose={() => setShowForm(false)}>
        <SafeAreaView style={styles.modal}>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>🔍 What Did You Discover?</Text>

            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.catPickBtn, category === c.id && { backgroundColor: c.color + "25", borderColor: c.color }]}
                    onPress={() => setCategory(c.id)}
                  >
                    <Text style={{ fontSize: 18 }}>{c.emoji}</Text>
                    <Text style={[styles.catPickLabel, category === c.id && { color: c.color }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.fieldLabel}>What did you discover?</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Walking barefoot on grass is healthy for you!"
              autoFocus
              multiline
            />

            <Text style={styles.fieldLabel}>Tell me more about it (optional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 90, textAlignVertical: "top" }]}
              value={note}
              onChangeText={setNote}
              placeholder="Where did you learn this? What happened? Why is it interesting?"
              multiline
            />

            <Text style={styles.fieldLabel}>Add a Photo (optional)</Text>
            {photoUri ? (
              <TouchableOpacity onPress={photoOptions}>
                <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
                <Text style={styles.changePhoto}>Tap to change</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.photoBtn} onPress={photoOptions}>
                <Text style={{ fontSize: 32 }}>📷</Text>
                <Text style={styles.photoBtnText}>Add a Photo</Text>
              </TouchableOpacity>
            )}

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={save}>
                <Text style={styles.saveBtnText}>💾 Save It!</Text>
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
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  exampleBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.primary + "12", borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  exampleBannerEmoji: { fontSize: 28 },
  exampleBannerTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primary },
  exampleBannerSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  exampleBannerArrow: { fontSize: 18, color: Colors.primary, fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: Spacing.xl, gap: 12 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", maxWidth: 300, lineHeight: 22 },
  card: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, marginBottom: 12,
    overflow: "hidden", borderTopWidth: 4, ...Shadow.sm,
  },
  cardPhoto: { width: "100%", height: 150 },
  cardBody: { padding: Spacing.md },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  catChipEmoji: { fontSize: 13 },
  catChipLabel: { fontSize: 11, fontWeight: "700" },
  cardDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  cardTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary, lineHeight: 22 },
  cardNote: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginTop: 4 },
  addBtn: {
    alignSelf: "center", backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 32, paddingVertical: 14, marginTop: Spacing.md, ...Shadow.md,
  },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },
  // Overlay / detail modal
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: Spacing.md },
  viewCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, overflow: "hidden" },
  viewPhoto: { width: "100%", height: 200 },
  viewTitle: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary, marginBottom: 6, lineHeight: 26 },
  viewNote: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 22, marginBottom: 8 },
  viewDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 12 },
  deleteBtn: { borderWidth: 1, borderColor: Colors.error + "50", borderRadius: Radius.full, alignItems: "center", paddingVertical: 10 },
  deleteBtnText: { color: Colors.error, fontWeight: "700" },
  // Form / examples modal
  modal: { flex: 1, backgroundColor: Colors.bgLight },
  modalContent: { padding: Spacing.lg, gap: 4 },
  modalTitle: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, textAlign: "center", marginBottom: 4 },
  modalSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", marginBottom: Spacing.md },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },
  catPickBtn: {
    borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg,
    paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", gap: 4,
    backgroundColor: Colors.surfaceLight,
  },
  catPickLabel: { fontSize: 10, fontWeight: "700", color: Colors.textSecondary },
  input: {
    borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg,
    padding: 14, fontSize: FontSize.base, backgroundColor: Colors.surfaceLight, lineHeight: 22,
  },
  photoBtn: {
    backgroundColor: Colors.cardLight, borderRadius: Radius.xl, padding: Spacing.lg,
    alignItems: "center", gap: 8, borderWidth: 2, borderColor: Colors.border, borderStyle: "dashed",
  },
  photoBtnText: { fontSize: FontSize.base, fontWeight: "700", color: Colors.primary },
  preview: { width: "100%", height: 200, borderRadius: Radius.lg },
  changePhoto: { textAlign: "center", color: Colors.primary, fontWeight: "600", marginTop: 6, fontSize: FontSize.sm },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: Spacing.md },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  cancelBtnText: { fontWeight: "700", color: Colors.textSecondary },
  saveBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, ...Shadow.md },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  // Examples list
  exampleCard: {
    flexDirection: "row", gap: 12, backgroundColor: Colors.surfaceLight,
    borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 10,
    borderLeftWidth: 4, ...Shadow.sm,
  },
  exampleEmoji: { fontSize: 30 },
  exampleText: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  closeBtn: {
    borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full,
    alignItems: "center", paddingVertical: 14, marginTop: Spacing.md,
  },
  closeBtnText: { fontWeight: "700", color: Colors.textSecondary, fontSize: FontSize.base },
});
