import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Modal, Alert,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Audio } from "expo-av";
import { useData } from "../../../lib/data/store";
import { uid } from "../../../lib/utils";
import { Colors, FontSize, Radius, Spacing } from "../../../lib/theme";
import { ScreenContainer } from "../../../components/screen-container";
import { useColors } from "../../../hooks/use-colors";
import type { FamilyMusicTrack } from "../../../lib/data/types";

const MUSIC_DIR = FileSystem.documentDirectory + "family_music/";

async function ensureMusicDir() {
  const info = await FileSystem.getInfoAsync(MUSIC_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(MUSIC_DIR, { intermediates: true });
}

export default function FamilyMusicScreen() {
  const { state, dispatch } = useData();
  const C = useColors();
  const tracks: FamilyMusicTrack[] = state.familyMusic ?? [];

  const [showAdd, setShowAdd] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [artistInput, setArtistInput] = useState("");
  const [picking, setPicking] = useState(false);

  // Playback state
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  async function pickAndAdd() {
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/*", "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/aac", "audio/flac"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) { setPicking(false); return; }
      const asset = result.assets[0];

      await ensureMusicDir();
      const ext = asset.name.split(".").pop() ?? "mp3";
      const destName = uid() + "." + ext;
      const destUri = MUSIC_DIR + destName;
      await FileSystem.copyAsync({ from: asset.uri, to: destUri });

      const name = titleInput.trim() || asset.name.replace(/\.[^.]+$/, "");
      const track: FamilyMusicTrack = {
        id: uid(),
        title: name,
        artist: artistInput.trim() || undefined,
        fileUri: destUri,
        fileType: ext,
        addedAt: new Date().toISOString(),
        addedByParentId: "parent",
      };
      dispatch({ type: "FAMILY_MUSIC_ADD", track });
      setTitleInput(""); setArtistInput("");
      setShowAdd(false);
    } catch (e: any) {
      Alert.alert("Error", "Could not pick audio file: " + (e?.message ?? e));
    } finally {
      setPicking(false);
    }
  }

  async function togglePlay(track: FamilyMusicTrack) {
    if (!track.fileUri) {
      Alert.alert("No file", "This track has no audio file.");
      return;
    }
    if (playingId === track.id) {
      // Pause / stop
      await soundRef.current?.pauseAsync().catch(() => {});
      setPlayingId(null);
      return;
    }
    // Stop previous
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setLoading(true);
    try {
      const info = await FileSystem.getInfoAsync(track.fileUri);
      if (!info.exists) { Alert.alert("File not found", "The audio file is missing."); setLoading(false); return; }
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.fileUri },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) setPlayingId(null);
        }
      );
      soundRef.current = sound;
      setPlayingId(track.id);
    } catch (e: any) {
      Alert.alert("Playback error", e?.message ?? "Could not play this file.");
    } finally {
      setLoading(false);
    }
  }

  function handleDelete(track: FamilyMusicTrack) {
    Alert.alert("Remove Track", `Remove "${track.title}" from the family library?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          // Stop if playing
          if (playingId === track.id) {
            await soundRef.current?.unloadAsync().catch(() => {});
            soundRef.current = null;
            setPlayingId(null);
          }
          // Delete file
          if (track.fileUri) {
            FileSystem.deleteAsync(track.fileUri, { idempotent: true }).catch(() => {});
          }
          dispatch({ type: "FAMILY_MUSIC_DELETE", trackId: track.id });
        },
      },
    ]);
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>🎵</Text>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Family Music</Text>
        <Text style={[styles.headerSub, { color: C.textSecondary }]}>
          Add and play music for the whole family
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: 100 }}>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>＋ Add Music</Text>
        </TouchableOpacity>

        {tracks.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: C.surface }]}>
            <Text style={styles.emptyEmoji}>🎶</Text>
            <Text style={[styles.emptyText, { color: C.textSecondary }]}>
              No music added yet. Tap "Add Music" to pick an audio file from your device.
            </Text>
          </View>
        ) : (
          tracks.map(t => {
            const isPlaying = playingId === t.id;
            return (
              <View key={t.id} style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
                <View style={styles.cardRow}>
                  <TouchableOpacity
                    style={[styles.playBtn, isPlaying && styles.playBtnActive]}
                    onPress={() => togglePlay(t)}
                    disabled={loading}
                  >
                    <Text style={styles.playBtnText}>{isPlaying ? "⏸" : "▶️"}</Text>
                  </TouchableOpacity>
                  <View style={styles.cardBody}>
                    <Text style={[styles.trackTitle, { color: C.textPrimary }]}>{t.title}</Text>
                    {!!t.artist && (
                      <Text style={[styles.trackArtist, { color: C.textSecondary }]}>{t.artist}</Text>
                    )}
                    <Text style={[styles.trackMeta, { color: C.textMuted }]}>
                      {t.fileType?.toUpperCase() ?? "AUDIO"}  ·  {new Date(t.addedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(t)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
                {isPlaying && (
                  <View style={styles.nowPlayingBar}>
                    <Text style={styles.nowPlayingText}>♪ Now Playing...</Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: C.background }]}>
            <Text style={[styles.modalTitle, { color: C.textPrimary }]}>Add Music Track</Text>

            <Text style={[styles.label, { color: C.textSecondary }]}>Track Name (optional — uses filename if blank)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.surface, color: C.textPrimary, borderColor: C.border }]}
              placeholder="Song title"
              placeholderTextColor={C.textMuted}
              value={titleInput}
              onChangeText={setTitleInput}
            />

            <Text style={[styles.label, { color: C.textSecondary }]}>Artist (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.surface, color: C.textPrimary, borderColor: C.border }]}
              placeholder="Artist or band name"
              placeholderTextColor={C.textMuted}
              value={artistInput}
              onChangeText={setArtistInput}
            />

            <TouchableOpacity
              style={[styles.pickFileBtn, picking && { opacity: 0.6 }]}
              onPress={pickAndAdd}
              disabled={picking}
            >
              <Text style={styles.pickFileBtnText}>{picking ? "Picking…" : "📂 Pick Audio File"}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: C.border, marginTop: Spacing.sm }]}
              onPress={() => { setShowAdd(false); setTitleInput(""); setArtistInput(""); }}
            >
              <Text style={[styles.cancelText, { color: C.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
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
    borderRadius: Radius.xl, padding: Spacing.xl, alignItems: "center", marginTop: 20,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { textAlign: "center", fontSize: FontSize.sm, lineHeight: 22 },
  card: {
    borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.md, marginBottom: 12,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  playBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.surfaceLight, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border,
  },
  playBtnActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  playBtnText: { fontSize: 22 },
  cardBody: { flex: 1 },
  trackTitle: { fontSize: FontSize.md, fontWeight: "700" },
  trackArtist: { fontSize: FontSize.sm, marginTop: 2 },
  trackMeta: { fontSize: FontSize.xs, marginTop: 3 },
  deleteBtn: { padding: 6 },
  deleteBtnText: { color: Colors.error, fontSize: 18, fontWeight: "700" },
  nowPlayingBar: {
    marginTop: 10, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: Colors.primary + "33",
  },
  nowPlayingText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: "600", textAlign: "center" },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl,
    padding: Spacing.lg, paddingBottom: 40,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: "800", textAlign: "center", marginBottom: Spacing.lg },
  label: { fontSize: FontSize.xs, fontWeight: "600", marginBottom: 4, marginTop: Spacing.sm },
  input: {
    borderWidth: 1, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: FontSize.sm,
  },
  pickFileBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingVertical: 14, alignItems: "center", marginTop: Spacing.lg,
  },
  pickFileBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.md },
  cancelBtn: {
    borderWidth: 1, borderRadius: Radius.lg,
    paddingVertical: 14, alignItems: "center",
  },
  cancelText: { fontWeight: "600", fontSize: FontSize.sm },
});
