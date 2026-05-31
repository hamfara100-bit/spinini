import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Switch, Alert, Linking, Platform,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { PASTEL_COLORS } from "../../../lib/data/types";
import type { AppRuleMode } from "../../../lib/data/types";
import { computeScheduledMode } from "../../../lib/app-scheduler";

// ─── App catalogue with store IDs ────────────────────────────────────────────
interface AppEntry {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  category: string;
  androidPkg: string;   // Google Play package name
  iosId: string;        // Apple App Store numeric ID
  free: boolean;
}

const LEARNING_APPS: AppEntry[] = [
  // Language & Literacy
  { id: "duolingo",    name: "Duolingo",         emoji: "🦜", desc: "Language learning in 40+ languages",   category: "Language",  androidPkg: "com.duolingo",               iosId: "570060128",  free: true  },
  { id: "khan",        name: "Khan Academy Kids", emoji: "📐", desc: "Free K-6 core subjects",               category: "Math",      androidPkg: "org.khanacademy.kids",        iosId: "1378467217", free: true  },
  { id: "epic",        name: "Epic! Books",       emoji: "📚", desc: "30,000+ books & audiobooks",           category: "Reading",   androidPkg: "com.getepic.epic",            iosId: "719219826",  free: false },
  { id: "abc_mouse",   name: "ABCmouse",          emoji: "🐭", desc: "Early learning Pre-K–2",               category: "Reading",   androidPkg: "com.ageoflearning.abcmouse",  iosId: "586328581",  free: false },
  { id: "readingiq",   name: "Reading IQ",        emoji: "📖", desc: "Leveled reading library",              category: "Reading",   androidPkg: "com.readingiq",              iosId: "1138191135", free: false },
  // Math & Science
  { id: "prodigy",     name: "Prodigy Math",      emoji: "🔢", desc: "Math adventure game grades 1–8",       category: "Math",      androidPkg: "com.prodigygame.prodigy",     iosId: "950841947",  free: true  },
  { id: "dragonbox",   name: "DragonBox Algebra", emoji: "🐉", desc: "Algebra made fun for ages 5+",         category: "Math",      androidPkg: "no.dragonbox.algebra5",       iosId: "522069155",  free: false },
  { id: "scratch",     name: "Scratch Jr",        emoji: "🐱", desc: "Learn to code with stories",           category: "Coding",    androidPkg: "org.scratchjr.android",       iosId: "895485086",  free: true  },
  { id: "tinkercad",   name: "Tinkercad",         emoji: "🖨️", desc: "3D design & coding for kids",          category: "Coding",    androidPkg: "com.autodesk.tinkercad",     iosId: "1486119842", free: true  },
  { id: "codeorg",     name: "Code.org",          emoji: "💻", desc: "Hour of Code activities",              category: "Coding",    androidPkg: "com.codeorg",                iosId: "1116472349", free: true  },
  // Nature & Arts
  { id: "pbs_kids",    name: "PBS Kids",          emoji: "🌟", desc: "Educational shows & games",            category: "Science",   androidPkg: "org.pbskids.video",           iosId: "1094791900", free: true  },
  { id: "natgeo_kids", name: "Nat Geo Kids",      emoji: "🦁", desc: "Science & nature exploration",         category: "Science",   androidPkg: "com.natgeokids",             iosId: "903995743",  free: false },
  { id: "tinkeractive",name: "TinkerActive",      emoji: "🔬", desc: "STEM workbooks & activities",          category: "Science",   androidPkg: "com.odder.tinkeractive",     iosId: "1460512960", free: false },
  { id: "smilebox",    name: "Drawing for Kids",  emoji: "🎨", desc: "Creative art & coloring",              category: "Art",       androidPkg: "com.studypad.drawingforkids", iosId: "881427817",  free: true  },
  { id: "garage_band", name: "GarageBand",        emoji: "🎸", desc: "Make music on iPad (iOS only)",        category: "Art",       androidPkg: "",                           iosId: "408709785",  free: true  },
];

const LEARNING_IDS = new Set(LEARNING_APPS.map(a => a.id));
const LEARNING_MAP = Object.fromEntries(LEARNING_APPS.map(a => [a.id, a]));

