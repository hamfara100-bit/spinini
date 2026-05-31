import React from "react";
import { View, Text, StyleSheet, Switch } from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";

export default function FamilyFilterScreen() {
  const { state, dispatch } = useData();
  const { familyFilter } = state;
  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🛡️ Family Filter</Text>
      <Text style={styles.sub}>Third-party parental control integration status.</Text>
      <View style={styles.card}>
        <View style={styles.row}><View><Text style={styles.cardTitle}>Android Filter</Text><Text style={styles.cardSub}>e.g. Google Family Link, Bark</Text></View><Switch value={familyFilter.androidEnabled} onValueChange={v => dispatch({ type: "FAMILY_FILTER_UPDATE", payload: { androidEnabled: v } })} trackColor={{ true: Colors.primary }} /></View>
      </View>
      <View style={styles.card}>
        <View style={styles.row}><View><Text style={styles.cardTitle}>iOS Filter</Text><Text style={styles.cardSub}>e.g. Screen Time, Circle</Text></View><Switch value={familyFilter.iosEnabled} onValueChange={v => dispatch({ type: "FAMILY_FILTER_UPDATE", payload: { iosEnabled: v } })} trackColor={{ true: Colors.primary }} /></View>
      </View>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg },
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  cardTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
