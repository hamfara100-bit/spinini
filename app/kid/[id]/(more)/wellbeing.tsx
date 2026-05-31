import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert, Image,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useData } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import type { WellBeingCategory, WellBeingEntry } from "../../../../lib/data/types";

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ─── Video embed chip ─────────────────────────────────────────────────────────
function VideoChip({ url }: { url: string }) {
  const ytId = getYouTubeId(url);
  const isTikTok = url.includes("tiktok.com");
  const thumbUrl = ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null;

  function open() {
    Linking.openURL(url).catch(() => Alert.alert("Can't open", "Could not open this video."));
  }

  return (
    <TouchableOpacity style={vc.chip} onPress={open} activeOpacity={0.85}>
      {thumbUrl ? (
        <Image source={{ uri: thumbUrl }} style={vc.thumb} />
      ) : (
        <View style={[vc.thumb, { backgroundColor: isTikTok ? "#010101" : Colors.primary + "20", alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ fontSize: 28 }}>{isTikTok ? "🎵" : "🎬"}</Text>
        </View>
      )}
      <View style={vc.chipRight}>
        <Text style={vc.chipLabel}>{isTikTok ? "TikTok Video" : ytId ? "YouTube Video" : "Watch Video"}</Text>
        <Text style={vc.chipUrl} numberOfLines={1}>{url}</Text>
        <View style={vc.watchBtn}><Text style={vc.watchText}>▶ Tap to Watch</Text></View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Entry view ───────────────────────────────────────────────────────────────
function EntryDetail({ entry, accentColor, onBack }: {
  entry: WellBeingEntry; accentColor: string; onBack: () => void;
}) {
  const fontFamily = entry.fontStyle === "serif" ? "serif" : entry.fontStyle === "handwriting" ? "cursive" : undefined;

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity onPress={onBack} style={{ marginBottom: 12 }}>
        <Text style={{ color: accentColor, fontWeight: "700", fontSize: 14 }}>← Back</Text>
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={[ed.titleBox, { backgroundColor: accentColor + "15", borderColor: accentColor + "30" }]}>
          <Text style={[ed.title, { color: accentColor }]}>{entry.title}</Text>
        </View>

        <Text style={[ed.body, fontFamily ? { fontFamily } : null]}>{entry.bodyText}</Text>

        {entry.images.length > 0 && (
          <>
            <Text style={ed.sectionLabel}>🖼️ Images</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
              {entry.images.map((img, i) => (
                <Image key={i} source={{ uri: img }} style={ed.img} />
              ))}
            </ScrollView>
          </>
        )}

        {entry.videoUrls.length > 0 && (
          <>
            <Text style={ed.sectionLabel}>🎬 Watch These</Text>
            {entry.videoUrls.map((url, i) => (
              <VideoChip key={i} url={url} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function KidWellBeingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useData();

  const categories = state.wellBeingCategories ?? [];
  const entries = state.wellBeingEntries ?? [];

  const [selectedCat, setSelectedCat] = useState<WellBeingCategory | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<WellBeingEntry | null>(null);

  const catEntries = selectedCat ? entries.filter(e => e.categoryId === selectedCat.id) : [];

  // Entry detail
  if (selectedEntry && selectedCat) return (
    <ScreenContainer scroll bg={selectedCat.color + "08"}>
      <EntryDetail
        entry={selectedEntry}
        accentColor={selectedCat.color}
        onBack={() => setSelectedEntry(null)}
      />
    </ScreenContainer>
  );

  // Category entries list
  if (selectedCat) return (
    <ScreenContainer scroll bg={selectedCat.color + "08"}>
      <TouchableOpacity onPress={() => setSelectedCat(null)} style={{ marginBottom: 12 }}>
        <Text style={{ color: selectedCat.color, fontWeight: "700", fontSize: 14 }}>← All Topics</Text>
      </TouchableOpacity>

      <View style={[cl.header, { backgroundColor: selectedCat.color + "18", borderColor: selectedCat.color + "40" }]}>
        <Text style={{ fontSize: 48 }}>{selectedCat.emoji}</Text>
        <Text style={[cl.title, { color: selectedCat.color }]}>{selectedCat.title}</Text>
        {selectedCat.description ? <Text style={cl.desc}>{selectedCat.description}</Text> : null}
      </View>

      {catEntries.length === 0 ? (
        <View style={cl.empty}>
          <Text style={{ fontSize: 48 }}>✏️</Text>
          <Text style={cl.emptyTitle}>Your parent hasn't added anything here yet.</Text>
          <Text style={cl.emptyDesc}>Check back later — they're probably working on it! 💙</Text>
        </View>
      ) : (
        catEntries.map(entry => (
          <TouchableOpacity
            key={entry.id}
            style={[cl.entryCard, { borderColor: selectedCat.color + "40" }]}
            onPress={() => setSelectedEntry(entry)}
            activeOpacity={0.85}
          >
            <View style={[cl.entryAccent, { backgroundColor: selectedCat.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={cl.entryTitle}>{entry.title}</Text>
              <Text style={cl.entryPreview} numberOfLines={2}>{entry.bodyText}</Text>
              {(entry.videoUrls.length > 0 || entry.images.length > 0) && (
                <View style={cl.entryMeta}>
                  {entry.videoUrls.length > 0 && <Text style={cl.metaTag}>🎬 {entry.videoUrls.length} video{entry.videoUrls.length > 1 ? "s" : ""}</Text>}
                  {entry.images.length > 0 && <Text style={cl.metaTag}>🖼️ {entry.images.length} image{entry.images.length > 1 ? "s" : ""}</Text>}
                </View>
              )}
            </View>
            <Text style={{ fontSize: 20, color: selectedCat.color }}>→</Text>
          </TouchableOpacity>
        ))
      )}
    </ScreenContainer>
  );

  // Category grid
  return (
    <ScreenContainer scroll>
      <View style={s.header}>
        <Text style={s.title}>💙 How Are You Feeling?</Text>
        <Text style={s.sub}>Pick a topic to find help and advice</Text>
      </View>

      {categories.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 64 }}>💙</Text>
          <Text style={s.emptyTitle}>Nothing here yet</Text>
          <Text style={s.emptySub}>Ask your parent to add some helpful content for you here!</Text>
        </View>
      ) : (
        <View style={s.grid}>
          {categories.map(cat => {
            const count = entries.filter(e => e.categoryId === cat.id).length;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[s.catCard, { backgroundColor: cat.color + "15", borderColor: cat.color + "40" }]}
                onPress={() => setSelectedCat(cat)}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 40, marginBottom: 8 }}>{cat.emoji}</Text>
                <Text style={[s.catLabel, { color: cat.color }]} numberOfLines={2}>{cat.title}</Text>
                <Text style={s.catCount}>{count} {count === 1 ? "tip" : "tips"}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  header: { alignItems: "center", marginBottom: 20, gap: 4 },
  title: { fontSize: 22, fontWeight: "800", color: Colors.primary },
  sub: { fontSize: 13, color: Colors.textSecondary },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: Colors.textPrimary },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  catCard: { width: "47%", borderRadius: 22, padding: 18, borderWidth: 2, alignItems: "center", ...Shadow.sm },
  catLabel: { fontSize: 15, fontWeight: "800", textAlign: "center" },
  catCount: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
});

const cl = StyleSheet.create({
  header: { borderRadius: 20, padding: 20, alignItems: "center", gap: 6, marginBottom: 16, borderWidth: 1.5 },
  title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  desc: { fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  emptyDesc: { fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  entryCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surfaceLight, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1.5, ...Shadow.sm },
  entryAccent: { width: 4, height: "100%", borderRadius: 2, minHeight: 40 },
  entryTitle: { fontSize: 15, fontWeight: "800", color: Colors.textPrimary, marginBottom: 4 },
  entryPreview: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  entryMeta: { flexDirection: "row", gap: 8, marginTop: 6 },
  metaTag: { fontSize: 11, color: Colors.textMuted, fontWeight: "600" },
});

const ed = StyleSheet.create({
  titleBox: { borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1.5 },
  title: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  body: { fontSize: 15, color: Colors.textPrimary, lineHeight: 26, marginBottom: 16 },
  sectionLabel: { fontSize: 13, fontWeight: "800", color: Colors.textSecondary, marginBottom: 10, marginTop: 8 },
  img: { width: 200, height: 140, borderRadius: 14, backgroundColor: Colors.border },
});

const vc = StyleSheet.create({
  chip: { flexDirection: "row", backgroundColor: Colors.surfaceLight, borderRadius: 16, overflow: "hidden", marginBottom: 10, ...Shadow.sm, borderWidth: 1, borderColor: Colors.border },
  thumb: { width: 100, height: 72 },
  chipRight: { flex: 1, padding: 10, gap: 4 },
  chipLabel: { fontSize: 13, fontWeight: "800", color: Colors.textPrimary },
  chipUrl: { fontSize: 10, color: Colors.textMuted },
  watchBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  watchText: { fontSize: 11, fontWeight: "700", color: "#fff" },
});
