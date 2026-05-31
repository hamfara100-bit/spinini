import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { AIResult, AIResultFormat } from "../../../../lib/data/types";
import { downloadResult, FORMAT_META } from "../../../../lib/ai-export";

function groupByDate(results: AIResult[]): { label: string; items: AIResult[] }[] {
  const groups: Record<string, AIResult[]> = {};
  const today = new Date();
  results.forEach(r => {
    const d = new Date(r.createdAt);
    const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
    const label =
      diff === 0 ? "Today" :
      diff === 1 ? "Yesterday" :
      diff < 7   ? "This Week" :
      diff < 30  ? "This Month" :
      d.toLocaleString("default", { month: "long", year: "numeric" });
    (groups[label] ??= []).push(r);
  });
  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

export default function KidAIResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);
  const [viewing, setViewing] = useState<AIResult | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterFormat, setFilterFormat] = useState<AIResultFormat | "all">("all");

  const allResults: AIResult[] = kid?.aiResults ?? [];
  const filtered = allResults.filter(r =>
    (filterFormat === "all" || r.format === filterFormat) &&
    (r.title.toLowerCase().includes(search.toLowerCase()) || r.content.toLowerCase().includes(search.toLowerCase()))
  );
  const grouped = groupByDate(filtered);

  function deleteResult(resultId: string) {
    Alert.alert("Delete Result", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => dispatch({ type: "KID_AI_RESULT_DELETE", kidId: id, resultId }) },
    ]);
  }

  function saveTitle() {
    if (editingId && editingTitle.trim()) {
      dispatch({ type: "KID_AI_RESULT_UPDATE", kidId: id, resultId: editingId, payload: { title: editingTitle.trim() } });
    }
    setEditingId(null);
  }

  const formats: (AIResultFormat | "all")[] = ["all", "report", "csv", "pdf", "form", "note"];

  return (
    <ScreenContainer scroll>
      <Text style={s.title}>📁 My AI Results</Text>
      <Text style={s.sub}>Files and reports your AI buddy made for you</Text>

      <TextInput
        style={s.search}
        value={search}
        onChangeText={setSearch}
        placeholder="🔍 Search…"
        placeholderTextColor={Colors.textSecondary}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: Spacing.md }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
        {formats.map(f => (
          <TouchableOpacity
            key={f}
            style={[s.fChip, filterFormat === f && s.fChipActive]}
            onPress={() => setFilterFormat(f)}
          >
            <Text style={[s.fChipText, filterFormat === f && s.fChipTextActive]}>
              {f === "all" ? "All" : `${FORMAT_META[f].emoji} ${FORMAT_META[f].label}`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filtered.length === 0 && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📭</Text>
          <Text style={s.emptyTitle}>Nothing here yet!</Text>
          <Text style={s.emptySub}>Ask your AI Buddy to create a report, list, or study sheet for you.</Text>
          <Text style={s.emptySub}>Try: "Make me a study plan for math" or "Create a chore tracker sheet"</Text>
        </View>
      )}

      {grouped.map(group => (
        <View key={group.label}>
          <Text style={s.groupLabel}>{group.label}</Text>
          {group.items.map(r => {
            const meta = FORMAT_META[r.format];
            const isEditing = editingId === r.id;
            return (
              <TouchableOpacity key={r.id} style={s.card} onPress={() => setViewing(r)} activeOpacity={0.85}>
                <View style={[s.badge, { backgroundColor: meta.color + "20" }]}>
                  <Text style={s.badgeEmoji}>{meta.emoji}</Text>
                </View>
                <View style={s.cardBody}>
                  {isEditing ? (
                    <TextInput
                      style={s.titleInput}
                      value={editingTitle}
                      onChangeText={setEditingTitle}
                      onBlur={saveTitle}
                      onSubmitEditing={saveTitle}
                      autoFocus
                    />
                  ) : (
                    <Text style={s.cardTitle} numberOfLines={1}>{r.title}</Text>
                  )}
                  <Text style={s.cardMeta}>
                    {meta.label} · {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
                <View style={s.actions}>
                  <TouchableOpacity style={s.iconBtn} onPress={() => { setEditingId(r.id); setEditingTitle(r.title); }}>
                    <Text style={s.iconBtnText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.iconBtn} onPress={() => downloadResult(r.title, r.content, r.format)}>
                    <Text style={s.iconBtnText}>⬇️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.iconBtn} onPress={() => deleteResult(r.id)}>
                    <Text style={[s.iconBtnText, { color: Colors.error }]}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* View modal */}
      <Modal visible={!!viewing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setViewing(null)}>
        {viewing && (
          <View style={{ flex: 1, backgroundColor: Colors.bgLight }}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setViewing(null)} style={s.closeBtn}>
                <Text style={s.closeBtnText}>✕ Close</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle} numberOfLines={2}>{viewing.title}</Text>
              <TouchableOpacity style={s.downloadBtn} onPress={() => downloadResult(viewing.title, viewing.content, viewing.format)}>
                <Text style={s.downloadBtnText}>⬇️ Download</Text>
              </TouchableOpacity>
            </View>
            <View style={[s.formatRow, { backgroundColor: FORMAT_META[viewing.format].color + "15" }]}>
              <Text style={[s.formatLabel, { color: FORMAT_META[viewing.format].color }]}>
                {FORMAT_META[viewing.format].emoji} {FORMAT_META[viewing.format].label}
              </Text>
              <Text style={s.formatDate}>{new Date(viewing.createdAt).toLocaleString()}</Text>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md }}>
              <Text style={s.content} selectable>{viewing.content}</Text>
            </ScrollView>
          </View>
        )}
      </Modal>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  search: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.sm, fontSize: FontSize.base, backgroundColor: Colors.surfaceLight, marginBottom: Spacing.sm },
  fChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.cardLight, marginRight: 8 },
  fChipActive: { backgroundColor: Colors.primary },
  fChipText: { fontWeight: "600", color: Colors.textSecondary, fontSize: FontSize.sm },
  fChipTextActive: { color: "#fff" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 16 },
  groupLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, marginBottom: 8, marginTop: Spacing.sm, textTransform: "uppercase" },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: 8, ...Shadow.sm, gap: 10 },
  badge: { width: 44, height: 44, borderRadius: Radius.md, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  badgeEmoji: { fontSize: 22 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary, marginBottom: 2 },
  cardMeta: { fontSize: FontSize.xs, color: Colors.textSecondary },
  titleInput: { borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.sm, padding: 4, fontSize: FontSize.base, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 4 },
  iconBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  iconBtnText: { fontSize: 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12 },
  closeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.md, backgroundColor: Colors.cardLight },
  closeBtnText: { fontWeight: "600", color: Colors.textSecondary, fontSize: FontSize.sm },
  modalTitle: { flex: 1, fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  downloadBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 7 },
  downloadBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  formatRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: 8 },
  formatLabel: { fontWeight: "700", fontSize: FontSize.sm, flex: 1 },
  formatDate: { fontSize: FontSize.xs, color: Colors.textSecondary },
  content: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 22, fontFamily: "monospace" },
});
