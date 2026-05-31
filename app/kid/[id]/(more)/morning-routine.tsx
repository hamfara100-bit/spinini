import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";

export default function KidMorningRoutineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);
  const routine = kid?.rules.morningRoutine;
  const completed = kid?.morningCompletedItems ?? [];

  if (!routine?.enabled || routine.items.length === 0) {
    return (
      <ScreenContainer>
        <Text style={styles.empty}>No morning routine set up yet.{"\n"}Ask a parent to configure one!</Text>
      </ScreenContainer>
    );
  }

  const allDone = routine.items.every(item => completed.includes(item.id));
  const doneCount = routine.items.filter(item => completed.includes(item.id)).length;

  function toggle(itemId: string) {
    dispatch({ type: "MORNING_ITEM_TOGGLE", kidId: id, itemId });
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🌅 Good Morning!</Text>
      <Text style={styles.sub}>Check off everything before your screen time unlocks.</Text>

      {/* Progress bar */}
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${(doneCount / routine.items.length) * 100}%` as any }]} />
      </View>
      <Text style={styles.progressLabel}>{doneCount} / {routine.items.length} done</Text>

      {/* Checklist */}
      {routine.items.map(item => {
        const done = completed.includes(item.id);
        return (
          <TouchableOpacity
            key={item.id}
            style={[styles.item, done && styles.itemDone]}
            onPress={() => toggle(item.id)}
            activeOpacity={0.75}
          >
            <Text style={styles.itemEmoji}>{item.emoji}</Text>
            <Text style={[styles.itemLabel, done && styles.itemLabelDone]}>{item.label}</Text>
            <View style={[styles.check, done && styles.checkDone]}>
              {done && <Text style={styles.checkMark}>✓</Text>}
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Completion banner */}
      {allDone && (
        <View style={styles.banner}>
          <Text style={styles.bannerEmoji}>🎉</Text>
          <Text style={styles.bannerTitle}>Morning routine complete!</Text>
          <Text style={styles.bannerSub}>Your screen time is now unlocked. Have a great day!</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xxl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg },
  progressBg: { height: 12, backgroundColor: Colors.border, borderRadius: Radius.full, marginBottom: 6, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: Colors.success, borderRadius: Radius.full },
  progressLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "right", marginBottom: Spacing.md },
  item: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: 16, marginBottom: 10, ...Shadow.sm, borderWidth: 2, borderColor: Colors.border },
  itemDone: { backgroundColor: "#F0FDF4", borderColor: Colors.success },
  itemEmoji: { fontSize: 28, marginRight: 12 },
  itemLabel: { flex: 1, fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  itemLabelDone: { color: Colors.success, textDecorationLine: "line-through" },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  checkDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  checkMark: { color: "#fff", fontWeight: "900", fontSize: 16 },
  banner: { backgroundColor: "#F0FDF4", borderRadius: Radius.xl, padding: Spacing.lg, alignItems: "center", marginTop: Spacing.md, borderWidth: 2, borderColor: Colors.success },
  bannerEmoji: { fontSize: 48, marginBottom: 8 },
  bannerTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.success, marginBottom: 4 },
  bannerSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },
  empty: { textAlign: "center", color: Colors.textMuted, marginTop: 60, fontSize: FontSize.base, lineHeight: 24 },
});