const CATEGORIES = ["All", ...Array.from(new Set(LEARNING_APPS.map(a => a.category)))];

// ─── Store URL helpers ─────────────────────────────────────────────────────────
function playStoreUrl(pkg: string) {
  return `https://play.google.com/store/apps/details?id=${pkg}`;
}
function appStoreUrl(id: string) {
  return `https://apps.apple.com/app/id${id}`;
}

async function openInStore(app: AppEntry) {
  if (Platform.OS === "android" && app.androidPkg) {
    const marketUrl = `market://details?id=${app.androidPkg}`;
    const webUrl = playStoreUrl(app.androidPkg);
    const canOpen = await Linking.canOpenURL(marketUrl);
    await Linking.openURL(canOpen ? marketUrl : webUrl);
  } else if (app.iosId) {
    await Linking.openURL(appStoreUrl(app.iosId));
  } else {
    Alert.alert("Not available", `${app.name} is not available on this platform.`);
  }
}

async function openFamilyLink() {
  const url = Platform.OS === "android"
    ? "market://details?id=com.google.android.apps.kids.familylink"
    : "https://apps.apple.com/app/google-family-link-for-parents/id1150721355";
  await Linking.openURL(url).catch(() =>
    Linking.openURL("https://families.google.com/familylink/")
  );
}

