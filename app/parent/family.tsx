import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useData } from "../../lib/data/store";
import { ScreenContainer } from "../../components/screen-container";
import { Mascot } from "../../components/mascot";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../lib/theme";
import { PASTEL_COLORS } from "../../lib/data/types";

export default function FamilyScreen() {
  const { state, dispatch } = useData();
  const router = useRouter();

  function removeKid(kidId: string) {
    const kid = state.kids.find(k => k.profile.id === kidId);
    Alert.alert(
      "Remove Kid",
      `Remove ${kid?.profile.name ?? "this kid"} and all their data? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => dispatch({ type: "REMOVE_KID", kidId }) },
      ]
    );
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Text style={styles.title}>👨‍👩‍👧 Family</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/setup/add-kid")}>
          <Text style={styles.addBtnText}>+ Add Kid</Text>
        </TouchableOpacity>
      </View>

      {state.kids.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 56 }}>👨‍👩‍👧</Text>
          <Text style={styles.emptyText}>No kids added yet. Add your first child!</Text>
          <TouchableOpacity style={styles.bigAddBtn} onPress={() => router.push("/setup/add-kid")}>
            <Text style={styles.bigAddBtnText}>+ Add First Kid</Text>
          </TouchableOpacity>
        </View>
      ) : (
        state.kids.map(kid => (
          <View key={kid.profile.id} style={[styles.card, { borderLeftColor: PASTEL_COLORS[kid.profile.color], borderLeftWidth: 4 }]}>
            <Mascot type={kid.profile.mascot} size={48} animate={false} />
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <Text style={styles.kidName}>{kid.profile.name}</Text>
              <Text style={styles.kidAge}>Age {kid.profile.age}</Text>
              <Text style={styles.kidMascot}>Mascot: {kid.profile.mascot}</Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => router.push(`/parent/(more)/kid/${kid.profile.id}` as any)}
              >
                <Text style={{ fontSize: 18 }}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => removeKid(kid.profile.id)}>
                <Text style={{ fontSize: 18 }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  addBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  addBtnText: { color: "#fff", fontWeight: "700" },
  empty: { alignItems: "center", padding: Spacing.xl, gap: 12 },
  emptyText: { color: Colors.textSecondary, textAlign: "center" },
  bigAddBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 24, paddingVertical: 12, marginTop: Spacing.sm },
  bigAddBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  kidName: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  kidAge: { fontSize: FontSize.sm, color: Colors.textSecondary },
  kidMascot: { fontSize: FontSize.sm, color: Colors.textSecondary, textTransform: "capitalize" },
  actions: { flexDirection: "row", gap: 8 },
  editBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  deleteBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.error + "20", alignItems: "center", justifyContent: "center" },
});
