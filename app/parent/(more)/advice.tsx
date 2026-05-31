import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from "react-native";
import { MicButton } from "../../../components/voice-text-input";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso } from "../../../lib/utils";

const EMOJIS = ["💎","💡","❤️","🌟","🏆","📖","🌈","🔑","⭐","🎯"];

export default function ParentAdviceScreen() {
  const { state, dispatch } = useData();
  const [text, setText] = useState("");
  const [emoji, setEmoji] = useState("💎");
  const [selectedKids, setSelectedKids] = useState<string[]>([]);

  function post() {
    if (!text.trim()) return;
    dispatch({ type: "ADVICE_ADD", advice: { id: uid(), text: text.trim(), emoji, targetKids: selectedKids, readBy: [], createdAt: nowIso() } });
    setText(""); setSelectedKids([]);
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>💎 Life Advice</Text>

      <View style={styles.form}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={[styles.label, { marginBottom: 0 }]}>Your wisdom</Text>
          <MicButton appendTo={text} onAppend={setText} onResult={setText} size={34} />
        </View>
        <TextInput style={styles.input} value={text} onChangeText={setText} placeholder="Share your wisdom… or tap 🎙️ to speak!" multiline />
        <View style={styles.emojiRow}>
          {EMOJIS.map(e => (
            <TouchableOpacity key={e} style={[styles.emojiBtn, emoji === e && styles.emojiBtnActive]} onPress={() => setEmoji(e)}>
              <Text style={{ fontSize: 22 }}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>For:</Text>
        <View style={styles.kidRow}>
          {state.kids.map(k => (
            <TouchableOpacity key={k.profile.id} style={[styles.kidChip, selectedKids.includes(k.profile.id) && styles.kidChipActive]} onPress={() => setSelectedKids(s => s.includes(k.profile.id) ? s.filter(x => x !== k.profile.id) : [...s, k.profile.id])}>
              <Text style={[styles.kidChipText, selectedKids.includes(k.profile.id) && styles.kidChipTextActive]}>{k.profile.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.postBtn} onPress={post} disabled={!text.trim()}>
          <Text style={styles.postBtnText}>Post Advice 💎</Text>
        </TouchableOpacity>
      </View>

      {state.advice.length === 0 && (
        <View style={styles.empty}>
          <Text style={{ fontSize: 56 }}>💎</Text>
          <Text style={styles.emptyTitle}>No advice posted yet</Text>
          <Text style={styles.emptySub}>Share your wisdom with your kids above!</Text>
        </View>
      )}

      {state.advice.map(a => (
        <View key={a.id} style={styles.adviceCard}>
          <Text style={{ fontSize: 28 }}>{a.emoji}</Text>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.adviceText}>{a.text}</Text>
            <Text style={styles.adviceMeta}>
              {a.targetKids.length > 0
                ? `For: ${state.kids.filter(k => a.targetKids.includes(k.profile.id)).map(k => k.profile.name).join(", ")}`
                : "For all kids"
              } · Read by {a.readBy.length}/{a.targetKids.length || state.kids.length}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => Alert.alert("Delete advice?", `"${a.text.slice(0, 50)}${a.text.length > 50 ? "…" : ""}"`, [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => dispatch({ type: "ADVICE_REMOVE", adviceId: a.id }) },
            ])}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.deleteBtnText}>🗑</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  form: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm, gap: 8 },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.base, minHeight: 80, textAlignVertical: "top" },
  emojiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emojiBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  emojiBtnActive: { backgroundColor: Colors.primary + "30", borderWidth: 2, borderColor: Colors.primary },
  label: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  kidRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kidChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.cardLight },
  kidChipActive: { backgroundColor: Colors.primary },
  kidChipText: { fontWeight: "600", color: Colors.textSecondary },
  kidChipTextActive: { color: "#fff" },
  postBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", padding: Spacing.sm },
  postBtnText: { color: "#fff", fontWeight: "700" },
  adviceCard: { flexDirection: "row", alignItems: "flex-start", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  adviceText: { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 22 },
  adviceMeta: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  deleteBtn: { padding: 6, marginLeft: 4 },
  deleteBtnText: { fontSize: 18 },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },
});
