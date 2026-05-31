import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, Dimensions,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import type { BookEntry } from "../../../../lib/data/types";

const COVER_EMOJIS = ["📖","🌟","🚀","🐉","🌈","🦄","🌙","⭐","🎠","🏰","🐬","🦋","🎪","🌺","🍀","🎯"];
const { width: SCREEN_W } = Dimensions.get("window");

// ─── Book list screen ─────────────────────────────────────────────────────────
export default function BooksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);

  const [newTitle, setNewTitle]   = useState("");
  const [adding, setAdding]       = useState(false);
  const [editingBook, setEditingBook] = useState<BookEntry | null>(null);

  // ── Create: title only ──────────────────────────────────────────────────────
  function handleCreate() {
    if (!newTitle.trim()) return;
    const book: BookEntry = {
      id: uid(),
      kidId: id,
      title: newTitle.trim(),
      coverEmoji: "📖",
      pages: [{ pageNumber: 1, text: "" }],
      createdAt: nowIso(),
    };
    dispatch({ type: "ADD_BOOK", kidId: id, book });
    setNewTitle("");
    setAdding(false);
    // Open the editor right away so they can start writing
    setEditingBook(book);
  }

  // ── If a book is open, show editor ─────────────────────────────────────────
  if (editingBook) {
    // Find the latest version from store (in case of saves)
    const liveBook = kid?.books.find(b => b.id === editingBook.id) ?? editingBook;
    return (
      <BookEditor
        book={liveBook}
        kidId={id}
        dispatch={dispatch}
        onClose={() => setEditingBook(null)}
      />
    );
  }

  // ── List view ───────────────────────────────────────────────────────────────
  const books = kid?.books ?? [];

  return (
    <ScreenContainer scroll showBack={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>📚 My Books</Text>
        <TouchableOpacity
          style={[styles.addBtn, adding && styles.addBtnActive]}
          onPress={() => { setAdding(v => !v); setNewTitle(""); }}
        >
          <Text style={styles.addBtnText}>{adding ? "✕" : "＋ New"}</Text>
        </TouchableOpacity>
      </View>

      {/* Quick-create panel: title only */}
      {adding && (
        <View style={styles.createCard}>
          <Text style={styles.createLabel}>📖 Book Title</Text>
          <TextInput
            style={styles.createInput}
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="My Amazing Story…"
            placeholderTextColor={Colors.textMuted}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <TouchableOpacity
            style={[styles.createBtn, !newTitle.trim() && styles.createBtnDisabled]}
            onPress={handleCreate}
            disabled={!newTitle.trim()}
          >
            <Text style={styles.createBtnText}>Create &amp; Open ✏️</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Empty state */}
      {books.length === 0 && !adding && (
        <View style={styles.empty}>
          <Text style={{ fontSize: 72 }}>📚</Text>
          <Text style={styles.emptyTitle}>No books yet!</Text>
          <Text style={styles.emptySub}>Tap "＋ New" to write your first story.</Text>
        </View>
      )}

      {/* Book grid */}
      <View style={styles.grid}>
        {books.map(b => (
          <TouchableOpacity
            key={b.id}
            style={styles.bookCard}
            onPress={() => setEditingBook(b)}
            activeOpacity={0.8}
          >
            {/* Cover */}
            <View style={styles.bookCover}>
              <Text style={{ fontSize: 44 }}>{b.coverEmoji}</Text>
            </View>
            {/* Spine */}
            <View style={styles.bookSpine} />
            {/* Info */}
            <View style={styles.bookInfo}>
              <Text style={styles.bookTitle} numberOfLines={2}>{b.title}</Text>
              <Text style={styles.bookMeta}>
                {b.pages.length} page{b.pages.length !== 1 ? "s" : ""}
              </Text>
            </View>
            {/* Edit badge */}
            <View style={styles.editBadge}>
              <Text style={{ fontSize: 11, color: "#fff", fontWeight: "800" }}>EDIT</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScreenContainer>
  );
}

// ─── Book Editor ──────────────────────────────────────────────────────────────
function BookEditor({
  book, kidId, dispatch, onClose,
}: {
  book: BookEntry;
  kidId: string;
  dispatch: (a: any) => void;
  onClose: () => void;
}) {
  const [title,       setTitle]       = useState(book.title);
  const [coverEmoji,  setCoverEmoji]  = useState(book.coverEmoji);
  const [pages,       setPages]       = useState(book.pages.map(p => ({ ...p })));
  const [currentPage, setCurrentPage] = useState(0);
  const [showEmojis,  setShowEmojis]  = useState(false);
  const [dirty,       setDirty]       = useState(false);
  const inputRef = useRef<TextInput>(null);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function markDirty() { setDirty(true); }

  function updatePageText(text: string) {
    setPages(prev => prev.map((p, i) => i === currentPage ? { ...p, text } : p));
    markDirty();
  }

  function addPage() {
    const next = [...pages, { pageNumber: pages.length + 1, text: "" }];
    setPages(next);
    setCurrentPage(next.length - 1);
    markDirty();
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function deletePage() {
    if (pages.length === 1) {
      Alert.alert("Can't delete", "A book must have at least one page.");
      return;
    }
    Alert.alert("Delete page?", `Remove page ${currentPage + 1}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: () => {
          const next = pages
            .filter((_, i) => i !== currentPage)
            .map((p, i) => ({ ...p, pageNumber: i + 1 }));
          setPages(next);
          setCurrentPage(Math.max(0, currentPage - 1));
          markDirty();
        },
      },
    ]);
  }

  function save() {
    dispatch({
      type: "UPDATE_BOOK",
      kidId,
      bookId: book.id,
      payload: { title: title.trim() || book.title, coverEmoji, pages },
    });
    setDirty(false);
  }

  function handleClose() {
    if (dirty) {
      Alert.alert("Save changes?", "You have unsaved changes.", [
        { text: "Discard", style: "destructive", onPress: onClose },
        { text: "Save & Close", onPress: () => { save(); onClose(); } },
      ]);
    } else {
      onClose();
    }
  }

  const page = pages[currentPage];

  return (
    <View style={{ flex: 1, backgroundColor: "#FAF7FF" }}>
      {/* ── Top bar ── */}
      <View style={edStyles.topBar}>
        <TouchableOpacity onPress={handleClose} style={edStyles.backBtn}>
          <Text style={edStyles.backText}>‹ Books</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[edStyles.saveBtn, !dirty && edStyles.saveBtnDim]}
          onPress={save}
          disabled={!dirty}
        >
          <Text style={edStyles.saveBtnText}>{dirty ? "💾 Save" : "✓ Saved"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Book title ── */}
        <View style={edStyles.titleRow}>
          {/* Cover emoji picker */}
          <TouchableOpacity
            style={edStyles.emojiBtn}
            onPress={() => setShowEmojis(v => !v)}
          >
            <Text style={{ fontSize: 36 }}>{coverEmoji}</Text>
            <Text style={edStyles.emojiHint}>✏️</Text>
          </TouchableOpacity>

          <TextInput
            style={edStyles.titleInput}
            value={title}
            onChangeText={t => { setTitle(t); markDirty(); }}
            placeholder="Book Title"
            placeholderTextColor={Colors.textMuted}
            maxLength={60}
          />
        </View>

        {/* ── Emoji picker ── */}
        {showEmojis && (
          <View style={edStyles.emojiGrid}>
            {COVER_EMOJIS.map(e => (
              <TouchableOpacity
                key={e}
                style={[edStyles.emojiOption, coverEmoji === e && edStyles.emojiSelected]}
                onPress={() => { setCoverEmoji(e); setShowEmojis(false); markDirty(); }}
              >
                <Text style={{ fontSize: 28 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Page navigation ── */}
        <View style={edStyles.pageNav}>
          <TouchableOpacity
            style={[edStyles.pageArrow, currentPage === 0 && edStyles.pageArrowDim]}
            onPress={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            <Text style={edStyles.pageArrowText}>◀</Text>
          </TouchableOpacity>

          <View style={edStyles.pageIndicator}>
            <Text style={edStyles.pageNum}>Page {currentPage + 1}</Text>
            <Text style={edStyles.pageOf}>of {pages.length}</Text>
          </View>

          <TouchableOpacity
            style={[edStyles.pageArrow, currentPage === pages.length - 1 && edStyles.pageArrowDim]}
            onPress={() => setCurrentPage(p => Math.min(pages.length - 1, p + 1))}
            disabled={currentPage === pages.length - 1}
          >
            <Text style={edStyles.pageArrowText}>▶</Text>
          </TouchableOpacity>
        </View>

        {/* ── Page dots ── */}
        <View style={edStyles.dots}>
          {pages.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => setCurrentPage(i)}>
              <View style={[edStyles.dot, i === currentPage && edStyles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Page text editor ── */}
        <View style={edStyles.pageCard}>
          <TextInput
            ref={inputRef}
            style={edStyles.pageText}
            value={page?.text ?? ""}
            onChangeText={updatePageText}
            placeholder="Start writing your story here…"
            placeholderTextColor={Colors.textMuted}
            multiline
            textAlignVertical="top"
            autoCorrect
          />
        </View>

        {/* ── Page actions ── */}
        <View style={edStyles.pageActions}>
          <TouchableOpacity style={edStyles.addPageBtn} onPress={addPage}>
            <Text style={edStyles.addPageText}>＋ Add Page</Text>
          </TouchableOpacity>
          <TouchableOpacity style={edStyles.delPageBtn} onPress={deletePage}>
            <Text style={edStyles.delPageText}>🗑 Delete Page</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const CARD_W = Math.floor((SCREEN_W - 32 - 12) / 2);

const styles = StyleSheet.create({
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  screenTitle:  { fontSize: FontSize.xl, fontWeight: "900", color: Colors.primary },
  addBtn:       { flexDirection: "row", alignItems: "center", backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnActive: { backgroundColor: Colors.error },
  addBtnText:   { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },

  createCard:       { backgroundColor: "#fff", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.md, borderWidth: 1.5, borderColor: Colors.primary + "30" },
  createLabel:      { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, marginBottom: 8 },
  createInput:      { borderWidth: 2, borderColor: Colors.primary + "50", borderRadius: Radius.lg, padding: 12, fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary, marginBottom: 12 },
  createBtn:        { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12 },
  createBtnDisabled:{ opacity: 0.45 },
  createBtnText:    { color: "#fff", fontWeight: "800", fontSize: FontSize.base },

  empty:      { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary },
  emptySub:   { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },

  bookCard: {
    width: CARD_W,
    backgroundColor: "#fff",
    borderRadius: Radius.xl,
    overflow: "hidden",
    ...Shadow.md,
  },
  bookCover: {
    height: CARD_W * 0.75,
    backgroundColor: Colors.primary + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  bookSpine: {
    height: 4,
    backgroundColor: Colors.primary + "40",
  },
  bookInfo: { padding: 10 },
  bookTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.textPrimary, lineHeight: 18 },
  bookMeta:  { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  editBadge: {
    position: "absolute", top: 8, right: 8,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
});

const edStyles = StyleSheet.create({
  topBar:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn:     { paddingVertical: 6, paddingRight: 12 },
  backText:    { fontSize: FontSize.base, fontWeight: "700", color: Colors.primary },
  saveBtn:     { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 8 },
  saveBtnDim:  { backgroundColor: Colors.border },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },

  titleRow:    { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  emojiBtn:    { width: 64, height: 64, backgroundColor: Colors.primary + "12", borderRadius: Radius.xl, alignItems: "center", justifyContent: "center" },
  emojiHint:   { position: "absolute", bottom: 2, right: 2, fontSize: 12 },
  titleInput:  { flex: 1, fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary, borderBottomWidth: 2, borderBottomColor: Colors.primary + "40", paddingBottom: 4 },

  emojiGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  emojiOption: { width: 52, height: 52, borderRadius: Radius.lg, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...Shadow.sm },
  emojiSelected:{ borderWidth: 2.5, borderColor: Colors.primary },

  pageNav:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginTop: 8 },
  pageArrow:    { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + "18", alignItems: "center", justifyContent: "center" },
  pageArrowDim: { opacity: 0.3 },
  pageArrowText:{ fontSize: 20, color: Colors.primary, fontWeight: "700" },
  pageIndicator:{ alignItems: "center" },
  pageNum:      { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  pageOf:       { fontSize: FontSize.xs, color: Colors.textMuted },

  dots:       { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 8, marginBottom: 4 },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive:  { backgroundColor: Colors.primary, width: 20 },

  pageCard: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: Radius.xl,
    padding: 16,
    minHeight: 280,
    ...Shadow.md,
    borderWidth: 1, borderColor: Colors.primary + "20",
  },
  pageText: {
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    lineHeight: 26,
    minHeight: 260,
    fontFamily: undefined,
  },

  pageActions:  { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginTop: 16 },
  addPageBtn:   { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12 },
  addPageText:  { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },
  delPageBtn:   { flex: 1, backgroundColor: Colors.error + "15", borderRadius: Radius.full, alignItems: "center", paddingVertical: 12, borderWidth: 1.5, borderColor: Colors.error + "40" },
  delPageText:  { color: Colors.error, fontWeight: "700", fontSize: FontSize.sm },
});
