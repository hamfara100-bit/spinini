import React from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Linking,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useData } from "../../../../lib/data/store";
import { Colors, FontSize, Radius, Spacing } from "../../../../lib/theme";
import { ScreenContainer } from "../../../../components/screen-container";
import { useColors } from "../../../../hooks/use-colors";
import type { MoviePlatform, FamilyMovie } from "../../../../lib/data/types";

const PLATFORMS: { id: MoviePlatform; label: string; emoji: string }[] = [
  { id: "youtube",    label: "YouTube",     emoji: "▶️" },
  { id: "netflix",    label: "Netflix",     emoji: "🔴" },
  { id: "disney_plus",label: "Disney+",     emoji: "🏰" },
  { id: "prime",      label: "Prime Video", emoji: "📦" },
  { id: "hbo",        label: "HBO/Max",     emoji: "🎭" },
  { id: "hulu",       label: "Hulu",        emoji: "🟢" },
  { id: "apple_tv",   label: "Apple TV+",   emoji: "🍎" },
  { id: "other",      label: "Other",       emoji: "🎬" },
];

function platformLabel(p: MoviePlatform) {
  return PLATFORMS.find(x => x.id === p)?.label ?? p;
}
function platformEmoji(p: MoviePlatform) {
  return PLATFORMS.find(x => x.id === p)?.emoji ?? "🎬";
}

export default function KidFamilyMoviesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useData();
  const C = useColors();
  const movies: FamilyMovie[] = state.familyMovies ?? [];

  function openLink(movie: FamilyMovie) {
    if (movie.url) {
      Linking.openURL(movie.url).catch(() =>
        Alert.alert("Cannot Open", "Could not open this link.")
      );
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>🎬</Text>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Movies & Shows</Text>
        <Text style={[styles.headerSub, { color: C.textSecondary }]}>
          Family picks — picked by your parents!
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: 100 }}>
        {movies.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: C.surface }]}>
            <Text style={styles.emptyEmoji}>🍿</Text>
            <Text style={[styles.emptyText, { color: C.textSecondary }]}>
              No movies added yet. Ask a parent to add some recommendations!
            </Text>
          </View>
        ) : (
          movies.map(m => (
            <View key={m.id} style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={styles.cardRow}>
                <Text style={styles.cardEmoji}>{platformEmoji(m.platform)}</Text>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, { color: C.textPrimary }]}>
                    {m.title}
                    {m.year ? <Text style={[styles.cardYear, { color: C.textSecondary }]}> ({m.year})</Text> : null}
                  </Text>
                  <Text style={[styles.cardPlatform, { color: Colors.primary }]}>
                    {platformLabel(m.platform)}{m.rating ? `  ·  ${m.rating}` : ""}
                  </Text>
                  {!!m.description && (
                    <Text style={[styles.cardDesc, { color: C.textSecondary }]} numberOfLines={4}>
                      {m.description}
                    </Text>
                  )}
                  {!!m.url && (
                    <TouchableOpacity onPress={() => openLink(m)} style={styles.watchBtn}>
                      <Text style={styles.watchBtnText}>▶ Watch Now</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))
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
  watchBtn: {
    marginTop: 10, backgroundColor: Colors.primary,
    borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 8,
    alignSelf: "flex-start",
  },
  watchBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
});
