import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Modal, Linking, Alert, Platform,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { uid } from "../../../lib/utils";
import { Colors, FontSize, Radius, Spacing } from "../../../lib/theme";
import { ScreenContainer } from "../../../components/screen-container";
import { useColors } from "../../../hooks/use-colors";
import type { MoviePlatform, FamilyMovie } from "../../../lib/data/types";

const PLATFORMS: { id: MoviePlatform; label: string; emoji: string }[] = [
  { id: "youtube",    label: "YouTube",     emoji: "▶️" },
  { id: "netflix",    label: "Netflix",     emoji: "🔴" },
  { id: "disney_plus",label: "Disney+",     emoji: "🏰" },
  { id: "prime",      label: "Prime Video", emoji: "📦" },
  { id: "hbo",        label: "HBO/Max",     emoji: "🎭" },
  { id: "hulu",       label: "Hulu",        emoji: "🟢" },
  { id: "apple_tv",   label: "Apple TV+",   emoji: "🍎" },
  { id: "other",      label: "Other / Name Only", emoji: "🎬" },
];

function platformLabel(p: MoviePlatform) {
  return PLATFORMS.find(x => x.id === p)?.label ?? p;
}
function platformEmoji(p: MoviePlatform) {
  return PLATFORMS.find(x => x.id === p)?.emoji ?? "🎬";
}

