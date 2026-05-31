import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Linking,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { checkForUpdates, APP_VERSION } from "../../../../lib/check-update";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as ImagePicker from "expo-image-picker";
import * as Contacts from "expo-contacts";
import { AudioModule } from "expo-audio";
import { useCameraPermissions } from "expo-camera";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { PinPad } from "../../../../components/pin-pad";
import { GoogleSignIn } from "../../../../components/google-sign-in";
import { KID_SCOPES } from "../../../../lib/google-auth";
import { backupKidToOwnDrive } from "../../../../lib/google-backup";
import { useData } from "../../../../lib/data/store";
import type { GoogleAccount } from "../../../../lib/data/types";
import { getGoogleTokens } from "../../../../lib/secure-tokens";

type Tab = "help" | "privacy";

const CONTACT_EMAIL = "privacy@famkids.app";

const FAQS = [
  // ─── Earning & Rewards ───────────────────────────────────────────────────────
  { q: "How do I earn more screen time?", a: "Complete your chores! When a parent approves them, you get time added to your Time Bank. ⭐" },
  { q: "How do I submit a chore?", a: "Go to ⭐ Rewards → Chores tab, tap the chore, add a note or photo as proof, and tap Done ✓. Your parent reviews it." },
  { q: "What is the Time Bank?", a: "Your screen time savings account. Earn minutes by completing chores and getting good grades. Spend them in the Rewards tab!" },
  { q: "What is the Reward Shop?", a: "🛍️ Go to ⭐ Rewards → Shop tab. Spend your behavior points on rewards your parent created — screen time, real-world prizes, or digital items!" },
  { q: "Can I get rewards for good grades?", a: "Yes! When you add an A+ or A grade, your parent can send you a screen-time bonus. Keep those grades up!" },
  { q: "What is the Morning Routine?", a: "🌅 Your parent may set up a Morning Routine checklist for you — things like brush teeth, make bed, and pack your bag. Check them off each morning to earn bonus points and unlock your screen time for the day!" },
  { q: "Can I ask for extra screen time?", a: "Yes! Tap 📬 Requests on your home screen and send a Borrow Time request to your parent. They can approve extra minutes." },
  // ─── My Reports ─────────────────────────────────────────────────────────────
  { q: "What is My Reports?", a: "📊 My Reports is your personal dashboard! Tap it from your home screen to see:\n• ⭐ Earnings — how much you've earned from chores, bonuses, and allowance\n• 📊 Usage — which apps you used most and how much screen time you had\nPick Last 7 Days, Last 30 Days, or All Time." },
  { q: "How do I see how much I've earned?", a: "Go to 📊 My Reports → ⭐ Earnings tab. You'll see your total earnings, a list of approved chores with points, any behavior bonuses, and your allowance history!" },
  { q: "How do I see my screen time?", a: "Go to 📊 My Reports → 📊 Usage tab. You'll see your total screen time, top apps, feature usage, and a mini chart of the last 14 days." },
  // ─── Family Calendar ─────────────────────────────────────────────────────────
  { q: "What is the Family Calendar?", a: "🗓️ Family Calendar shows a full monthly grid of family events. Tap any day to see what's happening. Events shared with you will show up here!" },
  { q: "Can I add events to the calendar?", a: "Family calendar events are added by parents. You can view events that are shared with you or with everyone in the family." },
  { q: "What do the colored dots on the calendar mean?", a: "Each colored dot on a calendar day represents an event. Tap the day to see the full list with titles and times." },
  // ─── AI Buddy ────────────────────────────────────────────────────────────────
  { q: "How do I talk to my AI Buddy?", a: "Go to the 🤖 AI Buddy button from the home screen and type or say something!" },
  { q: "Can I save what my AI Buddy says?", a: "Yes! Tap 💾 Save on any AI response to keep it. Saved results appear in your AI Results list so you can read them again later." },
  { q: "What is the Story Character?", a: "📖 Ask your AI Buddy to create a story about a character you describe. Say something like 'Make a story about a dragon who loves cooking!' 🐉" },
  // ─── School ──────────────────────────────────────────────────────────────────
  { q: "How do I add my grades?", a: "Go to 🏫 School and tap the 📊 Grades tab. Enter subject, grade, and period. GPA calculates automatically! 🎓" },
  { q: "What is the Homework Helper?", a: "Stuck on homework? Go to 🏫 School → Homework Helper and describe the problem or take a photo of it. The AI will explain how to solve it step-by-step without just giving you the answer! 🧠" },
  // ─── Fun Features ────────────────────────────────────────────────────────────
  { q: "What is the Trophy Room?", a: "🏆 Your Trophy Room is your personal collection of achievement badges! Earn trophies by completing chores, getting great grades, keeping streaks, and hitting milestones. Find it in your profile." },
  { q: "What is the Mood Tracker?", a: "😊 Tap the Mood button to log how you're feeling today with an emoji. It's just for you and your family — no one else sees it!" },
  { q: "What is the Leaderboard?", a: "🏆 The Leaderboard shows the weekly points ranking for all kids in your family. Can you get to the top? 🥇" },
  { q: "How do I add a wish?", a: "Tap 🌟 Wish List and write what you want. Your parents will see it and decide! ✨" },
  { q: "How do I save a drawing?", a: "In 🎨 Create, draw on the canvas and tap 💾 Save. Your drawing is saved and you can edit it later!" },
  { q: "What is the Piggy Bank?", a: "🐷 Piggy Bank tracks your real money — what you earn, spend, and save. Set savings goals!" },
  // ─── Safety ──────────────────────────────────────────────────────────────────
  { q: "Why is my screen locked?", a: "It might be bedtime, school hours, or your daily limit. Ask a parent to help! 🔒" },
  { q: "What happens when I press SOS?", a: "🚨 The SOS button on your home screen sends an emergency alert to your parent with your GPS location. Only use it in a real emergency." },
  { q: "What is Study Mode?", a: "When a parent turns on Study Mode, entertainment apps get blocked. You'll see a blue 📚 Study Mode banner. Focus time!" },
  // ─── Backup ──────────────────────────────────────────────────────────────────
  { q: "What does Google Drive Backup do?", a: "You can link your own Google account to save your journal, drawings, school work, and reading list to your own Google Drive — your personal cloud backup!" },
];

