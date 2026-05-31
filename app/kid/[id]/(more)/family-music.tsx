import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system";
import { Audio } from "expo-av";
import { useData } from "../../../../lib/data/store";
import { Colors, FontSize, Radius, Spacing } from "../../../../lib/theme";
import { ScreenContainer } from "../../../../components/screen-container";
import { useColors } from "../../../../hooks/use-colors";
import type { FamilyMusicTrack } from "../../../../lib/data/types";

export default function KidFamilyMusicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useData();
  const C = useColors();
  const tracks: FamilyMusicTrack[] = state.familyMusic ?? [];

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

  async function togglePlay(track: FamilyMusicTrack) {
    if (!track.fileUri) {
      Alert.alert("No file", "This track has no audio file.");
      return;
    }
    if (playingId === track.id) {
      await soundRef.current?.pauseAsync().catch(() => {});
      setPlayingId(null);
      return;
    }
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

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>🎵</Text>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Family Music</Text>
        <Text style={[styles.headerSub, { color: C.textSecondary }]}>
          Music your parents added for the family
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: 100 }}>
        {tracks.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: C.surface }]}>
            <Text style={styles.emptyEmoji}>🎶</Text>
            <Text style={[styles.emptyText, { color: C.textSecondary }]}>
              No music yet. Ask a parent to add some songs!
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
                      {t.fileType?.toUpperCase() ?? "AUDIO"}
                    </Text>
                  </View>
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", paddingVertical: Spacing.xl },
  headerEmoji: { fontSize: 52 },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: "800", marginTop: 8 },
  headerSub: { fontSize: FontSize.sm, marginTop: 4, textAlign: "center" },
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
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.surfaceLight, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: Colors.border,
  },
  playBtnActive: { backgroundColor: Colors.primary + "22", borderColor: Colors.primary },
  playBtnText: { fontSize: 24 },
  cardBody: { flex: 1 },
  trackTitle: { fontSize: FontSize.md, fontWeight: "700" },
  trackArtist: { fontSize: FontSize.sm, marginTop: 2 },
  trackMeta: { fontSize: FontSize.xs, marginTop: 3 },
  nowPlayingBar: {
    marginTop: 10, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: Colors.primary + "33",
  },
  nowPlayingText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: "600", textAlign: "center" },
});
