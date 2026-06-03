/**
 * MusicPicker — search free songs and attach one to a social post.
 *
 * Powered by lib/music-search (iTunes Search API → 30s previews, no API key).
 * Tap ▶ to audition a clip, tap the row to attach it. TikTok-style.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  Modal, View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator, ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { createAudioPlayer } from "expo-audio";
import { searchMusic, MUSIC_SUGGESTIONS, type MusicTrack } from "../lib/music-search";
import { Colors } from "../lib/theme";

export function MusicPicker({
  visible, onClose, onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (track: MusicTrack) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const reqRef = useRef(0);

  function stopPreview() {
    try { playerRef.current?.pause(); } catch {}
    try { playerRef.current?.remove(); } catch {}
    playerRef.current = null;
    setPlayingId(null);
  }

  // Stop audio when the modal closes / unmounts.
  useEffect(() => { if (!visible) stopPreview(); return () => stopPreview(); }, [visible]);

  async function run(q: string) {
    setQuery(q);
    const r = ++reqRef.current;
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const tracks = await searchMusic(q);
    if (reqRef.current === r) { setResults(tracks); setLoading(false); }
  }

  // Debounced search as the user types.
  const typeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onType(t: string) {
    setQuery(t);
    if (typeTimer.current) clearTimeout(typeTimer.current);
    typeTimer.current = setTimeout(() => run(t), 400);
  }

  function togglePreview(track: MusicTrack) {
    if (playingId === track.id) { stopPreview(); return; }
    stopPreview();
    try {
      const p = createAudioPlayer(track.previewUrl);
      p.play();
      playerRef.current = p;
      setPlayingId(track.id);
    } catch {}
  }

  function choose(track: MusicTrack) {
    stopPreview();
    onSelect(track);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={onClose}><Text style={s.cancel}>Cancel</Text></TouchableOpacity>
          <Text style={s.title}>🎵 Add Music</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={s.searchRow}>
          <Text style={{ fontSize: 18 }}>🔎</Text>
          <TextInput
            style={s.search}
            value={query}
            onChangeText={onType}
            placeholder="Search songs or artists…"
            placeholderTextColor="#8b85b0"
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => run(query)}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(""); setResults([]); }}>
              <Text style={{ color: "#8b85b0", fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {results.length === 0 && !loading && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.chips}>
            {MUSIC_SUGGESTIONS.map(sug => (
              <TouchableOpacity key={sug} style={s.chip} onPress={() => run(sug)}>
                <Text style={s.chipText}>{sug}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {loading && <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />}

        <FlatList
          data={results}
          keyExtractor={(t) => t.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 12, gap: 8 }}
          ListEmptyComponent={!loading && query.trim() ? (
            <Text style={s.empty}>No songs found — try another search.</Text>
          ) : null}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.row} activeOpacity={0.8} onPress={() => choose(item)}>
              {item.artworkUrl
                ? <Image source={{ uri: item.artworkUrl }} style={s.art} contentFit="cover" />
                : <View style={[s.art, { alignItems: "center", justifyContent: "center" }]}><Text style={{ fontSize: 22 }}>🎵</Text></View>}
              <View style={{ flex: 1 }}>
                <Text style={s.songTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={s.songArtist} numberOfLines={1}>{item.artist}</Text>
              </View>
              <TouchableOpacity style={s.playBtn} onPress={() => togglePreview(item)}>
                <Text style={{ fontSize: 20 }}>{playingId === item.id ? "⏸" : "▶"}</Text>
              </TouchableOpacity>
              <View style={s.addBtn}><Text style={s.addText}>Use</Text></View>
            </TouchableOpacity>
          )}
        />
        <Text style={s.foot}>30-second previews · powered by iTunes / Deezer</Text>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#15122b" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#2e2a52" },
  cancel: { color: Colors.error, fontWeight: "700", fontSize: 16 },
  title: { color: "#fff", fontWeight: "800", fontSize: 17 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#1c1838", borderRadius: 50, borderWidth: 1, borderColor: "#2e2a52" },
  search: { flex: 1, color: "#fff", fontSize: 16 },
  chips: { paddingHorizontal: 12, gap: 8, paddingVertical: 4 },
  chip: { backgroundColor: "#1c1838", borderRadius: 50, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#3531a8", marginRight: 8 },
  chipText: { color: "#d7d2f0", fontWeight: "700", fontSize: 13 },
  empty: { color: "#8b85b0", textAlign: "center", marginTop: 30 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#1c1838", borderRadius: 14, padding: 10 },
  art: { width: 48, height: 48, borderRadius: 8, backgroundColor: "#2e2a52" },
  songTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },
  songArtist: { color: "#9b95c0", fontSize: 13, marginTop: 2 },
  playBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#2e2a52", alignItems: "center", justifyContent: "center" },
  addBtn: { backgroundColor: Colors.primary, borderRadius: 50, paddingHorizontal: 14, paddingVertical: 8 },
  addText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  foot: { color: "#6b659a", fontSize: 11, textAlign: "center", paddingVertical: 8 },
});
