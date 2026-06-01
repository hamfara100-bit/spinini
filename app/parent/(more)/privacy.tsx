import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView,
} from "react-native";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";

// ─── Data ─────────────────────────────────────────────────────────────────────

const EFFECTIVE_DATE = "May 20, 2026";
const CONTACT_EMAIL  = "privacy@spinini.app";
const APP_NAME       = "Spinini";
const DEVELOPER      = "Spinini Inc.";

interface PolicySection {
  id: string;
  emoji: string;
  title: string;
  content: PolicyBlock[];
}

type PolicyBlock =
  | { kind: "para"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "table"; rows: string[][] };

const SECTIONS: PolicySection[] = [
  {
    id: "overview",
    emoji: "📋",
    title: "Overview",
    content: [
      { kind: "para", text: `${APP_NAME} ("we", "us", "our") is a family management and parental control application. This Privacy Policy explains how we collect, use, disclose, and protect information about you and your family when you use ${APP_NAME}. By using the app you agree to the terms of this policy.` },
      { kind: "para", text: `Effective Date: ${EFFECTIVE_DATE}` },
      { kind: "para", text: "Spinini is designed for use by parents and guardians to manage their minor children's device usage. We take your family's privacy seriously and have built the app with a local-first, minimal-data philosophy." },
    ],
  },
  {
    id: "who",
    emoji: "👨‍👩‍👧",
    title: "Who Uses Spinini",
    content: [
      { kind: "para", text: "Spinini is intended for use by parents and legal guardians (age 18+) to monitor and manage devices used by their children." },
      { kind: "heading", text: "COPPA Notice — Children Under 13" },
      { kind: "para", text: "Spinini is a parental control tool, not an app directed at children. We do not knowingly collect personal information directly from children under 13. Children interact with the child-facing side of the app on devices managed by a parent. All data created on the child side (journal entries, drawings, messages) belongs to the parent account and is stored locally on the device." },
      { kind: "para", text: "Parents who allow their child to link a Google account for backup do so as the child's legal guardian and consent on the child's behalf, consistent with COPPA requirements." },
    ],
  },
  {
    id: "collect",
    emoji: "📂",
    title: "Data We Collect",
    content: [
      { kind: "heading", text: "Data You Provide" },
      { kind: "bullets", items: [
        "Parent name, PIN (hashed), and optional email address",
        "Child names, ages, and profile photos",
        "Chore descriptions, rules, and schedules you create",
        "Messages, journal entries, drawings, and stories created in the app",
        "Grades, assignments, and school information you enter",
        "Contacts you add to the child's approved contacts list",
        "Savings goals and money tracking entries",
      ]},
      { kind: "heading", text: "Data Collected Automatically (on device)" },
      { kind: "bullets", items: [
        "Screen time usage per app — collected via Android UsageStatsManager with your explicit permission",
        "Device location — collected in the background via GPS when background location permission is granted",
        "Foreground app changes — detected via Android Accessibility Service when enabled by you",
        "Camera snapshots — taken during Camera Watch sessions you initiate",
        "Notification history — local notification delivery records",
        "App usage events — time spent in each app, aggregated per day",
      ]},
      { kind: "heading", text: "Data NOT Collected" },
      { kind: "bullets", items: [
        "We do not operate servers that store your family data — all data stays on your device and optionally your Google Drive",
        "We do not collect advertising identifiers or track you across apps",
        "We do not sell your data to any third party",
        "We do not use analytics SDKs that phone home",
        "We do not record audio or video without an active Camera Watch session you start",
      ]},
    ],
  },
  {
    id: "permissions",
    emoji: "🔐",
    title: "Device Permissions",
    content: [
      { kind: "para", text: "The following table lists every device permission the app requests, why we need it, and whether it is required or optional." },
      { kind: "table", rows: [
        ["Permission", "Purpose"],
        ["Camera", "Camera Watch live monitoring; photo proof for chores; profile photos"],
        ["Microphone", "Voice recording for Fun Lock messages and story narration"],
        ["Background Location", "Continuous location tracking for parent Location map and Safe Zone alerts"],
        ["Foreground Location", "One-time location fetch for SOS button; location tab in reports"],
        ["Notifications", "Reminders for homework due dates, chore approvals, SOS alerts, ping alerts"],
        ["Photo Library / Media", "Selecting photos for chore proof, memories, drawings, profile pictures"],
        ["Contacts (Android)", "Populating the child's emergency contacts list"],
        ["Usage Access (Android)", "Reading per-app screen time data via UsageStatsManager — requires manual grant in Special App Access settings"],
        ["Accessibility Service (Android)", "Detecting foreground app changes in real time to enforce blocked app rules — requires manual enable in Accessibility Settings"],
        ["Display Over Other Apps (Android)", "Showing the device lock overlay screen over blocked or time-limited apps"],
        ["Receive Boot Completed (Android)", "Restarting background monitoring after device reboot"],
        ["Internet", "AI buddy chat (Claude API), optional Google Drive backup, tRPC API calls"],
        ["Network State", "Detecting offline mode to show the connectivity banner"],
      ]},
      { kind: "heading", text: "Sensitive Permission Disclosures" },
      { kind: "para", text: "Accessibility Service: This permission allows Spinini to observe which app is in the foreground. We use it only to enforce parental app block rules. We do not read the content of other apps, capture keystrokes, or access any data beyond the foreground app package name." },
      { kind: "para", text: "Usage Access: This allows Spinini to read daily screen time per app. We use this only to populate the parent's Reports screen and enforce daily limits. Data stays on the device." },
      { kind: "para", text: "Display Over Other Apps: Used exclusively to show a full-screen lock overlay when a child opens a blocked app or when a parent activates Remote Lock. No content is captured through this overlay." },
    ],
  },
  {
    id: "use",
    emoji: "🛠️",
    title: "How We Use Data",
    content: [
      { kind: "bullets", items: [
        "Show parents real-time and historical screen time for each child",
        "Enforce screen time limits, bedtime modes, and app block rules",
        "Display a child's location on the parent's map and alert when entering/leaving Safe Zones",
        "Power the AI Buddy (Claude by Anthropic) — messages are sent to Anthropic's API over HTTPS and are subject to Anthropic's privacy policy",
        "Generate AI coloring pages via the Anthropic API",
        "Enable Google Drive backup when you opt in — data goes directly to your own Google account",
        "Schedule homework due-date reminders as local notifications",
        "Deliver parent-created ping and alarm alerts to the child's device locally",
        "Track chore completion, behavior points, and grade rewards",
        "Provide the parent AI Agent with context about your family's data to answer questions",
      ]},
    ],
  },
  {
    id: "sharing",
    emoji: "🤝",
    title: "Data Sharing & Third Parties",
    content: [
      { kind: "para", text: "We share your data with the following third parties only as described:" },
      { kind: "table", rows: [
        ["Third Party", "What Is Shared", "Purpose"],
        ["Anthropic (Claude API)", "Messages you or your child send to the AI Buddy or Parent Agent; optional image uploads for coloring", "AI-powered responses — see anthropic.com/privacy"],
        ["Google (Drive API)", "Family data files you choose to back up", "Cloud backup to YOUR own Google Drive only — requires your explicit sign-in and consent"],
        ["Google (Sign-In)", "Google OAuth token for authentication", "Linking your Google account for backup — see policies.google.com/privacy"],
        ["Expo / React Native", "App crash reports if you consent via Expo error reporting", "Bug fixing — opt-in only"],
      ]},
      { kind: "para", text: "We do not share your data with advertisers, data brokers, analytics companies, employers, government entities (except as required by law), or any other parties not listed above." },
    ],
  },
  {
    id: "storage",
    emoji: "💾",
    title: "Data Storage & Retention",
    content: [
      { kind: "heading", text: "Local Storage" },
      { kind: "para", text: "All family data is stored locally on your device using AsyncStorage (React Native's encrypted local storage). Data persists until you uninstall the app or clear app data from device settings." },
      { kind: "heading", text: "Cloud Backup (Optional)" },
      { kind: "para", text: "If you enable Google Drive backup, data is saved to your personal Google Drive account. You control this data through your Google account. We do not retain copies on our servers." },
      { kind: "heading", text: "AI Conversations" },
      { kind: "para", text: "Messages sent to the AI Buddy and Parent Agent are transmitted to Anthropic's API and are subject to Anthropic's data retention policies. We do not store conversation history on our servers; it is stored locally on your device only." },
      { kind: "heading", text: "Data Deletion" },
      { kind: "para", text: "You can delete all app data at any time by uninstalling Spinini or clearing app storage in your device Settings. For Google Drive backup data, delete the 'Spinini' folder from your Google Drive. To request deletion of any data associated with your account, contact us at " + CONTACT_EMAIL + "." },
    ],
  },
  {
    id: "security",
    emoji: "🔒",
    title: "Security",
    content: [
      { kind: "bullets", items: [
        "All network communication uses HTTPS/TLS encryption",
        "Parent PIN is stored as a hash — we cannot recover it for you (use your recovery code)",
        "The parent PIN gates access to all parental controls",
        "Co-parent PINs are independently hashed",
        "Google Drive backups use OAuth 2.0 tokens scoped to your own Drive only",
        "We do not transmit raw location data, usage data, or personal data to our servers",
        "The app overlay lock uses Android's SYSTEM_ALERT_WINDOW, which is visible in device settings and can be revoked by you at any time",
      ]},
    ],
  },
  {
    id: "rights",
    emoji: "⚖️",
    title: "Your Rights (GDPR / CCPA)",
    content: [
      { kind: "para", text: "Depending on your location, you may have the following rights regarding your personal data:" },
      { kind: "bullets", items: [
        "Right to Access — request a copy of data we hold about you",
        "Right to Correction — request correction of inaccurate data",
        "Right to Deletion ('Right to be Forgotten') — request erasure of your data",
        "Right to Portability — receive your data in a portable format",
        "Right to Object — object to certain processing activities",
        "Right to Restrict Processing — request we limit how we use your data",
        "CCPA: California residents may opt out of the 'sale' of personal information — we do not sell personal information",
        "CCPA: California residents may request disclosure of categories of data collected and purpose",
      ]},
      { kind: "para", text: `To exercise any of these rights, contact us at ${CONTACT_EMAIL}. We will respond within 30 days. Because data is stored locally on your device, most deletions can be performed directly by clearing app data.` },
    ],
  },
  {
    id: "apple",
    emoji: "🍎",
    title: "Apple App Store — Privacy Nutrition Label",
    content: [
      { kind: "para", text: "The following is our disclosure as required for the Apple App Store Privacy Nutrition Label. This maps to the \"App Privacy\" section in App Store Connect." },
      { kind: "heading", text: "Data Used to Track You" },
      { kind: "para", text: "None. Spinini does not track users across third-party apps or websites for advertising purposes." },
      { kind: "heading", text: "Data Linked to You" },
      { kind: "bullets", items: [
        "Contact Info: Parent name (used for account personalization)",
        "User Content: Journal entries, drawings, messages, stories (stored locally, optionally backed up to your Google Drive)",
        "Browsing History: Child's safe browser history (stored locally on device, accessible to parent only)",
        "Location: Background GPS location (stored locally, shown to parent on map)",
        "Usage Data: Per-app screen time (stored locally, shown in parent reports)",
        "Identifiers: Google account identifier when you link Google for backup",
        "Health & Fitness: Fitness logs and meal plans you enter (stored locally)",
        "Financial Info: Piggy bank entries you input (stored locally)",
        "Photos & Videos: Chore proof photos, profile pictures, memory photos (stored locally or in your Google Drive)",
      ]},
      { kind: "heading", text: "Data NOT Linked to You" },
      { kind: "bullets", items: [
        "Crash data (anonymous, if crash reporting is enabled in app settings)",
      ]},
    ],
  },
  {
    id: "google",
    emoji: "🤖",
    title: "Google Play — Data Safety",
    content: [
      { kind: "para", text: "The following disclosures are required for the Google Play Data Safety section. Complete this in the Play Console under 'App content → Data safety'." },
      { kind: "heading", text: "Data Collection Summary" },
      { kind: "table", rows: [
        ["Data Type", "Collected?", "Shared?", "Purpose"],
        ["Name", "Yes (parent + child names)", "No", "App functionality — profile display"],
        ["Email address", "Optional", "No", "Weekly digest (if enabled)"],
        ["Photos & videos", "Yes", "No (only to your Google Drive)", "Chore proof, profiles, memories"],
        ["Audio files", "Yes (voice memos)", "No", "Fun Lock voice recording, story narration"],
        ["Approximate location", "Yes", "No", "Location tracking for parent map"],
        ["Precise location", "Yes", "No", "GPS location for SOS, safe zones"],
        ["App interactions", "Yes", "No", "Screen time tracking, usage limits"],
        ["Installed apps", "Yes", "No", "App rule enforcement"],
        ["App activity", "Yes", "No", "Usage reports and parental controls"],
        ["Financial info", "Yes (you enter it)", "No", "Piggy bank tracking"],
        ["Health & fitness", "Yes (you enter it)", "No", "Fitness and meal logging"],
        ["Contacts", "Yes (parent selects)", "No", "Child's emergency contact list"],
        ["Device identifiers", "No", "No", "—"],
      ]},
      { kind: "heading", text: "Required Play Policy Disclosures" },
      { kind: "bullets", items: [
        "Prominent Disclosure: Spinini requests the Accessibility Service permission. This is used solely to detect which app is in the foreground to enforce parental app blocking rules. We do not read content from other apps.",
        "Prominent Disclosure: Spinini requests the 'Display Over Other Apps' permission to show a lock overlay when blocked apps are opened.",
        "Prominent Disclosure: Spinini requests 'App Usage Access' (UsageStatsManager) to read per-app screen time. You must grant this manually in Special App Access settings.",
        "Family Policy: Spinini is a parental control app. The child-facing interface does not display ads. We comply with the Google Play Families Policy.",
        "Data encryption: All data is stored locally; network traffic is TLS-encrypted.",
        "Data deletion: Users can delete all data by uninstalling the app. Email " + CONTACT_EMAIL + " for assisted deletion.",
      ]},
    ],
  },
  {
    id: "coppa",
    emoji: "👶",
    title: "COPPA Compliance",
    content: [
      { kind: "para", text: "The Children's Online Privacy Protection Act (COPPA) applies to online services directed at children under 13. Spinini is directed at parents and legal guardians, not children." },
      { kind: "bullets", items: [
        "Spinini does not operate servers that receive or store children's personal information",
        "No registration or account creation is required from children",
        "Children's data (journal, drawings, school info) is stored only on the parent's device",
        "Parents provide verifiable parental consent when they create a child profile",
        "If you are a parent and believe we have inadvertently collected information from your child, contact " + CONTACT_EMAIL + " and we will delete it",
        "AI Buddy conversations are sent to Anthropic's API — parents control access to this feature",
      ]},
    ],
  },
  {
    id: "changes",
    emoji: "🔄",
    title: "Changes to This Policy",
    content: [
      { kind: "para", text: "We may update this Privacy Policy from time to time. When we do, we will update the Effective Date at the top of this document. For material changes, we will show an in-app notice. Continued use of the app after changes constitutes acceptance of the updated policy." },
    ],
  },
  {
    id: "contact",
    emoji: "📬",
    title: "Contact Us",
    content: [
      { kind: "para", text: `For privacy questions, data requests, or to report a privacy concern, contact us at:\n\n${DEVELOPER}\nEmail: ${CONTACT_EMAIL}` },
      { kind: "para", text: `For EU/EEA residents: You may lodge a complaint with your local Data Protection Authority if you believe we have not handled your data in accordance with applicable law.` },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function PrivacyScreen() {
  const [expanded, setExpanded] = useState<string | null>("overview");

  function toggle(id: string) {
    setExpanded(prev => prev === id ? null : id);
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>🛡️</Text>
        <Text style={styles.heroTitle}>Privacy Policy</Text>
        <Text style={styles.heroSub}>Effective {EFFECTIVE_DATE}</Text>
      </View>

      {/* Quick summary */}
      <View style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>The Short Version</Text>
        <Text style={styles.summaryText}>
          {"✅ Your data stays on YOUR device — we have no servers storing it.\n" +
           "✅ We never sell your data or use it for advertising.\n" +
           "✅ You can delete everything by uninstalling the app.\n" +
           "✅ AI features use Anthropic's API over encrypted connections.\n" +
           "✅ Google Drive backup goes to YOUR account only."}
        </Text>
      </View>

      {/* Expandable sections */}
      {SECTIONS.map(section => (
        <View key={section.id} style={styles.sectionWrapper}>
          <TouchableOpacity
            style={[styles.sectionHeader, expanded === section.id && styles.sectionHeaderActive]}
            onPress={() => toggle(section.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionEmoji}>{section.emoji}</Text>
            <Text style={[styles.sectionTitle, expanded === section.id && styles.sectionTitleActive]}>
              {section.title}
            </Text>
            <Text style={styles.chevron}>{expanded === section.id ? "▲" : "▼"}</Text>
          </TouchableOpacity>

          {expanded === section.id && (
            <View style={styles.sectionBody}>
              {section.content.map((block, bi) => {
                if (block.kind === "para") {
                  return <Text key={bi} style={styles.para}>{block.text}</Text>;
                }
                if (block.kind === "heading") {
                  return <Text key={bi} style={styles.subHeading}>{block.text}</Text>;
                }
                if (block.kind === "bullets") {
                  return (
                    <View key={bi} style={styles.bulletList}>
                      {block.items.map((item, ii) => (
                        <View key={ii} style={styles.bulletRow}>
                          <Text style={styles.bulletDot}>•</Text>
                          <Text style={styles.bulletText}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  );
                }
                if (block.kind === "table") {
                  return (
                    <ScrollView key={bi} horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
                      <View style={styles.table}>
                        {block.rows.map((row, ri) => (
                          <View key={ri} style={[styles.tableRow, ri === 0 && styles.tableHeaderRow]}>
                            {row.map((cell, ci) => (
                              <Text key={ci} style={[styles.tableCell, ri === 0 && styles.tableHeaderCell, { minWidth: ci === 0 ? 140 : 160 }]}>
                                {cell}
                              </Text>
                            ))}
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  );
                }
                return null;
              })}
            </View>
          )}
        </View>
      ))}

      {/* Contact button */}
      <TouchableOpacity
        style={styles.contactBtn}
        onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=Spinini Privacy Request`)}
      >
        <Text style={styles.contactBtnText}>📬 Email Privacy Team</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>© {new Date().getFullYear()} {DEVELOPER}</Text>
        <Text style={styles.footerSub}>All data stays local on your device unless you enable Google Drive backup.</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero:              { alignItems: "center", paddingVertical: Spacing.lg, marginBottom: Spacing.sm },
  heroEmoji:         { fontSize: 56, marginBottom: 8 },
  heroTitle:         { fontSize: FontSize.xl, fontWeight: "900", color: Colors.primary },
  heroSub:           { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },

  summaryBox:        { backgroundColor: Colors.success + "15", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.success + "40" },
  summaryTitle:      { fontSize: FontSize.base, fontWeight: "800", color: Colors.success, marginBottom: 8 },
  summaryText:       { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 22 },

  sectionWrapper:    { marginBottom: 8 },
  sectionHeader:     { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
  sectionHeaderActive: { backgroundColor: Colors.primary, borderRadius: Radius.lg },
  sectionEmoji:      { fontSize: 20 },
  sectionTitle:      { flex: 1, fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  sectionTitleActive: { color: "#fff" },
  chevron:           { fontSize: FontSize.sm, color: Colors.textSecondary },

  sectionBody:       { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginTop: 2, ...Shadow.sm },

  para:              { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 22, marginBottom: Spacing.sm },
  subHeading:        { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primary, marginTop: Spacing.sm, marginBottom: 6 },

  bulletList:        { marginBottom: Spacing.sm },
  bulletRow:         { flexDirection: "row", gap: 8, marginBottom: 6 },
  bulletDot:         { color: Colors.primary, fontWeight: "800", fontSize: FontSize.base, lineHeight: 22 },
  bulletText:        { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 22 },

  tableScroll:       { marginBottom: Spacing.sm },
  table:             { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, overflow: "hidden" },
  tableRow:          { flexDirection: "row" },
  tableHeaderRow:    { backgroundColor: Colors.primary + "15" },
  tableCell:         { padding: 8, fontSize: 11, color: Colors.textPrimary, borderRightWidth: 1, borderBottomWidth: 1, borderColor: Colors.border, lineHeight: 16 },
  tableHeaderCell:   { fontWeight: "800", color: Colors.primary },

  contactBtn:        { backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: Spacing.md, alignItems: "center", marginTop: Spacing.lg },
  contactBtnText:    { color: "#fff", fontWeight: "800", fontSize: FontSize.base },

  footer:            { alignItems: "center", paddingVertical: Spacing.lg, gap: 4 },
  footerText:        { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  footerSub:         { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "center" },
});
