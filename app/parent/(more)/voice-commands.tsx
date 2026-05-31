import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Linking, Alert, Platform,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";

// Deep link base — must match the scheme in app.config.ts
const SCHEME = "famkids";

interface VoiceCommand {
  emoji: string;
  title: string;
  description: string;
  googlePhrase: (kidName: string) => string;
  applePhrase: (kidName: string) => string;
  deepLink: (kidId: string) => string;
}

const VOICE_COMMANDS: VoiceCommand[] = [
  {
    emoji: "🍽️",
    title: "Dinner / Attention Call",
    description: "Send the kid a message ping so they know to come downstairs.",
    googlePhrase: name => `Hey Google, tell ${name} dinner is ready`,
    applePhrase:  name => `Hey Siri, tell ${name} dinner is ready`,
    deepLink:     id   => `${SCHEME}://ping/${id}?message=Dinner+is+ready%21`,
  },
  {
    emoji: "🔒",
    title: "Lock Device",
    description: "Instantly lock the kid's device with a remote lock.",
    googlePhrase: name => `Hey Google, lock ${name}'s device`,
    applePhrase:  name => `Hey Siri, lock ${name}'s device`,
    deepLink:     id   => `${SCHEME}://lock/${id}`,
  },
  {
    emoji: "🔔",
    title: "Send Alarm Ping",
    description: "Trigger a loud alarm ping that won't stop until the kid acknowledges it.",
    googlePhrase: name => `Hey Google, alarm ${name}`,
    applePhrase:  name => `Hey Siri, alarm ${name}`,
    deepLink:     id   => `${SCHEME}://alarm/${id}`,
  },
  {
    emoji: "✅",
    title: "Check In",
    description: "Ask the app to send a check-in notification to the kid.",
    googlePhrase: name => `Hey Google, check in on ${name}`,
    applePhrase:  name => `Hey Siri, check in on ${name}`,
    deepLink:     id   => `${SCHEME}://ping/${id}?message=Check+in+with+me+please!`,
  },
  {
    emoji: "🏠",
    title: "Come Home",
    description: "Send a 'come home now' message.",
    googlePhrase: name => `Hey Google, tell ${name} to come home`,
    applePhrase:  name => `Hey Siri, tell ${name} to come home`,
    deepLink:     id   => `${SCHEME}://ping/${id}?message=Please+come+home+now!`,
  },
  {
    emoji: "🛌",
    title: "Bedtime",
    description: "Send a bedtime reminder and lock the device.",
    googlePhrase: name => `Hey Google, send ${name} to bed`,
    applePhrase:  name => `Hey Siri, bedtime for ${name}`,
    deepLink:     id   => `${SCHEME}://lock/${id}?reason=Bedtime`,
  },
];

const GOOGLE_SETUP_STEPS = [
  "Open the Google app (or Google Assistant) on your phone.",
  "Tap your profile picture → Settings → Assistant → Shortcuts.",
  "Tap '+' to add a new shortcut.",
  "In 'When I say…' type the phrase shown below.",
  "In 'Google Assistant should…' paste the deep link URL.",
  "Save and test by saying the phrase to your Google Assistant.",
];

const APPLE_SETUP_STEPS = [
  "Open the Shortcuts app on your iPhone or iPad.",
  "Tap '+' in the top right to create a new shortcut.",
  "Tap 'Add Action' → search for 'Open URLs'.",
  "Paste the deep link URL into the URL field.",
  "Tap the shortcut name at the top and type the Siri phrase.",
  "Tap 'Done', then say 'Hey Siri, [phrase]' to test.",
];

