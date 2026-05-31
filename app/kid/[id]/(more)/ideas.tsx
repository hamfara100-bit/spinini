import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, Modal, ScrollView, Image, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MicButton } from "../../../../components/voice-text-input";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import type { IdeaPaper, KidNote, NoteFontStyle, NoteFontSize, NoteHighlightColor, Discovery, DiscoveryCategory } from "../../../../lib/data/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const IDEA_EMOJIS = ["💡","🚀","🌍","🤖","🎨","🔬","🏗","🌱","⚡","🎮","🛸","🔮"];

const HIGHLIGHT_COLORS: { key: NoteHighlightColor; hex: string; label: string }[] = [
  { key: "none",   hex: "transparent", label: "None" },
  { key: "yellow", hex: "#FFF176",     label: "☀️" },
  { key: "pink",   hex: "#F48FB1",     label: "🌸" },
  { key: "green",  hex: "#A5D6A7",     label: "🌿" },
  { key: "blue",   hex: "#90CAF9",     label: "💧" },
  { key: "orange", hex: "#FFCC80",     label: "🍊" },
];

const FONT_STYLES: { key: NoteFontStyle; label: string; family: string }[] = [
  { key: "normal", label: "Aa", family: "System" },
  { key: "serif",  label: "Sf", family: "serif" },
  { key: "mono",   label: "</>", family: "monospace" },
];

const FONT_SIZES: { key: NoteFontSize; label: string; size: number }[] = [
  { key: "sm", label: "S", size: 14 },
  { key: "md", label: "M", size: 17 },
  { key: "lg", label: "L", size: 22 },
];

// ─── Discoveries constants ────────────────────────────────────────────────────

const DISC_CATEGORIES: { id: DiscoveryCategory; emoji: string; label: string; color: string }[] = [
  { id: "nature",   emoji: "🌿", label: "Nature",   color: "#16A34A" },
  { id: "animals",  emoji: "🐾", label: "Animals",  color: "#F97316" },
  { id: "science",  emoji: "🔬", label: "Science",  color: "#2563EB" },
  { id: "health",   emoji: "💚", label: "Health",   color: "#10B981" },
  { id: "food",     emoji: "🍎", label: "Food",     color: "#EF4444" },
  { id: "space",    emoji: "🚀", label: "Space",    color: "#7C3AED" },
  { id: "history",  emoji: "📜", label: "History",  color: "#92400E" },
  { id: "people",   emoji: "🧠", label: "People",   color: "#0891B2" },
  { id: "random",   emoji: "🎲", label: "Random",   color: "#64748B" },
];

const DISC_EXAMPLES: { emoji: string; title: string; category: DiscoveryCategory }[] = [
  { emoji: "🦶", title: "Walking barefoot on grass is healthy — it helps reduce stress and connect to the earth's energy!", category: "health" },
  { emoji: "🐦", title: "Magpies swoop and chase people during nesting season to protect their babies!", category: "animals" },
  { emoji: "🍯", title: "Honey never expires — archaeologists found 3,000-year-old honey in Egyptian tombs and it was still good!", category: "food" },
  { emoji: "🌊", title: "The ocean makes up 71% of Earth's surface but over 80% of it has never been explored!", category: "nature" },
  { emoji: "⚡", title: "Lightning strikes the Earth about 100 times every single second!", category: "science" },
  { emoji: "🦈", title: "Sharks are older than trees — they've been swimming in the ocean for over 450 million years!", category: "animals" },
  { emoji: "🍌", title: "Bananas are technically berries, but strawberries are NOT berries — science is weird!", category: "food" },
  { emoji: "🧲", title: "A day on Venus is longer than a year on Venus — it spins so slowly!", category: "space" },
];

function discCatFor(id: DiscoveryCategory) {
  return DISC_CATEGORIES.find(c => c.id === id) ?? DISC_CATEGORIES[8];
}

type Tab = "ideas" | "notes" | "todo" | "discoveries";

// ─── Root Screen ──────────────────────────────────────────────────────────────

const TAB_DEFS: { id: Tab; label: string }[] = [
  { id: "ideas",       label: "💡 Ideas" },
  { id: "notes",       label: "📝 Notes" },
  { id: "todo",        label: "✅ To-Do" },
  { id: "discoveries", label: "🔭 Discoveries" },
];

export default function IdeasScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);
  const [tab, setTab] = useState<Tab>("ideas");

  const ideas       = kid?.ideas ?? [];
  const notes       = kid?.kidNotes ?? [];
  const todos       = kid?.todos ?? [];
  const discoveries = kid?.discoveries ?? [];

  const titleMap: Record<Tab, string> = {
    ideas: "💡 Ideas",
    notes: "📝 Notes",
    todo: "✅ To-Do",
    discoveries: "🔭 Discoveries",
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>{titleMap[tab]}</Text>
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBarScroll}
        contentContainerStyle={styles.tabBar}
      >
        {TAB_DEFS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}
            onPress={() => setTab(t.id)}
          >
            <Text style={[styles.tabBtnText, tab === t.id && styles.tabBtnTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      {tab === "ideas"       && <IdeasTab ideas={ideas} kidId={id} dispatch={dispatch} />}
      {tab === "notes"       && <NotesTab notes={notes} kidId={id} dispatch={dispatch} />}
      {tab === "todo"        && <TodoTab todos={todos} kidId={id} dispatch={dispatch} />}
      {tab === "discoveries" && <DiscoveriesTab discoveries={discoveries} kidId={id} dispatch={dispatch} />}
    </View>
  );
}

