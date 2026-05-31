import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Switch, TextInput,
  Alert, ScrollView, FlatList,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid } from "../../../lib/utils";
import type { MorningChecklistItem, MorningRoutine } from "../../../lib/data/types";

const DEFAULT_ITEMS: Omit<MorningChecklistItem, "id">[] = [
  { emoji: "🦷", label: "Brush teeth" },
  { emoji: "🛏️", label: "Make bed" },
  { emoji: "🥣", label: "Eat breakfast" },
  { emoji: "👔", label: "Get dressed" },
  { emoji: "🎒", label: "Pack backpack" },
];

const EMOJI_OPTIONS = ["🦷","🛏️","🥣","👔","🎒","📚","🚿","💊","🐕","🌅","🏃","🧹","🧴","🥛","🍎","✏️","🎵","🙏","🧠","💧"];

export default function MorningRoutineScreen() {
  const { state, dispatch } = useData();
  const [selectedKidId, setSelectedKidId] = useState(state.kids[0]?.profile.id ?? "");
  const [newLabel, setNewLabel] = useState("");
  const [newEmoji, setNewEmoji] = useState("✅");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const kid = state.kids.find(k => k.profile.id === selectedKidId);
  const routine: MorningRoutine = kid?.rules.morningRoutine ?? { enabled: false, items: [], resetHour: 4 };

  function update(patch: Partial<MorningRoutine>) {
    if (!selectedKidId) return;
    dispatch({ type: "MORNING_ROUTINE_UPDATE", kidId: selectedKidId, routine: patch });
  }

  function addItem() {
    if (!newLabel.trim()) return;
    const item: MorningChecklistItem = { id: uid(), label: newLabel.trim(), emoji: newEmoji };
    update({ items: [...routine.items, item] });
    setNewLabel("");
    setNewEmoji("✅");
  }

  function removeItem(id: string) {
    update({ items: routine.items.filter(i => i.id !== id) });
  }

  function loadDefaults() {
    const items = DEFAULT_ITEMS.map(i => ({ ...i, id: uid() }));
    update({ items });
  }

  if (state.kids.length === 0) {
    return (
      <ScreenContainer>
        <Text style={styles.empty}>No kids added yet. Add a kid profile first.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🌅 Morning Routine</Text>
      <Text style={styles.sub}>Kids must check off every item before their screen time unlocks each day.</Text>

      {/* Kid picker */}
      {state.kids.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
          {state.kids.map(k => (
            <TouchableOpacity
              key={k.profile.id}
              style={[styles.kidChip, selectedKidId === k.profile.id && styles.kidChipActive]}
              onPress={() => setSelectedKidId(k.profile.id)}
            >
              <Text style={[styles.kidChipText, selectedKidId === k.profile.id && styles.kidChipTextActive]}>
                {k.profile.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Enable toggle */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Enable Morning Routine</Text>
            <Text style={styles.cardSub}>Screen time stays locked until all items are checked</Text>
          </View>
          <Switch
            value={routine.enabled}
            onValueChange={v => update({ enabled: v })}
            trackColor={{ true: Colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {routine.enabled && (
        <>
          {/* Reset hour */}
          <Text style={styles.sectionLabel}>CHECKLIST RESETS AT</Text>
          <View style={styles.card}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
              {[3, 4, 5, 6].map(h => (
                <TouchableOpacity
                  key={h}
                  style={[styles.hourChip, routine.resetHour === h && styles.hourChipActive]}
                  onPress={() => update({ resetHour: h })}
                >
                  <Text style={[styles.hourChipText, routine.resetHour === h && styles.hourChipTextActive]}>
                    {h}:00 AM
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.hint}>Items reset after this time so the checklist is fresh each morning.</Text>
          </View>

          {/* Current items */}
          <Text style={styles.sectionLabel}>CHECKLIST ITEMS</Text>
          {routine.items.length === 0 ? (
            <TouchableOpacity style={styles.defaultsBtn} onPress={loadDefaults}>
              <Text style={styles.defaultsBtnText}>+ Load Default Items</Text>
            </TouchableOpacity>
          ) : (
            routine.items.map((item, idx) => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemEmoji}>{item.emoji}</Text>
                <Text style={styles.itemLabel}>{item.label}</Text>
                <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          {/* Add item */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add Item</Text>
            <TouchableOpacity onPress={() => setShowEmojiPicker(!showEmojiPicker)} style={styles.emojiBtn}>
              <Text style={styles.emojiBtnText}>{newEmoji} Pick emoji</Text>
            </TouchableOpacity>
            {showEmojiPicker && (
              <View style={styles.emojiGrid}>
                {EMOJI_OPTIONS.map(e => (
                  <TouchableOpacity key={e} onPress={() => { setNewEmoji(e); setShowEmojiPicker(false); }} style={styles.emojiOption}>
                    <Text style={{ fontSize: 24 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TextInput
              style={styles.input}
              value={newLabel}
              onChangeText={setNewLabel}
              placeholder="e.g. Brush teeth"
              onSubmitEditing={addItem}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addBtn} onPress={addItem}>
              <Text style={styles.addBtnText}>+ Add to Checklist</Text>
            </TouchableOpacity>
          </View>

          {routine.items.length > 0 && (
            <TouchableOpacity style={styles.defaultsBtn} onPress={loadDefaults}>
              <Text style={styles.defaultsBtnText}>↺ Reset to Defaults</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textMuted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6, marginTop: 12 },
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadow.sm },
  cardTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary, marginBottom: 2 },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  row: { flexDirection: "row", alignItems: "center" },
  kidChip: { borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  kidChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  kidChipText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  kidChipTextActive: { color: "#fff" },
  hourChip: { borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  hourChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  hourChipText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  hourChipTextActive: { color: "#fff" },
  hint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 8 },
  itemRow: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: 12, marginBottom: 8, ...Shadow.sm },
  itemEmoji: { fontSize: 22, marginRight: 10 },
  itemLabel: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: "600" },
  deleteBtn: { padding: 6 },
  deleteBtnText: { color: Colors.textMuted, fontSize: 16 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg, padding: 12, fontSize: FontSize.base, marginTop: 10, marginBottom: 8 },
  addBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  emojiBtn: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg, padding: 10, alignItems: "center", marginBottom: 4 },
  emojiBtnText: { fontSize: FontSize.base, color: Colors.textSecondary },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 },
  emojiOption: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.background },
  defaultsBtn: { borderWidth: 1.5, borderColor: Colors.primary, borderStyle: "dashed", borderRadius: Radius.lg, alignItems: "center", padding: 12, marginBottom: Spacing.sm },
  defaultsBtnText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.sm },
  empty: { textAlign: "center", color: Colors.textMuted, marginTop: 40, fontSize: FontSize.base },
});
