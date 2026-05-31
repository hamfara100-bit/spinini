import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { nowIso } from "../../../lib/utils";

export default function ParentWishesScreen() {
  const { state, dispatch } = useData();

  const allWishes = state.kids.flatMap(k =>
    k.wishes.filter(w => w.decision === "pending").map(w => ({ ...w, kidName: k.profile.name }))
  );

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🌟 Kid Wishes</Text>
      {allWishes.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 48 }}>🌟</Text>
          <Text style={styles.emptyText}>No pending wishes. Your kids haven't made any yet!</Text>
        </View>
      ) : (
        allWishes.map(w => (
          <View key={w.id} style={styles.card}>
            <Text style={styles.kidName}>{w.kidName}</Text>
            <Text style={styles.wishTitle}>{w.title}</Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.approveBtn}
                onPress={() => dispatch({ type: "WISH_DECIDE", kidId: w.kidId, wishId: w.id, decision: "approved", comment: "Of course! 🎉" })}
              >
                <Text style={styles.approveBtnText}>✓ Grant</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.denyBtn}
                onPress={() => dispatch({ type: "WISH_DECIDE", kidId: w.kidId, wishId: w.id, decision: "denied", comment: "Maybe later 💙" })}
              >
                <Text style={styles.denyBtnText}>Not now</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  empty: { alignItems: "center", padding: Spacing.xl, gap: 12 },
  emptyText: { color: Colors.textSecondary, textAlign: "center" },
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  kidName: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: "600" },
  wishTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary, marginTop: 4, marginBottom: Spacing.sm },
  actions: { flexDirection: "row", gap: 8 },
  approveBtn: { flex: 1, backgroundColor: Colors.success, borderRadius: Radius.full, alignItems: "center", padding: 10 },
  approveBtnText: { color: "#fff", fontWeight: "700" },
  denyBtn: { flex: 1, backgroundColor: Colors.error + "20", borderRadius: Radius.full, alignItems: "center", padding: 10 },
  denyBtnText: { color: Colors.error, fontWeight: "700" },
});