export default function VoiceCommandsScreen() {
  const { state } = useData();
  const [selectedKidId, setSelectedKidId] = useState(state.kids[0]?.profile.id ?? "");
  const [platform, setPlatform] = useState<"google" | "apple">("google");
  const [expandedCmd, setExpandedCmd] = useState<number | null>(null);

  const kid = state.kids.find(k => k.profile.id === selectedKidId);
  const kidName = kid?.profile.name ?? "Kid";

  function copyDeepLink(cmd: VoiceCommand) {
    const url = cmd.deepLink(selectedKidId);
    Linking.canOpenURL(url)
      .then(() => {
        Alert.alert(
          "Deep Link",
          `Copy this URL into your ${platform === "google" ? "Google Assistant shortcut" : "Shortcuts app"}:\n\n${url}`,
          [{ text: "OK" }],
        );
      })
      .catch(() => {
        Alert.alert("URL", url);
      });
  }

  function testDeepLink(cmd: VoiceCommand) {
    const url = cmd.deepLink(selectedKidId);
    Linking.openURL(url).catch(() =>
      Alert.alert("Test Failed", "Could not open the deep link. Make sure the app is installed.")
    );
  }

  const steps = platform === "google" ? GOOGLE_SETUP_STEPS : APPLE_SETUP_STEPS;

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🎙️ Voice Commands</Text>
      <Text style={styles.sub}>
        Use Google Assistant or Siri to control the app hands-free.
      </Text>

      {/* Kid selector */}
      <Text style={styles.sectionLabel}>Which child?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kidRow}>
        {state.kids.map(k => (
          <TouchableOpacity
            key={k.profile.id}
            style={[styles.kidChip, selectedKidId === k.profile.id && styles.kidChipActive]}
            onPress={() => setSelectedKidId(k.profile.id)}
          >
            <Text style={[styles.kidChipText, selectedKidId === k.profile.id && styles.kidChipTextActive]}>
              {k.profile.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Platform toggle */}
      <Text style={styles.sectionLabel}>Platform</Text>
      <View style={styles.platformRow}>
        <TouchableOpacity
          style={[styles.platformBtn, platform === "google" && styles.platformBtnActive]}
          onPress={() => setPlatform("google")}
        >
          <Text style={[styles.platformBtnText, platform === "google" && styles.platformBtnTextActive]}>
            🔍 Google Assistant
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.platformBtn, platform === "apple" && styles.platformBtnActive]}
          onPress={() => setPlatform("apple")}
        >
          <Text style={[styles.platformBtnText, platform === "apple" && styles.platformBtnTextActive]}>
            🍎 Apple Siri
          </Text>
        </TouchableOpacity>
      </View>

      {/* Setup steps */}
      <View style={styles.setupCard}>
        <Text style={styles.setupTitle}>
          {platform === "google" ? "📱 Google Assistant Setup" : "📱 Siri Shortcuts Setup"}
        </Text>
        {steps.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepBullet}><Text style={styles.stepNum}>{i + 1}</Text></View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      {/* Command list */}
      <Text style={styles.sectionLabel}>Available Commands for {kidName}</Text>

      {VOICE_COMMANDS.map((cmd, i) => {
        const phrase = platform === "google" ? cmd.googlePhrase(kidName) : cmd.applePhrase(kidName);
        const isExpanded = expandedCmd === i;
        return (
          <TouchableOpacity
            key={i}
            style={styles.cmdCard}
            onPress={() => setExpandedCmd(isExpanded ? null : i)}
            activeOpacity={0.85}
          >
            <View style={styles.cmdHeader}>
              <Text style={styles.cmdEmoji}>{cmd.emoji}</Text>
              <View style={styles.cmdInfo}>
                <Text style={styles.cmdTitle}>{cmd.title}</Text>
                <Text style={styles.cmdDesc}>{cmd.description}</Text>
              </View>
              <Text style={styles.cmdChevron}>{isExpanded ? "▲" : "▼"}</Text>
            </View>

            {isExpanded && (
              <View style={styles.cmdExpanded}>
                <View style={styles.phraseBox}>
                  <Text style={styles.phraseLabel}>Say:</Text>
                  <Text style={styles.phraseText}>"{phrase}"</Text>
                </View>

                <View style={styles.linkBox}>
                  <Text style={styles.linkLabel}>Deep link URL:</Text>
                  <Text style={styles.linkUrl} numberOfLines={2}>{cmd.deepLink(selectedKidId)}</Text>
                </View>

                <View style={styles.cmdBtns}>
                  <TouchableOpacity style={styles.copyBtn} onPress={() => copyDeepLink(cmd)}>
                    <Text style={styles.copyBtnText}>📋 Show URL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.testBtn} onPress={() => testDeepLink(cmd)}>
                    <Text style={styles.testBtnText}>▶ Test</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>💡 How it works</Text>
        <Text style={styles.noteText}>
          Voice assistants don't directly control apps — instead, they open a special URL
          (deep link) that launches Spinini and performs the action automatically.{"\n\n"}
          Each command above has a unique deep link. Paste it into your assistant's shortcut
          settings and assign a phrase. When you say the phrase, the app opens and acts instantly.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title:       { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub:         { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  sectionLabel:{ fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, marginBottom: 8, marginTop: Spacing.sm },

  // Kid chips
  kidRow:          { marginBottom: Spacing.sm, flexGrow: 0 },
  kidChip:         { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight, marginRight: 8 },
  kidChipActive:   { backgroundColor: Colors.primary },
  kidChipText:     { fontWeight: "600", color: Colors.textSecondary },
  kidChipTextActive: { color: "#fff" },

  // Platform toggle
  platformRow:        { flexDirection: "row", gap: 10, marginBottom: Spacing.sm },
  platformBtn:        { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: Radius.md, backgroundColor: Colors.cardLight, borderWidth: 2, borderColor: "transparent" },
  platformBtnActive:  { backgroundColor: Colors.primary + "15", borderColor: Colors.primary },
  platformBtnText:    { fontWeight: "600", color: Colors.textSecondary, fontSize: FontSize.sm },
  platformBtnTextActive: { color: Colors.primary },

  // Setup steps
  setupCard:   { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm, marginBottom: Spacing.md },
  setupTitle:  { fontSize: FontSize.base, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.sm },
  stepRow:     { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  stepBullet:  { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", marginRight: 10, marginTop: 1 },
  stepNum:     { color: "#fff", fontWeight: "800", fontSize: 12 },
  stepText:    { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },

  // Command cards
  cmdCard:      { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm, marginBottom: Spacing.sm },
  cmdHeader:    { flexDirection: "row", alignItems: "center" },
  cmdEmoji:     { fontSize: 28, marginRight: 12 },
  cmdInfo:      { flex: 1 },
  cmdTitle:     { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  cmdDesc:      { fontSize: FontSize.sm, color: Colors.textSecondary },
  cmdChevron:   { color: Colors.textSecondary, fontSize: 12, marginLeft: 8 },
  cmdExpanded:  { marginTop: Spacing.sm, gap: 10 },

  phraseBox:    { backgroundColor: Colors.primary + "12", borderRadius: Radius.md, padding: Spacing.sm },
  phraseLabel:  { fontSize: 11, fontWeight: "700", color: Colors.primary, marginBottom: 4 },
  phraseText:   { fontSize: FontSize.base, color: Colors.primary, fontWeight: "600", fontStyle: "italic" },

  linkBox:      { backgroundColor: Colors.cardLight, borderRadius: Radius.md, padding: Spacing.sm },
  linkLabel:    { fontSize: 11, fontWeight: "700", color: Colors.textSecondary, marginBottom: 4 },
  linkUrl:      { fontSize: FontSize.sm, color: Colors.textSecondary, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },

  cmdBtns:      { flexDirection: "row", gap: 10 },
  copyBtn:      { flex: 1, backgroundColor: Colors.cardLight, borderRadius: Radius.full, alignItems: "center", padding: 10 },
  copyBtnText:  { fontWeight: "600", color: Colors.textSecondary },
  testBtn:      { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", padding: 10 },
  testBtnText:  { fontWeight: "700", color: "#fff" },

  // Info note
  noteCard:    { backgroundColor: "#F59E0B18", borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.sm, marginBottom: Spacing.xl },
  noteTitle:   { fontSize: FontSize.base, fontWeight: "700", color: "#D97706", marginBottom: 8 },
  noteText:    { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
});
