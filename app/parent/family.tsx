import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useData } from "../../lib/data/store";
import { ScreenContainer } from "../../components/screen-container";
import { Mascot } from "../../components/mascot";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../lib/theme";
import { PASTEL_COLORS } from "../../lib/data/types";
import { AddKidQR } from "../../components/add-kid-qr";

export default function FamilyScreen() {
  const { state, dispatch } = useData();
  const router = useRouter();
  const [showGamePicker, setShowGamePicker] = React.useState(false);
  const [showAddKid, setShowAddKid] = React.useState(false);

  function launchGameNight() {
    if (state.kids.length === 0) {
      Alert.alert("No kids yet", "Add a child first to start Game Night!");
      return;
    }
    if (state.kids.length === 1) {
      router.push(`/parent/(more)/game-night?kidId=${state.kids[0].profile.id}` as any);
      return;
    }
    setShowGamePicker(true);
  }

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
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddKid(true)}>
          <Text style={styles.addBtnText}>+ Add Kid</Text>
        </TouchableOpacity>
      </View>

      <AddKidQR visible={showAddKid} onClose={() => setShowAddKid(false)} />

      {/* Game Night */}
      <TouchableOpacity style={styles.gameNightBtn} onPress={launchGameNight} activeOpacity={0.85}>
        <Text style={styles.gameNightEmoji}>🎮</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.gameNightTitle}>Game Night</Text>
          <Text style={styles.gameNightSub}>Play family games together — earn points, have fun!</Text>
        </View>
        <Text style={styles.gameNightArrow}>›</Text>
      </TouchableOpacity>

      {/* Kid picker for Game Night (multi-kid families) */}
      <Modal visible={showGamePicker} transparent animationType="slide" onRequestClose={() => setShowGamePicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>🎮 Choose a kid's Game Night</Text>
            <ScrollView>
              {state.kids.map(kid => (
                <TouchableOpacity
                  key={kid.profile.id}
                  style={styles.pickerRow}
                  onPress={() => { setShowGamePicker(false); router.push(`/parent/(more)/game-night?kidId=${kid.profile.id}` as any); }}
                  activeOpacity={0.85}
                >
                  <Mascot type={kid.profile.mascot} size={40} animate={false} />
                  <Text style={styles.pickerName}>{kid.profile.name}</Text>
                  <Text style={styles.pickerArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowGamePicker(false)}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {state.kids.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 56 }}>👨‍👩‍👧</Text>
          <Text style={styles.emptyText}>No kids added yet. Add your first child!</Text>
          <TouchableOpacity style={styles.bigAddBtn} onPress={() => setShowAddKid(true)}>
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
  gameNightBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: Colors.primary, borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.md,
  },
  gameNightEmoji: { fontSize: 36 },
  gameNightTitle: { fontSize: FontSize.md, fontWeight: "900", color: "#fff" },
  gameNightSub:   { fontSize: FontSize.xs, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  gameNightArrow: { fontSize: 28, color: "rgba(255,255,255,0.6)", fontWeight: "300" },
  // Kid picker modal
  pickerOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  pickerSheet:    { backgroundColor: "#fff", borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, maxHeight: "70%" },
  pickerTitle:    { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary, marginBottom: Spacing.md, textAlign: "center" },
  pickerRow:      { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerName:     { flex: 1, fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  pickerArrow:    { fontSize: 24, color: Colors.textMuted },
  pickerCancel:   { marginTop: Spacing.md, paddingVertical: 14, alignItems: "center" },
  pickerCancelText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.base },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  kidName: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  kidAge: { fontSize: FontSize.sm, color: Colors.textSecondary },
  kidMascot: { fontSize: FontSize.sm, color: Colors.textSecondary, textTransform: "capitalize" },
  actions: { flexDirection: "row", gap: 8 },
  editBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  deleteBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.error + "20", alignItems: "center", justifyContent: "center" },
});
