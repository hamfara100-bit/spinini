import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "../../components/screen-container";
import { Colors, FontSize, Radius, Spacing } from "../../lib/theme";
import { useData } from "../../lib/data/store";
import { nowIso } from "../../lib/utils";

const CONSENTS = [
  {
    id: "terms",
    title: "Terms of Service",
    body: "I agree to the Spinini Terms of Service, including acceptable use and account responsibilities.",
    required: true,
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    body: "I have read and agree to the Privacy Policy. I understand how Spinini collects, uses, and protects family data.",
    required: true,
  },
  {
    id: "coppa",
    title: "Parental Consent (COPPA)",
    body: "I confirm I am the parent or legal guardian of the children who will use this app. I consent to Spinini collecting limited data (device info, usage patterns) to provide parental controls. No child data is sold or shared with advertisers.",
    required: true,
  },
  {
    id: "ai",
    title: "AI Features Consent",
    body: "I understand that AI chat features (AI Buddy, Parent Agent) send messages to OpenRouter's API. Conversations are not stored on external servers beyond what's needed to generate a reply.",
    required: true,
  },
  {
    id: "marketing",
    title: "Feature Updates (Optional)",
    body: "I'd like to receive occasional emails about new features and family safety tips.",
    required: false,
  },
];

export default function ConsentScreen() {
  const router = useRouter();
  const { dispatch } = useData();
  const [agreed, setAgreed] = useState<Record<string, boolean>>({});

  const required = CONSENTS.filter(c => c.required);
  const allRequiredAgreed = required.every(c => agreed[c.id]);

  function proceed() {
    if (!allRequiredAgreed) return;
    dispatch({
      type: "SET_PARENT_SETTINGS",
      payload: {
        consentGiven: true,
        consentDate: nowIso(),
        marketingOptIn: !!agreed.marketing,
      },
    });
    router.replace("/setup/permissions");
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Text style={styles.emoji}>🛡️</Text>
        <Text style={styles.title}>Your Privacy & Consent</Text>
        <Text style={styles.sub}>
          Spinini is designed for families. Before we begin, please review and agree to the following.
        </Text>
      </View>

      {CONSENTS.map(c => (
        <View key={c.id} style={[styles.card, agreed[c.id] && styles.cardAgreed]}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle}>{c.title}</Text>
                {!c.required && (
                  <View style={styles.optionalBadge}>
                    <Text style={styles.optionalText}>Optional</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardBody}>{c.body}</Text>
            </View>
            <Switch
              value={!!agreed[c.id]}
              onValueChange={v => setAgreed(prev => ({ ...prev, [c.id]: v }))}
              trackColor={{ false: Colors.border, true: Colors.primary + "80" }}
              thumbColor={agreed[c.id] ? Colors.primary : "#ccc"}
            />
          </View>
        </View>
      ))}

      <View style={styles.linksRow}>
        <TouchableOpacity onPress={() => router.push("/privacy-policy" as any)}>
          <Text style={styles.link}>Read Privacy Policy →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL("https://famkids.app/terms")}>
          <Text style={styles.link}>Terms of Service →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.coppaBox}>
        <Text style={styles.coppaTitle}>🏛️ COPPA Compliance</Text>
        <Text style={styles.coppaText}>
          Spinini complies with the Children's Online Privacy Protection Act (COPPA). We do not collect personal information from children under 13 without verifiable parental consent. All child-facing features are designed to be safe and age-appropriate.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.btn, !allRequiredAgreed && styles.btnDisabled]}
        onPress={proceed}
        disabled={!allRequiredAgreed}
      >
        <Text style={styles.btnText}>I Agree — Continue →</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        You can review our privacy practices at any time in Settings → Help & Privacy.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header:   { alignItems: "center", paddingVertical: Spacing.lg },
  emoji:    { fontSize: 56 },
  title:    { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, textAlign: "center", marginTop: Spacing.sm },
  sub:      { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: "center", marginTop: Spacing.sm, lineHeight: 22 },

  card:      {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 2, borderColor: Colors.border,
  },
  cardAgreed: { borderColor: Colors.primary + "60", backgroundColor: Colors.primary + "06" },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  titleRow:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardTitle:  { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  cardBody:   { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  optionalBadge: { backgroundColor: Colors.textSecondary + "20", borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  optionalText:  { fontSize: 10, color: Colors.textSecondary, fontWeight: "600" },

  linksRow: { flexDirection: "row", justifyContent: "space-around", marginVertical: Spacing.md },
  link:     { color: Colors.primary, fontWeight: "600", fontSize: FontSize.sm },

  coppaBox:   {
    backgroundColor: Colors.info + "12", borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: Colors.info + "40",
  },
  coppaTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.info, marginBottom: 6 },
  coppaText:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  btn:         { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", padding: 16, marginBottom: Spacing.md },
  btnDisabled: { opacity: 0.4 },
  btnText:     { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  footer:      { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: "center", lineHeight: 18, marginBottom: Spacing.xl },
});
