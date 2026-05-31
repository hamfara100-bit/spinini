import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso } from "../../../lib/utils";

export default function WebAllowlistScreen() {
  const { state, dispatch } = useData();
  const [kidId, setKidId] = useState(state.kids[0]?.profile.id ?? "");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const kid = state.kids.find(k => k.profile.id === kidId);

  function addSite() {
    if (!url.trim() || !kidId) return;
    dispatch({ type: "ADD_WEBSITE_RULE", kidId, rule: { id: uid(), url: url.trim(), label: label.trim() || url.trim(), allowed: true, addedAt: nowIso() } });
    setUrl(""); setLabel("");
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🌐 Web Allowlist</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
        {state.kids.map(k => (
          <TouchableOpacity key={k.profile.id} style={[styles.kidTab, kidId === k.profile.id && styles.kidTabActive]} onPress={() => setKidId(k.profile.id)}>
            <Text style={[styles.kidTabText, kidId === k.profile.id && styles.kidTabTextActive]}>{k.profile.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.form}>
        <TextInput style={styles.input} value={url} onChangeText={setUrl} placeholder="https://www.example.com" autoCapitalize="none" keyboardType="url" />
        <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Label (e.g. Khan Academy)" />
        <TouchableOpacity style={styles.addBtn} onPress={addSite} disabled={!url.trim()}><Text style={styles.addBtnText}>+ Add Site</Text></TouchableOpacity>
      </View>
      {(kid?.rules.webAllowlist ?? []).map(site => (
        <View key={site.id} style={styles.siteCard}>
          <Text style={styles.siteLabel}>{site.label}</Text>
          <Text style={styles.siteUrl}>{site.url}</Text>
          <TouchableOpacity onPress={() => dispatch({ type: "REMOVE_WEBSITE_RULE", kidId, ruleId: site.id })}><Text style={styles.remove}>Remove</Text></TouchableOpacity>
        </View>
      ))}
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  kidTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight, marginRight: 8 },
  kidTabActive: { backgroundColor: Colors.primary },
  kidTabText: { fontWeight: "600", color: Colors.textSecondary },
  kidTabTextActive: { color: "#fff" },
  form: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm, gap: 8 },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.base },
  addBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", padding: Spacing.sm },
  addBtnText: { color: "#fff", fontWeight: "700" },
  siteCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  siteLabel: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  siteUrl: { fontSize: FontSize.sm, color: Colors.textSecondary },
  remove: { color: Colors.error, fontSize: FontSize.sm, fontWeight: "600", marginTop: 4 },
});
