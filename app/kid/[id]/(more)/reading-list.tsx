import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, Alert, Image, FlatList,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid } from "../../../../lib/utils";
import type { ReadingBook } from "../../../../lib/data/types";

// ─── Star Rating ─────────────────────────────────────────────────────────────

function StarRating({ value, onChange, size = 32 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity key={n} onPress={() => onChange?.(n)} disabled={!onChange}>
          <Text style={{ fontSize: size }}>{n <= value ? "⭐" : "☆"}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Add Book Modal ───────────────────────────────────────────────────────────

function AddBookModal({ visible, onClose, onSave }: {
  visible: boolean;
  onClose: () => void;
  onSave: (b: Omit<ReadingBook, "id">) => void;
}) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [coverUri, setCoverUri] = useState<string | undefined>();
  const [rating, setRating] = useState(3);
  const [review, setReview] = useState("");

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
    });
    if (!result.canceled) setCoverUri(result.assets[0].uri);
  }

  async function takePhoto() {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (!result.canceled) setCoverUri(result.assets[0].uri);
  }

  function save() {
    if (!title.trim()) { Alert.alert("Title needed", "What's the book called?"); return; }
    onSave({
      title: title.trim(),
      author: author.trim() || undefined,
      coverUri,
      rating,
      review: review.trim() || undefined,
      dateFinished: new Date().toISOString().slice(0, 10),
    });
    setTitle(""); setAuthor(""); setCoverUri(undefined); setRating(3); setReview("");
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={ms.overlay}>
        <ScrollView style={ms.sheet} keyboardShouldPersistTaps="handled">
          <Text style={ms.title}>📖 Add a Book</Text>

          {/* Cover image picker */}
          <View style={ms.coverRow}>
            <TouchableOpacity
              style={[ms.coverBox, coverUri && { borderWidth: 0 }]}
              onPress={pickImage}
            >
              {coverUri ? (
                <Image source={{ uri: coverUri }} style={ms.coverImg} />
              ) : (
                <Text style={ms.coverPlaceholder}>📸{"\n"}Tap to add{"\n"}cover photo</Text>
              )}
            </TouchableOpacity>
            <View style={ms.coverBtns}>
              <TouchableOpacity style={ms.imgBtn} onPress={pickImage}>
                <Text style={ms.imgBtnText}>🖼 Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ms.imgBtn} onPress={takePhoto}>
                <Text style={ms.imgBtnText}>📷 Camera</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={ms.label}>Book Title *</Text>
          <TextInput
            style={ms.input}
            value={title}
            onChangeText={setTitle}
            placeholder="What book did you read?"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={ms.label}>Author</Text>
          <TextInput
            style={ms.input}
            value={author}
            onChangeText={setAuthor}
            placeholder="Who wrote it? (optional)"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={ms.label}>How much did you enjoy it?</Text>
          <View style={{ marginBottom: Spacing.sm }}>
            <StarRating value={rating} onChange={setRating} size={36} />
          </View>
          <Text style={ms.ratingHint}>
            {["", "Not for me 😕", "It was okay 😐", "Pretty good 😊", "Really liked it 😄", "LOVED it! 🤩"][rating]}
          </Text>

          <Text style={ms.label}>My Thoughts (optional)</Text>
          <TextInput
            style={[ms.input, { height: 90, textAlignVertical: "top" }]}
            value={review}
            onChangeText={setReview}
            multiline
            placeholder="What was it about? What did you like?"
            placeholderTextColor={Colors.textMuted}
          />

          <View style={ms.btnRow}>
            <TouchableOpacity style={ms.cancelBtn} onPress={onClose}>
              <Text style={ms.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ms.saveBtn} onPress={save}>
              <Text style={ms.saveText}>Add to My List ✓</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Book Card ────────────────────────────────────────────────────────────────

