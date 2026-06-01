import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { Mascot } from "../../../components/mascot";
import { AddKidQR } from "../../../components/add-kid-qr";

export default function AccountScreen() {
  const { state } = useData();
  const router = useRouter();
  const [showAddKid, setShowAddKid] = useState(false);
  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>👤 Account</Text>

      <AddKidQR visible={showAddKid} onClose={() => setShowAddKid(false)} />
      <View style={styles.profileCard}>
        <Mascot type={state.parent.mascot} size={64} animate={false} />
        <Text style={styles.name}>{state.parentSettings.name}</Text>
        {state.parentMembership && <Text style={styles.email}>{state.parentMembership.email}</Text>}
      </View>
      <View style={styles.card}><Text style={styles.cardTitle}>Parent PIN</Text><Text style={styles.cardSub}>••••</Text></View>
      <View style={styles.card}><Text style={styles.cardTitle}>Kids</Text><Text style={styles.cardSub}>{state.kids.length} child{state.kids.length !== 1 ? "ren" : ""}</Text></View>

      <TouchableOpacity style={styles.addKidCard} onPress={() => setShowAddKid(true)} activeOpacity={0.85}>
        <Text style={styles.addKidEmoji}>📲</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.addKidTitle}>Add a Child</Text>
          <Text style={styles.addKidSub}>Show a QR code for your child to scan on their own phone</Text>
        </View>
        <Text style={styles.cloudChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cloudCard} onPress={() => router.push("/account" as any)}>
        <Text style={styles.cloudEmoji}>☁️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cloudTitle}>Family Cloud Account</Text>
          <Text style={styles.cloudSub}>Sign in to connect devices across the family</Text>
        </View>
        <Text style={styles.cloudChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutBtn} onPress={() => router.replace("/")}><Text style={styles.signOutText}>← Back to Profiles</Text></TouchableOpacity>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  profileCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: "center", marginBottom: Spacing.md, ...Shadow.md },
  name: { fontSize: FontSize.xl, fontWeight: "700", color: Colors.textPrimary, marginTop: 8 },
  email: { fontSize: FontSize.sm, color: Colors.textSecondary },
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  cardTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  addKidCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.success + "12", borderRadius: Radius.lg, padding: Spacing.md, marginTop: 8, marginBottom: 8, borderWidth: 1.5, borderColor: Colors.success + "44" },
  addKidEmoji: { fontSize: 26 },
  addKidTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  addKidSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  cloudCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.primary + "12", borderRadius: Radius.lg, padding: Spacing.md, marginTop: 8, marginBottom: 8, borderWidth: 1.5, borderColor: Colors.primary + "33" },
  cloudEmoji: { fontSize: 26 },
  cloudTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  cloudSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  cloudChevron: { fontSize: 28, color: Colors.primary, fontWeight: "800" },
  signOutBtn: { alignItems: "center", padding: Spacing.md, marginTop: Spacing.md },
  signOutText: { color: Colors.primary, fontWeight: "600" },
});
