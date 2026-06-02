import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, Image, Alert, Modal, ScrollView,
} from "react-native";
import { MicButton } from "../../../../components/voice-text-input";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Video, ResizeMode } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso, formatDate } from "../../../../lib/utils";
import { uploadMedia } from "../../../../lib/media-upload";
import type { JournalEntry } from "../../../../lib/data/types";

const MOODS = ["😊", "😢", "😡", "😴", "🤩", "😌", "🤔", "🥳"];

export default function JournalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);
  const router = useRouter();

  const [showEditor, setShowEditor] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

  // Editor state
  const [text, setText] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"photo" | "video" | null>(null);

  function openNew() {
    setEditingEntry(null);
    setText(""); setMood(null); setMediaUri(null); setMediaType(null);
    setShowEditor(true);
  }

  function openEdit(entry: JournalEntry) {
    setEditingEntry(entry);
    setText(entry.text);
    setMood(entry.mood ?? null);
    setMediaUri(entry.photoUri ?? null);
    setMediaType(entry.mediaType ?? (entry.photoUri ? "photo" : null));
    setShowEditor(true);
  }

  function closeEditor() {
    setShowEditor(false);
    setEditingEntry(null);
    setText(""); setMood(null); setMediaUri(null); setMediaType(null);
  }

  async function pickMedia() {
    Alert.alert("Add Media", "Choose a source", [
      {
        text: "📷 Take Photo",
        onPress: async () => {
          const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
          if (!r.canceled) { setMediaUri(r.assets[0].uri); setMediaType("photo"); }
        },
      },
      {
        text: "🎥 Record Video",
        onPress: async () => {
          const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["videos"], videoMaxDuration: 60 });
          if (!r.canceled) { setMediaUri(r.assets[0].uri); setMediaType("video"); }
        },
      },
      {
        text: "🖼️ Photo from Library",
        onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.8 });
          if (!r.canceled) { setMediaUri(r.assets[0].uri); setMediaType("photo"); }
        },
      },
      {
        text: "📹 Video from Library",
        onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["videos"] });
          if (!r.canceled) { setMediaUri(r.assets[0].uri); setMediaType("video"); }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function removeMedia() {
    setMediaUri(null); setMediaType(null);
  }

  async function save() {
    if (!text.trim() && !mediaUri) { Alert.alert("Write something or add a photo!"); return; }
    const now = nowIso();
    // Upload media so it shows on the parent's device too.
    const sharedMedia = mediaUri ? (await uploadMedia(mediaUri, { folder: "journal" })) ?? mediaUri : undefined;
    if (editingEntry) {
      dispatch({
        type: "EDIT_JOURNAL",
        kidId: id,
        entry: {
          ...editingEntry,
          text: text.trim(),
          mood: mood ?? undefined,
          photoUri: sharedMedia,
          mediaType: mediaType ?? undefined,
          updatedAt: now,
        },
      });
    } else {
      dispatch({
        type: "ADD_JOURNAL",
        kidId: id,
        entry: {
          id: uid(),
          kidId: id,
          text: text.trim(),
          mood: mood ?? undefined,
          photoUri: sharedMedia,
          mediaType: mediaType ?? undefined,
          createdAt: now,
        },
      });
    }
    closeEditor();
  }

  function deleteEntry(entry: JournalEntry) {
    Alert.alert("Delete Entry", "Remove this journal entry?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => dispatch({ type: "REMOVE_JOURNAL", kidId: id, entryId: entry.id }) },
    ]);
  }

  return (
    <ScreenContainer>
      {/* Tab row: Journal | Books */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabPill, styles.tabPillActive]}>
          <Text style={styles.tabPillTextActive}>📓 Journal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabPill}
          onPress={() => router.push(`/kid/${id}/(more)/books` as any)}
        >
          <Text style={styles.tabPillText}>📖 My Books</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>📔 My Journal</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openNew}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={kid?.journal ?? []}
        keyExtractor={e => e.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>✏️</Text>
            <Text style={styles.emptyTitle}>Start writing!</Text>
            <Text style={styles.emptySub}>Your first entry awaits.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <EntryCard
            entry={item}
            onEdit={() => openEdit(item)}
            onDelete={() => deleteEntry(item)}
          />
        )}
      />

      {/* Editor Modal */}
      <Modal visible={showEditor} animationType="slide" onRequestClose={closeEditor}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeEditor} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingEntry ? "Edit Entry" : "New Entry"}</Text>
            <TouchableOpacity onPress={save} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            {/* Mood picker */}
            <Text style={styles.fieldLabel}>How are you feeling?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
              {MOODS.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.moodBtn, mood === m && styles.moodBtnActive]}
                  onPress={() => setMood(mood === m ? null : m)}
                >
                  <Text style={{ fontSize: 26 }}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Text input */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={styles.fieldLabel}>What's on your mind?</Text>
              <MicButton appendTo={text} onAppend={setText} onResult={setText} size={32} />
            </View>
            <TextInput
              style={styles.textInput}
              value={text}
              onChangeText={setText}
              placeholder="Write about your day… or tap 🎙️ to speak!"
              multiline
              autoFocus={!editingEntry}
              textAlignVertical="top"
            />

            {/* Media */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Photo or Video</Text>
            {mediaUri ? (
              <View style={styles.mediaPreview}>
                {mediaType === "video" ? (
                  <Video
                    source={{ uri: mediaUri }}
                    style={styles.previewMedia}
                    useNativeControls
                    resizeMode={ResizeMode.COVER}
                  />
                ) : (
                  <Image source={{ uri: mediaUri }} style={styles.previewMedia} resizeMode="cover" />
                )}
                <View style={styles.mediaActions}>
                  <TouchableOpacity style={styles.changeMediaBtn} onPress={pickMedia}>
                    <Text style={styles.changeMediaText}>🔄 Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeMediaBtn} onPress={removeMedia}>
                    <Text style={styles.removeMediaText}>🗑 Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.addMediaBtn} onPress={pickMedia}>
                <Text style={{ fontSize: 32 }}>📷</Text>
                <Text style={styles.addMediaText}>Add Photo or Video</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScreenContainer>
  );
}

