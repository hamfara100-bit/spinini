import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Dimensions, Modal,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useData } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { Memory } from "../../../../lib/data/types";

const W = Dimensions.get("window").width;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const MOOD_BG: Record<string, string> = {
  "❤️": "#FFF0F3", "😂": "#FFFBEB", "🥹": "#F0F9FF",
  "🤩": "#FDF4FF", "😍": "#FFF0F6", "🎉": "#F0FFF4",
  "😮": "#FFF7ED", "🌟": "#FFFBEB",
};
const MOOD_ACCENT: Record<string, string> = {
  "❤️": "#FB7185", "😂": "#FBBF24", "🥹": "#38BDF8",
  "🤩": "#C084FC", "😍": "#F472B6", "🎉": "#4ADE80",
  "😮": "#FB923C", "🌟": "#FBBF24",
};

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function MemoryDetailModal({ memory, onClose }: { memory: Memory; onClose: () => void }) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const bg     = MOOD_BG[memory.mood]   ?? "#F9F9F9";
  const accent = MOOD_ACCENT[memory.mood] ?? Colors.primary;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[modalStyles.container, { backgroundColor: bg }]}>
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Header */}
          <View style={[modalStyles.header, { borderBottomColor: accent + "30" }]}>
            <TouchableOpacity style={modalStyles.closeBtn} onPress={onClose}>
              <Text style={[modalStyles.closeBtnText, { color: accent }]}>✕</Text>
            </TouchableOpacity>
            <Text style={modalStyles.mood}>{memory.mood}</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Date */}
          <View style={[modalStyles.dateBadge, { backgroundColor: accent + "20" }]}>
            <Text style={[modalStyles.dateText, { color: accent }]}>{formatDate(memory.date)}</Text>
          </View>

          {/* Title */}
          <Text style={modalStyles.title}>{memory.title}</Text>

          {/* Photos */}
          {memory.photoUris.length > 0 && (
            <View style={modalStyles.photoSection}>
              <Image
                source={{ uri: memory.photoUris[photoIdx] }}
                style={[modalStyles.mainPhoto, { borderColor: accent + "40" }]}
                resizeMode="cover"
              />
              {memory.photoUris.length > 1 && (
                <View style={modalStyles.dotRow}>
                  {memory.photoUris.map((_, i) => (
                    <TouchableOpacity key={i} onPress={() => setPhotoIdx(i)}>
                      <View style={[modalStyles.dot, i === photoIdx && { backgroundColor: accent, width: 16 }]} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {memory.photoUris.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={modalStyles.thumbRow}>
                  {memory.photoUris.map((uri, i) => (
                    <TouchableOpacity key={i} onPress={() => setPhotoIdx(i)}>
                      <Image
                        source={{ uri }}
                        style={[modalStyles.thumbImg, i === photoIdx && { borderColor: accent, borderWidth: 2 }]}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Story */}
          {memory.story ? (
            <View style={[modalStyles.storyCard, { borderLeftColor: accent }]}>
              <Text style={modalStyles.storyQuote}>"</Text>
              <Text style={modalStyles.storyText}>{memory.story}</Text>
              <Text style={[modalStyles.storyAuthor, { color: accent }]}>— {memory.addedBy}</Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function KidMemoriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useData();
  const [selected, setSelected] = useState<Memory | null>(null);

  // Only show memories visible to this kid
  const myMemories = state.memories.filter(m =>
    m.forKids.length === 0 || m.forKids.includes(id)
  ).sort((a, b) => b.date.localeCompare(a.date));

  // Group by year
  const byYear: Record<number, Memory[]> = {};
  for (const m of myMemories) {
    const y = parseInt(m.date.split("-")[0]);
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(m);
  }
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  const totalPhotos = myMemories.reduce((sum, m) => sum + m.photoUris.length, 0);

  if (myMemories.length === 0) {
    return (
      <ScreenContainer scroll>
        <Text style={styles.title}>📸 Memories</Text>
        <View style={styles.empty}>
          <Text style={{ fontSize: 72 }}>🌅</Text>
          <Text style={styles.emptyTitle}>No memories yet</Text>
          <Text style={styles.emptyText}>
            Your parent will add special memories here for you to look back on. 💛
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      {/* Header stats */}
      <Text style={styles.title}>📸 Our Memories</Text>
      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statNumber}>{myMemories.length}</Text>
          <Text style={styles.statLabel}>Moments</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statNumber}>{totalPhotos}</Text>
          <Text style={styles.statLabel}>Photos</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statNumber}>{years.length}</Text>
          <Text style={styles.statLabel}>Year{years.length !== 1 ? "s" : ""}</Text>
        </View>
      </View>

      {/* Most recent featured memory */}
      {myMemories[0] && (() => {
        const m = myMemories[0];
        const accent = MOOD_ACCENT[m.mood] ?? Colors.primary;
        const bg     = MOOD_BG[m.mood]    ?? "#F0F0FF";
        return (
          <TouchableOpacity
            style={[styles.featured, { backgroundColor: bg, borderColor: accent + "40" }]}
            onPress={() => setSelected(m)}
            activeOpacity={0.85}
          >
            <View style={styles.featuredTop}>
              <Text style={styles.featuredMood}>{m.mood}</Text>
              <View style={[styles.featuredBadge, { backgroundColor: accent }]}>
                <Text style={styles.featuredBadgeText}>Most Recent</Text>
              </View>
            </View>
            {m.photoUris[0] ? (
              <Image source={{ uri: m.photoUris[0] }} style={styles.featuredPhoto} resizeMode="cover" />
            ) : null}
            <Text style={styles.featuredTitle}>{m.title}</Text>
            <Text style={styles.featuredDate}>{formatDate(m.date)}</Text>
            {m.story ? (
              <Text style={styles.featuredPreview} numberOfLines={3}>{m.story}</Text>
            ) : null}
          </TouchableOpacity>
        );
      })()}

      {/* Year timeline */}
      {years.map(year => (
        <View key={year}>
          <View style={styles.yearRow}>
            <View style={styles.yearLine} />
            <Text style={styles.yearText}>{year}</Text>
            <View style={styles.yearLine} />
          </View>

          {byYear[year].map((memory, i) => {
            const accent = MOOD_ACCENT[memory.mood] ?? Colors.primary;
            const bg     = MOOD_BG[memory.mood]    ?? Colors.surfaceLight;
            const isFirst = i === 0 && year === years[0];

            // Skip the most-recent since it's shown featured
            if (isFirst) return null;

            return (
              <TouchableOpacity
                key={memory.id}
                style={[styles.memCard, { backgroundColor: bg, borderLeftColor: accent }]}
                onPress={() => setSelected(memory)}
                activeOpacity={0.85}
              >
                <View style={styles.memCardLeft}>
                  <Text style={styles.memMood}>{memory.mood}</Text>
                  <Text style={styles.memDay}>{memory.date.split("-")[2]}</Text>
                  <Text style={styles.memMonth}>{MONTHS[parseInt(memory.date.split("-")[1]) - 1].toUpperCase()}</Text>
                </View>

                <View style={styles.memCardBody}>
                  <Text style={styles.memTitle} numberOfLines={1}>{memory.title}</Text>
                  {memory.story ? (
                    <Text style={styles.memPreview} numberOfLines={2}>{memory.story}</Text>
                  ) : null}
                  {memory.photoUris.length > 0 && (
                    <Text style={[styles.memPhotoBadge, { color: accent }]}>📷 {memory.photoUris.length} photo{memory.photoUris.length > 1 ? "s" : ""}</Text>
                  )}
                </View>

                {memory.photoUris[0] ? (
                  <Image source={{ uri: memory.photoUris[0] }} style={styles.memThumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.memThumbEmpty, { backgroundColor: accent + "20" }]}>
                    <Text style={{ fontSize: 24 }}>{memory.mood}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {selected && (
        <MemoryDetailModal memory={selected} onClose={() => setSelected(null)} />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title:      { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.sm },

  statsRow:   { flexDirection: "row", gap: 8, marginBottom: Spacing.md },
  statPill:   { flex: 1, backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: 12, alignItems: "center", ...Shadow.sm },
  statNumber: { fontSize: 22, fontWeight: "900", color: Colors.primary },
  statLabel:  { fontSize: 11, color: Colors.textSecondary, fontWeight: "600" },

  // Featured
  featured:       { borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, ...Shadow.sm },
  featuredTop:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  featuredMood:   { fontSize: 36 },
  featuredBadge:  { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  featuredBadgeText: { color: "#fff", fontWeight: "700", fontSize: 11 },
  featuredPhoto:  { width: "100%", height: 200, borderRadius: Radius.lg, marginBottom: 10 },
  featuredTitle:  { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  featuredDate:   { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 6 },
  featuredPreview:{ fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 22 },

  // Year divider
  yearRow:    { flexDirection: "row", alignItems: "center", marginVertical: Spacing.sm, gap: 8 },
  yearLine:   { flex: 1, height: 1, backgroundColor: Colors.border },
  yearText:   { fontSize: FontSize.sm, fontWeight: "800", color: Colors.textSecondary },

  // Memory cards
  memCard:      { borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: 10, flexDirection: "row", alignItems: "center", borderLeftWidth: 4, ...Shadow.sm },
  memCardLeft:  { alignItems: "center", width: 48, marginRight: 10 },
  memMood:      { fontSize: 20 },
  memDay:       { fontSize: 20, fontWeight: "900", color: Colors.textPrimary, lineHeight: 24 },
  memMonth:     { fontSize: 9, fontWeight: "700", color: Colors.textSecondary, letterSpacing: 0.5 },
  memCardBody:  { flex: 1 },
  memTitle:     { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  memPreview:   { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
  memPhotoBadge:{ fontSize: 11, fontWeight: "600", marginTop: 4 },
  memThumb:     { width: 60, height: 60, borderRadius: Radius.md, marginLeft: 8 },
  memThumbEmpty:{ width: 60, height: 60, borderRadius: Radius.md, marginLeft: 8, alignItems: "center", justifyContent: "center" },

  // Empty
  empty:      { alignItems: "center", paddingVertical: Spacing.xl, gap: 12 },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary },
  emptyText:  { color: Colors.textSecondary, textAlign: "center", lineHeight: 22, paddingHorizontal: 24 },
});

const modalStyles = StyleSheet.create({
  container:  { flex: 1 },
  header:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.md, borderBottomWidth: 1 },
  closeBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.08)", alignItems: "center", justifyContent: "center" },
  closeBtnText:{ fontSize: 16, fontWeight: "700" },
  mood:       { fontSize: 40 },
  dateBadge:  { alignSelf: "center", borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 6, marginTop: 12 },
  dateText:   { fontWeight: "700", fontSize: FontSize.sm },
  title:      { fontSize: 24, fontWeight: "900", color: Colors.textPrimary, textAlign: "center", paddingHorizontal: Spacing.lg, marginTop: 8, marginBottom: Spacing.md },
  photoSection: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  mainPhoto:  { width: "100%", height: W * 0.72, borderRadius: Radius.xl, borderWidth: 2 },
  dotRow:     { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
  dot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  thumbRow:   { marginTop: 10 },
  thumbImg:   { width: 72, height: 72, borderRadius: Radius.md, marginRight: 8, borderWidth: 0, borderColor: "transparent" },
  storyCard:  { margin: Spacing.md, backgroundColor: "rgba(255,255,255,0.8)", borderRadius: Radius.xl, padding: Spacing.lg, borderLeftWidth: 4, ...Shadow.sm },
  storyQuote: { fontSize: 48, color: Colors.textSecondary, lineHeight: 40, fontFamily: "serif" },
  storyText:  { fontSize: FontSize.lg, color: Colors.textPrimary, lineHeight: 30, fontStyle: "italic" },
  storyAuthor:{ fontSize: FontSize.base, fontWeight: "700", marginTop: Spacing.sm, textAlign: "right" },
});
