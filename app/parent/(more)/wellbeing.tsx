import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, Alert, FlatList,
} from "react-native";
import { MicButton } from "../../../components/voice-text-input";
import * as ImagePicker from "expo-image-picker";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso } from "../../../lib/utils";
import type { WellBeingCategory, WellBeingEntry, WellBeingFontStyle } from "../../../lib/data/types";

const SUGGESTED_CATEGORIES = [
  { emoji: "😢", title: "When I'm Sad", color: "#3B82F6", description: "Things to do or watch when feeling down" },
  { emoji: "🤒", title: "When I'm Sick", color: "#10B981", description: "Self-care and comfort tips when unwell" },
  { emoji: "😤", title: "When I'm Angry", color: "#EF4444", description: "How to calm down and handle frustration" },
  { emoji: "😟", title: "Facing Bullying", color: "#8B5CF6", description: "What to do if someone is mean to you" },
  { emoji: "🥱", title: "When I'm Bored", color: "#F59E0B", description: "Fun ideas and activities to try" },
  { emoji: "💸", title: "Money Problems", color: "#059669", description: "Understanding money and being smart with it" },
  { emoji: "👫", title: "Friendship", color: "#EC4899", description: "How to make friends and handle conflict" },
  { emoji: "😰", title: "Feeling Anxious", color: "#6366F1", description: "Breathing and calming techniques" },
  { emoji: "💔", title: "Feeling Left Out", color: "#F43F5E", description: "You matter — here's a reminder" },
  { emoji: "🏫", title: "School Stress", color: "#0EA5E9", description: "Tips for studying and handling school pressure" },
  { emoji: "❤️", title: "Self Love", color: "#F97316", description: "Why you are amazing just as you are" },
  { emoji: "🌙", title: "Can't Sleep", color: "#312E81", description: "Bedtime routines and calming ideas" },
];

const FONT_STYLES: { key: WellBeingFontStyle; label: string }[] = [
  { key: "normal",      label: "Aa Normal" },
  { key: "serif",       label: "Serif" },
  { key: "handwriting", label: "✏️ Personal" },
];

const VIDEO_HINTS = [
  "YouTube: https://youtu.be/…",
  "TikTok: https://www.tiktok.com/@…",
];