function EntryCard({ entry, onEdit, onDelete }: {
  entry: JournalEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [videoExpanded, setVideoExpanded] = useState(false);

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.entryDate}>{formatDate(entry.createdAt)}</Text>
          {entry.updatedAt && (
            <Text style={styles.editedLabel}>edited {formatDate(entry.updatedAt)}</Text>
          )}
        </View>
        {entry.mood && <Text style={{ fontSize: 22 }}>{entry.mood}</Text>}
        <TouchableOpacity style={styles.editIconBtn} onPress={onEdit}>
          <Text style={styles.editIcon}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteIconBtn} onPress={onDelete}>
          <Text style={styles.deleteIcon}>🗑</Text>
        </TouchableOpacity>
      </View>

      {/* Text */}
      {!!entry.text && <Text style={styles.entryText}>{entry.text}</Text>}

      {/* Media */}
      {entry.photoUri && (
        entry.mediaType === "video" ? (
          <TouchableOpacity onPress={() => setVideoExpanded(!videoExpanded)} activeOpacity={0.9}>
            {videoExpanded ? (
              <Video
                source={{ uri: entry.photoUri }}
                style={styles.entryMedia}
                useNativeControls
                resizeMode={ResizeMode.COVER}
              />
            ) : (
              <View style={styles.videoThumb}>
                <Text style={{ fontSize: 40 }}>▶️</Text>
                <Text style={styles.videoThumbText}>Tap to play video</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <Image source={{ uri: entry.photoUri }} style={styles.entryMedia} resizeMode="cover" />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: "row", gap: 8,
    marginBottom: Spacing.md, marginTop: 4,
  },
  tabPill: {
    flex: 1, alignItems: "center", paddingVertical: 10,
    borderRadius: Radius.full, backgroundColor: Colors.cardLight,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  tabPillActive: {
    backgroundColor: Colors.primary + "18", borderColor: Colors.primary,
  },
  tabPillText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  tabPillTextActive: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primary },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  addBtnText: { color: "#fff", fontSize: 22, fontWeight: "700" },

  empty: { alignItems: "center", gap: 10, paddingTop: 60 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary },

  // Entry card
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 10, ...Shadow.sm },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  entryDate: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  editedLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  editIconBtn: { padding: 4 },
  editIcon: { fontSize: 16 },
  deleteIconBtn: { padding: 4 },
  deleteIcon: { fontSize: 16 },
  entryText: { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 22, marginBottom: 10 },
  entryMedia: { width: "100%", height: 200, borderRadius: Radius.md, marginTop: 4 },
  videoThumb: {
    width: "100%", height: 140, borderRadius: Radius.md,
    backgroundColor: "#000", alignItems: "center", justifyContent: "center", gap: 8,
  },
  videoThumbText: { color: "#fff", fontWeight: "600", fontSize: FontSize.sm },

  // Editor modal
  modal: { flex: 1, backgroundColor: Colors.bgLight },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  cancelBtn: { padding: 4 },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: "600", fontSize: FontSize.base },
  saveBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 7, borderRadius: Radius.md },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  modalContent: { padding: Spacing.md, paddingBottom: 60 },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: "800", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  moodBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center", marginRight: 8 },
  moodBtnActive: { backgroundColor: Colors.primary + "30", borderWidth: 2, borderColor: Colors.primary },
  textInput: {
    borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg,
    padding: Spacing.md, fontSize: FontSize.base, color: Colors.textPrimary,
    backgroundColor: Colors.surfaceLight, minHeight: 140,
  },
  addMediaBtn: {
    borderWidth: 2, borderColor: Colors.border, borderStyle: "dashed",
    borderRadius: Radius.lg, alignItems: "center", gap: 8, padding: Spacing.lg,
    backgroundColor: Colors.cardLight,
  },
  addMediaText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.primary },
  mediaPreview: { gap: 10 },
  previewMedia: { width: "100%", height: 200, borderRadius: Radius.lg },
  mediaActions: { flexDirection: "row", gap: 10 },
  changeMediaBtn: { flex: 1, backgroundColor: Colors.primary + "18", borderRadius: Radius.md, padding: 10, alignItems: "center" },
  changeMediaText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.sm },
  removeMediaBtn: { flex: 1, backgroundColor: Colors.error + "15", borderRadius: Radius.md, padding: 10, alignItems: "center" },
  removeMediaText: { color: Colors.error, fontWeight: "700", fontSize: FontSize.sm },
});
