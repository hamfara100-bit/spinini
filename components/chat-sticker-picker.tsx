import React, { useState } from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Pressable } from "react-native";
import { CHAT_STICKER_CATEGORIES } from "../lib/stickers";
import { Colors, Radius } from "../lib/theme";

/**
 * Bottom-sheet sticker picker for the family chat — reuses the same emoji
 * sticker sets as the drawing canvas. Tapping a sticker fires onPick.
 */
export function ChatStickerPicker({
  visible, onClose, onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
}) {
  const cats = Object.keys(CHAT_STICKER_CATEGORIES);
  const [cat, setCat] = useState(cats[0]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose} />
      <View style={st.sheet}>
        <View style={st.handle} />
        <Text style={st.title}>Pick a sticker</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingBottom: 8, alignItems: "center" }}
        >
          {cats.map(c => (
            <TouchableOpacity key={c} onPress={() => setCat(c)} style={[st.tab, cat === c && st.tabOn]}>
              <Text style={[st.tabText, cat === c && { color: "#fff" }]} numberOfLines={1}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView contentContainerStyle={st.grid} keyboardShouldPersistTaps="handled">
          {(CHAT_STICKER_CATEGORIES[cat] ?? []).map((e, i) => (
            <TouchableOpacity key={cat + i} style={st.cell} activeOpacity={0.6} onPress={() => { onPick(e); onClose(); }}>
              <Text style={{ fontSize: 38 }}>{e}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    height: "55%", backgroundColor: Colors.bgLight,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingBottom: 16,
  },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: Colors.border, marginBottom: 6 },
  title: { textAlign: "center", fontWeight: "800", color: Colors.textPrimary, fontSize: 15, marginBottom: 8 },
  tab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.cardLight, height: 34, justifyContent: "center" },
  tabOn: { backgroundColor: Colors.primary },
  tabText: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, padding: 12 },
  cell: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: Colors.surfaceLight },
});
