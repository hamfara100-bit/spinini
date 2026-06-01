/**
 * Role chooser — shown once on first ever launch.
 * The user picks "Parent" or "Child" and the device is locked into that role
 * forever (stored in the persisted AppState). One device = one role.
 */
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useData } from "../../lib/data/store";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../lib/theme";

export default function RoleChooser() {
  const { dispatch } = useData();
  const router = useRouter();

  function choose(role: "parent" | "kid") {
    dispatch({ type: "SET_DEVICE_ROLE", role });
    router.replace(role === "parent" ? "/onboarding/parent" : "/onboarding/kid");
  }

  return (
    <View style={s.root}>
      <Text style={s.logo}>🌀 Spinini</Text>
      <Text style={s.heading}>Who is using this device?</Text>
      <Text style={s.sub}>Choose once — your device stays in this role.</Text>

      <TouchableOpacity style={[s.card, s.parentCard]} onPress={() => choose("parent")} activeOpacity={0.87}>
        <Text style={s.cardEmoji}>👨‍👩‍👧</Text>
        <Text style={[s.cardTitle, { color: "#fff" }]}>I'm a Parent</Text>
        <Text style={[s.cardSub, { color: "rgba(255,255,255,0.85)" }]}>Set up parental controls and monitor your children's devices</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[s.card, s.kidCard]} onPress={() => choose("kid")} activeOpacity={0.87}>
        <Text style={s.cardEmoji}>🧒</Text>
        <Text style={s.cardTitle}>I'm a Child</Text>
        <Text style={s.cardSub}>Create your account and connect to your parent's phone</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgLight, justifyContent: "center", padding: Spacing.lg, gap: 20 },
  logo: { fontSize: FontSize.xxl, fontWeight: "900", color: Colors.primary, textAlign: "center" },
  heading: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", marginBottom: 12 },
  card: { borderRadius: Radius.xl, padding: Spacing.xl, alignItems: "center", gap: 10, ...Shadow.md },
  parentCard: { backgroundColor: Colors.primary },
  kidCard: { backgroundColor: Colors.surfaceLight, borderWidth: 2, borderColor: Colors.primary + "55" },
  cardEmoji: { fontSize: 52 },
  cardTitle: { fontSize: FontSize.lg, fontWeight: "900", color: Colors.textPrimary },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 19 },
});

// Override card text colours so both are readable
const _fix = StyleSheet.create({});
// parentCard is dark → white text
// kidCard is white → normal text
// Done via inline: see cardTitle / cardSub — they're always textPrimary/Secondary
// For parent card we need white. Patch below.
