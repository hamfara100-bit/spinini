import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams } from "expo-router";
import { useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { useWebVisit, useFeatureTap } from "../../../../lib/usage-tracker";

const DEFAULT_SITES = [
  { id: "1", url: "https://www.khanacademy.org", label: "Khan Academy", emoji: "📐" },
  { id: "2", url: "https://scratch.mit.edu", label: "Scratch", emoji: "🐱" },
  { id: "3", url: "https://www.pbskids.org", label: "PBS Kids", emoji: "🌟" },
  { id: "4", url: "https://www.tinkercad.com", label: "Tinkercad", emoji: "🖨️" },
  { id: "5", url: "https://ocw.mit.edu", label: "MIT OpenCourseWare", emoji: "🎓" },
  { id: "6", url: "https://www.nasa.gov", label: "NASA", emoji: "🚀" },
  { id: "7", url: "https://www.nationalgeographic.com/kids", label: "Nat Geo Kids", emoji: "🦁" },
  { id: "8", url: "https://www.coolmathgames.com", label: "Cool Math Games", emoji: "🧮" },
];

const SITE_COLORS = ["#EDE9FE", "#FEE2E2", "#D1FAE5", "#DBEAFE", "#FEF3C7", "#FCE7F3", "#E0F2FE", "#F0FDF4"];

export default function BrowserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const kid = useKid(id);
  const [opening, setOpening] = useState<string | null>(null);

  // ── Usage tracking ────────────────────────────────────────────────────────
  const logVisit   = useWebVisit(id);
  const tapFeature = useFeatureTap(id, "browser", "Safe Browser", "🌐");

  const allowlist = kid?.rules.webAllowlist.length
    ? kid.rules.webAllowlist.map(s => ({ ...s, emoji: "🌐" }))
    : DEFAULT_SITES;

  async function openSite(url: string, label: string) {
    tapFeature();           // count this feature being used
    setOpening(url);
    const openedAt = Date.now();
    try {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: Colors.primary,
        controlsColor: "#fff",
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
      // Browser closed — log how long they spent
      logVisit(url, label, openedAt);
    } catch {
      Alert.alert("Oops!", `Couldn't open ${label}. Check your internet connection.`);
    } finally {
      setOpening(null);
    }
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🌐 Safe Browser</Text>
      <Text style={styles.sub}>Only approved websites. Tap to open!</Text>

      <View style={styles.grid}>
        {allowlist.map((site, i) => {
          const bg = SITE_COLORS[i % SITE_COLORS.length];
          const isLoading = opening === site.url;
          return (
            <TouchableOpacity
              key={site.id ?? i}
              style={[styles.siteCard, { backgroundColor: bg, opacity: isLoading ? 0.6 : 1 }]}
              onPress={() => openSite(site.url, site.label)}
              activeOpacity={0.8}
              disabled={!!opening}
            >
              <Text style={{ fontSize: 36 }}>{"emoji" in site ? (site as any).emoji : "🌐"}</Text>
              <Text style={styles.siteLabel}>{site.label}</Text>
              <Text style={styles.siteUrl} numberOfLines={1}>
                {isLoading ? "Opening..." : site.url.replace(/^https?:\/\/(www\.)?/, "")}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeText}>🔒 Only websites approved by your parent are shown here.</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  siteCard: {
    width: "47%",
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: "center",
    ...Shadow.sm,
    minHeight: 110,
    justifyContent: "center",
  },
  siteLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary, marginTop: 6, textAlign: "center" },
  siteUrl: { fontSize: 10, color: Colors.textSecondary, marginTop: 2, textAlign: "center" },
  notice: {
    marginTop: Spacing.xl,
    padding: Spacing.md,
    backgroundColor: Colors.primaryLight + "20",
    borderRadius: Radius.md,
  },
  noticeText: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: "center" },
});