function BookCard({ book, onDelete }: { book: ReadingBook; onDelete: () => void }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onLongPress={onDelete}
      delayLongPress={600}
      activeOpacity={0.85}
    >
      {/* Cover */}
      <View style={styles.cardCover}>
        {book.coverUri ? (
          <Image source={{ uri: book.coverUri }} style={styles.coverImg} />
        ) : (
          <View style={styles.coverFallback}>
            <Text style={{ fontSize: 36 }}>📖</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
        {book.author ? <Text style={styles.bookAuthor}>by {book.author}</Text> : null}

        <StarRating value={book.rating} size={18} />

        {book.review ? (
          <Text style={styles.bookReview} numberOfLines={2}>"{book.review}"</Text>
        ) : null}

        <Text style={styles.bookDate}>Finished {book.dateFinished}</Text>

        {/* Parent points badge */}
        {book.parentPoints !== undefined && (
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsText}>⭐ +{book.parentPoints} pts from parent</Text>
            {book.parentMessage ? <Text style={styles.parentMsg}>"{book.parentMessage}"</Text> : null}
          </View>
        )}
        {book.parentPoints === undefined && (
          <Text style={styles.waitingText}>⏳ Waiting for parent review…</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ReadingListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);
  const [showAdd, setShowAdd] = useState(false);

  const books = kid?.readingBooks ?? [];

  function addBook(data: Omit<ReadingBook, "id">) {
    dispatch({ type: "READING_BOOK_ADD", kidId: id, book: { id: uid(), ...data } });
  }

  function deleteBook(bookId: string) {
    Alert.alert("Remove book?", "Remove this book from your reading list?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: () => dispatch({ type: "READING_BOOK_REMOVE", kidId: id, bookId }),
      },
    ]);
  }

  // Reading stats
  const totalRead = books.length;
  const avgRating = totalRead > 0
    ? (books.reduce((s, b) => s + b.rating, 0) / totalRead).toFixed(1)
    : "—";
  const totalPoints = books.reduce((s, b) => s + (b.parentPoints ?? 0), 0);

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>📚 Books I've Read</Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{totalRead}</Text>
          <Text style={styles.statLabel}>Books Read</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{avgRating}</Text>
          <Text style={styles.statLabel}>Avg Rating</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{totalPoints}</Text>
          <Text style={styles.statLabel}>Points Earned</Text>
        </View>
      </View>

      {/* Book list */}
      {books.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 72, marginBottom: 16 }}>📚</Text>
          <Text style={styles.emptyTitle}>No books yet!</Text>
          <Text style={styles.emptySub}>
            Tap the button below to add a book you've read. Your parent can give you points! ⭐
          </Text>
        </View>
      ) : (
        books.map(book => (
          <BookCard key={book.id} book={book} onDelete={() => deleteBook(book.id)} />
        ))
      )}

      {/* Add button */}
      <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
        <Text style={styles.addBtnText}>+ Add a Book I Read</Text>
      </TouchableOpacity>

      {books.length > 0 && (
        <Text style={styles.hint}>Hold a book card to remove it</Text>
      )}

      <AddBookModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={addBook}
      />
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  title: {
    fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: "row", gap: 8, marginBottom: Spacing.md,
  },
  statBox: {
    flex: 1, backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: "center", ...Shadow.sm,
  },
  statNum: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  empty: {
    alignItems: "center", paddingVertical: Spacing.xl,
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl,
    marginBottom: Spacing.lg, padding: Spacing.lg,
  },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary, marginBottom: 8 },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  card: {
    flexDirection: "row", gap: 12,
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: 10, ...Shadow.sm,
  },
  cardCover: { width: 72, alignItems: "center" },
  coverImg: { width: 72, height: 96, borderRadius: 8, resizeMode: "cover" },
  coverFallback: {
    width: 72, height: 96, borderRadius: 8,
    backgroundColor: Colors.primary + "15",
    alignItems: "center", justifyContent: "center",
  },
  cardInfo: { flex: 1, gap: 4 },
  bookTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary, lineHeight: 20 },
  bookAuthor: { fontSize: FontSize.sm, color: Colors.textSecondary },
  bookReview: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: "italic", lineHeight: 18 },
  bookDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  pointsBadge: {
    backgroundColor: Colors.secondary + "25", borderRadius: Radius.md,
    paddingHorizontal: 8, paddingVertical: 4, marginTop: 4, gap: 2,
  },
  pointsText: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textPrimary },
  parentMsg: { fontSize: FontSize.xs, color: Colors.textSecondary, fontStyle: "italic" },
  waitingText: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  addBtn: {
    alignSelf: "center", backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 28, paddingVertical: 14, marginTop: Spacing.md, ...Shadow.sm,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  hint: {
    textAlign: "center", fontSize: FontSize.xs,
    color: Colors.textMuted, marginTop: Spacing.sm,
  },
});

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: Colors.surfaceLight,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, maxHeight: "94%",
  },
  title: {
    fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary,
    marginBottom: Spacing.md, textAlign: "center",
  },
  coverRow: {
    flexDirection: "row", gap: 12, marginBottom: Spacing.md, alignItems: "flex-start",
  },
  coverBox: {
    width: 90, height: 120, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.border, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  coverImg: { width: 90, height: 120, resizeMode: "cover" },
  coverPlaceholder: {
    fontSize: FontSize.xs, color: Colors.textMuted,
    textAlign: "center", lineHeight: 18,
  },
  coverBtns: { flex: 1, gap: 8, justifyContent: "center" },
  imgBtn: {
    backgroundColor: Colors.cardLight, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 10, alignItems: "center",
  },
  imgBtnText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary },
  label: {
    fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 14,
  },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    padding: 12, fontSize: FontSize.base, backgroundColor: Colors.surfaceLight,
    color: Colors.textPrimary,
  },
  ratingHint: {
    fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm, marginTop: 4,
  },
  btnRow: { flexDirection: "row", gap: 10, marginTop: Spacing.lg },
  cancelBtn: {
    flex: 1, borderWidth: 2, borderColor: Colors.border,
    borderRadius: Radius.full, alignItems: "center", paddingVertical: 14,
  },
  cancelText: { fontWeight: "700", color: Colors.textSecondary },
  saveBtn: {
    flex: 2, backgroundColor: Colors.primary,
    borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, ...Shadow.sm,
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
});
