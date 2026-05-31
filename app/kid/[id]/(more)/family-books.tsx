import React from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Linking,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system";
import { useData } from "../../../../lib/data/store";
import { Colors, FontSize, Radius, Spacing } from "../../../../lib/theme";
import { ScreenContainer } from "../../../../components/screen-container";
import { useColors } from "../../../../hooks/use-colors";
import type { FamilyBook, BookFormat } from "../../../../lib/data/types";

const FORMAT_ICONS: Record<BookFormat, string> = {
  pdf: "📄", epub: "📗", url: "🔗", other: "📚",
};

export default function KidFamilyBooksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useData();
  const C = useColors();
  const books: FamilyBook[] = state.familyBooks ?? [];

  async function openBook(book: FamilyBook) {
    if (book.url) {
      Linking.openURL(book.url).catch(() =>
        Alert.alert("Cannot Open", "Could not open this link.")
      );
      return;
    }
    if (book.fileUri) {
      const info = await FileSystem.getInfoAsync(book.fileUri);
      if (!info.exists) { Alert.alert("File not found", "The book file is missing."); return; }
      Linking.openURL(book.fileUri).catch(() =>
        Alert.alert("Cannot Open", "No app installed to open this file type.")
      );
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>📚</Text>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Books & Reading</Text>
        <Text style={[styles.headerSub, { color: C.textSecondary }]}>
          Books and reading links from your parents
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: 100 }}>
        {books.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: C.surface }]}>
            <Text style={styles.emptyEmoji}>📖</Text>
            <Text style={[styles.emptyText, { color: C.textSecondary }]}>
              No books yet. Ask a parent to add some books or reading links!
            </Text>
          </View>
        ) : (
          books.map(b => (
            <View key={b.id} style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={styles.cardRow}>
                <Text style={styles.cardIcon}>
                  {FORMAT_ICONS[b.fileType ?? "other"]}
                </Text>
                <View style={styles.cardBody}>
                  <Text style={[styles.bookTitle, { color: C.textPrimary }]}>{b.title}</Text>
                  {!!b.author && (
                    <Text style={[styles.bookAuthor, { color: C.textSecondary }]}>by {b.author}</Text>
                  )}
                  {!!b.description && (
                    <Text style={[styles.bookDesc, { color: C.textSecondary }]} numberOfLines={3}>
                      {b.description}
                    </Text>
                  )}
                  <View style={styles.cardFooter}>
                    <Text style={[styles.bookMeta, { color: C.textMuted }]}>
                      {(b.fileType ?? "other").toUpperCase()}
                    </Text>
                    <TouchableOpacity onPress={() => openBook(b)} style={styles.readBtn}>
                      <Text style={styles.readBtnText}>📖 Read</Text>
                    </TouchableOpacity>
                  </View>
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
    borderRadius: Radius.xl, padding: Spacing.xl, alignItems: "center", marginTop: 20,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { textAlign: "center", fontSize: FontSize.sm, lineHeight: 22 },
  card: {
    borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.md, marginBottom: 12,
  },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardIcon: { fontSize: 32, marginTop: 2 },
  cardBody: { flex: 1 },
  bookTitle: { fontSize: FontSize.md, fontWeight: "700" },
  bookAuthor: { fontSize: FontSize.sm, marginTop: 2, fontStyle: "italic" },
  bookDesc: { fontSize: FontSize.sm, marginTop: 5, lineHeight: 20 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  bookMeta: { fontSize: FontSize.xs },
  readBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 6,
  },
  readBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
});
