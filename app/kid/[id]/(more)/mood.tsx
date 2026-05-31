import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, today, nowIso } from "../../../../lib/utils";
import { MOOD_LABELS, type MoodLevel } from "../../../../lib/data/types";

export default function MoodCheckInScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);

  const entries = kid?.moodEntries ?? [];
  const todayEntry = entries.find(e => e.date === today());

  const [selected, setSelected] = useState<MoodLevel | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  function logMood() {
    if (!selected) return;
    dispatch({
      type: "MOOD_LOG",
      kidId: id,
      entry: { id: uid(), date: today(), mood: selected, note: note.trim() || undefined, loggedAt: nowIso() },
    });
    setSaved(true);
  }

  const recentEntries = entries.slice(0, 14);

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>😊 How are you feeling?</Text>
      <Text style={styles.sub}>Check in once a day — your feelings matter!</Text>

      {todayEntry && !saved ? (
        <View style={styles.alreadyCard}>
          <Text style={styles.alreadyEmoji}>{MOOD_LABELS[todayEntry.mood].emoji}</Text>
          <Text style={styles.alreadyTitle}>You checked in today!</Text>
          <Text style={styles.alreadyMood}>Feeling: {MOOD_LABELS[todayEntry.mood].label}</Text>
          {todayEntry.note && <Text style={styles.alreadyNote}>"{todayEntry.note}"</Text>}
        </View>
      ) : saved ? (
        <View style={[styles.alreadyCard, { borderColor: Colors.success, backgroundColor: "#F0FDF4" }]}>
          <Text style={styles.alreadyEmoji}>{selected ? MOOD_LABELS[selected].emoji : "✅"}</Text>
          <Text style={[styles.alreadyTitle, { color: Colors.success }]}>Mood logged! Thanks for sharing.</Text>
        </View>
      ) : (
        <>
          <View style={styles.moodRow}>
            {([1, 2, 3, 4, 5] as MoodLevel[]).map(m => {
              const info = MOOD_LABELS[m];
              return (
                <TouchableOpacity
                  key={m}
                  style={[styles.moodBtn, selected === m && { borderColor: info.color, borderWidth: 3 }]}
                  onPress={() => setSelected(m)}
                >
                  <Text style={styles.moodEmoji}>{info.emoji}</Text>
                  <Text style={[styles.moodLabel, { color: info.color }]}>{info.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selected && (
            <>
              <Text style={styles.noteLabel}>Want to say more? (optional)</Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="What's on your mind?"
                multiline
              />
              <TouchableOpacity style={styles.saveBtn} onPress={logMood}>
                <Text style={styles.saveBtnText}>Save My Mood</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}

      {/* Recent history */}
      {recentEntries.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>RECENT CHECK-INS</Text>
          <View style={styles.historyRow}>
            {recentEntries.map(e => {
              const info = MOOD_LABELS[e.mood];
              const d = new Date(e.date + "T12:00:00");
              return (
                <View key={e.id} style={[styles.historyDot, { backgroundColor: info.color + "20", borderColor: info.color }]}>
                  <Text style={styles.historyEmoji}>{info.emoji}</Text>
                  <Text style={styles.historyDay}>{d.toLocaleDateString(undefined, { weekday: "short" })}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg },
  moodRow: { flexDirection: "row", gap: 8, marginBottom: Spacing.lg },
  moodBtn: { flex: 1, alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: 12, borderWidth: 2, borderColor: Colors.border },
  moodEmoji: { fontSize: 28, marginBottom: 4 },
  moodLabel: { fontSize: 10, fontWeight: "700", textAlign: "center" },
  noteLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, marginBottom: 6 },
  noteInput: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg, padding: 12, fontSize: FontSize.base, minHeight: 80, textAlignVertical: "top", marginBottom: Spacing.md },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 16, ...Shadow.md },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  alreadyCard: { alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.xl, marginBottom: Spacing.lg, borderWidth: 2, borderColor: Colors.primary + "30" },
  alreadyEmoji: { fontSize: 52, marginBottom: 8 },
  alreadyTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  alreadyMood: { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: "600" },
  alreadyNote: { fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: "italic", marginTop: 4 },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginTop: Spacing.lg, marginBottom: 10 },
  historyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  historyDot: { alignItems: "center", borderRadius: Radius.md, padding: 8, borderWidth: 1.5, minWidth: 52 },
  historyEmoji: { fontSize: 20, marginBottom: 2 },
  historyDay: { fontSize: 9, fontWeight: "700", color: Colors.textMuted },
});
