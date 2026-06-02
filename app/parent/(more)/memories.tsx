import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Image, Modal, Alert, Animated, Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso } from "../../../lib/utils";
import { uploadMediaMany } from "../../../lib/media-upload";
import { Memory, MemoryMood } from "../../../lib/data/types";

const W = Dimensions.get("window").width;

const MOODS: MemoryMood[] = ["❤️","😂","🥹","🤩","😍","🎉","😮","🌟"];
const MOOD_LABEL: Record<MemoryMood, string> = {
  "❤️": "Loving", "😂": "Funny", "🥹": "Touching", "🤩": "Amazing",
  "😍": "Beautiful", "🎉": "Celebration", "😮": "Surprising", "🌟": "Special",
};

// Month names for the date picker
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 20 }, (_, i) => CURRENT_YEAR - i);
const DAYS  = Array.from({ length: 31 }, (_, i) => i + 1);

function formatMemoryDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function todayISO() { return new Date().toISOString().split("T")[0]; }

export default function ParentMemoriesScreen() {
  const { state, dispatch } = useData();
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [detailMemory, setDetailMemory] = useState<Memory | null>(null);

  // ── Create form state ──
  const [formTitle, setFormTitle]   = useState("");
  const [formStory, setFormStory]   = useState("");
  const [formMood, setFormMood]     = useState<MemoryMood>("❤️");
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [formForKids, setFormForKids] = useState<string[]>([]); // [] = everyone

  // Date picker state
  const today = todayISO().split("-").map(Number);
  const [selYear,  setSelYear]  = useState(today[0]);
  const [selMonth, setSelMonth] = useState(today[1]);
  const [selDay,   setSelDay]   = useState(today[2]);
  const [datePicker, setDatePicker] = useState<"year"|"month"|"day"|null>(null);

  const formDate = `${selYear}-${String(selMonth).padStart(2,"0")}-${String(selDay).padStart(2,"0")}`;

  async function pickPhoto() {
    if (formPhotos.length >= 5) {
      Alert.alert("Max Photos", "You can add up to 5 photos per memory.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]) {
      setFormPhotos(p => [...p, result.assets[0].uri]);
    }
  }

  function resetForm() {
    setFormTitle(""); setFormStory(""); setFormMood("❤️");
    setFormPhotos([]); setFormForKids([]);
    const t = todayISO().split("-").map(Number);
    setSelYear(t[0]); setSelMonth(t[1]); setSelDay(t[2]);
  }

  async function saveMemory() {
    if (!formStory.trim() && formPhotos.length === 0) {
      Alert.alert("Add Content", "Please write a story or add at least one photo.");
      return;
    }
    // Upload photos so they show on every family device (not just this one).
    const photoUris = await uploadMediaMany(formPhotos, { folder: "memories" });
    const memory: Memory = {
      id: uid(),
      title: formTitle.trim() || `${MOOD_LABEL[formMood]} Memory`,
      date: formDate,
      story: formStory.trim(),
      photoUris,
      mood: formMood,
      forKids: formForKids,
      addedBy: state.parent.name,
      addedAt: nowIso(),
    };
    dispatch({ type: "MEMORY_ADD", memory });
    resetForm();
    setView("list");
  }

  function deleteMemory(id: string) {
    Alert.alert("Delete Memory", "Remove this memory permanently?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        dispatch({ type: "MEMORY_REMOVE", memoryId: id });
        if (detailMemory?.id === id) { setDetailMemory(null); setView("list"); }
      }},
    ]);
  }

  const memories = [...state.memories].sort((a, b) => b.date.localeCompare(a.date));

  // Group by year
  const byYear: Record<number, Memory[]> = {};
  for (const m of memories) {
    const y = parseInt(m.date.split("-")[0]);
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(m);
  }
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  // ── Detail view ──
  if (view === "detail" && detailMemory) {
    return (
      <ScreenContainer scroll>
        <TouchableOpacity style={styles.backBtn} onPress={() => setView("list")}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.detailHeader}>
          <Text style={styles.detailMood}>{detailMemory.mood}</Text>
          <View style={styles.detailHeaderText}>
            <Text style={styles.detailTitle}>{detailMemory.title}</Text>
            <Text style={styles.detailDate}>{formatMemoryDate(detailMemory.date)}</Text>
            <Text style={styles.detailBy}>Added by {detailMemory.addedBy}</Text>
          </View>
        </View>

        {/* Photos */}
        {detailMemory.photoUris.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
            {detailMemory.photoUris.map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.detailPhoto} resizeMode="cover" />
            ))}
          </ScrollView>
        )}

        {/* Story */}
        {detailMemory.story ? (
          <View style={styles.storyCard}>
            <Text style={styles.storyText}>{detailMemory.story}</Text>
          </View>
        ) : null}

        {/* Who can see */}
        {detailMemory.forKids.length > 0 && (
          <View style={styles.forKidsRow}>
            <Text style={styles.forKidsLabel}>Shared with: </Text>
            <Text style={styles.forKidsNames}>
              {detailMemory.forKids
                .map(id => state.kids.find(k => k.profile.id === id)?.profile.name)
                .filter(Boolean).join(", ")}
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteMemory(detailMemory.id)}>
          <Text style={styles.deleteBtnText}>🗑 Delete Memory</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  // ── Create view ──
  if (view === "create") {
    return (
      <ScreenContainer scroll>
        <View style={styles.createHeader}>
          <TouchableOpacity onPress={() => { resetForm(); setView("list"); }}>
            <Text style={styles.backBtnText}>← Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.createTitle}>New Memory</Text>
          <TouchableOpacity onPress={saveMemory}>
            <Text style={styles.saveText}>Save ✓</Text>
          </TouchableOpacity>
        </View>

        {/* Mood picker */}
        <Text style={styles.label}>How was the moment?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moodRow}>
          {MOODS.map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.moodBtn, formMood === m && styles.moodBtnActive]}
              onPress={() => setFormMood(m)}
            >
              <Text style={styles.moodEmoji}>{m}</Text>
              <Text style={[styles.moodLabel, formMood === m && styles.moodLabelActive]}>
                {MOOD_LABEL[m]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Date picker */}
        <Text style={styles.label}>When did it happen?</Text>
        <View style={styles.dateRow}>
          {/* Month */}
          <TouchableOpacity style={[styles.dateSegment, { flex: 3 }, datePicker === "month" && styles.dateSegmentActive]}
            onPress={() => setDatePicker(datePicker === "month" ? null : "month")}>
            <Text style={styles.dateSegmentText}>{MONTHS[selMonth - 1]}</Text>
          </TouchableOpacity>
          {/* Day */}
          <TouchableOpacity style={[styles.dateSegment, { flex: 2 }, datePicker === "day" && styles.dateSegmentActive]}
            onPress={() => setDatePicker(datePicker === "day" ? null : "day")}>
            <Text style={styles.dateSegmentText}>{selDay}</Text>
          </TouchableOpacity>
          {/* Year */}
          <TouchableOpacity style={[styles.dateSegment, { flex: 3 }, datePicker === "year" && styles.dateSegmentActive]}
            onPress={() => setDatePicker(datePicker === "year" ? null : "year")}>
            <Text style={styles.dateSegmentText}>{selYear}</Text>
          </TouchableOpacity>
        </View>

        {datePicker && (
          <ScrollView style={styles.pickerList} nestedScrollEnabled>
            {datePicker === "month" && MONTHS.map((mn, i) => (
              <TouchableOpacity key={i} style={[styles.pickerItem, selMonth === i+1 && styles.pickerItemActive]}
                onPress={() => { setSelMonth(i+1); setDatePicker(null); }}>
                <Text style={[styles.pickerItemText, selMonth === i+1 && styles.pickerItemTextActive]}>{mn}</Text>
              </TouchableOpacity>
            ))}
            {datePicker === "day" && DAYS.map(d => (
              <TouchableOpacity key={d} style={[styles.pickerItem, selDay === d && styles.pickerItemActive]}
                onPress={() => { setSelDay(d); setDatePicker(null); }}>
                <Text style={[styles.pickerItemText, selDay === d && styles.pickerItemTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
            {datePicker === "year" && YEARS.map(y => (
              <TouchableOpacity key={y} style={[styles.pickerItem, selYear === y && styles.pickerItemActive]}
                onPress={() => { setSelYear(y); setDatePicker(null); }}>
                <Text style={[styles.pickerItemText, selYear === y && styles.pickerItemTextActive]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Title */}
        <Text style={styles.label}>Title (optional)</Text>
        <TextInput
          style={styles.input}
          value={formTitle}
          onChangeText={setFormTitle}
          placeholder={`e.g. "Emma's first bike ride"`}
        />

        {/* Story */}
        <Text style={styles.label}>What made it special?</Text>
        <TextInput
          style={[styles.input, styles.storyInput]}
          value={formStory}
          onChangeText={setFormStory}
          placeholder={"Describe this moment in your own words…\n\nWhat happened? How did it feel? Why will you always remember it?"}
          multiline
          textAlignVertical="top"
        />

        {/* Photos */}
        <Text style={styles.label}>Add Photos ({formPhotos.length}/5)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoPickerRow}>
          {formPhotos.map((uri, i) => (
            <View key={i} style={styles.photoThumb}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <TouchableOpacity
                style={styles.photoRemove}
                onPress={() => setFormPhotos(p => p.filter((_, j) => j !== i))}
              >
                <Text style={styles.photoRemoveText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {formPhotos.length < 5 && (
            <TouchableOpacity style={styles.addPhotoBtn} onPress={pickPhoto}>
              <Text style={styles.addPhotoIcon}>📷</Text>
              <Text style={styles.addPhotoText}>Add Photo</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* For kids */}
        <Text style={styles.label}>Share with (leave blank for everyone)</Text>
        <View style={styles.kidRow}>
          {state.kids.map(k => (
            <TouchableOpacity
              key={k.profile.id}
              style={[styles.kidChip, formForKids.includes(k.profile.id) && styles.kidChipActive]}
              onPress={() => setFormForKids(prev =>
                prev.includes(k.profile.id) ? prev.filter(x => x !== k.profile.id) : [...prev, k.profile.id]
              )}
            >
              <Text style={[styles.kidChipText, formForKids.includes(k.profile.id) && styles.kidChipTextActive]}>
                {k.profile.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={saveMemory}>
          <Text style={styles.saveBtnText}>✨ Save Memory</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  // ── List view ──
  return (
    <ScreenContainer scroll>
      <View style={styles.listHeader}>
        <View>
          <Text style={styles.title}>📸 Memories</Text>
          <Text style={styles.subtitle}>{memories.length} moment{memories.length !== 1 ? "s" : ""} captured</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setView("create")}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {memories.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 72, textAlign: "center" }}>🌅</Text>
          <Text style={styles.emptyTitle}>No memories yet</Text>
          <Text style={styles.emptyText}>
            Start capturing the moments that matter — big milestones, funny days, quiet evenings, anything worth remembering.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => setView("create")}>
            <Text style={styles.emptyBtnText}>Add Your First Memory ✨</Text>
          </TouchableOpacity>
        </View>
      ) : (
        years.map(year => (
          <View key={year}>
            <Text style={styles.yearLabel}>{year}</Text>
            {byYear[year].map(memory => (
              <TouchableOpacity
                key={memory.id}
                style={styles.memoryCard}
                onPress={() => { setDetailMemory(memory); setView("detail"); }}
                activeOpacity={0.85}
              >
                {/* Left: mood + date */}
                <View style={styles.memoryLeft}>
                  <Text style={styles.memoryMoodIcon}>{memory.mood}</Text>
                  <Text style={styles.memoryDateDay}>{memory.date.split("-")[2]}</Text>
                  <Text style={styles.memoryDateMonth}>{MONTHS[parseInt(memory.date.split("-")[1]) - 1].toUpperCase()}</Text>
                </View>

                {/* Right: content */}
                <View style={styles.memoryContent}>
                  <Text style={styles.memoryTitle} numberOfLines={1}>{memory.title}</Text>
                  {memory.story ? (
                    <Text style={styles.memoryPreview} numberOfLines={2}>{memory.story}</Text>
                  ) : null}
                  <View style={styles.memoryMeta}>
                    {memory.photoUris.length > 0 && (
                      <Text style={styles.memoryMetaChip}>📷 {memory.photoUris.length}</Text>
                    )}
                    {memory.forKids.length > 0 && (
                      <Text style={styles.memoryMetaChip}>
                        👧 {memory.forKids.map(id => state.kids.find(k => k.profile.id === id)?.profile.name).filter(Boolean).join(", ")}
                      </Text>
                    )}
                    {memory.forKids.length === 0 && (
                      <Text style={styles.memoryMetaChip}>👨‍👩‍👧 Everyone</Text>
                    )}
                  </View>
                </View>

                {/* Thumbnail */}
                {memory.photoUris[0] ? (
                  <Image source={{ uri: memory.photoUris[0] }} style={styles.memoryThumb} resizeMode="cover" />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        ))
      )}
    </ScreenContainer>
  );
}

const THUMB = 64;
const PHOTO_H = 220;

const styles = StyleSheet.create({
  // List
  listHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: Spacing.md },
  title:         { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  subtitle:      { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  addBtn:        { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 10 },
  addBtnText:    { color: "#fff", fontWeight: "700" },
  yearLabel:     { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textSecondary, marginBottom: 8, marginTop: Spacing.md },

  memoryCard:    { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.sm, ...Shadow.sm, marginBottom: 10, flexDirection: "row", alignItems: "center" },
  memoryLeft:    { alignItems: "center", width: 52, marginRight: 12 },
  memoryMoodIcon:{ fontSize: 24, marginBottom: 2 },
  memoryDateDay: { fontSize: 22, fontWeight: "900", color: Colors.textPrimary, lineHeight: 26 },
  memoryDateMonth: { fontSize: 10, fontWeight: "700", color: Colors.textSecondary, letterSpacing: 0.5 },
  memoryContent: { flex: 1 },
  memoryTitle:   { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  memoryPreview: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
  memoryMeta:    { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  memoryMetaChip:{ fontSize: 11, color: Colors.textSecondary, backgroundColor: Colors.cardLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  memoryThumb:   { width: THUMB, height: THUMB, borderRadius: Radius.md, marginLeft: 10 },

  empty:         { alignItems: "center", paddingVertical: Spacing.xl, gap: 12 },
  emptyTitle:    { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary },
  emptyText:     { color: Colors.textSecondary, textAlign: "center", lineHeight: 22, paddingHorizontal: 20 },
  emptyBtn:      { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  emptyBtnText:  { color: "#fff", fontWeight: "800", fontSize: FontSize.base },

  // Detail
  backBtn:       { marginBottom: Spacing.md },
  backBtnText:   { color: Colors.primary, fontWeight: "700", fontSize: FontSize.base },
  detailHeader:  { flexDirection: "row", alignItems: "flex-start", marginBottom: Spacing.md, gap: 12 },
  detailMood:    { fontSize: 48 },
  detailHeaderText: { flex: 1 },
  detailTitle:   { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary },
  detailDate:    { fontSize: FontSize.base, color: Colors.primary, fontWeight: "600", marginTop: 2 },
  detailBy:      { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  photoScroll:   { marginBottom: Spacing.md },
  detailPhoto:   { width: W - 64, height: PHOTO_H, borderRadius: Radius.lg, marginRight: 10 },
  storyCard:     { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm, marginBottom: Spacing.md },
  storyText:     { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 26 },
  forKidsRow:    { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md },
  forKidsLabel:  { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: "600" },
  forKidsNames:  { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "700" },
  deleteBtn:     { backgroundColor: Colors.error + "15", borderRadius: Radius.full, alignItems: "center", padding: 12, marginTop: Spacing.lg, marginHorizontal: Spacing.sm },
  deleteBtnText: { color: Colors.error, fontWeight: "700" },

  // Create
  createHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  createTitle:   { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  saveText:      { color: Colors.primary, fontWeight: "700", fontSize: FontSize.base },
  label:         { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, marginBottom: 6, marginTop: Spacing.sm },
  input:         { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.base },
  storyInput:    { height: 160, textAlignVertical: "top" },

  // Mood
  moodRow:       { marginBottom: Spacing.sm },
  moodBtn:       { alignItems: "center", marginRight: 12, paddingVertical: 8, paddingHorizontal: 10, borderRadius: Radius.lg, backgroundColor: Colors.cardLight, borderWidth: 2, borderColor: "transparent", minWidth: 70 },
  moodBtnActive: { backgroundColor: Colors.primary + "15", borderColor: Colors.primary },
  moodEmoji:     { fontSize: 28 },
  moodLabel:     { fontSize: 10, color: Colors.textSecondary, fontWeight: "600", marginTop: 2 },
  moodLabelActive: { color: Colors.primary },

  // Date
  dateRow:           { flexDirection: "row", gap: 8, marginBottom: Spacing.sm },
  dateSegment:       { alignItems: "center", paddingVertical: 12, backgroundColor: Colors.cardLight, borderRadius: Radius.md, borderWidth: 2, borderColor: "transparent" },
  dateSegmentActive: { backgroundColor: Colors.primary + "15", borderColor: Colors.primary },
  dateSegmentText:   { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  pickerList:        { maxHeight: 180, backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  pickerItem:        { paddingVertical: 12, paddingHorizontal: Spacing.md },
  pickerItemActive:  { backgroundColor: Colors.primary + "15" },
  pickerItemText:    { fontSize: FontSize.base, color: Colors.textPrimary },
  pickerItemTextActive: { color: Colors.primary, fontWeight: "700" },

  // Photos
  photoPickerRow: { marginBottom: Spacing.sm },
  photoThumb:     { width: 90, height: 90, borderRadius: Radius.md, marginRight: 10, overflow: "hidden", backgroundColor: Colors.cardLight },
  photoRemove:    { position: "absolute", top: 4, right: 4, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  photoRemoveText:{ color: "#fff", fontSize: 12, fontWeight: "700" },
  addPhotoBtn:    { width: 90, height: 90, borderRadius: Radius.md, marginRight: 10, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.border, borderStyle: "dashed", gap: 4 },
  addPhotoIcon:   { fontSize: 24 },
  addPhotoText:   { fontSize: 11, color: Colors.textSecondary, fontWeight: "600" },

  // Kid chips
  kidRow:         { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: Spacing.sm },
  kidChip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight, borderWidth: 2, borderColor: "transparent" },
  kidChipActive:  { backgroundColor: Colors.primary + "15", borderColor: Colors.primary },
  kidChipText:    { fontWeight: "600", color: Colors.textSecondary },
  kidChipTextActive: { color: Colors.primary },

  saveBtn:        { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", padding: 14, marginTop: Spacing.lg, marginBottom: Spacing.xl },
  saveBtnText:    { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
});
