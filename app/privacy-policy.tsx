import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Colors, FontSize, Radius, Spacing } from "../lib/theme";

const LAST_UPDATED = "May 2025";

const SECTIONS = [
  {
    title: "1. Who We Are",
    body: `Spinini ("we", "us", "our") is a family companion app designed to help parents manage screen time, chores, and communication for their children. We are committed to protecting the privacy of all users, especially children.`,
  },
  {
    title: "2. Information We Collect",
    body: `We collect only what's needed to provide the service:

• Family profiles (names, ages, PINs stored locally on your device)
• Usage data (screen time, chore completions, behavior points — stored locally)
• AI chat messages (sent to OpenRouter API to generate replies — not stored permanently)
• Device information (OS version, device type for compatibility)

We do NOT collect: Social Security Numbers, payment card numbers, precise location without permission, or any biometric data.`,
  },
  {
    title: "3. Children's Privacy (COPPA)",
    body: `Spinini is designed for families with children under 13. We comply fully with the Children's Online Privacy Protection Act (COPPA):

• All data is stored locally on the parent's device by default
• We do not collect personal information from children without verifiable parental consent
• Parents can review and delete all data at any time in Settings → Data & Storage
• AI Buddy chat messages are sent to a third-party AI service (OpenRouter) for response generation only — they are not used for advertising or profiling
• We do not sell or share children's data with advertisers or data brokers`,
  },
  {
    title: "4. How We Use Data",
    body: `Your data is used only to:
• Operate the app features (chores, rewards, AI buddy, etc.)
• Generate AI responses (messages sent to OpenRouter API)
• Sync family data between parent and child devices (if cloud backup enabled)

We never use your data for advertising, sell it to third parties, or share it with analytics platforms.`,
  },
  {
    title: "5. Data Storage & Security",
    body: `• All family data is stored locally on your device using AsyncStorage
• Cloud backup (if enabled) uses encrypted transmission
• AI messages are transmitted over HTTPS to our server, then to OpenRouter
• Your OpenRouter API key is stored server-side only — never in the app
• We recommend setting a strong Parent PIN to protect parental controls`,
  },
  {
    title: "6. Third-Party Services",
    body: `Spinini uses the following third-party services:
• OpenRouter (AI responses) — see openrouter.ai/privacy
• Expo / EAS (app delivery) — see expo.dev/privacy
• Railway (server hosting, if using cloud features) — see railway.app/legal/privacy

We have data processing agreements with these providers and they do not receive children's personal information beyond what's necessary to operate.`,
  },
  {
    title: "7. Your Rights",
    body: `You have the right to:
• Access all data stored in the app (Settings → Data & Storage)
• Delete your family's data at any time (Settings → Data & Storage → Delete All Data)
• Opt out of AI features entirely (Settings → AI Features → Disable)
• Request data deletion by contacting us at privacy@famkids.app

For GDPR users (EU/UK): You also have rights to data portability and to object to processing. Contact us at privacy@famkids.app.`,
  },
  {
    title: "8. Data Retention",
    body: `• Local data is retained until you delete the app or use "Delete All Data" in Settings
• AI conversation logs are not retained on our servers beyond the current session
• We do not maintain server-side databases of user content`,
  },
  {
    title: "9. Changes to This Policy",
    body: `We may update this Privacy Policy occasionally. We will notify you of significant changes through an in-app notification. Continued use of Spinini after changes constitutes acceptance.`,
  },
  {
    title: "10. Contact Us",
    body: `For privacy questions, data requests, or concerns:\n\nEmail: privacy@famkids.app\nWebsite: famkids.app/privacy`,
  },
];

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Privacy Policy</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Spinini Privacy Policy</Text>
        <Text style={styles.updated}>Last updated: {LAST_UPDATED}</Text>
        <Text style={styles.intro}>
          Your family's privacy is important to us. This policy explains what data Spinini collects, why, and how it is protected.
        </Text>

        {SECTIONS.map(s => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}

        <View style={styles.badge}>
          <Text style={styles.badgeText}>🏛️ COPPA Compliant · 🔒 GDPR Ready · 🚫 No Ads</Text>
        </View>

        <Text style={styles.footer}>© 2025 Spinini. All rights reserved.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bgLight },
  topBar:  {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surfaceLight, borderBottomWidth: 1, borderColor: Colors.border,
  },
  backBtn:    { width: 60 },
  backText:   { color: Colors.primary, fontWeight: "700", fontSize: FontSize.base },
  topTitle:   { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },

  scroll:   { flex: 1 },
  content:  { padding: Spacing.lg, paddingBottom: 60 },
  heading:  { fontSize: FontSize.xl, fontWeight: "900", color: Colors.primary, marginBottom: 4 },
  updated:  { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  intro:    { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 24, marginBottom: Spacing.lg },

  section:      { marginBottom: Spacing.lg },
  sectionTitle: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary, marginBottom: 8 },
  sectionBody:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 22 },

  badge:     {
    backgroundColor: Colors.success + "15", borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: "center", marginVertical: Spacing.lg,
    borderWidth: 1, borderColor: Colors.success + "40",
  },
  badgeText: { color: Colors.success, fontWeight: "700", fontSize: FontSize.sm },
  footer:    { color: Colors.textSecondary, fontSize: FontSize.xs, textAlign: "center" },
});
