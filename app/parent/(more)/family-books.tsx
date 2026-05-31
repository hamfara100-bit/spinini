import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Modal, Alert, Linking,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useData } from "../../../lib/data/store";
import { uid } from "../../../lib/utils";
import { Colors, FontSize, Radius, Spacing } from "../../../lib/theme";
import { ScreenContainer } from "../../../components/screen-container";
import { useColors } from "../../../hooks/use-colors";
import type { FamilyBook, BookFormat } from "../../../lib/data/types";

const BOOKS_DIR = FileSystem.documentDirectory + "family_books/";

async function ensureBooksDir() {
  const info = await FileSystem.getInfoAsync(BOOKS_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(BOOKS_DIR, { intermediates: true });
}

const FORMAT_ICONS: Record<BookFormat, string> = {
  pdf: "📄", epub: "📗", url: "🔗", other: "📚",
};

type AddMode = "file" | "url";

export default function FamilyBooksScreen() {
  const { state, dispatch } = useData();
  const C = useColors();
  const books: FamilyBook[] = state.familyBooks ?? [];

  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("file");

  // Shared fields
  const [titleInput, setTitleInput] = useState("");
  const [authorInput, setAuthorInput] = useState("");
  const [descInput, setDescInput] = useState("");

  // URL mode
  const [urlInput, setUrlInput] = useState("");

  const [picking, setPicking] = useState(false);

  function resetForm() {
    setTitleInput(""); setAuthorInput(""); setDescInput(""); setUrlInput("");
    setAddMode("file");
  }

  async function pickFile() {
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/epub+zip",
          "application/x-mobipocket-ebook",
          "*/*",
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) { setPicking(false); return; }
      const asset = result.assets[0];

      await ensureBooksDir();
      const ext = asset.name.split(".").pop()?.toLowerCase() ?? "pdf";
      const destName = uid() + "." + ext;
      const destUri = BOOKS_DIR + destName;
      await FileSystem.copyAsync({ from: asset.uri, to: destUri });

      const fmt: BookFormat = ext === "pdf" ? "pdf" : ext === "epub" ? "epub" : "other";
      const bookTitle = titleInput.trim() || asset.name.replace(/\.[^.]+$/, "");

      const book: FamilyBook = {
        id: uid(),
        title: bookTitle,
        author: authorInput.trim() || undefined,
        fileUri: destUri,
        fileType: fmt,
        description: descInput.trim() || undefined,
        addedAt: new Date().toISOString(),
        addedByParentId: "parent",
      };
      dispatch({ type: "FAMILY_BOOK_ADD", book });
      resetForm();
      setShowAdd(false);
    } catch (e: any) {
      Alert.alert("Error", "Could not pick file: " + (e?.message ?? e));
    } finally {
      setPicking(false);
    }
  }

  function addUrl() {
    if (!urlInput.trim()) {
      Alert.alert("URL required", "Please enter a URL for the book.");
      return;
    }
    if (!titleInput.trim()) {
      Alert.alert("Title required", "Please enter a book title.");
      return;
    }
    const book: FamilyBook = {
      id: uid(),
      title: titleInput.trim(),
      author: authorInput.trim() || undefined,
      url: urlInput.trim(),
      fileType: "url",
      description: descInput.trim() || undefined,
      addedAt: new Date().toISOString(),
      addedByParentId: "parent",
    };
    dispatch({ type: "FAMILY_BOOK_ADD", book });
    resetForm();
    setShowAdd(false);
  }

  async function openBook(book: FamilyBook) {
    if (book.url) {
      Linking.openURL(book.url).catch(() =>
        Alert.alert("Cannot Open", "Could not open this URL.")
      );
      return;
    }
    if (book.fileUri) {
      const info = await FileSystem.getInfoAsync(book.fileUri);
      if (!info.exists) { Alert.alert("File not found", "The book file is missing."); return; }
      // Open with system viewer via Linking
      Linking.openURL(book.fileUri).catch(() =>
        Alert.alert("Cannot Open", "No app installed to open this file type. Try installing a PDF or ebook reader.")
      );
    }
  }

  function handleDelete(book: FamilyBook) {
    Alert.alert("Remove Book", `Remove "${book.title}" from the family library?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: () => {
          if (book.fileUri) {
            FileSystem.deleteAsync(book.fileUri, { idempotent: true }).catch(() => {});
          }
          dispatch({ type: "FAMILY_BOOK_DELETE", bookId: book.id });
        },
      },
    ]);
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>📚</Text>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Books & Reading</Text>
        <Text style={[styles.headerSub, { color: C.textSecondary }]}>
          Share PDFs, ebooks, and reading links with the family
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: 100 }}>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>＋ Add Book / PDF</Text>
        </TouchableOpacity>

        {books.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: C.surface }]}>
            <Text style={styles.emptyEmoji}>📖</Text>
            <Text style={[styles.emptyText, { color: C.textSecondary }]}>
              No books added yet. Add a PDF, ebook file, or a reading link!
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
                    <Text style={[styles.bookDesc, { color: C.textSecondary }]} numberOfLines={2}>
                      {b.description}
                    </Text>
                  )}
                  <View style={styles.cardFooter}>
                    <Text style={[styles.bookMeta, { color: C.textMuted }]}>
                      {(b.fileType ?? "other").toUpperCase()}  ·  {new Date(b.addedAt).toLocaleDateString()}
                    </Text>
                    <TouchableOpacity onPress={() => openBook(b)} style={styles.openBtn}>
                      <Text style={styles.openBtnText}>Open ↗</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDelete(b)} style={styles.deleteBtn}>
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
              <Text style={[styles.modalTitle, { color: C.textPrimary }]}>Add Book / PDF</Text>

              {/* Mode tabs */}
              <View style={styles.modeTabs}>
                {(["file", "url"] as AddMode[]).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.modeTab, addMode === m && styles.modeTabActive]}
                    onPress={() => setAddMode(m)}
                  >
                    <Text style={[styles.modeTabText, addMode === m && styles.modeTabTextActive]}>
                      {m === "file" ? "📂 Upload File" : "🔗 Add URL"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: C.textSecondary }]}>
                Title {addMode === "url" ? "*" : "(optional — uses filename if blank)"}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: C.surface, color: C.textPrimary, borderColor: C.border }]}
                placeholder="Book title"
                placeholderTextColor={C.textMuted}
                value={titleInput}
                onChangeText={setTitleInput}
              />

              <Text style={[styles.label, { color: C.textSecondary }]}>Author (optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: C.surface, color: C.textPrimary, borderColor: C.border }]}
                placeholder="Author name"
                placeholderTextColor={C.textMuted}
                value={authorInput}
                onChangeText={setAuthorInput}
              />

              <Text style={[styles.label, { color: C.textSecondary }]}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.inputMulti, { backgroundColor: C.surface, color: C.textPrimary, borderColor: C.border }]}
                placeholder="Short description or notes..."
                placeholderTextColor={C.textMuted}
                value={descInput}
                onChangeText={setDescInput}
                multiline
                numberOfLines={3}
              />

              {addMode === "url" ? (
                <>
                  <Text style={[styles.label, { color: C.textSecondary }]}>Book URL *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: C.surface, color: C.textPrimary, borderColor: C.border }]}
                    placeholder="https://..."
                    placeholderTextColor={C.textMuted}
                    value={urlInput}
                    onChangeText={setUrlInput}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity style={styles.saveBtn} onPress={addUrl}>
                    <Text style={styles.saveBtnText}>Add Book</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.pickFileBtn, picking && { opacity: 0.6 }]}
                  onPress={pickFile}
                  disabled={picking}
                >
                  <Text style={styles.pickFileBtnText}>{picking ? "Picking…" : "📂 Pick PDF / Ebook File"}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: C.border, marginTop: Spacing.sm }]}
                onPress={() => { setShowAdd(false); resetForm(); }}
              >
                <Text style={[styles.cancelText, { color: C.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
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
  openBtn: { backgroundColor: Colors.primary + "18", borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 5 },
  openBtnText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.xs },
  deleteBtn: { padding: 6 },
  deleteBtnText: { color: Colors.error, fontSize: 18, fontWeight: "700" },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl,
    padding: Spacing.lg, maxHeight: "90%",
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: "800", textAlign: "center", marginBottom: Spacing.md },
  modeTabs: { flexDirection: "row", gap: 10, marginBottom: Spacing.md },
  modeTab: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg,
    paddingVertical: 10, alignItems: "center", backgroundColor: Colors.surfaceLight,
  },
  modeTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modeTabText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary },
  modeTabTextActive: { color: "#fff" },
  label: { fontSize: FontSize.xs, fontWeight: "600", marginBottom: 4, marginTop: Spacing.sm },
  input: {
    borderWidth: 1, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: FontSize.sm,
  },
  inputMulti: { height: 80, textAlignVertical: "top" },
  pickFileBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingVertical: 14, alignItems: "center", marginTop: Spacing.lg,
  },
  pickFileBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.md },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingVertical: 14, alignItems: "center", marginTop: Spacing.lg,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.md },
  cancelBtn: {
    borderWidth: 1, borderRadius: Radius.lg, paddingVertical: 14, alignItems: "center",
  },
  cancelText: { fontWeight: "600", fontSize: FontSize.sm },
});
