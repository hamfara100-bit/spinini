import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useData } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";

export default function AdviceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useData();

  const advice = state.advice.filter(a => a.targetKids.includes(id) || a.targetKids.length === 0);

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>💎 Parent Wisdom</Text>
      <Text style={styles.sub}>Life lessons from your parents 💙</Text>
      {advice.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 56 }}>💌</Text>
          <Text style={styles.emptyText}>Your parents haven't posted any advice yet.</Text>
        </View>
      ) : (
        advice.map(a => (
          <TouchableOpacity
            key={a.id}
            style={[styles.card, !a.readBy.includes(id) && styles.cardUnread]}
            onPress={() => dispatch({ type: "ADVICE_READ", adviceId: a.id, kidId: id })}
          >
            <Text style={{ fontSize: 32 }}>{a.emoji ?? "💎"}</Text>
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              {!!a.title && <Text style={styles.cardTitle}>{a.title}</Text>}
              {!!a.text && <Text style={styles.cardText}>{a.text}</Text>}
              {!a.readBy.includes(id) && <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>}
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg },
  empty: { alignItems: "center", padding: Spacing.xl, gap: 12 },
  emptyText: { color: Colors.textSecondary, textAlign: "center" },
  card: { flexDirection: "row", alignItems: "flex-start", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  cardUnread: { borderLeftWidth: 4, borderLeftColor: Colors.primary },
  cardTitle: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary, marginBottom: 2 },
  cardText: { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 22, flex: 1 },
  newBadge: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  newBadgeText: { color: "#fff", fontSize: FontSize.xs, fontWeight: "700" },
});
