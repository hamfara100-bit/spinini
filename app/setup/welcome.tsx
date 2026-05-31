import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "../../components/screen-container";
import { Button } from "../../components/ui/primitives";
import { Mascot } from "../../components/mascot";
import { Colors, FontSize, Radius, Spacing } from "../../lib/theme";

const FEATURES = [
  { emoji: "🤖", label: "AI Buddy", desc: "Safe AI companion kids actually love" },
  { emoji: "🏆", label: "Chores & Rewards", desc: "Earn screen time by completing tasks" },
  { emoji: "⏱️", label: "Screen Time Controls", desc: "Smart limits without the fights" },
  { emoji: "🎨", label: "Creative Tools", desc: "Drawing, stories, coloring & more" },
  { emoji: "📍", label: "Location & Safety", desc: "Know where they are, always" },
  { emoji: "📊", label: "Weekly Insights", desc: "Thriving Score tracks their wellbeing" },
];

const TRUST_BADGES = [
  { emoji: "🏛️", label: "COPPA\nCompliant" },
  { emoji: "🔒", label: "GDPR\nReady" },
  { emoji: "🚫", label: "Zero\nAds Ever" },
  { emoji: "📱", label: "Local-First\nData" },
  { emoji: "🤖", label: "AI Safety\nFiltered" },
];

export default function Welcome() {
  const router = useRouter();
  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Mascot type="owl" size={110} animate />
        <Text style={styles.headline}>Raise kids who{"\n"}thrive online and off.</Text>
        <Text style={styles.sub}>
          The family companion app with AI — parental controls your kids won't resent.
        </Text>
      </View>

      {/* Feature grid */}
      <View style={styles.featureGrid}>
        {FEATURES.map(f => (
          <View key={f.label} style={styles.featureCard}>
            <Text style={styles.featureEmoji}>{f.emoji}</Text>
            <Text style={styles.featureLabel}>{f.label}</Text>
            <Text style={styles.featureDesc}>{f.desc}</Text>
          </View>
        ))}
      </View>

      {/* Setup time badge */}
      <View style={styles.setupBadge}>
        <Text style={styles.setupText}>⚡ Set up in under 5 minutes · No account required to start</Text>
      </View>

      <Button
        label="Get Started — It's Free →"
        onPress={() => router.push("/setup/consent")}
        size="lg"
        fullWidth
        style={{ marginHorizontal: Spacing.lg, marginBottom: Spacing.lg }}
      />

      {/* Trust badges */}
      <View style={styles.trustRow}>
        {TRUST_BADGES.map(b => (
          <View key={b.label} style={styles.trustBadge}>
            <Text style={styles.trustEmoji}>{b.emoji}</Text>
            <Text style={styles.trustLabel}>{b.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>
        No credit card required · Cancel anytime · 14-day free trial of premium
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, backgroundColor: Colors.bgLight, paddingBottom: 40 },

  hero:     { alignItems: "center", paddingTop: 60, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  headline: { fontSize: 28, fontWeight: "900", color: Colors.textPrimary, textAlign: "center", marginTop: Spacing.lg, lineHeight: 34 },
  sub:      { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: "center", marginTop: Spacing.sm, lineHeight: 24 },

  featureGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: Spacing.md, gap: 10, marginBottom: Spacing.md },
  featureCard: {
    width: "47%", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg,
    padding: Spacing.sm, gap: 4,
  },
  featureEmoji: { fontSize: 26 },
  featureLabel: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  featureDesc:  { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },

  setupBadge: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    backgroundColor: Colors.success + "15", borderRadius: Radius.lg,
    padding: Spacing.sm, alignItems: "center", borderWidth: 1, borderColor: Colors.success + "40",
  },
  setupText: { color: Colors.success, fontWeight: "700", fontSize: FontSize.sm, textAlign: "center" },

  trustRow:   { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: Spacing.md, marginTop: Spacing.sm, marginBottom: Spacing.md },
  trustBadge: { alignItems: "center", gap: 4 },
  trustEmoji: { fontSize: 22 },
  trustLabel: { fontSize: 9, color: Colors.textSecondary, textAlign: "center", fontWeight: "600", lineHeight: 12 },

  footer: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: "center", paddingHorizontal: Spacing.lg },
});