export default function FamilyMoviesScreen() {
  const { state, dispatch } = useData();
  const C = useColors();
  const movies: FamilyMovie[] = state.familyMovies ?? [];

  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState<MoviePlatform>("other");
  const [url, setUrl] = useState("");
  const [rating, setRating] = useState("");

  function resetForm() {
    setTitle(""); setYear(""); setDescription("");
    setPlatform("other"); setUrl(""); setRating("");
  }

  function handleAdd() {
    if (!title.trim()) {
      Alert.alert("Title required", "Please enter a movie or show title.");
      return;
    }
    const movie: FamilyMovie = {
      id: uid(),
      title: title.trim(),
      year: year.trim() || undefined,
      description: description.trim(),
      platform,
      url: url.trim() || undefined,
      rating: rating.trim() || undefined,
      addedAt: new Date().toISOString(),
      addedByParentId: "parent",
    };
    dispatch({ type: "FAMILY_MOVIE_ADD", movie });
    resetForm();
    setShowAdd(false);
  }

  function handleDelete(movieId: string, movieTitle: string) {
    Alert.alert("Remove Movie", `Remove "${movieTitle}" from the family list?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => dispatch({ type: "FAMILY_MOVIE_DELETE", movieId }) },
    ]);
  }

  function openLink(movie: FamilyMovie) {
    if (movie.url) {
      Linking.openURL(movie.url).catch(() =>
        Alert.alert("Cannot Open", "Could not open this link. Please check the URL.")
      );
    }
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>🎬</Text>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Movies & Shows</Text>
        <Text style={[styles.headerSub, { color: C.textSecondary }]}>
          Share your family's favourite content
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: 100 }}>
        {/* Add button */}
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>＋ Add Movie / Show</Text>
        </TouchableOpacity>

        {movies.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: C.surface }]}>
            <Text style={styles.emptyEmoji}>🍿</Text>
            <Text style={[styles.emptyText, { color: C.textSecondary }]}>
              No movies added yet. Add your first recommendation!
            </Text>
          </View>
        ) : (
          movies.map(m => (
            <View key={m.id} style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={styles.cardRow}>
                <Text style={styles.cardEmoji}>{platformEmoji(m.platform)}</Text>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: C.textPrimary }]}>{m.title}
                    {m.year ? <Text style={[styles.cardYear, { color: C.textSecondary }]}> ({m.year})</Text> : null}
                  </Text>
                  <Text style={[styles.cardPlatform, { color: Colors.primary }]}>
                    {platformLabel(m.platform)}{m.rating ? `  ·  ${m.rating}` : ""}
                  </Text>
                  {!!m.description && (
                    <Text style={[styles.cardDesc, { color: C.textSecondary }]} numberOfLines={3}>
                      {m.description}
                    </Text>
                  )}
                  {!!m.url && (
                    <TouchableOpacity onPress={() => openLink(m)} style={styles.linkBtn}>
                      <Text style={styles.linkText}>🔗 Open Link</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleDelete(m.id, m.title)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => { setShowAdd(false); resetForm(); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: C.background }]}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={[styles.modalTitle, { color: C.textPrimary }]}>Add Movie / Show</Text>

              <Text style={[styles.label, { color: C.textSecondary }]}>Title *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: C.surface, color: C.textPrimary, borderColor: C.border }]}
                placeholder="e.g. The Lion King"
                placeholderTextColor={C.textMuted}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={[styles.label, { color: C.textSecondary }]}>Year</Text>
              <TextInput
                style={[styles.input, { backgroundColor: C.surface, color: C.textPrimary, borderColor: C.border }]}
                placeholder="e.g. 2019"
                placeholderTextColor={C.textMuted}
                value={year}
                onChangeText={setYear}
                keyboardType="numeric"
              />

              <Text style={[styles.label, { color: C.textSecondary }]}>Why you love it / Description</Text>
              <TextInput
                style={[styles.input, styles.inputMulti, { backgroundColor: C.surface, color: C.textPrimary, borderColor: C.border }]}
                placeholder="Share why the family will love this..."
                placeholderTextColor={C.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              <Text style={[styles.label, { color: C.textSecondary }]}>Age Rating (optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: C.surface, color: C.textPrimary, borderColor: C.border }]}
                placeholder="e.g. PG, G, PG-13, TV-Y7"
                placeholderTextColor={C.textMuted}
                value={rating}
                onChangeText={setRating}
              />

              <Text style={[styles.label, { color: C.textSecondary }]}>Platform</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
                {PLATFORMS.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setPlatform(p.id)}
                    style={[
                      styles.platformChip,
                      platform === p.id && styles.platformChipActive,
                    ]}
                  >
                    <Text style={styles.platformChipEmoji}>{p.emoji}</Text>
                    <Text style={[styles.platformChipLabel, platform === p.id && { color: "#fff" }]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.label, { color: C.textSecondary }]}>Link (YouTube / Netflix / etc.)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: C.surface, color: C.textPrimary, borderColor: C.border }]}
                placeholder="https://..."
                placeholderTextColor={C.textMuted}
                value={url}
                onChangeText={setUrl}
                keyboardType="url"
                autoCapitalize="none"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: C.border }]}
                  onPress={() => { setShowAdd(false); resetForm(); }}
                >
                  <Text style={[styles.cancelText, { color: C.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
                  <Text style={styles.saveBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", paddingVertical: Spacing.xl },
  headerEmoji: { fontSize: 52 },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: "800", marginTop: 8 },
  headerSub: { fontSize: FontSize.sm, marginTop: 4, textAlign: "center" },
  addBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingVertical: 14, alignItems: "center", marginBottom: Spacing.md,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.md },
  emptyBox: {
    borderRadius: Radius.xl, padding: Spacing.xl,
    alignItems: "center", marginTop: 20,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { textAlign: "center", fontSize: FontSize.sm, lineHeight: 22 },
  card: {
    borderRadius: Radius.xl, borderWidth: 1,
    padding: Spacing.md, marginBottom: 12,
  },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardEmoji: { fontSize: 32, marginTop: 2 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: FontSize.md, fontWeight: "700" },
  cardYear: { fontSize: FontSize.sm, fontWeight: "400" },
  cardPlatform: { fontSize: FontSize.xs, fontWeight: "600", marginTop: 2 },
  cardDesc: { fontSize: FontSize.sm, marginTop: 6, lineHeight: 20 },
  linkBtn: { marginTop: 8 },
  linkText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: "600" },
  deleteBtn: { padding: 6 },
  deleteBtnText: { color: Colors.error, fontSize: 18, fontWeight: "700" },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl,
    padding: Spacing.lg, maxHeight: "90%",
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: "800", textAlign: "center", marginBottom: Spacing.lg },
  label: { fontSize: FontSize.xs, fontWeight: "600", marginBottom: 4, marginTop: Spacing.sm },
  input: {
    borderWidth: 1, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: FontSize.sm,
  },
  inputMulti: { height: 90, textAlignVertical: "top" },
  platformChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg,
    paddingHorizontal: 12, paddingVertical: 8, marginRight: 8,
    backgroundColor: Colors.surfaceLight,
  },
  platformChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  platformChipEmoji: { fontSize: 16 },
  platformChipLabel: { fontSize: FontSize.xs, fontWeight: "600", color: Colors.textPrimary },
  modalActions: { flexDirection: "row", gap: 12, marginTop: Spacing.lg },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderRadius: Radius.lg,
    paddingVertical: 14, alignItems: "center",
  },
  cancelText: { fontWeight: "600", fontSize: FontSize.sm },
  saveBtn: {
    flex: 1, backgroundColor: Colors.primary,
    borderRadius: Radius.lg, paddingVertical: 14, alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
});