async function requestPerms(requestCamera: () => Promise<any>): Promise<string[]> {
  const missing: string[] = [];
  try { const r = await requestCamera(); if (r.status !== "granted") missing.push("Camera"); } catch {}
  try { const r = await AudioModule.requestRecordingPermissionsAsync(); if (!r.granted) missing.push("Microphone"); } catch {}
  try { const r = await Location.requestForegroundPermissionsAsync(); if (r.status !== "granted") missing.push("Location"); } catch {}
  try { const r = await Notifications.requestPermissionsAsync(); if (r.status !== "granted") missing.push("Notifications"); } catch {}
  try { const r = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (r.status !== "granted") missing.push("Photo Library"); } catch {}
  try { const r = await Contacts.requestPermissionsAsync(); if (r.status !== "granted") missing.push("Contacts"); } catch {}
  return missing;
}

export default function HelpScreen() {
  const { state, dispatch } = useData();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("help");
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState("");
  const [backingUp, setBackingUp] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [, requestCamera] = useCameraPermissions();

  const hasPin = !!state.parentSettings.pin;
  const kid = state.kids.find(k => k.profile.id === id);
  const kidGoogleAccount = kid?.profile.googleAccount;
  const [kidAccessToken, setKidAccessToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!kidGoogleAccount?.id) { setKidAccessToken(null); return; }
    getGoogleTokens(kidGoogleAccount.id).then(t => setKidAccessToken(t?.accessToken ?? null)).catch(() => {});
  }, [kidGoogleAccount?.id]);

  async function handleKidBackup() {
    if (!kid || !kidAccessToken) return;
    setBackingUp(true);
    try {
      await backupKidToOwnDrive(kidAccessToken, kid);
      Alert.alert("✅ Backed Up!", `Your data is saved to Google Drive under "Spinini - ${kid.profile.name}/" 🎉`);
    } catch {
      Alert.alert("Backup Failed", "Couldn't reach Google Drive. Try again later.");
    } finally {
      setBackingUp(false);
    }
  }

  function handleKidGoogleSuccess(account: GoogleAccount) {
    if (!kid) return;
    dispatch({ type: "SET_KID_GOOGLE", kidId: kid.profile.id, account });
  }

  function handleSwitchToParent() {
    if (hasPin) {
      setShowPin(true);
    } else {
      // No PIN is set — still require a tap-through confirmation so kids can't
      // accidentally (or intentionally) switch to parent mode with a single tap.
      Alert.alert(
        "🔒 Parent Access",
        "No parent PIN is set. Are you a parent? Tap Continue to open the parent dashboard, or ask a parent to set a PIN in Settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Continue as Parent →", onPress: () => router.push("/parent/dashboard") },
        ]
      );
    }
  }

  async function checkPin(pin: string) {
    const hashed = await hashPin(pin);
    if (hashed === state.parentSettings.pin) {
      setShowPin(false); setPinError("");
      router.push("/parent/dashboard");
    } else {
      setPinError("Wrong PIN. Try again.");
    }
  }

  async function handleCheckPerms() {
    setChecking(true);
    const missing = await requestPerms(requestCamera);
    setChecking(false);
    if (missing.length === 0) {
      Alert.alert("✅ All Good!", "The app has all the permissions it needs.");
    } else {
      Alert.alert("⚠️ Some permissions missing", `These couldn't be enabled:\n• ${missing.join("\n• ")}\n\nAsk a parent to check device Settings.`);
    }
  }

  if (showPin) {
    return (
      <ScreenContainer>
        <Text style={styles.pinTitle}>🔒 Parent Mode</Text>
        <Text style={styles.pinSub}>Enter your parent PIN to switch</Text>
        <PinPad onComplete={checkPin} error={pinError} />
        <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowPin(false); setPinError(""); }}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🛡️ Help & Privacy</Text>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === "help" && styles.tabActive]} onPress={() => setTab("help")}>
          <Text style={[styles.tabText, tab === "help" && styles.tabTextActive]}>❓ Help</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "privacy" && styles.tabActive]} onPress={() => setTab("privacy")}>
          <Text style={[styles.tabText, tab === "privacy" && styles.tabTextActive]}>🔒 Privacy</Text>
        </TouchableOpacity>
      </View>

      {tab === "help" ? (
        <>
          {/* ── Check for Updates ── */}
          <TouchableOpacity
            style={[styles.updateBtn, updating && { opacity: 0.7 }]}
            onPress={() => checkForUpdates(setUpdating)}
            disabled={updating}
            activeOpacity={0.85}
          >
            {updating ? (
              <ActivityIndicator color="#fff" size="small" style={{ marginVertical: 4 }} />
            ) : (
              <>
                <Text style={styles.updateBtnIcon}>🔄</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.updateBtnTitle}>Check for Updates</Text>
                  <Text style={styles.updateBtnSub}>Version {APP_VERSION} installed</Text>
                </View>
                <Text style={styles.updateBtnArrow}>›</Text>
              </>
            )}
          </TouchableOpacity>

          {/* ── Switch to Parent — prominent section ── */}
          <View style={styles.parentSection}>
            <View style={styles.parentSectionHeader}>
              <Text style={styles.parentSectionIcon}>👨‍👩‍👧</Text>
              <Text style={styles.parentSectionTitle}>Parent Access</Text>
            </View>
            <Text style={styles.parentSectionSub}>
              Switch to the parent dashboard to change settings, approve chores, and more.
            </Text>
            <TouchableOpacity style={styles.switchBtn} onPress={handleSwitchToParent} activeOpacity={0.85}>
              <Text style={styles.switchBtnEmoji}>🔒</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchBtnTitle}>Switch to Parent Mode</Text>
                <Text style={styles.switchBtnSub}>{hasPin ? "Enter your PIN to continue" : "Tap to open parent dashboard"}</Text>
              </View>
              <Text style={styles.switchBtnArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Check permissions */}
          <TouchableOpacity style={[styles.permBtn, checking && { opacity: 0.7 }]} onPress={handleCheckPerms} disabled={checking}>
            {checking ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.permBtnText}>🔐 Check App Permissions</Text>}
          </TouchableOpacity>
          <Text style={styles.permHint}>Tap to make sure everything the app needs is turned on.</Text>

          {FAQS.map((faq, i) => (
            <View key={i} style={styles.card}>
              <Text style={styles.question}>{faq.q}</Text>
              <Text style={styles.answer}>{faq.a}</Text>
            </View>
          ))}

          <View style={styles.contactCard}>
            <Text style={styles.contactText}>Need more help? Ask a parent or go to your 🤖 AI Buddy! 😊</Text>
          </View>

          {/* Google Drive Backup */}
          <Text style={styles.backupHeader}>☁️ My Google Drive Backup</Text>
          {kidGoogleAccount ? (
            <View style={styles.backupCard}>
              <View style={styles.backupAccountRow}>
                <Text style={{ fontSize: 22 }}>✅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.backupAccountName}>{kidGoogleAccount.name}</Text>
                  <Text style={styles.backupAccountEmail}>{kidGoogleAccount.email}</Text>
                </View>
              </View>
              <Text style={styles.backupFolderNote}>
                Saves to: <Text style={{ fontWeight: "700" }}>Spinini - {kid?.profile.name}/</Text> in your Google Drive
              </Text>
              <TouchableOpacity style={[styles.backupBtn, backingUp && { opacity: 0.7 }]} onPress={handleKidBackup} disabled={backingUp}>
                {backingUp ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.backupBtnText}>☁️ Back Up My Data</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.backupCard}>
              <Text style={styles.backupPrompt}>Link your Google account to save your journal, drawings, school work, and reading list to your own Google Drive! 📚</Text>
              <GoogleSignIn scopes={KID_SCOPES} onSuccess={handleKidGoogleSuccess} label="Link My Google Account" compact />
            </View>
          )}
        </>
      ) : (
        <>
          {/* Privacy for kids — simple language */}
          <View style={styles.privHero}>
            <Text style={styles.privHeroEmoji}>🔒</Text>
            <Text style={styles.privHeroTitle}>Your Privacy</Text>
            <Text style={styles.privHeroSub}>Here's what we collect and why</Text>
          </View>

          {[
            { emoji: "📱", title: "Your stuff stays on this device", body: "Your journal, drawings, and messages are saved right here on the device. We don't have a computer somewhere holding your stuff." },
            { emoji: "🚫", title: "We don't show you ads", body: "Spinini never shows ads. Your information is never sold to companies." },
            { emoji: "📍", title: "Location is for your safety", body: "Your parent can see where you are on a map. This is so they can make sure you're safe. Location is only shared with your parent." },
            { emoji: "⏱️", title: "Screen time data goes to your parent", body: "The app tracks which apps you use and for how long. Your parent sees this in their Reports. No one else does." },
            { emoji: "🤖", title: "AI Buddy chats", body: "When you chat with your AI Buddy, your messages go to a company called Anthropic (who makes the AI). They don't share it with advertisers." },
            { emoji: "🗑️", title: "Deleting your data", body: "Your parent can delete all your data. You can also ask to delete your journal or drawings at any time." },
          ].map((card, i) => (
            <View key={i} style={styles.privCard}>
              <Text style={styles.privCardEmoji}>{card.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.privCardTitle}>{card.title}</Text>
                <Text style={styles.privCardBody}>{card.body}</Text>
              </View>
            </View>
          ))}

          <View style={styles.coppaBox}>
            <Text style={styles.coppaTitle}>👶 A Note About Children's Privacy</Text>
            <Text style={styles.coppaBody}>
              Spinini is built for parents and kids to use together. We follow the rules about keeping kids' information private (called COPPA in the US). Your parent is responsible for your account and has agreed to the privacy rules on your behalf.{"\n\n"}
              If something feels wrong, tell a parent or contact us:
            </Text>
            <TouchableOpacity onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
              <Text style={styles.coppaEmail}>{CONTACT_EMAIL}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Spinini — Keeping Families Connected 💜</Text>
            <Text style={[styles.footerText, { fontWeight: "400", fontSize: FontSize.xs, marginTop: 2 }]}>
              © {new Date().getFullYear()} Spinini Inc. · Full policy in parent's Help & Privacy screen.
            </Text>
          </View>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title:               { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },

  tabRow:              { flexDirection: "row", gap: 8, marginBottom: Spacing.md },
  tab:                 { flex: 1, paddingVertical: 11, borderRadius: Radius.lg, backgroundColor: Colors.surfaceLight, alignItems: "center", ...Shadow.sm },
  tabActive:           { backgroundColor: Colors.primary },
  tabText:             { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  tabTextActive:       { color: "#fff" },

  // Check for Updates button
  updateBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#0EA5E9",
    borderRadius: Radius.xl, paddingVertical: 11, paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    shadowColor: "#0EA5E9", shadowOpacity: 0.30,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 5,
  },
  updateBtnIcon:  { fontSize: 24 },
  updateBtnTitle: { fontSize: FontSize.base, fontWeight: "900", color: "#fff" },
  updateBtnSub:   { fontSize: FontSize.xs, color: "rgba(255,255,255,0.80)", marginTop: 2 },
  updateBtnArrow: { fontSize: 22, color: "rgba(255,255,255,0.60)" },

  permBtn:             { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 13, alignItems: "center", marginBottom: 6 },
  permBtnText:         { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  permHint:            { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "center", marginBottom: Spacing.md },

  card:                { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  question:            { fontSize: FontSize.base, fontWeight: "700", color: Colors.primary, marginBottom: 4 },
  answer:              { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 22 },
  contactCard:         { backgroundColor: Colors.primary + "15", borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md },
  contactText:         { color: Colors.primary, fontWeight: "500", textAlign: "center", lineHeight: 22 },
  // Parent access section
  parentSection:       {
    backgroundColor: Colors.primary + "0F", borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.primary + "30",
  },
  parentSectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  parentSectionIcon:   { fontSize: 28 },
  parentSectionTitle:  { fontSize: FontSize.md, fontWeight: "800", color: Colors.primary },
  parentSectionSub:    { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19, marginBottom: 12 },

  switchBtn:           {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    padding: Spacing.md, ...Shadow.sm,
  },
  switchBtnEmoji:      { fontSize: 26 },
  switchBtnTitle:      { fontSize: FontSize.base, fontWeight: "800", color: "#fff" },
  switchBtnSub:        { fontSize: FontSize.sm, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  switchBtnArrow:      { fontSize: 24, color: "rgba(255,255,255,0.6)", fontWeight: "300" },
  backupHeader:        { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: Spacing.lg, marginBottom: 8 },
  backupCard:          { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm, gap: 10 },
  backupAccountRow:    { flexDirection: "row", alignItems: "center", gap: 10 },
  backupAccountName:   { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  backupAccountEmail:  { fontSize: FontSize.sm, color: Colors.textSecondary },
  backupFolderNote:    { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  backupBtn:           { backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 12, alignItems: "center" },
  backupBtnText:       { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  backupPrompt:        { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  // Privacy tab — kid
  privHero:            { alignItems: "center", paddingVertical: Spacing.md, marginBottom: Spacing.sm },
  privHeroEmoji:       { fontSize: 48, marginBottom: 8 },
  privHeroTitle:       { fontSize: FontSize.lg, fontWeight: "900", color: Colors.primary },
  privHeroSub:         { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  privCard:            { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  privCardEmoji:       { fontSize: 28, marginTop: 2 },
  privCardTitle:       { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary, marginBottom: 4 },
  privCardBody:        { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  coppaBox:            { backgroundColor: "#EDE9FE", borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md, gap: 6 },
  coppaTitle:          { fontSize: FontSize.base, fontWeight: "800", color: Colors.primary },
  coppaBody:           { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  coppaEmail:          { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "700", textDecorationLine: "underline" },
  footer:              { backgroundColor: Colors.primary + "12", borderRadius: Radius.xl, padding: Spacing.md, alignItems: "center", marginTop: Spacing.md, gap: 4 },
  footerText:          { fontSize: FontSize.sm, fontWeight: "700", color: Colors.primary, textAlign: "center" },

  // PIN screen
  pinTitle:            { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, textAlign: "center", marginTop: Spacing.xl, marginBottom: 6 },
  pinSub:              { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", marginBottom: Spacing.xl },
  cancelBtn:           { alignSelf: "center", marginTop: Spacing.lg, padding: Spacing.md },
  cancelText:          { color: Colors.textSecondary, fontWeight: "600", fontSize: FontSize.base },
});
