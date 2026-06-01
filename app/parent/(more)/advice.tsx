import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Modal, ScrollView,
} from "react-native";
import { MicButton } from "../../../components/voice-text-input";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso } from "../../../lib/utils";

const EMOJIS = ["💎","💡","❤️","🌟","🏆","📖","🌈","🔑","⭐","🎯","🧠","🤝"];

export default function ParentAdviceScreen() {
  const { state, dispatch } = useData();
  const categories = state.adviceCategories ?? [];

  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [expandedId, setExpandedId]   = useState<string | null>(null);

  // New-category modal
  const [showCatForm, setShowCatForm] = useState(false);
  const [catName, setCatName] = useState("");
  const [catEmoji, setCatEmoji] = useState("💎");

  // New-advice modal
  const [showAdviceForm, setShowAdviceForm] = useState(false);
  const [advTitle, setAdvTitle] = useState("");
  const [advBody, setAdvBody]   = useState("");
  const [advKids, setAdvKids]   = useState<string[]>([]);

  function createCategory() {
    if (!catName.trim()) return;
    dispatch({ type: "ADVICE_CATEGORY_ADD", category: { id: uid(), name: catName.trim(), emoji: catEmoji, createdAt: nowIso() } });
    setCatName(""); setCatEmoji("💎"); setShowCatForm(false);
  }

  function deleteCategory(id: string, name: string) {
    Alert.alert("Delete category?", `Delete "${name}" and all its advice?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        dispatch({ type: "ADVICE_CATEGORY_REMOVE", categoryId: id });
        if (selectedCat === id) setSelectedCat(null);
      }},
    ]);
  }

  function addAdvice() {
    if (!advTitle.trim() || !selectedCat) return;
    dispatch({ type: "ADVICE_ADD", advice: {
      id: uid(),
      title: advTitle.trim(),
      text: advBody.trim(),
      emoji: categories.find(c => c.id === selectedCat)?.emoji ?? "💎",
      categoryId: selectedCat,
      targetKids: advKids,
      readBy: [],
      createdAt: nowIso(),
    }});
    setAdvTitle(""); setAdvBody(""); setAdvKids([]); setShowAdviceForm(false);
  }

  function deleteAdvice(id: string, title: string) {
    Alert.alert("Delete advice?", `"${title}"`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => dispatch({ type: "ADVICE_REMOVE", adviceId: id }) },
    ]);
  }

  // ── Category detail view ────────────────────────────────────────────────────
  if (selectedCat) {
    const cat = categories.find(c => c.id === selectedCat);
    const items = state.advice.filter(a => a.categoryId === selectedCat);
    return (
      <ScreenContainer scroll>
        <TouchableOpacity onPress={() => { setSelectedCat(null); setExpandedId(null); }}>
          <Text style={styles.back}>← All categories</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{cat?.emoji} {cat?.name}</Text>

        <TouchableOpacity style={styles.addBar} onPress={() => setShowAdviceForm(true)} activeOpacity={0.85}>
          <Text style={styles.addBarText}>＋ Add advice</Text>
        </TouchableOpacity>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 48 }}>{cat?.emoji}</Text>
            <Text style={styles.emptyTitle}>No advice yet</Text>
            <Text style={styles.emptySub}>Tap "Add advice" to write your first one.</Text>
          </View>
        ) : (
          items.map(a => {
            const open = expandedId === a.id;
            return (
              <View key={a.id} style={styles.adviceCard}>
                <TouchableOpacity
                  style={styles.adviceHeader}
                  onPress={() => setExpandedId(open ? null : a.id)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 22 }}>{a.emoji}</Text>
                  <Text style={styles.adviceTitle} numberOfLines={open ? undefined : 1}>{a.title || a.text.slice(0, 40)}</Text>
                  <Text style={styles.chevron}>{open ? "▲" : "▼"}</Text>
                </TouchableOpacity>
                {open && (
                  <View style={styles.adviceBodyWrap}>
                    {!!a.text && <Text style={styles.adviceBody}>{a.text}</Text>}
                    <Text style={styles.adviceMeta}>
                      {a.targetKids.length > 0
                        ? `For: ${state.kids.filter(k => a.targetKids.includes(k.profile.id)).map(k => k.profile.name).join(", ")}`
                        : "For all kids"}
                    </Text>
                    <TouchableOpacity style={styles.deleteRow} onPress={() => deleteAdvice(a.id, a.title || a.text.slice(0, 30))}>
                      <Text style={styles.deleteRowText}>🗑 Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* Add advice modal */}
        <Modal visible={showAdviceForm} transparent animationType="slide" onRequestClose={() => setShowAdviceForm(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>＋ New advice in {cat?.name}</Text>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>Title</Text>
                <TextInput style={styles.input} value={advTitle} onChangeText={setAdvTitle} placeholder="e.g. Always be honest" placeholderTextColor={Colors.textMuted} autoFocus />

                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                  <Text style={styles.label}>Advice</Text>
                  <MicButton appendTo={advBody} onAppend={setAdvBody} onResult={setAdvBody} size={32} />
                </View>
                <TextInput style={[styles.input, { minHeight: 110, textAlignVertical: "top" }]} value={advBody} onChangeText={setAdvBody} placeholder="Write the full advice here… or tap 🎙️ to speak" placeholderTextColor={Colors.textMuted} multiline />

                <Text style={[styles.label, { marginTop: 10 }]}>For:</Text>
                <View style={styles.kidRow}>
                  {state.kids.map(k => (
                    <TouchableOpacity key={k.profile.id} style={[styles.kidChip, advKids.includes(k.profile.id) && styles.kidChipActive]} onPress={() => setAdvKids(s => s.includes(k.profile.id) ? s.filter(x => x !== k.profile.id) : [...s, k.profile.id])}>
                      <Text style={[styles.kidChipText, advKids.includes(k.profile.id) && styles.kidChipTextActive]}>{k.profile.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.hint}>No kids selected = visible to all kids.</Text>
              </ScrollView>
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAdviceForm(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, !advTitle.trim() && { opacity: 0.5 }]} onPress={addAdvice} disabled={!advTitle.trim()}>
                  <Text style={styles.saveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScreenContainer>
    );
  }

  // ── Category list view ──────────────────────────────────────────────────────
  return (
    <ScreenContainer scroll>
      <View style={styles.headerRow}>
        <Text style={styles.title}>💎 Life Advice</Text>
        <TouchableOpacity style={styles.newCatBtn} onPress={() => setShowCatForm(true)}>
          <Text style={styles.newCatText}>＋ Category</Text>
        </TouchableOpacity>
      </View>

      {categories.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 56 }}>💎</Text>
          <Text style={styles.emptyTitle}>No categories yet</Text>
          <Text style={styles.emptySub}>Create a category (like "Honesty" or "Money") then add your advice inside it.</Text>
          <TouchableOpacity style={styles.bigBtn} onPress={() => setShowCatForm(true)}>
            <Text style={styles.bigBtnText}>＋ Create first category</Text>
          </TouchableOpacity>
        </View>
      ) : (
        categories.map(c => {
          const count = state.advice.filter(a => a.categoryId === c.id).length;
          return (
            <TouchableOpacity key={c.id} style={styles.catCard} onPress={() => setSelectedCat(c.id)} activeOpacity={0.85}>
              <Text style={{ fontSize: 32 }}>{c.emoji}</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.catName}>{c.name}</Text>
                <Text style={styles.catCount}>{count} advice{count !== 1 ? "s" : ""}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteCategory(c.id, c.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.deleteBtnText}>🗑</Text>
              </TouchableOpacity>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          );
        })
      )}

      {/* New category modal */}
      <Modal visible={showCatForm} transparent animationType="slide" onRequestClose={() => setShowCatForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>＋ New category</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={catName} onChangeText={setCatName} placeholder="e.g. Honesty, Money, Friendship" placeholderTextColor={Colors.textMuted} autoFocus />
            <Text style={[styles.label, { marginTop: 10 }]}>Icon</Text>
            <View style={styles.emojiRow}>
              {EMOJIS.map(e => (
                <TouchableOpacity key={e} style={[styles.emojiBtn, catEmoji === e && styles.emojiBtnActive]} onPress={() => setCatEmoji(e)}>
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCatForm(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, !catName.trim() && { opacity: 0.5 }]} onPress={createCategory} disabled={!catName.trim()}>
                <Text style={styles.saveText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  back: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.base, marginBottom: 6 },
  newCatBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  newCatText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },

  // Category cards
  catCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 10, ...Shadow.sm },
  catName: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },
  catCount: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 22, color: Colors.textMuted, marginLeft: 8, fontWeight: "300" },

  // Add bar
  addBar: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 13, alignItems: "center", marginBottom: Spacing.md },
  addBarText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },

  // Advice accordion cards
  adviceCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, marginBottom: 8, overflow: "hidden", ...Shadow.sm },
  adviceHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: Spacing.md },
  adviceTitle: { flex: 1, fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  adviceBodyWrap: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  adviceBody: { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 22, paddingTop: 10 },
  adviceMeta: { fontSize: FontSize.xs, color: Colors.textMuted },
  deleteRow: { alignSelf: "flex-start", paddingVertical: 4 },
  deleteRowText: { color: Colors.error, fontWeight: "700", fontSize: FontSize.sm },

  // Forms
  label: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, marginBottom: 6 },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: "#fff" },
  hint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 6 },
  emojiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emojiBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  emojiBtnActive: { backgroundColor: Colors.primary + "30", borderWidth: 2, borderColor: Colors.primary },
  kidRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kidChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.cardLight },
  kidChipActive: { backgroundColor: Colors.primary },
  kidChipText: { fontWeight: "600", color: Colors.textSecondary },
  kidChipTextActive: { color: "#fff" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, maxHeight: "85%" },
  modalTitle: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary, marginBottom: Spacing.md },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: Spacing.md },
  cancelBtn: { flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: Radius.md, backgroundColor: Colors.cardLight },
  cancelText: { color: Colors.textSecondary, fontWeight: "700" },
  saveBtn: { flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: Radius.md, backgroundColor: Colors.primary },
  saveText: { color: "#fff", fontWeight: "800" },

  // Empty / delete
  deleteBtnText: { fontSize: 18 },
  bigBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 24, paddingVertical: 12, marginTop: Spacing.md },
  bigBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 20 },
});