// ─── Ideas Tab ────────────────────────────────────────────────────────────────

function IdeasTab({ ideas, kidId, dispatch }: { ideas: IdeaPaper[]; kidId: string; dispatch: any }) {
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<IdeaPaper | null>(null);

  function handleCreate() {
    if (!newTitle.trim()) return;
    const idea: IdeaPaper = {
      id: uid(), kidId,
      title: newTitle.trim(),
      description: "",
      sketches: [],
      createdAt: nowIso(),
    };
    dispatch({ type: "ADD_IDEA", kidId, idea });
    setNewTitle("");
    setAdding(false);
    setEditing(idea);
  }

  function handleDelete(ideaId: string, title: string) {
    Alert.alert("Delete idea?", `"${title}" will be gone forever.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => dispatch({ type: "DELETE_IDEA", kidId, ideaId }) },
    ]);
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, paddingBottom: 40 }}>
      {/* Create row */}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: Spacing.sm }}>
        <TouchableOpacity
          style={[styles.addBtn, adding && styles.addBtnCancel]}
          onPress={() => { setAdding(v => !v); setNewTitle(""); }}
        >
          <Text style={styles.addBtnText}>{adding ? "✕ Cancel" : "＋ New Idea"}</Text>
        </TouchableOpacity>
      </View>

      {/* Motivational tagline */}
      {!adding && (
        <View style={styles.motivationCard}>
          <Text style={styles.motivationTitle}>💡 This is YOUR idea space!</Text>
          <Text style={styles.motivationText}>
            Create your cool game idea and save them for later — you can make them into a real video when you grow up or when you have the resources.{"\n\n"}Here's a great way to keep ideas fast and make them reality later! 🚀✨
          </Text>
        </View>
      )}

      {adding && (
        <View style={styles.createCard}>
          <Text style={styles.createLabel}>💡 Idea name</Text>
          <TextInput
            style={styles.createInput}
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="My brilliant idea…"
            placeholderTextColor={Colors.textMuted}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <TouchableOpacity
            style={[styles.createBtn, !newTitle.trim() && { opacity: 0.4 }]}
            onPress={handleCreate}
            disabled={!newTitle.trim()}
          >
            <Text style={styles.createBtnText}>Create &amp; Edit ✏️</Text>
          </TouchableOpacity>
        </View>
      )}

      {ideas.length === 0 && !adding && (
        <View style={styles.empty}>
          <Text style={{ fontSize: 72 }}>💡</Text>
          <Text style={styles.emptyTitle}>No ideas yet!</Text>
          <Text style={styles.emptySub}>Got a big idea? Tap "＋ New Idea" to capture it.</Text>
        </View>
      )}

      {ideas.map(idea => (
        <TouchableOpacity
          key={idea.id}
          style={styles.ideaCard}
          onPress={() => setEditing(idea)}
          activeOpacity={0.8}
        >
          {idea.photos?.[0]
            ? <Image source={{ uri: idea.photos[0] }} style={styles.ideaThumb} resizeMode="cover" />
            : <Text style={styles.ideaEmoji}>{(idea.sketches as any)?.[0] ?? "💡"}</Text>
          }
          <View style={styles.ideaBody}>
            <Text style={styles.ideaTitle} numberOfLines={1}>{idea.title}</Text>
            {idea.description
              ? <Text style={styles.ideaDesc} numberOfLines={2}>{idea.description}</Text>
              : <Text style={styles.ideaEmpty}>Tap to add description…</Text>
            }
          </View>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(idea.id, idea.title)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.deleteBtnText}>🗑</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      ))}

      {editing && (
        <IdeaEditor
          idea={editing}
          kidId={kidId}
          dispatch={dispatch}
          onClose={() => setEditing(null)}
        />
      )}
    </ScrollView>
  );
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────

function NotesTab({ notes, kidId, dispatch }: { notes: KidNote[]; kidId: string; dispatch: any }) {
  const [idx, setIdx] = useState(0);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const note = notes[idx] ?? null;

  // Clamp index when notes list changes
  useEffect(() => {
    if (idx >= notes.length && notes.length > 0) setIdx(notes.length - 1);
  }, [notes.length]);

  function createNote() {
    const n: KidNote = {
      id: uid(), kidId,
      title: "",
      content: "",
      photos: [],
      highlightColor: "none",
      fontStyle: "normal",
      fontSize: "md",
      bold: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    dispatch({ type: "KID_NOTE_ADD", kidId, note: n });
    setIdx(0); // new note is prepended
  }

  function deleteCurrentNote() {
    if (!note) return;
    Alert.alert("Delete Note", "Delete this note?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: () => {
          dispatch({ type: "KID_NOTE_DELETE", kidId, noteId: note.id });
          setIdx(i => Math.max(0, i - 1));
        },
      },
    ]);
  }

  function updateField(field: keyof KidNote, value: any) {
    if (!note) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      dispatch({ type: "KID_NOTE_UPDATE", kidId, noteId: note.id, payload: { [field]: value } });
    }, 1500);
  }

  function updateImmediate(field: keyof KidNote, value: any) {
    if (!note) return;
    dispatch({ type: "KID_NOTE_UPDATE", kidId, noteId: note.id, payload: { [field]: value } });
  }

  async function addPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (!result.canceled && result.assets[0] && note) {
      const updated = [...(note.photos ?? []), result.assets[0].uri];
      dispatch({ type: "KID_NOTE_UPDATE", kidId, noteId: note.id, payload: { photos: updated } });
    }
  }

  async function takePhoto() {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!result.canceled && result.assets[0] && note) {
      const updated = [...(note.photos ?? []), result.assets[0].uri];
      dispatch({ type: "KID_NOTE_UPDATE", kidId, noteId: note.id, payload: { photos: updated } });
    }
  }

  function removePhoto(uri: string) {
    if (!note) return;
    const updated = (note.photos ?? []).filter(u => u !== uri);
    dispatch({ type: "KID_NOTE_UPDATE", kidId, noteId: note.id, payload: { photos: updated } });
  }

  const hlColor = note ? HIGHLIGHT_COLORS.find(h => h.key === note.highlightColor) : null;
  const bgColor = hlColor?.hex && hlColor.hex !== "transparent" ? hlColor.hex + "55" : "#FFFFFF";
  const fontDef = FONT_STYLES.find(f => f.key === note?.fontStyle) ?? FONT_STYLES[0];
  const sizeDef = FONT_SIZES.find(f => f.key === note?.fontSize) ?? FONT_SIZES[1];

  if (notes.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={{ fontSize: 64 }}>📝</Text>
        <Text style={styles.emptyTitle}>No notes yet!</Text>
        <Text style={styles.emptySub}>Tap ＋ to write your first note.</Text>
        <TouchableOpacity style={styles.addBtn} onPress={createNote}>
          <Text style={styles.addBtnText}>＋ New Note</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Navigation row */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={[styles.navArrow, idx === 0 && styles.navArrowDim]}
          onPress={() => setIdx(i => Math.max(0, i - 1))}
          disabled={idx === 0}
        >
          <Text style={styles.navArrowText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.navCenter}>
          {/* Editable title */}
          <TextInput
            style={styles.noteTitle}
            value={note?.title ?? ""}
            onChangeText={t => {
              dispatch({ type: "KID_NOTE_UPDATE", kidId, noteId: note!.id, payload: { title: t } });
            }}
            placeholder="Note title…"
            placeholderTextColor={Colors.textMuted}
            maxLength={60}
          />
          <Text style={styles.navCount}>{idx + 1} / {notes.length}</Text>
        </View>

        <TouchableOpacity
          style={[styles.navArrow, idx === notes.length - 1 && styles.navArrowDim]}
          onPress={() => setIdx(i => Math.min(notes.length - 1, i + 1))}
          disabled={idx === notes.length - 1}
        >
          <Text style={styles.navArrowText}>›</Text>
        </TouchableOpacity>

        {/* Add new note */}
        <TouchableOpacity style={styles.navAdd} onPress={createNote}>
          <Text style={styles.navAddText}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* Formatting toolbar */}
      <View style={styles.fmtBar}>
        {/* Font style */}
        {FONT_STYLES.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.fmtBtn, note?.fontStyle === f.key && styles.fmtBtnActive]}
            onPress={() => updateImmediate("fontStyle", f.key)}
          >
            <Text style={[styles.fmtBtnText, { fontFamily: f.family }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.fmtDivider} />

        {/* Font size */}
        {FONT_SIZES.map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.fmtBtn, note?.fontSize === s.key && styles.fmtBtnActive]}
            onPress={() => updateImmediate("fontSize", s.key)}
          >
            <Text style={[styles.fmtBtnText, { fontSize: s.size * 0.65 }]}>{s.label}</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.fmtDivider} />

        {/* Bold */}
        <TouchableOpacity
          style={[styles.fmtBtn, note?.bold && styles.fmtBtnActive]}
          onPress={() => updateImmediate("bold", !note?.bold)}
        >
          <Text style={[styles.fmtBtnText, { fontWeight: "900" }]}>B</Text>
        </TouchableOpacity>

        <View style={styles.fmtDivider} />

        {/* Highlight colors */}
        {HIGHLIGHT_COLORS.map(h => (
          <TouchableOpacity
            key={h.key}
            onPress={() => updateImmediate("highlightColor", h.key)}
            style={[
              styles.hlDot,
              { backgroundColor: h.hex === "transparent" ? "#E5E5E5" : h.hex },
              note?.highlightColor === h.key && styles.hlDotActive,
            ]}
          >
            <Text style={{ fontSize: 9 }}>{h.label}</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.fmtDivider} />

        {/* Add photo */}
        <TouchableOpacity style={styles.fmtBtn} onPress={addPhoto}>
          <Text style={styles.fmtBtnText}>🖼️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fmtBtn} onPress={takePhoto}>
          <Text style={styles.fmtBtnText}>📷</Text>
        </TouchableOpacity>

        {/* Delete */}
        <TouchableOpacity style={[styles.fmtBtn, { marginLeft: "auto" }]} onPress={deleteCurrentNote}>
          <Text style={styles.fmtBtnText}>🗑</Text>
        </TouchableOpacity>
      </View>

      {/* Note writing area */}
      <ScrollView
        style={[styles.noteArea, { backgroundColor: bgColor }]}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          key={note?.id}
          style={[
            styles.noteContent,
            {
              fontFamily: fontDef.family !== "System" ? fontDef.family : undefined,
              fontSize: sizeDef.size,
              fontWeight: note?.bold ? "700" : "400",
            },
          ]}
          value={note?.content ?? ""}
          onChangeText={t => {
            // optimistic local update via dispatch (no debounce needed — store handles it)
            dispatch({ type: "KID_NOTE_UPDATE", kidId, noteId: note!.id, payload: { content: t } });
          }}
          placeholder="Start writing…"
          placeholderTextColor={Colors.textMuted}
          multiline
          textAlignVertical="top"
          scrollEnabled={false}
          autoCorrect
        />

        {/* Photo strip */}
        {(note?.photos ?? []).length > 0 && (
          <View style={styles.photoStrip}>
            {note!.photos.map(uri => (
              <TouchableOpacity key={uri} onPress={() => Alert.alert("Remove photo?", undefined, [
                { text: "Cancel", style: "cancel" },
                { text: "Remove", style: "destructive", onPress: () => removePhoto(uri) },
              ])}>
                <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                <View style={styles.photoRemove}><Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>✕</Text></View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.autoSaveHint}>✓ Auto-saved</Text>
      </ScrollView>
    </View>
  );
}

// ─── Todo Tab (moved from create.tsx) ────────────────────────────────────────

function TodoTab({ todos, kidId, dispatch }: { todos: any[]; kidId: string; dispatch: any }) {
  const [text, setText] = useState("");

  function add() {
    if (!text.trim()) return;
    dispatch({ type: "ADD_TODO", kidId, item: { id: uid(), title: text.trim(), done: false, createdAt: nowIso() } });
    setText("");
  }

  const pending = todos.filter(t => !t.done);
  const done    = todos.filter(t => t.done);

  return (
    <View style={{ flex: 1 }}>
      {/* Input */}
      <View style={styles.todoInputRow}>
        <TextInput
          style={styles.todoInput}
          value={text}
          onChangeText={setText}
          placeholder="Add a task…"
          placeholderTextColor={Colors.textMuted}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <TouchableOpacity style={[styles.todoAddBtn, !text.trim() && { opacity: 0.4 }]} onPress={add} disabled={!text.trim()}>
          <Text style={styles.todoAddText}>＋ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, paddingBottom: 40 }}>
        {todos.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ fontSize: 60 }}>✅</Text>
            <Text style={styles.emptyTitle}>No tasks yet!</Text>
            <Text style={styles.emptySub}>Add something above to get started.</Text>
          </View>
        )}

        {/* Pending */}
        {pending.map(t => (
          <TouchableOpacity
            key={t.id}
            style={styles.todoRow}
            onPress={() => dispatch({ type: "TOGGLE_TODO", kidId, todoId: t.id })}
          >
            <Text style={{ fontSize: 24 }}>⬜</Text>
            <Text style={styles.todoText}>{t.title}</Text>
            <TouchableOpacity onPress={() => dispatch({ type: "REMOVE_TODO", kidId, todoId: t.id })}>
              <Text style={styles.todoDelete}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {/* Done section */}
        {done.length > 0 && (
          <>
            <Text style={styles.todoDoneHeader}>✅ Completed ({done.length})</Text>
            {done.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.todoRow, { opacity: 0.55 }]}
                onPress={() => dispatch({ type: "TOGGLE_TODO", kidId, todoId: t.id })}
              >
                <Text style={{ fontSize: 24 }}>✅</Text>
                <Text style={[styles.todoText, { textDecorationLine: "line-through" }]}>{t.title}</Text>
                <TouchableOpacity onPress={() => dispatch({ type: "REMOVE_TODO", kidId, todoId: t.id })}>
                  <Text style={styles.todoDelete}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Discoveries Tab ─────────────────────────────────────────────────────────

function DiscoveriesTab({ discoveries, kidId, dispatch }: { discoveries: Discovery[]; kidId: string; dispatch: any }) {
  const [showForm,     setShowForm]     = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [title,        setTitle]        = useState("");
  const [note,         setNote]         = useState("");
  const [category,     setCategory]     = useState<DiscoveryCategory>("random");
  const [photoUri,     setPhotoUri]     = useState<string | null>(null);
  const [viewItem,     setViewItem]     = useState<Discovery | null>(null);

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.8 });
    if (!r.canceled) setPhotoUri(r.assets[0].uri);
  }

  async function takePhoto() {
    const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
    if (!r.canceled) setPhotoUri(r.assets[0].uri);
  }

  function photoOptions() {
    Alert.alert("Add Photo", "Show what you discovered!", [
      { text: "📷 Take Photo",        onPress: takePhoto },
      { text: "🖼️ Choose from Library", onPress: pickPhoto },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function openForm(prefill?: { title: string; category: DiscoveryCategory }) {
    setTitle(prefill?.title ?? "");
    setNote("");
    setPhotoUri(null);
    setCategory(prefill?.category ?? "random");
    setShowExamples(false);
    setShowForm(true);
  }

  function save() {
    if (!title.trim()) { Alert.alert("Tell me what you discovered!"); return; }
    const discovery: Discovery = {
      id: uid(), kidId,
      title: title.trim(),
      note: note.trim() || undefined,
      photoUri: photoUri ?? undefined,
      category,
      createdAt: nowIso(),
    };
    dispatch({ type: "DISCOVERY_ADD", kidId, discovery });
    setShowForm(false);
  }

  function deleteDiscovery(d: Discovery) {
    Alert.alert("Remove this discovery?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => dispatch({ type: "DISCOVERY_REMOVE", kidId, discoveryId: d.id }) },
    ]);
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, paddingBottom: 40 }}>
      <Text style={dsc.sub}>Write down cool facts and things you learn every day!</Text>

      {/* Inspiration banner */}
      <TouchableOpacity style={dsc.exampleBanner} onPress={() => setShowExamples(true)}>
        <Text style={{ fontSize: 26 }}>💡</Text>
        <View style={{ flex: 1 }}>
          <Text style={dsc.exampleBannerTitle}>Need inspiration?</Text>
          <Text style={dsc.exampleBannerSub}>See example discoveries to get started!</Text>
        </View>
        <Text style={dsc.exampleBannerArrow}>→</Text>
      </TouchableOpacity>

      {/* Cards */}
      {discoveries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 60 }}>🔭</Text>
          <Text style={styles.emptyTitle}>Start exploring!</Text>
          <Text style={styles.emptySub}>
            Did you know walking barefoot is healthy? Write it down and never forget it!
          </Text>
        </View>
      ) : (
        discoveries.map(d => {
          const cat = discCatFor(d.category);
          return (
            <TouchableOpacity
              key={d.id}
              style={[dsc.card, { borderTopColor: cat.color }]}
              onPress={() => setViewItem(d)}
              activeOpacity={0.8}
            >
              {d.photoUri && <Image source={{ uri: d.photoUri }} style={dsc.cardPhoto} resizeMode="cover" />}
              <View style={dsc.cardBody}>
                <View style={dsc.cardTopRow}>
                  <View style={[dsc.catChip, { backgroundColor: cat.color + "20" }]}>
                    <Text style={dsc.catChipEmoji}>{cat.emoji}</Text>
                    <Text style={[dsc.catChipLabel, { color: cat.color }]}>{cat.label}</Text>
                  </View>
                  <Text style={dsc.cardDate}>
                    {new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </Text>
                </View>
                <Text style={dsc.cardTitle}>{d.title}</Text>
                {d.note ? <Text style={dsc.cardNote} numberOfLines={2}>{d.note}</Text> : null}
              </View>
            </TouchableOpacity>
          );
        })
      )}

      <TouchableOpacity style={[styles.addBtn, { marginTop: Spacing.md }]} onPress={() => openForm()}>
        <Text style={styles.addBtnText}>🔍 Add a Discovery</Text>
      </TouchableOpacity>

      {/* Examples Modal */}
      <Modal visible={showExamples} animationType="slide" onRequestClose={() => setShowExamples(false)}>
        <SafeAreaView style={dsc.modal}>
          <ScrollView contentContainerStyle={dsc.modalContent}>
            <Text style={dsc.modalTitle}>💡 Example Discoveries</Text>
            <Text style={dsc.modalSub}>Tap one to use it as a starting point!</Text>
            {DISC_EXAMPLES.map((ex, i) => {
              const cat = discCatFor(ex.category);
              return (
                <TouchableOpacity
                  key={i}
                  style={[dsc.exampleCard, { borderLeftColor: cat.color }]}
                  onPress={() => openForm({ title: ex.title, category: ex.category })}
                >
                  <Text style={{ fontSize: 30 }}>{ex.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={[dsc.catChip, { backgroundColor: cat.color + "20", alignSelf: "flex-start", marginBottom: 4 }]}>
                      <Text style={dsc.catChipEmoji}>{cat.emoji}</Text>
                      <Text style={[dsc.catChipLabel, { color: cat.color }]}>{cat.label}</Text>
                    </View>
                    <Text style={dsc.exampleText}>{ex.title}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={dsc.closeBtn} onPress={() => setShowExamples(false)}>
              <Text style={dsc.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* View Detail Modal */}
      <Modal visible={!!viewItem} animationType="fade" transparent onRequestClose={() => setViewItem(null)}>
        <TouchableOpacity style={dsc.overlay} activeOpacity={1} onPress={() => setViewItem(null)}>
          <View style={dsc.viewCard}>
            {viewItem?.photoUri && (
              <Image source={{ uri: viewItem.photoUri }} style={dsc.viewPhoto} resizeMode="cover" />
            )}
            <View style={{ padding: Spacing.md }}>
              {viewItem && (
                <View style={[dsc.catChip, { backgroundColor: discCatFor(viewItem.category).color + "20", alignSelf: "flex-start", marginBottom: 8 }]}>
                  <Text style={dsc.catChipEmoji}>{discCatFor(viewItem.category).emoji}</Text>
                  <Text style={[dsc.catChipLabel, { color: discCatFor(viewItem.category).color }]}>{discCatFor(viewItem.category).label}</Text>
                </View>
              )}
              <Text style={dsc.viewTitle}>{viewItem?.title}</Text>
              {viewItem?.note ? <Text style={dsc.viewNote}>{viewItem.note}</Text> : null}
              <Text style={dsc.viewDate}>{viewItem ? new Date(viewItem.createdAt).toLocaleDateString() : ""}</Text>
              <TouchableOpacity
                style={dsc.deleteBtn}
                onPress={() => { setViewItem(null); if (viewItem) deleteDiscovery(viewItem); }}
              >
                <Text style={dsc.deleteBtnText}>🗑 Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Form Modal */}
      <Modal visible={showForm} animationType="slide" onRequestClose={() => setShowForm(false)}>
        <SafeAreaView style={dsc.modal}>
          <ScrollView contentContainerStyle={dsc.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={dsc.modalTitle}>🔍 What Did You Discover?</Text>

            <Text style={dsc.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {DISC_CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[dsc.catPickBtn, category === c.id && { backgroundColor: c.color + "25", borderColor: c.color }]}
                    onPress={() => setCategory(c.id)}
                  >
                    <Text style={{ fontSize: 18 }}>{c.emoji}</Text>
                    <Text style={[dsc.catPickLabel, category === c.id && { color: c.color }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={dsc.fieldLabel}>What did you discover?</Text>
            <TextInput
              style={dsc.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Walking barefoot on grass is healthy for you!"
              autoFocus
              multiline
            />

            <Text style={dsc.fieldLabel}>Tell me more about it (optional)</Text>
            <TextInput
              style={[dsc.input, { minHeight: 90, textAlignVertical: "top" }]}
              value={note}
              onChangeText={setNote}
              placeholder="Where did you learn this? What happened? Why is it interesting?"
              multiline
            />

            <Text style={dsc.fieldLabel}>Add a Photo (optional)</Text>
            {photoUri ? (
              <TouchableOpacity onPress={photoOptions}>
                <Image source={{ uri: photoUri }} style={dsc.preview} resizeMode="cover" />
                <Text style={dsc.changePhoto}>Tap to change</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={dsc.photoBtn} onPress={photoOptions}>
                <Text style={{ fontSize: 32 }}>📷</Text>
                <Text style={dsc.photoBtnText}>Add a Photo</Text>
              </TouchableOpacity>
            )}

            <View style={dsc.modalBtns}>
              <TouchableOpacity style={dsc.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={dsc.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={dsc.saveBtn} onPress={save}>
                <Text style={dsc.saveBtnText}>💾 Save It!</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

// ─── Idea Editor Modal (unchanged logic) ─────────────────────────────────────

function IdeaEditor({ idea, kidId, dispatch, onClose }: {
  idea: IdeaPaper; kidId: string; dispatch: any; onClose: () => void;
}) {
  const [title,  setTitle]  = useState(idea.title);
  const [desc,   setDesc]   = useState(idea.description ?? "");
  const [emoji,  setEmoji]  = useState((idea.sketches as any)?.[0] ?? "💡");
  const [photos, setPhotos] = useState<string[]>(idea.photos ?? []);
  const [showPicker, setShowPicker] = useState(false);
  const [dirty,  setDirty]  = useState(false);

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85, allowsEditing: true });
    if (!r.canceled && r.assets[0]) { setPhotos(p => [...p, r.assets[0].uri]); setDirty(true); }
  }

  async function takePhoto() {
    const r = await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: true });
    if (!r.canceled && r.assets[0]) { setPhotos(p => [...p, r.assets[0].uri]); setDirty(true); }
  }

  function removePhoto(uri: string) {
    Alert.alert("Remove photo?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => { setPhotos(p => p.filter(u => u !== uri)); setDirty(true); } },
    ]);
  }

  function save() {
    dispatch({ type: "UPDATE_IDEA", kidId, ideaId: idea.id,
      payload: { title: title.trim() || idea.title, description: desc.trim(), sketches: [emoji] as any, photos } });
    setDirty(false);
  }

  function handleClose() {
    if (dirty) {
      Alert.alert("Save changes?", undefined, [
        { text: "Discard", style: "destructive", onPress: onClose },
        { text: "Save & Close", onPress: () => { save(); onClose(); } },
      ]);
    } else { onClose(); }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={ed.root}>
        <View style={ed.topBar}>
          <TouchableOpacity onPress={handleClose} style={ed.backBtn}><Text style={ed.backText}>‹ Ideas</Text></TouchableOpacity>
          <TouchableOpacity style={[ed.saveBtn, !dirty && ed.saveBtnDim]} onPress={save} disabled={!dirty}>
            <Text style={ed.saveBtnText}>{dirty ? "💾 Save" : "✓ Saved"}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 60 }}>
          <View style={ed.titleRow}>
            <TouchableOpacity style={ed.emojiBtn} onPress={() => setShowPicker(v => !v)}>
              <Text style={{ fontSize: 36 }}>{emoji}</Text>
              <Text style={ed.emojiHint}>✏️</Text>
            </TouchableOpacity>
            <TextInput style={ed.titleInput} value={title} onChangeText={t => { setTitle(t); setDirty(true); }}
              placeholder="Idea title" placeholderTextColor={Colors.textMuted} maxLength={80} />
          </View>

          {showPicker && (
            <View style={ed.emojiGrid}>
              {IDEA_EMOJIS.map(e => (
                <TouchableOpacity key={e} style={[ed.emojiOpt, emoji === e && ed.emojiSel]}
                  onPress={() => { setEmoji(e); setShowPicker(false); setDirty(true); }}>
                  <Text style={{ fontSize: 28 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={ed.descCard}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={ed.descLabel}>📝 Describe your idea</Text>
              <MicButton appendTo={desc} onAppend={d => { setDesc(d); setDirty(true); }} onResult={d => { setDesc(d); setDirty(true); }} size={32} />
            </View>
            <TextInput style={ed.descInput} value={desc} onChangeText={d => { setDesc(d); setDirty(true); }}
              placeholder="What is it? How does it work? Why is it amazing? Tap 🎙️ to speak!"
              placeholderTextColor={Colors.textMuted} multiline textAlignVertical="top" />
          </View>

          <View style={ed.photosCard}>
            <Text style={ed.descLabel}>📸 Photos & Sketches</Text>
            <View style={ed.photoAddRow}>
              <TouchableOpacity style={ed.photoAddBtn} onPress={takePhoto}>
                <Text style={ed.photoAddIcon}>📷</Text><Text style={ed.photoAddText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ed.photoAddBtn} onPress={pickPhoto}>
                <Text style={ed.photoAddIcon}>🖼️</Text><Text style={ed.photoAddText}>Library</Text>
              </TouchableOpacity>
            </View>
            {photos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ed.photoStrip}>
                {photos.map(uri => (
                  <TouchableOpacity key={uri} onPress={() => removePhoto(uri)} style={ed.photoThumb}>
                    <Image source={{ uri }} style={ed.photoImg} resizeMode="cover" />
                    <View style={ed.photoRemove}><Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>✕</Text></View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={ed.photoEmpty}>Tap Camera or Library to add a photo!</Text>
            )}
          </View>

          <View style={ed.promptsCard}>
            <Text style={ed.promptsTitle}>💬 Think about…</Text>
            {["What problem does it solve?","Who would use it?","What materials do you need?","How would you make it?"].map(p => (
              <TouchableOpacity key={p} style={ed.promptBtn}
                onPress={() => { setDesc(d => d ? `${d}\n\n${p}: ` : `${p}: `); setDirty(true); }}>
                <Text style={ed.promptText}>＋ {p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.bgLight },
  header:       { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 4 },
  screenTitle:  { fontSize: FontSize.xl, fontWeight: "900", color: Colors.primary },

  tabBarScroll: { flexGrow: 0, marginBottom: Spacing.sm },
  tabBar:       { flexDirection: "row", gap: 6, paddingHorizontal: Spacing.md, paddingVertical: 2 },
  tabBtn:       { alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.cardLight },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnText:   { fontSize: 11, fontWeight: "700", color: Colors.textSecondary, whiteSpace: "nowrap" } as any,
  tabBtnTextActive: { color: "#fff" },

  addBtn:       { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnCancel: { backgroundColor: Colors.error },
  addBtnText:   { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },

  motivationCard: {
    backgroundColor: Colors.primary + "0D",
    borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.primary + "25",
    gap: 6,
  },
  motivationTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primary },
  motivationText:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  createCard:   { backgroundColor: "#fff", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.md, borderWidth: 1.5, borderColor: Colors.primary + "30" },
  createLabel:  { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, marginBottom: 8 },
  createInput:  { borderWidth: 2, borderColor: Colors.primary + "50", borderRadius: Radius.lg, padding: 12, fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary, marginBottom: 12 },
  createBtn:    { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12 },
  createBtnText:{ color: "#fff", fontWeight: "800", fontSize: FontSize.base },

  empty:        { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: Spacing.xl },
  emptyTitle:   { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary },
  emptySub:     { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },

  ideaCard:     { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 10, ...Shadow.sm, gap: 12 },
  ideaEmoji:    { fontSize: 32 },
  ideaThumb:    { width: 52, height: 52, borderRadius: Radius.lg },
  ideaBody:     { flex: 1 },
  ideaTitle:    { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  ideaDesc:     { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
  ideaEmpty:    { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2, fontStyle: "italic" },
  deleteBtn:    { padding: 6 },
  deleteBtnText:{ fontSize: 18 },

  // Notes navigation
  navRow:       { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.sm, paddingVertical: 6, backgroundColor: Colors.surfaceLight, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 4 },
  navArrow:     { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  navArrowDim:  { backgroundColor: Colors.cardLight },
  navArrowText: { fontSize: 22, fontWeight: "900", color: "#fff", lineHeight: 26 },
  navCenter:    { flex: 1, alignItems: "center" },
  noteTitle:    { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary, textAlign: "center", width: "100%" },
  navCount:     { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  navAdd:       { width: 40, height: 40, borderRadius: 20, backgroundColor: "#22C55E", alignItems: "center", justifyContent: "center" },
  navAddText:   { fontSize: 22, color: "#fff", fontWeight: "900", lineHeight: 26 },

  // Note formatting bar
  fmtBar:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 6, backgroundColor: Colors.surfaceLight, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 2, flexWrap: "wrap" },
  fmtBtn:       { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: Colors.cardLight },
  fmtBtnActive: { backgroundColor: Colors.primary + "33", borderWidth: 1.5, borderColor: Colors.primary },
  fmtBtnText:   { fontSize: 12, fontWeight: "700", color: Colors.textPrimary },
  fmtDivider:   { width: 1, height: 22, backgroundColor: Colors.border, marginHorizontal: 3 },
  hlDot:        { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "transparent" },
  hlDotActive:  { borderColor: Colors.primary, transform: [{ scale: 1.15 }] },

  // Note writing area
  noteArea:     { flex: 1 },
  noteContent:  { minHeight: 300, color: Colors.textPrimary, lineHeight: 28, textAlignVertical: "top" },
  photoStrip:   { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: Spacing.md },
  photoThumb:   { width: 100, height: 100, borderRadius: Radius.lg, position: "relative" },
  photoRemove:  { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
  autoSaveHint: { fontSize: 10, color: Colors.textMuted, marginTop: 20, textAlign: "center" },

  // Todo
  todoInputRow: { flexDirection: "row", gap: 8, padding: Spacing.md, paddingBottom: 0 },
  todoInput:    { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.base, backgroundColor: Colors.surfaceLight, color: Colors.textPrimary },
  todoAddBtn:   { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 14, justifyContent: "center" },
  todoAddText:  { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },
  todoRow:      { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  todoText:     { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary },
  todoDelete:   { color: Colors.error, fontSize: 16, fontWeight: "700", paddingHorizontal: 4 },
  todoDoneHeader:{ fontSize: FontSize.sm, fontWeight: "700", color: Colors.textMuted, paddingTop: Spacing.md, paddingBottom: 6 },
});

const ed = StyleSheet.create({
  root:    { flex: 1, backgroundColor: "#FAF7FF" },
  topBar:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { paddingRight: 12, paddingVertical: 6 },
  backText:{ fontSize: FontSize.base, fontWeight: "700", color: Colors.primary },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 8 },
  saveBtnDim:{ backgroundColor: Colors.border },
  saveBtnText:{ color: "#fff", fontWeight: "800", fontSize: FontSize.sm },
  titleRow:  { flexDirection: "row", alignItems: "center", gap: 12 },
  emojiBtn:  { width: 64, height: 64, backgroundColor: Colors.primary + "12", borderRadius: Radius.xl, alignItems: "center", justifyContent: "center" },
  emojiHint: { position: "absolute", bottom: 2, right: 2, fontSize: 12 },
  titleInput:{ flex: 1, fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary, borderBottomWidth: 2, borderBottomColor: Colors.primary + "40", paddingBottom: 4 },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emojiOpt:  { width: 52, height: 52, borderRadius: Radius.lg, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...Shadow.sm },
  emojiSel:  { borderWidth: 2.5, borderColor: Colors.primary },
  descCard:  { backgroundColor: "#fff", borderRadius: Radius.xl, padding: 16, ...Shadow.sm },
  descLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, marginBottom: 8 },
  descInput: { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 24, minHeight: 160 },
  photosCard:  { backgroundColor: "#fff", borderRadius: Radius.xl, padding: 16, ...Shadow.sm },
  photoAddRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  photoAddBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: Radius.lg, borderWidth: 2, borderColor: Colors.primary + "40", backgroundColor: Colors.primary + "06", gap: 4 },
  photoAddIcon:{ fontSize: 24 },
  photoAddText:{ fontSize: FontSize.sm, fontWeight: "700", color: Colors.primary },
  photoStrip:  { flexGrow: 0 },
  photoThumb:  { position: "relative", marginRight: 10 },
  photoImg:    { width: 100, height: 100, borderRadius: Radius.lg },
  photoRemove: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
  photoEmpty:  { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "center", fontStyle: "italic", paddingVertical: 8 },
  promptsCard: { backgroundColor: Colors.primary + "08", borderRadius: Radius.xl, padding: 16, borderWidth: 1, borderColor: Colors.primary + "20" },
  promptsTitle:{ fontSize: FontSize.sm, fontWeight: "700", color: Colors.primary, marginBottom: 10 },
  promptBtn:   { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#fff", borderRadius: Radius.lg, marginBottom: 6 },
  promptText:  { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600" },
});

// ─── Discoveries Styles ───────────────────────────────────────────────────────
const dsc = StyleSheet.create({
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  exampleBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.primary + "12", borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  exampleBannerTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primary },
  exampleBannerSub:   { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  exampleBannerArrow: { fontSize: 18, color: Colors.primary, fontWeight: "700" },
  card: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, marginBottom: 12,
    overflow: "hidden", borderTopWidth: 4, ...Shadow.sm,
  },
  cardPhoto:   { width: "100%", height: 150 },
  cardBody:    { padding: Spacing.md },
  cardTopRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  catChip:     { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  catChipEmoji:{ fontSize: 13 },
  catChipLabel:{ fontSize: 11, fontWeight: "700" },
  cardDate:    { fontSize: FontSize.xs, color: Colors.textMuted },
  cardTitle:   { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary, lineHeight: 22 },
  cardNote:    { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginTop: 4 },
  // Overlay detail modal
  overlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", padding: Spacing.md },
  viewCard:    { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, overflow: "hidden" },
  viewPhoto:   { width: "100%", height: 200 },
  viewTitle:   { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary, marginBottom: 6, lineHeight: 26 },
  viewNote:    { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 22, marginBottom: 8 },
  viewDate:    { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 12 },
  deleteBtn:   { borderWidth: 1, borderColor: Colors.error + "50", borderRadius: Radius.full, alignItems: "center", paddingVertical: 10 },
  deleteBtnText:{ color: Colors.error, fontWeight: "700" },
  // Form / examples modal
  modal:       { flex: 1, backgroundColor: Colors.bgLight },
  modalContent:{ padding: Spacing.lg, gap: 4 },
  modalTitle:  { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, textAlign: "center", marginBottom: 4 },
  modalSub:    { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", marginBottom: Spacing.md },
  fieldLabel:  { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },
  catPickBtn:  { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", gap: 4, backgroundColor: Colors.surfaceLight },
  catPickLabel:{ fontSize: 10, fontWeight: "700", color: Colors.textSecondary },
  input:       { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, padding: 14, fontSize: FontSize.base, backgroundColor: Colors.surfaceLight, lineHeight: 22 },
  photoBtn:    { backgroundColor: Colors.cardLight, borderRadius: Radius.xl, padding: Spacing.lg, alignItems: "center", gap: 8, borderWidth: 2, borderColor: Colors.border, borderStyle: "dashed" },
  photoBtnText:{ fontSize: FontSize.base, fontWeight: "700", color: Colors.primary },
  preview:     { width: "100%", height: 200, borderRadius: Radius.lg },
  changePhoto: { textAlign: "center", color: Colors.primary, fontWeight: "600", marginTop: 6, fontSize: FontSize.sm },
  modalBtns:   { flexDirection: "row", gap: 10, marginTop: Spacing.md },
  cancelBtn:   { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  cancelBtnText:{ fontWeight: "700", color: Colors.textSecondary },
  saveBtn:     { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, ...Shadow.md },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  // Examples list
  exampleCard: { flexDirection: "row", gap: 12, backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 10, borderLeftWidth: 4, ...Shadow.sm },
  exampleText: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  closeBtn:    { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, marginTop: Spacing.md },
  closeBtnText:{ fontWeight: "700", color: Colors.textSecondary, fontSize: FontSize.base },
});