export default function LearningAppsScreen() {
  const { state, dispatch } = useData();
  const [kidId, setKidId] = useState(state.kids[0]?.profile.id ?? "");
  const [category, setCategory] = useState("All");
  const [tab, setTab] = useState<"installed" | "browse" | "remote">("browse");

  const kid = state.kids.find(k => k.profile.id === kidId);

  const installedLearning = (kid?.rules.installedApps ?? [])
    .filter(id => LEARNING_IDS.has(id))
    .map(id => LEARNING_MAP[id])
    .filter(Boolean) as AppEntry[];

  const filtered = LEARNING_APPS.filter(a =>
    (category === "All" || a.category === category) &&
    !(kid?.rules.installedApps ?? []).includes(a.id)
  );

  function getRule(appId: string) {
    return kid?.rules.appRules.find(r => r.appId === appId) ?? {
      appId, appName: LEARNING_MAP[appId]?.name ?? appId,
      mode: "block" as AppRuleMode, scheduleEnabled: false, schedules: [],
    };
  }

  function toggleAllow(appId: string, appName: string, allow: boolean) {
    dispatch({
      type: "SET_APP_RULE",
      kidId,
      rule: { ...getRule(appId), mode: allow ? "allow" : "block", scheduleEnabled: false },
    });
  }

  function addToProfile(app: AppEntry) {
    dispatch({ type: "INSTALL_APP", kidId, appId: app.id, appName: app.name });
    dispatch({
      type: "SET_APP_RULE",
      kidId,
      rule: { appId: app.id, appName: app.name, mode: "allow", scheduleEnabled: false, schedules: [] },
    });
  }

  function removeApp(appId: string, appName: string) {
    Alert.alert("Remove App", `Remove ${appName} from ${kid?.profile.name}'s allowed list?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => dispatch({ type: "REMOVE_APP", kidId, appId }) },
    ]);
  }

  function handleSendToDevice(app: AppEntry) {
    Alert.alert(
      `📲 Install ${app.name}`,
      Platform.OS === "android"
        ? `This opens Google Play on YOUR device. To install directly on ${kid?.profile.name}'s phone:\n\n1. Use the Google Family Link app → Apps → Approve\n2. Or open Play Store on their device\n\nOpen Play Store for ${app.name}?`
        : `On iPhone/iPad, use Screen Time + Family Sharing:\n\n1. Go to Settings → Screen Time → Content & Privacy\n2. Or use the Family Link app\n\nOpen App Store for ${app.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Store →", onPress: () => openInStore(app) },
      ]
    );
  }

  const TAB_LABELS: { id: typeof tab; label: string; emoji: string }[] = [
    { id: "browse",    label: "Browse",    emoji: "🔍" },
    { id: "installed", label: "Installed", emoji: "✅" },
    { id: "remote",    label: "Remote",    emoji: "📲" },
  ];

  return (
    <ScreenContainer>
      <Text style={styles.title}>🎓 Learning Apps</Text>

      {/* Kid selector */}
      {state.kids.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10, flexGrow: 0 }}>
          {state.kids.map(k => (
            <TouchableOpacity
              key={k.profile.id}
              style={[styles.kidChip, kidId === k.profile.id && { backgroundColor: Colors.primary }]}
              onPress={() => setKidId(k.profile.id)}
              accessibilityLabel={`Select ${k.profile.name}`}
            >
              <Text style={[styles.kidChipText, kidId === k.profile.id && { color: "#fff" }]}>
                {k.profile.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Tab bar */}
      <View style={styles.tabRow}>
        {TAB_LABELS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, tab === t.id && styles.tabActive]}
            onPress={() => setTab(t.id)}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
          >
            <Text style={styles.tabEmoji}>{t.emoji}</Text>
            <Text style={[styles.tabLabel, tab === t.id && styles.tabLabelActive]}>{t.label}</Text>
            {t.id === "installed" && installedLearning.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{installedLearning.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>

        {/* ── BROWSE tab ── */}
        {tab === "browse" && (
          <>
            {/* Category filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, flexGrow: 0 }}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.catChip, category === c && styles.catChipActive]}
                  onPress={() => setCategory(c)}
                  accessibilityLabel={`Filter by ${c}`}
                >
                  <Text style={[styles.catText, category === c && styles.catTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {filtered.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={{ fontSize: 40 }}>🎉</Text>
                <Text style={styles.emptyTitle}>All added!</Text>
                <Text style={styles.emptySub}>All {category === "All" ? "" : category + " "}apps are in {kid?.profile.name}'s profile.</Text>
              </View>
            )}

            {filtered.map(app => (
              <View key={app.id} style={styles.appCard}>
                <View style={styles.appIconCircle}>
                  <Text style={{ fontSize: 28 }}>{app.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.appTitleRow}>
                    <Text style={styles.appName}>{app.name}</Text>
                    {app.free
                      ? <View style={styles.freeBadge}><Text style={styles.freeBadgeText}>FREE</Text></View>
                      : <View style={styles.paidBadge}><Text style={styles.paidBadgeText}>PAID</Text></View>
                    }
                  </View>
                  <Text style={styles.appDesc}>{app.desc}</Text>
                  <Text style={styles.catLabel}>{app.category}</Text>
                </View>
                <View style={styles.appActions}>
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => { addToProfile(app); Alert.alert("✅ Added", `${app.name} added to ${kid?.profile.name}'s allowed apps.`); }}
                    accessibilityLabel={`Add ${app.name} to profile`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.addBtnText}>+ Profile</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.storeBtn}
                    onPress={() => handleSendToDevice(app)}
                    accessibilityLabel={`Open ${app.name} in store`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.storeBtnText}>📲 Store</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── INSTALLED tab ── */}
        {tab === "installed" && (
          <>
            {installedLearning.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={{ fontSize: 48 }}>🎓</Text>
                <Text style={styles.emptyTitle}>No learning apps yet</Text>
                <Text style={styles.emptySub}>Browse the catalogue and tap "+ Profile" to add apps for {kid?.profile.name ?? "your kid"}.</Text>
              </View>
            ) : (
              installedLearning.map(app => {
                const rule = getRule(app.id);
                const effectiveMode = rule.scheduleEnabled ? (computeScheduledMode(rule) ?? rule.mode) : rule.mode;
                const isOn = effectiveMode === "allow" || effectiveMode === "limit";
                return (
                  <View key={app.id} style={styles.installedCard}>
                    <View style={[styles.appIconCircle, { backgroundColor: isOn ? "#D1FAE5" : "#F3F4F6" }]}>
                      <Text style={{ fontSize: 26 }}>{app.emoji}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.appName}>{app.name}</Text>
                      <Text style={styles.appDesc}>{app.desc}</Text>
                      <View style={styles.statusRow}>
                        <View style={[styles.dot, { backgroundColor: isOn ? Colors.success : Colors.error }]} />
                        <Text style={[styles.statusText, { color: isOn ? Colors.success : Colors.error }]}>
                          {isOn ? "Allowed" : "Blocked"}
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 8 }}>
                      <Switch
                        value={isOn}
                        onValueChange={v => toggleAllow(app.id, app.name, v)}
                        trackColor={{ true: Colors.success, false: "#D1D5DB" }}
                        thumbColor="#fff"
                        accessibilityLabel={`${isOn ? "Block" : "Allow"} ${app.name}`}
                      />
                      <TouchableOpacity onPress={() => removeApp(app.id, app.name)}>
                        <Text style={styles.removeText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* ── REMOTE INSTALL tab ── */}
        {tab === "remote" && (
          <>
            {/* How it works card */}
            <View style={styles.howCard}>
              <Text style={styles.howTitle}>📲 Remote App Installation</Text>
              <Text style={styles.howBody}>
                You can install apps on {kid?.profile.name ?? "your child"}'s device without touching it — using your phone or a browser.
              </Text>
            </View>

            {/* Android instructions */}
            <View style={styles.platformCard}>
              <Text style={styles.platformTitle}>🤖 Android — Google Family Link</Text>
              {[
                { n: "1", text: "Install Google Family Link on your phone" },
                { n: "2", text: "Link it to your child's Google account" },
                { n: "3", text: "Open Family Link → child's name → Apps" },
                { n: "4", text: "Browse Google Play and tap Approve — it installs instantly on their device" },
                { n: "5", text: "Or: go to play.google.com on your laptop, pick an app, choose their device from the Install drop-down" },
              ].map(s => (
                <View key={s.n} style={styles.step}>
                  <View style={styles.stepNum}><Text style={styles.stepNumText}>{s.n}</Text></View>
                  <Text style={styles.stepText}>{s.text}</Text>
                </View>
              ))}
              <TouchableOpacity
                style={styles.openAppBtn}
                onPress={openFamilyLink}
                accessibilityLabel="Open Family Link app"
                accessibilityRole="button"
              >
                <Text style={styles.openAppBtnText}>📱 Open Family Link →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.openAppBtn, { backgroundColor: Colors.primary + "15", marginTop: 8 }]}
                onPress={() => Linking.openURL("https://play.google.com/store")}
                accessibilityLabel="Open Google Play on web"
                accessibilityRole="button"
              >
                <Text style={[styles.openAppBtnText, { color: Colors.primary }]}>🌐 Open Google Play (web) →</Text>
              </TouchableOpacity>
            </View>

            {/* iOS instructions */}
            <View style={styles.platformCard}>
              <Text style={styles.platformTitle}>🍎 iPhone / iPad — Family Sharing</Text>
              {[
                { n: "1", text: "Set up Family Sharing: Settings → your name → Family Sharing" },
                { n: "2", text: "Add your child as a family member" },
                { n: "3", text: "Enable Screen Time → Content & Privacy for their account" },
                { n: "4", text: "Turn on Ask to Buy — your child requests, you approve from your phone" },
                { n: "5", text: "Or: go to apps.apple.com on your laptop, choose a free app, and send a link to their device" },
              ].map(s => (
                <View key={s.n} style={styles.step}>
                  <View style={styles.stepNum}><Text style={styles.stepNumText}>{s.n}</Text></View>
                  <Text style={styles.stepText}>{s.text}</Text>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.openAppBtn, { backgroundColor: "#007AFF20" }]}
                onPress={() => Linking.openURL("https://www.apple.com/family-sharing/")}
                accessibilityLabel="Learn about Apple Family Sharing"
                accessibilityRole="button"
              >
                <Text style={[styles.openAppBtnText, { color: "#007AFF" }]}>🍎 Learn about Family Sharing →</Text>
              </TouchableOpacity>
            </View>

            {/* Quick store links for all catalogue apps */}
            <Text style={styles.sectionLabel}>QUICK-SEND TO STORE</Text>
            <Text style={styles.quickSendSub}>Tap any app to open its store page — install it remotely from there.</Text>
            {LEARNING_APPS.map(app => (
              <TouchableOpacity
                key={app.id}
                style={styles.quickRow}
                onPress={() => openInStore(app)}
                accessibilityLabel={`Open ${app.name} in the app store`}
                accessibilityRole="button"
              >
                <Text style={{ fontSize: 24, marginRight: 12 }}>{app.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appName}>{app.name}</Text>
                  <Text style={styles.appDesc}>{app.category} · {app.free ? "Free" : "Paid"}</Text>
                </View>
                <Text style={{ color: Colors.primary, fontWeight: "700", fontSize: 20 }}>›</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title:           { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.sm },
  kidChip:         { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight, marginRight: 8 },
  kidChipText:     { fontWeight: "700", color: Colors.textSecondary, fontSize: FontSize.sm },

  tabRow:          { flexDirection: "row", gap: 8, marginBottom: Spacing.md },
  tab:             { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: Radius.lg, backgroundColor: Colors.cardLight, gap: 2 },
  tabActive:       { backgroundColor: Colors.primary },
  tabEmoji:        { fontSize: 18 },
  tabLabel:        { fontSize: 11, fontWeight: "700", color: Colors.textSecondary },
  tabLabelActive:  { color: "#fff" },
  tabBadge:        { backgroundColor: Colors.success, borderRadius: 10, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, marginTop: 2 },
  tabBadgeText:    { color: "#fff", fontSize: 10, fontWeight: "800" },

  catChip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.cardLight, marginRight: 8, borderWidth: 1.5, borderColor: "transparent" },
  catChipActive:   { backgroundColor: Colors.primary + "15", borderColor: Colors.primary },
  catText:         { fontWeight: "600", fontSize: FontSize.sm, color: Colors.textSecondary },
  catTextActive:   { color: Colors.primary },

  appCard:         { flexDirection: "row", alignItems: "flex-start", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: 8, ...Shadow.sm, gap: 12 },
  installedCard:   { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: 8, ...Shadow.sm },
  appIconCircle:   { width: 52, height: 52, borderRadius: Radius.md, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  appTitleRow:     { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  appName:         { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  appDesc:         { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  catLabel:        { fontSize: 10, color: Colors.textMuted, fontWeight: "600", marginTop: 4, textTransform: "uppercase" },
  freeBadge:       { backgroundColor: Colors.success + "20", borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  freeBadgeText:   { fontSize: 9, fontWeight: "800", color: Colors.success },
  paidBadge:       { backgroundColor: Colors.warning + "20", borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  paidBadgeText:   { fontSize: 9, fontWeight: "800", color: Colors.warning },
  appActions:      { gap: 6, alignItems: "flex-end", justifyContent: "center" },
  addBtn:          { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.md },
  addBtnText:      { color: "#fff", fontWeight: "700", fontSize: 11 },
  storeBtn:        { backgroundColor: Colors.secondary + "20", paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.md },
  storeBtnText:    { color: Colors.textPrimary, fontWeight: "700", fontSize: 11 },

  statusRow:       { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  dot:             { width: 7, height: 7, borderRadius: 4 },
  statusText:      { fontSize: 12, fontWeight: "700" },
  removeText:      { fontSize: 12, color: Colors.error, fontWeight: "600" },

  sectionLabel:    { fontSize: 11, fontWeight: "800", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, marginTop: 16 },
  quickSendSub:    { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 10 },
  quickRow:        { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: 6, ...Shadow.sm },

  emptyBox:        { alignItems: "center", gap: 10, backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.xl, marginVertical: Spacing.md, ...Shadow.sm },
  emptyTitle:      { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },
  emptySub:        { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },

  howCard:         { backgroundColor: Colors.primary + "12", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.primary + "25" },
  howTitle:        { fontSize: FontSize.md, fontWeight: "800", color: Colors.primary, marginBottom: 6 },
  howBody:         { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  platformCard:    { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm },
  platformTitle:   { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary, marginBottom: Spacing.sm },
  step:            { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  stepNum:         { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  stepNumText:     { color: "#fff", fontSize: 12, fontWeight: "800" },
  stepText:        { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  openAppBtn:      { backgroundColor: Colors.success + "18", borderRadius: Radius.full, alignItems: "center", paddingVertical: 12, borderWidth: 1, borderColor: Colors.success + "40", marginTop: 4 },
  openAppBtnText:  { color: Colors.success, fontWeight: "800", fontSize: FontSize.base },
});