// ─── Entry card ───────────────────────────────────────────────────────────────
function EntryCard({ entry, onEdit, onDelete }: {
  entry: WellBeingEntry; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <View style={ec.card}>
      <Text style={ec.title} numberOfLines={1}>{entry.title}</Text>
      <Text style={ec.preview} numberOfLines={2}>{entry.bodyText}</Text>
      {entry.videoUrls.length > 0 && (
        <Text style={ec.videos}>🎬 {entry.videoUrls.length} video{entry.videoUrls.length > 1 ? "s" : ""}</Text>
      )}
      {entry.images.length > 0 && (
        <Text style={ec.imgs}>🖼️ {entry.images.length} image{entry.images.length > 1 ? "s" : ""}</Text>
      )}
      <View style={ec.footer}>
        <Text style={ec.date}>Updated {new Date(entry.updatedAt).toLocaleDateString()}</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity onPress={onEdit}><Text style={{ color: Colors.primary, fontWeight: "700", fontSize: 12 }}>✏️ Edit</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert("Delete?", "Remove this entry?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: onDelete },
          ])}><Text style={{ color: Colors.error, fontWeight: "700", fontSize: 12 }}>🗑 Delete</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ParentWellBeingScreen() {
  const { state, dispatch } = useData();
  const categories = state.wellBeingCategories ?? [];
  const entries = state.wellBeingEntries ?? [];

  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [showAddCat, setShowAddCat] = useState(false);
  const [showEditEntry, setShowEditEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WellBeingEntry | null>(null);

  // Category form
  const [catEmoji, setCatEmoji] = useState("❤️");
  const [catTitle, setCatTitle] = useState("");
  const [catColor, setCatColor] = useState("#7C5CFF");
  const [catDesc, setCatDesc] = useState("");

  // Entry form
  const [entryTitle, setEntryTitle] = useState("");
  const [entryBody, setEntryBody] = useState("");
  const [entryFont, setEntryFont] = useState<WellBeingFontStyle>("normal");
  const [entryVideos, setEntryVideos] = useState<string[]>([]);
  const [entryImages, setEntryImages] = useState<string[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState("");

  const selectedCat = categories.find(c => c.id === selectedCatId);
  const catEntries = entries.filter(e => e.categoryId === selectedCatId);

  function resetEntryForm() {
    setEntryTitle(""); setEntryBody(""); setEntryFont("normal");
    setEntryVideos([]); setEntryImages([]); setNewVideoUrl(""); setEditingEntry(null);
  }

  function openEditEntry(entry?: WellBeingEntry) {
    if (entry) {
      setEditingEntry(entry);
      setEntryTitle(entry.title); setEntryBody(entry.bodyText);
      setEntryFont(entry.fontStyle); setEntryVideos(entry.videoUrls);
      setEntryImages(entry.images);
    } else resetEntryForm();
    setShowEditEntry(true);
  }

  function saveEntry() {
    if (!selectedCatId) return;
    if (!entryTitle.trim()) { Alert.alert("Add a title", "Give this entry a name."); return; }
    if (!entryBody.trim()) { Alert.alert("Add content", "Write something for your child."); return; }
    if (editingEntry) {
      dispatch({ type: "WELLBEING_ENTRY_UPDATE", entryId: editingEntry.id, payload: {
        title: entryTitle.trim(), bodyText: entryBody.trim(),
        fontStyle: entryFont, videoUrls: entryVideos, images: entryImages,
      }});
    } else {
      const entry: WellBeingEntry = {
        id: uid(), categoryId: selectedCatId,
        title: entryTitle.trim(), bodyText: entryBody.trim(),
        fontStyle: entryFont, videoUrls: entryVideos, images: entryImages,
        createdAt: nowIso(), updatedAt: nowIso(),
      };
      dispatch({ type: "WELLBEING_ENTRY_ADD", entry });
    }
    setShowEditEntry(false); resetEntryForm();
  }

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.8 });
    if (!res.canceled && res.assets[0]) {
      setEntryImages(imgs => [...imgs, res.assets[0].uri]);
    }
  }

  function addVideo() {
    const url = newVideoUrl.trim();
    if (!url) return;
    if (!url.startsWith("http")) { Alert.alert("Invalid URL", "Paste a YouTube or TikTok link."); return; }
    setEntryVideos(vs => [...vs, url]);
    setNewVideoUrl("");
  }

  function saveCategory() {
    if (!catTitle.trim()) { Alert.alert("Add a title", "Give the category a name."); return; }
    const cat: WellBeingCategory = {
      id: uid(), emoji: catEmoji, title: catTitle.trim(),
      color: catColor, description: catDesc.trim() || undefined, createdAt: nowIso(),
    };
    dispatch({ type: "WELLBEING_CATEGORY_ADD", category: cat });
    setShowAddCat(false); setCatEmoji("❤️"); setCatTitle(""); setCatColor("#7C5CFF"); setCatDesc("");
  }

  const COLOR_PALETTE = ["#7C5CFF", "#3B82F6", "#10B981", "#EF4444", "#F59E0B", "#EC4899", "#8B5CF6", "#0EA5E9", "#F97316", "#059669"];

  // ── Category detail view ──────────────────────────────────────────────────
  if (selectedCat) return (
    <ScreenContainer scroll>
      <TouchableOpacity onPress={() => setSelectedCatId(null)} style={{ marginBottom: 12 }}>
        <Text style={{ color: Colors.primary, fontWeight: "700", fontSize: 14 }}>← All Categories</Text>
      </TouchableOpacity>
      <View style={[s.catHeader, { backgroundColor: selectedCat.color + "18", borderColor: selectedCat.color + "40" }]}>
        <Text style={{ fontSize: 36 }}>{selectedCat.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.catTitle, { color: selectedCat.color }]}>{selectedCat.title}</Text>
          {selectedCat.description ? <Text style={s.catDesc}>{selectedCat.description}</Text> : null}
        </View>
        <TouchableOpacity
          style={[s.addEntryBtn, { backgroundColor: selectedCat.color }]}
          onPress={() => openEditEntry()}
        >
          <Text style={s.addEntryText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {catEntries.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 48 }}>{selectedCat.emoji}</Text>
          <Text style={s.emptyTitle}>No entries yet</Text>
          <Text style={s.emptySub}>Add advice, videos, or tips for when your child feels this way.</Text>
          <TouchableOpacity style={[s.addEntryBtn, { backgroundColor: selectedCat.color, paddingHorizontal: 24 }]} onPress={() => openEditEntry()}>
            <Text style={s.addEntryText}>+ Add First Entry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        catEntries.map(entry => (
          <EntryCard
            key={entry.id} entry={entry}
            onEdit={() => openEditEntry(entry)}
            onDelete={() => dispatch({ type: "WELLBEING_ENTRY_DELETE", entryId: entry.id })}
          />
        ))
      )}

      {/* Entry editor modal */}
      <Modal visible={showEditEntry} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowEditEntry(false); resetEntryForm(); }}>
        <View style={{ flex: 1, backgroundColor: Colors.bgLight }}>
          <View style={m.handle} />
          <ScrollView contentContainerStyle={m.body} keyboardShouldPersistTaps="handled">
            <Text style={m.title}>{editingEntry ? "✏️ Edit Entry" : "✍️ New Entry"}</Text>

            <Text style={m.label}>Title</Text>
            <TextInput style={m.input} placeholder="e.g. What to do when sad" placeholderTextColor={Colors.textMuted} value={entryTitle} onChangeText={setEntryTitle} />

            <Text style={m.label}>Font style</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              {FONT_STYLES.map(f => (
                <TouchableOpacity key={f.key} style={[m.fontBtn, entryFont === f.key && m.fontBtnActive]} onPress={() => setEntryFont(f.key)}>
                  <Text style={[m.fontText, entryFont === f.key && { color: "#fff" }]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={m.label}>Content</Text>
              <MicButton appendTo={entryBody} onAppend={setEntryBody} onResult={setEntryBody} size={34} />
            </View>
            <Text style={m.hint}>Write advice, tips, what to do, who to call, etc. You can use emoji and be creative!</Text>
            <TextInput
              style={[m.input, {
                minHeight: 200,
                fontFamily: entryFont === "serif" ? "serif" : entryFont === "handwriting" ? "cursive" : undefined,
              }]}
              multiline placeholder="Write here… or tap 🎙️ to dictate!"
              placeholderTextColor={Colors.textMuted}
              value={entryBody} onChangeText={setEntryBody}
            />

            <Text style={m.label}>🎬 Video Links (YouTube / TikTok)</Text>
            {entryVideos.map((v, i) => (
              <View key={i} style={m.videoRow}>
                <Text style={m.videoUrl} numberOfLines={1}>{v}</Text>
                <TouchableOpacity onPress={() => setEntryVideos(vs => vs.filter((_, j) => j !== i))}>
                  <Text style={{ color: Colors.error, fontWeight: "700" }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={m.videoAdd}>
              <TextInput
                style={[m.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Paste YouTube or TikTok URL…"
                placeholderTextColor={Colors.textMuted}
                value={newVideoUrl} onChangeText={setNewVideoUrl}
                autoCapitalize="none" keyboardType="url"
              />
              <TouchableOpacity style={m.addVideoBtn} onPress={addVideo}>
                <Text style={m.addVideoText}>Add</Text>
              </TouchableOpacity>
            </View>

            <Text style={m.label}>🖼️ Images</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              <TouchableOpacity style={m.addImgBtn} onPress={pickImage}>
                <Text style={{ fontSize: 28 }}>+</Text>
                <Text style={m.addImgText}>Add Photo</Text>
              </TouchableOpacity>
              {entryImages.map((img, i) => (
                <View key={i} style={m.imgThumb}>
                  <TouchableOpacity style={m.imgDel} onPress={() => setEntryImages(imgs => imgs.filter((_, j) => j !== i))}>
                    <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>✕</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 11, color: Colors.textMuted, textAlign: "center" }}>📷 {i + 1}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={m.btnRow}>
              <TouchableOpacity style={m.cancelBtn} onPress={() => { setShowEditEntry(false); resetEntryForm(); }}>
                <Text style={m.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={m.saveBtn} onPress={saveEntry}>
                <Text style={m.saveText}>💾 Save Entry</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );

  // ── Category grid view ────────────────────────────────────────────────────
  return (
    <ScreenContainer scroll>
      <View style={s.header}>
        <View>
          <Text style={s.title}>💙 Emotional Well-Being</Text>
          <Text style={s.sub}>Advice &amp; support for every feeling</Text>
        </View>
        <TouchableOpacity style={s.newBtn} onPress={() => setShowAddCat(true)}>
          <Text style={s.newBtnText}>+ Category</Text>
        </TouchableOpacity>
      </View>

      {categories.length === 0 ? (
        <View style={s.emptyWrap}>
          <Text style={{ fontSize: 52, marginBottom: 12 }}>💙</Text>
          <Text style={s.emptyTitle}>Start your Well-Being Library</Text>
          <Text style={s.emptySub}>Create categories for different feelings and situations. Add advice, videos, and tips so your child knows exactly what to do.</Text>
          <Text style={[s.hint, { marginTop: 16 }]}>💡 Suggested categories:</Text>
          <View style={s.suggGrid}>
            {SUGGESTED_CATEGORIES.slice(0, 6).map(sug => (
              <TouchableOpacity
                key={sug.title}
                style={[s.suggChip, { backgroundColor: sug.color + "18", borderColor: sug.color + "40" }]}
                onPress={() => { setCatEmoji(sug.emoji); setCatTitle(sug.title); setCatColor(sug.color); setCatDesc(sug.description); setShowAddCat(true); }}
              >
                <Text>{sug.emoji} {sug.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <>
          {/* Suggested quick-add when not all covered */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
            {SUGGESTED_CATEGORIES.filter(sg => !categories.some(c => c.title === sg.title)).slice(0, 5).map(sug => (
              <TouchableOpacity
                key={sug.title}
                style={[s.suggChipSm, { borderColor: sug.color + "60" }]}
                onPress={() => { setCatEmoji(sug.emoji); setCatTitle(sug.title); setCatColor(sug.color); setCatDesc(sug.description); setShowAddCat(true); }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: sug.color }}>{sug.emoji} {sug.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={s.grid}>
            {categories.map(cat => {
              const count = entries.filter(e => e.categoryId === cat.id).length;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[s.catCard, { backgroundColor: cat.color + "15", borderColor: cat.color + "40" }]}
                  onPress={() => setSelectedCatId(cat.id)}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 36, marginBottom: 6 }}>{cat.emoji}</Text>
                  <Text style={[s.catCardTitle, { color: cat.color }]} numberOfLines={2}>{cat.title}</Text>
                  <Text style={s.catCardCount}>{count} {count === 1 ? "entry" : "entries"}</Text>
                  <TouchableOpacity
                    style={s.catDel}
                    onPress={() => Alert.alert("Delete category?", `This will delete "${cat.title}" and all its entries.`, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => dispatch({ type: "WELLBEING_CATEGORY_DELETE", categoryId: cat.id }) },
                    ])}
                  >
                    <Text style={{ fontSize: 13 }}>🗑</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}

            {/* Add new */}
            <TouchableOpacity style={s.addCatCard} onPress={() => setShowAddCat(true)}>
              <Text style={{ fontSize: 30, color: Colors.textMuted }}>+</Text>
              <Text style={s.addCatLabel}>New Category</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Add Category Modal */}
      <Modal visible={showAddCat} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddCat(false)}>
        <View style={{ flex: 1, backgroundColor: Colors.bgLight }}>
          <View style={m.handle} />
          <ScrollView contentContainerStyle={m.body} keyboardShouldPersistTaps="handled">
            <Text style={m.title}>🗂 New Category</Text>
            <Text style={m.label}>Emoji</Text>
            <TextInput style={[m.input, { fontSize: 28, textAlign: "center" }]} value={catEmoji} onChangeText={setCatEmoji} maxLength={2} />
            <Text style={m.label}>Title</Text>
            <TextInput style={m.input} placeholder="e.g. When I'm Sad" placeholderTextColor={Colors.textMuted} value={catTitle} onChangeText={setCatTitle} />
            <Text style={m.label}>Description (optional)</Text>
            <TextInput style={m.input} placeholder="What this section is about…" placeholderTextColor={Colors.textMuted} value={catDesc} onChangeText={setCatDesc} />
            <Text style={m.label}>Color</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {COLOR_PALETTE.map(c => (
                <TouchableOpacity key={c} style={[m.colorDot, { backgroundColor: c }, catColor === c && m.colorDotActive]} onPress={() => setCatColor(c)} />
              ))}
            </View>
            <View style={[m.btnRow, { marginTop: 24 }]}>
              <TouchableOpacity style={m.cancelBtn} onPress={() => setShowAddCat(false)}><Text style={m.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={m.saveBtn} onPress={saveCategory}><Text style={m.saveText}>✅ Create</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title: { fontSize: 22, fontWeight: "800", color: Colors.textPrimary },
  sub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  newBtn: { backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  newBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  catHeader: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, padding: 14, marginBottom: 16, borderWidth: 1.5 },
  catTitle: { fontSize: 18, fontWeight: "800" },
  catDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  addEntryBtn: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  addEntryText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  empty: { alignItems: "center", paddingTop: 40, gap: 10 },
  emptyWrap: { alignItems: "center", paddingTop: 24, gap: 10, paddingHorizontal: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  hint: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
  suggGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  suggChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  suggChipSm: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5, backgroundColor: Colors.surfaceLight },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  catCard: { width: "47%", borderRadius: 20, padding: 16, borderWidth: 1.5, alignItems: "center", ...Shadow.sm, position: "relative" },
  catCardTitle: { fontSize: 14, fontWeight: "800", textAlign: "center" },
  catCardCount: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  catDel: { position: "absolute", top: 8, right: 8 },
  addCatCard: { width: "47%", borderRadius: 20, padding: 16, borderWidth: 2, borderStyle: "dashed", borderColor: Colors.border, alignItems: "center", justifyContent: "center", gap: 6, minHeight: 110 },
  addCatLabel: { fontSize: 12, fontWeight: "700", color: Colors.textMuted },
});

const ec = StyleSheet.create({
  card: { backgroundColor: Colors.surfaceLight, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: Colors.border, ...Shadow.sm },
  title: { fontSize: 15, fontWeight: "800", color: Colors.textPrimary, marginBottom: 4 },
  preview: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginBottom: 6 },
  videos: { fontSize: 11, color: Colors.primary, fontWeight: "600" },
  imgs: { fontSize: 11, color: Colors.success, fontWeight: "600" },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  date: { fontSize: 11, color: Colors.textMuted },
});

const m = StyleSheet.create({
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginTop: 10 },
  body: { padding: Spacing.lg, paddingBottom: 60, gap: 6 },
  title: { fontSize: 22, fontWeight: "800", color: Colors.textPrimary, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary, marginTop: 10, marginBottom: 6 },
  hint: { fontSize: 12, color: Colors.textMuted, marginBottom: 6 },
  input: { backgroundColor: Colors.surfaceLight, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, padding: 12, fontSize: 14, color: Colors.textPrimary, textAlignVertical: "top" },
  fontBtn: { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center", backgroundColor: Colors.border + "60", borderWidth: 1, borderColor: Colors.border },
  fontBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  fontText: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
  videoRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.primary + "10", borderRadius: 10, padding: 10, marginBottom: 6 },
  videoUrl: { flex: 1, fontSize: 12, color: Colors.primary, fontWeight: "600" },
  videoAdd: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 4 },
  addVideoBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  addVideoText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  addImgBtn: { width: 80, height: 80, borderRadius: 14, borderWidth: 2, borderColor: Colors.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 2 },
  addImgText: { fontSize: 10, color: Colors.textMuted, fontWeight: "600" },
  imgThumb: { width: 80, height: 80, borderRadius: 14, backgroundColor: Colors.primary + "15", alignItems: "center", justifyContent: "center", position: "relative" },
  imgDel: { position: "absolute", top: 4, right: 4, backgroundColor: Colors.error, borderRadius: 10, width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  colorDotActive: { borderWidth: 3, borderColor: Colors.textPrimary },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: 50, alignItems: "center", paddingVertical: 14 },
  cancelText: { fontWeight: "700", color: Colors.textSecondary, fontSize: 14 },
  saveBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: 50, alignItems: "center", paddingVertical: 14 },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
