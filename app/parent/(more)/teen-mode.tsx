import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView } from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";

const TEEN_FEATURES = [
  {
    emoji: "📊",
    title: "Usage Transparency",
    desc: "Teen can see their own screen time stats and trends",
  },
  {
    emoji: "🤝",
    title: "Self-Management Focus",
    desc: "Hard locks are replaced with gentle nudges and conversations",
  },
  {
    emoji: "⏰",
    title: "Flexible Limits",
    desc: "Screen time limits become soft — teen gets reminders instead of hard cutoffs",
  },
  {
    emoji: "🎯",
    title: "Goal Setting",
    desc: "Teen can set their own weekly goals and track progress",
  },
  {
    emoji: "🔒",
    title: "Reduced Content Blocking",
    desc: "Strict web filters loosen to allow age-appropriate teen content",
  },
  {
    emoji: "📱",
    title: "Privacy Mode",
    desc: "Journal and messages become private (not visible to parents)",
  },
];

export default function TeenModeScreen() {
  const { state, dispatch } = useData();
  const [selectedKidId, setSelectedKidId] = useState(state.kids[0]?.profile.id ?? "");

  const kid = state.kids.find(k => k.profile.id === selectedKidId);
  const teenMode = kid?.rules.teenMode ?? false;

  function toggle(enabled: boolean) {
    if (!selectedKidId) return;
    dispatch({ type: "SET_TEEN_MODE", kidId: selectedKidId, enabled });
  }

  if (state.kids.length === 0) {
    return (
      <ScreenContainer>
        <Text style={styles.empty}>No kids added yet.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🧑 Teen Mode</Text>
      <Text style={styles.sub}>
        Designed for kids 13–17. Shifts from hard controls to transparency and self-management, building trust and independence.
      </Text>

      {/* Kid picker */}
      {state.kids.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
          {state.kids.map(k => (
            <TouchableOpacity
              key={k.profile.id}
              style={[styles.kidChip, selectedKidId === k.profile.id && styles.kidChipActive]}
              onPress={() => setSelectedKidId(k.profile.id)}
            >
              <Text style={[styles.kidChipText, selectedKidId === k.profile.id && styles.kidChipTextActive]}>
                {k.profile.name} {k.profile.age >= 13 ? "" : `(${k.profile.age})`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {kid && kid.profile.age < 13 && (
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>
            ⚠️ {kid.profile.name} is {kid.profile.age} years old. Teen Mode is designed for ages 13+. You can still enable it, but full parental controls are recommended for younger kids.
          </Text>
        </View>
      )}

      <View style={styles.toggleCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleTitle}>Teen Mode</Text>
          <Text style={styles.toggleSub}>{teenMode ? "Enabled — softer controls, more trust" : "Disabled — full parental controls active"}</Text>
        </View>
        <Switch
          value={teenMode}
          onValueChange={toggle}
          trackColor={{ true: Colors.primary }}
          thumbColor="#fff"
        />
      </View>

      <Text style={styles.sectionLabel}>WHAT TEEN MODE DOES</Text>
      {TEEN_FEATURES.map(f => (
        <View key={f.title} style={[styles.featureCard, !teenMode && styles.featureCardDisabled]}>
          <Text style={styles.featureEmoji}>{f.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.featureTitle}>{f.title}</Text>
            <Text style={styles.featureDesc}>{f.desc}</Text>
          </View>
          {teenMode ? <Text style={styles.checkMark}>✓</Text> : <Text style={styles.lockIcon}>○</Text>}
        </View>
      ))}

      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>💡 Parenting Tips</Text>
        <Text style={styles.tipsText}>
          {`• Have a conversation with your teen before enabling this mode\n• Review usage reports together weekly\n• Teen Mode works best as a reward for demonstrated responsibility\n• You can disable it anytime if trust is broken`}
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
  kidChip: { borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  kidChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  kidChipText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  kidChipTextActive: { color: "#fff" },
  warningCard: { backgroundColor: "#FFFBEB", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1.5, borderColor: "#F59E0B" },
  warningText: { fontSize: FontSize.sm, color: "#92400E", lineHeight: 20 },
  toggleCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm },
  toggleTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  toggleSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  featureCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  featureCardDisabled: { opacity: 0.5 },
  featureEmoji: { fontSize: 26 },
  featureTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  featureDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  checkMark: { fontSize: 18, color: Colors.success, fontWeight: "700" },
  lockIcon: { fontSize: 18, color: Colors.border },
  tipsCard: { backgroundColor: "#F0FDF4", borderRadius: Radius.xl, padding: Spacing.md, marginTop: Spacing.sm, borderWidth: 1, borderColor: Colors.success },
  tipsTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.success, marginBottom: 8 },
  tipsText: { fontSize: FontSize.xs, color: "#166534", lineHeight: 20 },
  empty: { textAlign: "center", color: Colors.textMuted, marginTop: 40 },
});
