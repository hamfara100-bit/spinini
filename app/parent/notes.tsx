import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Modal, Alert, StatusBar,
} from "react-native";
import { MicButton } from "../../components/voice-text-input";
import { SafeAreaView } from "react-native-safe-area-context";
import { useData } from "../../lib/data/store";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../lib/theme";
import { uid, nowIso, today } from "../../lib/utils";
import type { ParentNote, TodoItem } from "../../lib/data/types";

const NOTE_COLORS = [
  "#FFF9C4", "#FCE4EC", "#E8F5E9", "#E3F2FD",
  "#F3E5F5", "#FFF3E0", "#E0F7FA", "#FAFAFA",
];

const NOTE_COLOR_LABELS = [
  "Yellow", "Pink", "Green", "Blue",
  "Purple", "Orange", "Teal", "White",
];

const COL_GAP = 10;

type Tab = "notes" | "todos";

export default function ParentNotesScreen() {
  const { state, dispatch } = useData();
  const [activeTab, setActiveTab] = useState<Tab>("notes");
  const notes = state.parentNotes ?? [];
  const todos = state.parentTodos ?? [];
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ParentNote | null>(null);
  const [search, setSearch] = useState("");

  // Todo state
  const [newTodo, setNewTodo] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);
  const [todoEditText, setTodoEditText] = useState("");
  const [todoEditDue, setTodoEditDue] = useState("");
  const [showTodoFilter, setShowTodoFilter] = useState<"all" | "open" | "done">("open");

  const pinned = notes.filter(n => n.pinned);
  const unpinned = notes.filter(n => !n.pinned);

  const filteredNotes = [...pinned, ...unpinned].filter(n =>
    !search.trim() ||
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  );

  const filteredTodos = todos.filter(t => {
    if (showTodoFilter === "open") return !t.done;
    if (showTodoFilter === "done") return t.done;
    return true;
  });

  const todayStr = today();

  function openNew() {
    setEditingNote(null);
    setEditorOpen(true);
  }

  function openEdit(note: ParentNote) {
    setEditingNote(note);
    setEditorOpen(true);
  }

  function confirmDelete(note: ParentNote) {
    Alert.alert("Delete Note", `Delete "${note.title || "this note"}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: () => dispatch({ type: "PARENT_NOTE_DELETE", noteId: note.id }),
      },
    ]);
  }

  function togglePin(note: ParentNote) {
    dispatch({ type: "PARENT_NOTE_UPDATE", noteId: note.id, payload: { pinned: !note.pinned } });
  }

  function addTodo() {
    if (!newTodo.trim()) return;
    dispatch({
      type: "PARENT_TODO_ADD",
      item: { id: uid(), title: newTodo.trim(), done: false, createdAt: nowIso(), dueDate: newDueDate || undefined },
    });
    setNewTodo("");
    setNewDueDate("");
  }

  function saveEditTodo() {
    if (!editingTodo || !todoEditText.trim()) { setEditingTodo(null); return; }
    dispatch({ type: "PARENT_TODO_UPDATE", todoId: editingTodo.id, payload: { title: todoEditText.trim(), dueDate: todoEditDue || undefined } });
    setEditingTodo(null);
  }

  function deleteTodo(id: string) {
    dispatch({ type: "PARENT_TODO_DELETE", todoId: id });
  }

  const openCount = todos.filter(t => !t.done).length;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>📝 Notes & To-Do</Text>
          <Text style={styles.sub}>
            {activeTab === "notes"
              ? `${notes.length} note${notes.length !== 1 ? "s" : ""}`
              : `${openCount} open · ${todos.length - openCount} done`}
          </Text>
        </View>
        {activeTab === "notes" && (
          <TouchableOpacity style={styles.newBtn} onPress={openNew}>
            <Text style={styles.newBtnText}>＋ New</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === "notes" && styles.tabActive]} onPress={() => setActiveTab("notes")}>
          <Text style={[styles.tabText, activeTab === "notes" && styles.tabTextActive]}>📝 Notes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === "todos" && styles.tabActive]} onPress={() => setActiveTab("todos")}>
          <Text style={[styles.tabText, activeTab === "todos" && styles.tabTextActive]}>
            ✅ To-Do {openCount > 0 ? `(${openCount})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── NOTES TAB ── */}
      {activeTab === "notes" && (
        <>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.search}
              value={search}
              onChangeText={setSearch}
              placeholder="🔍 Search notes…"
              placeholderTextColor={Colors.textMuted}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")} style={styles.searchClear}>
                <Text style={styles.searchClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {filteredNotes.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyTitle}>{search ? "No results" : "No notes yet"}</Text>
              <Text style={styles.emptySub}>
                {search ? "Try a different search term" : "Tap ＋ New to add your first note"}
              </Text>
              {!search && (
                <TouchableOpacity style={styles.emptyBtn} onPress={openNew}>
                  <Text style={styles.emptyBtnText}>＋ Create First Note</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
              {(() => {
                const left: ParentNote[] = [];
                const right: ParentNote[] = [];
                filteredNotes.forEach((n, i) => (i % 2 === 0 ? left : right).push(n));
                return (
                  <View style={styles.columns}>
                    <View style={styles.column}>
                      {left.map(note => (
                        <NoteCard key={note.id} note={note} onEdit={() => openEdit(note)} onDelete={() => confirmDelete(note)} onPin={() => togglePin(note)} />
                      ))}
                    </View>
                    <View style={styles.column}>
                      {right.map(note => (
                        <NoteCard key={note.id} note={note} onEdit={() => openEdit(note)} onDelete={() => confirmDelete(note)} onPin={() => togglePin(note)} />
                      ))}
                    </View>
                  </View>
                );
              })()}
            </ScrollView>
          )}
        </>
      )}

      {/* ── TO-DO TAB ── */}
      {activeTab === "todos" && (
        <ScrollView contentContainerStyle={styles.todoContainer} keyboardShouldPersistTaps="handled">
          {/* Add input */}
          <View style={styles.addRow}>
            <View style={{ flex: 1, gap: 6 }}>
              <TextInput
                style={styles.todoInput}
                value={newTodo}
                onChangeText={setNewTodo}
                placeholder="Add a to-do…"
                placeholderTextColor={Colors.textMuted}
                onSubmitEditing={addTodo}
                returnKeyType="done"
              />
              <TextInput
                style={[styles.todoInput, { fontSize: FontSize.sm }]}
                value={newDueDate}
                onChangeText={setNewDueDate}
                placeholder="Due date (YYYY-MM-DD, optional)"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <TouchableOpacity style={styles.addTodoBtn} onPress={addTodo}>
              <Text style={styles.addTodoBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {/* Filter chips */}
          <View style={styles.filterRow}>
            {(["open","all","done"] as const).map(f => (
              <TouchableOpacity key={f} style={[styles.filterChip, showTodoFilter === f && styles.filterChipActive]} onPress={() => setShowTodoFilter(f)}>
                <Text style={[styles.filterChipText, showTodoFilter === f && styles.filterChipTextActive]}>
                  {f === "open" ? "Open" : f === "done" ? "Done" : "All"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {filteredTodos.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyTitle}>{showTodoFilter === "done" ? "Nothing done yet" : "All caught up!"}</Text>
              <Text style={styles.emptySub}>Add a task above to get started.</Text>
            </View>
          )}

          {filteredTodos.map(t => {
            const isOverdue = !t.done && t.dueDate && t.dueDate < todayStr;
            const isEditing = editingTodo?.id === t.id;
            return (
              <View key={t.id} style={[styles.todoCard, t.done && styles.todoCardDone]}>
                <TouchableOpacity style={styles.todoCheck} onPress={() => dispatch({ type: "PARENT_TODO_TOGGLE", todoId: t.id })}>
                  <View style={[styles.checkBox, t.done && styles.checkBoxDone]}>
                    {t.done && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  {isEditing ? (
                    <>
                      <TextInput
                        style={styles.todoEditInput}
                        value={todoEditText}
                        onChangeText={setTodoEditText}
                        autoFocus
                        onSubmitEditing={saveEditTodo}
                        returnKeyType="done"
                      />
                      <TextInput
                        style={[styles.todoEditInput, { fontSize: FontSize.sm, marginTop: 4 }]}
                        value={todoEditDue}
                        onChangeText={setTodoEditDue}
                        placeholder="Due date (YYYY-MM-DD)"
                        placeholderTextColor={Colors.textMuted}
                      />
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                        <TouchableOpacity style={styles.saveEditBtn} onPress={saveEditTodo}>
                          <Text style={styles.saveEditBtnText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelEditBtn} onPress={() => setEditingTodo(null)}>
                          <Text style={styles.cancelEditBtnText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.todoTitle, t.done && styles.todoTitleDone]}>{t.title}</Text>
                      {t.dueDate && (
                        <Text style={[styles.todoDue, isOverdue && styles.todoDueOverdue]}>
                          {isOverdue ? "⚠️ Overdue: " : "📅 Due: "}{t.dueDate}
                        </Text>
                      )}
                    </>
                  )}
                </View>
                {!isEditing && (
                  <View style={styles.todoActions}>
                    <TouchableOpacity onPress={() => { setEditingTodo(t); setTodoEditText(t.title); setTodoEditDue(t.dueDate ?? ""); }} style={styles.todoActionBtn}>
                      <Text style={styles.todoActionBtnText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteTodo(t.id)} style={styles.todoActionBtn}>
                      <Text style={[styles.todoActionBtnText, { color: Colors.error }]}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

          {todos.filter(t => t.done).length > 0 && showTodoFilter !== "done" && (
            <TouchableOpacity style={styles.clearDoneBtn} onPress={() => {
              Alert.alert("Clear done?", "Remove all completed tasks.", [
                { text: "Cancel", style: "cancel" },
                { text: "Clear", style: "destructive", onPress: () => {
                  todos.filter(t => t.done).forEach(t => dispatch({ type: "PARENT_TODO_DELETE", todoId: t.id }));
                }},
              ]);
            }}>
              <Text style={styles.clearDoneBtnText}>🗑 Clear completed ({todos.filter(t => t.done).length})</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Editor Modal */}
      <NoteEditor
        visible={editorOpen}
        note={editingNote}
        onClose={() => setEditorOpen(false)}
        onSave={(payload) => {
          if (editingNote) {
            dispatch({ type: "PARENT_NOTE_UPDATE", noteId: editingNote.id, payload });
          } else {
            dispatch({
              type: "PARENT_NOTE_ADD",
              note: {
                id: uid(),
                title: payload.title ?? "",
                content: payload.content ?? "",
                color: payload.color ?? NOTE_COLORS[0],
                pinned: false,
                createdAt: nowIso(),
                updatedAt: nowIso(),
              },
            });
          }
          setEditorOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Note Card ────────────────────────────────────────────────────────────────

function NoteCard({ note, onEdit, onDelete, onPin }: {
  note: ParentNote;
  onEdit: () => void;
  onDelete: () => void;
  onPin: () => void;
}) {
  const preview = note.content.slice(0, 120);
  const date = new Date(note.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: note.color || NOTE_COLORS[0] }]}
      onPress={onEdit}
      activeOpacity={0.85}
    >
      {note.pinned && <Text style={styles.pinBadge}>📌</Text>}
      {note.title ? <Text style={styles.cardTitle} numberOfLines={2}>{note.title}</Text> : null}
      {preview ? (
        <Text style={styles.cardContent} numberOfLines={6}>{preview}</Text>
      ) : (
        <Text style={styles.cardEmpty}>Empty note…</Text>
      )}
      <View style={styles.cardFooter}>
        <Text style={styles.cardDate}>{date}</Text>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={onPin} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontSize: 14 }}>{note.pinned ? "📌" : "📍"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontSize: 14 }}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Note Editor Modal ────────────────────────────────────────────────────────

function NoteEditor({ visible, note, onClose, onSave }: {
  visible: boolean;
  note: ParentNote | null;
  onClose: () => void;
  onSave: (payload: Partial<ParentNote>) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState(NOTE_COLORS[0]);
  const [showColors, setShowColors] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setTitle(note?.title ?? "");
      setContent(note?.content ?? "");
      setColor(note?.color ?? NOTE_COLORS[0]);
      setShowColors(false);
      isDirtyRef.current = false;
    }
  }, [visible, note]);

  useEffect(() => {
    if (!visible || !isDirtyRef.current) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      if (isDirtyRef.current) {
        onSave({ title, content, color });
        isDirtyRef.current = false;
      }
    }, 2000);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [title, content, color]);

  function handleChange(field: "title" | "content" | "color", val: string) {
    isDirtyRef.current = true;
    if (field === "title") setTitle(val);
    else if (field === "content") setContent(val);
    else setColor(val);
  }

  function handleSave() {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    onSave({ title, content, color });
  }

  function handleClose() {
    if (isDirtyRef.current) handleSave();
    else onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={[ed.root, { backgroundColor: color }]}>
        <View style={ed.topBar}>
          <TouchableOpacity onPress={handleClose} style={ed.backBtn}>
            <Text style={ed.backText}>‹ Notes</Text>
          </TouchableOpacity>
          <View style={ed.topRight}>
            <TouchableOpacity
              onPress={() => setShowColors(v => !v)}
              style={[ed.colorCircle, { backgroundColor: color, borderWidth: 2, borderColor: Colors.primary }]}
            />
            <TouchableOpacity style={ed.saveBtn} onPress={handleSave}>
              <Text style={ed.saveBtnText}>💾 Save</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showColors && (
          <View style={ed.colorRow}>
            {NOTE_COLORS.map((c, i) => (
              <TouchableOpacity
                key={c}
                onPress={() => { handleChange("color", c); setShowColors(false); }}
                style={[ed.colorSwatch, { backgroundColor: c }, color === c && ed.colorSwatchActive]}
              >
                <Text style={{ fontSize: 9, textAlign: "center", color: "#555" }}>{NOTE_COLOR_LABELS[i]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <ScrollView contentContainerStyle={ed.content} keyboardShouldPersistTaps="handled">
          <TextInput
            style={ed.titleInput}
            value={title}
            onChangeText={t => handleChange("title", t)}
            placeholder="Note title…"
            placeholderTextColor="#AAA"
            maxLength={100}
          />
          <View style={ed.divider} />
          <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 8, marginBottom: 4 }}>
            <MicButton appendTo={content} onAppend={c => handleChange("content", c)} onResult={c => handleChange("content", c)} size={32} />
          </View>
          <TextInput
            style={ed.contentInput}
            value={content}
            onChangeText={c => handleChange("content", c)}
            placeholder="Start writing… or tap 🎙️ to dictate!"
            placeholderTextColor="#BBB"
            multiline
            textAlignVertical="top"
            scrollEnabled={false}
            autoFocus={!note}
          />
        </ScrollView>

        <View style={ed.footer}>
          <Text style={ed.footerText}>{content.length} chars · {content.split(/\s+/).filter(Boolean).length} words</Text>
          <Text style={ed.footerText}>Auto-saves every 2s</Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgLight },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: 4,
  },
  title: { fontSize: FontSize.xl, fontWeight: "900", color: Colors.textPrimary },
  sub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  newBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8 },
  newBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },

  tabs: { flexDirection: "row", marginHorizontal: Spacing.md, marginBottom: Spacing.sm, borderRadius: Radius.lg, backgroundColor: Colors.cardLight, padding: 3 },
  tab: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: Radius.md },
  tabActive: { backgroundColor: "#fff", ...Shadow.sm },
  tabText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textMuted },
  tabTextActive: { color: Colors.primary },

  searchRow: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12,
  },
  search: { flex: 1, paddingVertical: 10, fontSize: FontSize.base, color: Colors.textPrimary },
  searchClear: { padding: 4 },
  searchClearText: { fontSize: 16, color: Colors.textMuted },

  grid: { paddingHorizontal: Spacing.md, paddingBottom: 40 },
  columns: { flexDirection: "row", gap: COL_GAP },
  column: { flex: 1, gap: 10 },

  card: { borderRadius: Radius.xl, padding: Spacing.md, ...Shadow.sm, position: "relative" },
  pinBadge: { position: "absolute", top: 8, right: 10, fontSize: 14 },
  cardTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary, marginBottom: 6 },
  cardContent: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  cardEmpty: { fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: "italic" },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  cardDate: { fontSize: 10, color: Colors.textMuted, fontWeight: "600" },
  cardActions: { flexDirection: "row", gap: 10 },

  // To-Do styles
  todoContainer: { padding: Spacing.md, paddingBottom: 40, gap: 0 },
  addRow: { flexDirection: "row", gap: 10, marginBottom: Spacing.sm, alignItems: "flex-start" },
  todoInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg,
    padding: 12, fontSize: FontSize.base, backgroundColor: Colors.surfaceLight,
  },
  addTodoBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingHorizontal: 16, paddingVertical: 12, marginTop: 0, alignSelf: "flex-start" },
  addTodoBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },

  filterRow: { flexDirection: "row", gap: 8, marginBottom: Spacing.md },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.cardLight },
  filterChipActive: { backgroundColor: Colors.primary },
  filterChipText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  filterChipTextActive: { color: "#fff" },

  todoCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: 12, marginBottom: 8, ...Shadow.sm, gap: 10 },
  todoCardDone: { opacity: 0.6 },
  todoCheck: { padding: 4 },
  checkBox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  checkBoxDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkMark: { color: "#fff", fontSize: 14, fontWeight: "800" },
  todoTitle: { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary },
  todoTitleDone: { textDecorationLine: "line-through", color: Colors.textMuted },
  todoDue: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  todoDueOverdue: { color: Colors.error, fontWeight: "700" },
  todoActions: { flexDirection: "row", gap: 4 },
  todoActionBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  todoActionBtnText: { fontSize: 16 },
  todoEditInput: { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.md, padding: 8, fontSize: FontSize.base },
  saveEditBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 6 },
  saveEditBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  cancelEditBtn: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 6 },
  cancelEditBtnText: { fontWeight: "700", color: Colors.textSecondary, fontSize: FontSize.sm },
  clearDoneBtn: { alignItems: "center", paddingVertical: Spacing.md },
  clearDoneBtnText: { color: Colors.error, fontWeight: "600", fontSize: FontSize.sm },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: Spacing.xl },
  emptyIcon: { fontSize: 72 },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  emptyBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
});

const ed = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: "#00000015",
  },
  backBtn: { paddingRight: 8, paddingVertical: 4 },
  backText: { fontSize: FontSize.base, fontWeight: "700", color: Colors.primary },
  topRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  colorCircle: { width: 28, height: 28, borderRadius: 14 },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 7 },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: "#00000015" },
  colorSwatch: { width: 54, height: 36, borderRadius: Radius.md, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#00000015" },
  colorSwatchActive: { borderWidth: 2.5, borderColor: Colors.primary },
  content: { padding: Spacing.md, paddingBottom: 80 },
  titleInput: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary, paddingVertical: 4 },
  divider: { height: 1, backgroundColor: "#00000015", marginVertical: Spacing.sm },
  contentInput: { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 26, minHeight: 300 },
  footer: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: Spacing.md, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#00000015" },
  footerText: { fontSize: 11, color: "#888", fontWeight: "500" },
});
