/**
 * Upgrade to Ad-Free screen
 *
 * Shown when the user taps "Remove Ads" from:
 *   • The first-launch MonetizationModal
 *   • The Help & Privacy screen (top button)
 *   • The small link under each ad banner
 *
 * Directs users to App Store / Google Play for the $19.99 one-time purchase.
 * Before publishing: replace STORE_URL_IOS with the real App Store URL after
 * the app is submitted, and wire handleRestore to your RevenueCat SDK.
 */

import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Platform,
} from "react-native";
import { ScreenContainer } from "../../../components/screen-container";
import { useData } from "../../../lib/data/store";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";

// ── Replace STORE_URL_IOS with the real App Store URL after submission ────────
const STORE_URL_IOS     = "https://apps.apple.com/app/spinini/id000000000";
const STORE_URL_ANDROID = "https://play.google.com/store/apps/details?id=com.famkids.app";

const PERKS = [
  { emoji: "🚫", title: "Zero ads on your parent dashboard",    sub: "No banners, no pop-ups, no interruptions — ever." },
  { emoji: "👶", title: "Kids were already ad-free",            sub: "Children see zero ads regardless of your plan — always." },
  { emoji: "♾️", title: "All features stay completely free",    sub: "Nothing is paywalled. This upgrade is purely ad removal." },
  { emoji: "💳", title: "One-time purchase — not a subscription", sub: "Pay once and enjoy 12 months of no ads." },
  { emoji: "🔄", title: "Optional $19.99/year renewal",         sub: "Let it lapse any time → goes back to free with limited ads." },
  { emoji: "🔒", title: "Restores across devices",              sub: "Tied to your Apple ID or Google account — restore any time." },
];

export default function UpgradeAdFreeScreen() {
  const { state, dispatch } = useData();
  const isAdFree   = state.parentSettings.adFree ?? false;
  const [restoring, setRestoring] = useState(false);

  function openStore(platform: "ios" | "android") {
    const url = platform === "ios" ? STORE_URL_IOS : STORE_URL_ANDROID;
    Alert.alert(
      platform === "ios" ? "Open App Store?" : "Open Google Play?",
      `You'll be taken to the ${platform === "ios" ? "App Store" : "Google Play"} to complete the $19.99 Ad-Free purchase.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: platform === "ios" ? "Open App Store" : "Open Google Play", onPress: () => Linking.openURL(url) },
      ]
    );
  }

  async function handleRestore() {
    setRestoring(true);
    await new Promise(r => setTimeout(r, 1500));
    setRestoring(false);
    // Wire to RevenueCat Purchases.restorePurchases() before publishing
    Alert.alert(
      "Restore Purchases",
      isAdFree
        ? "✅ Your Ad-Free upgrade is already active on this device."
        : "No Ad-Free purchase found linked to this account.\n\nIf you believe this is an error, contact support@spinini.app.",
      [{ text: "OK" }]
    );
  }

  // ── Already ad-free ─────────────────────────────────────────────────────────
  if (isAdFree) {
    return (
      <ScreenContainer scroll>
        <View style={s.activeHero}>
          <Text style={s.activeIcon}>🎉</Text>
          <Text style={s.activeTitle}>You're Ad-Free!</Text>
          <Text style={s.activeSub}>
            Thank you for supporting Spinini.{"\n"}
            Your parent dashboard is completely ad-free.
          </Text>
        </View>
        <View style={s.activeCard}>
          {[
            "No ads on your parent dashboard",
            "All features remain fully unlocked",
            "Kids side was always ad-free — still is",
          ].map((line, i) => (
            <View key={i} style={s.checkRow}>
              <Text style={s.checkMark}>✓</Text>
              <Text style={s.checkText}>{line}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={s.restoreBtn} onPress={handleRestore} disabled={restoring}>
          <Text style={s.restoreBtnText}>{restoring ? "Checking…" : "↩ Restore Purchases"}</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  // ── Upgrade CTA ─────────────────────────────────────────────────────────────
  return (
    <ScreenContainer scroll>

      {/* ── Hero ── */}
      <View style={s.hero}>
        <Text style={s.heroIcon}>🚫📢</Text>
        <Text style={s.heroTitle}>Go Ad-Free</Text>
        <Text style={s.heroSub}>
          Spinini is{" "}
          <Text style={{ fontWeight: "900", color: "#fff" }}>100% free — forever.</Text>
          {"\n"}One small upgrade removes all ads from your parent view.
        </Text>
        <View style={s.freeBadgeRow}>
          <View style={s.freeBadge}><Text style={s.freeBadgeText}>✅  No ads on kids side — ever</Text></View>
          <View style={s.freeBadge}><Text style={s.freeBadgeText}>✅  All features stay free</Text></View>
        </View>
      </View>

      {/* ── What you get ── */}
      <View style={s.perksCard}>
        <Text style={s.perksTitle}>What You Get</Text>
        {PERKS.map((p, i) => (
          <View key={i} style={[s.perkRow, i < PERKS.length - 1 && s.perkRowBorder]}>
            <Text style={s.perkEmoji}>{p.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.perkTitle}>{p.title}</Text>
              <Text style={s.perkSub}>{p.sub}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* ── Price ── */}
      <View style={s.priceCard}>
        <Text style={s.priceLabel}>AD-FREE UPGRADE</Text>
        <View style={s.priceRow}>
          <Text style={s.price}>$19.99</Text>
          <Text style={s.pricePer}> / year</Text>
        </View>
        <Text style={s.priceSub}>One-time purchase · 12 months ad-free · Optional renewal</Text>
      </View>

      {/* ── Store buttons ── */}
      <Text style={s.storeLabel}>Complete your purchase via your app store:</Text>

      <TouchableOpacity
        style={[s.storeBtn, { backgroundColor: "#000" }]}
        onPress={() => openStore("ios")}
        activeOpacity={0.85}
      >
        <Text style={s.storeBtnIcon}>🍎</Text>
        <View>
          <Text style={s.storeBtnSub}>Download on the</Text>
          <Text style={s.storeBtnMain}>App Store</Text>
        </View>
        <Text style={s.storeBtnArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.storeBtn, { backgroundColor: "#01875F" }]}
        onPress={() => openStore("android")}
        activeOpacity={0.85}
      >
        <Text style={s.storeBtnIcon}>▶</Text>
        <View>
          <Text style={s.storeBtnSub}>Get it on</Text>
          <Text style={s.storeBtnMain}>Google Play</Text>
        </View>
        <Text style={s.storeBtnArrow}>›</Text>
      </TouchableOpacity>

      {/* ── Restore ── */}
      <TouchableOpacity style={s.restoreBtn} onPress={handleRestore} disabled={restoring}>
        <Text style={s.restoreBtnText}>
          {restoring ? "Checking purchases…" : "↩ Already purchased? Restore"}
        </Text>
      </TouchableOpacity>

      {/* ── Legal small print ── */}
      <View style={s.legalBox}>
        <Text style={s.legalText}>
          Purchase is processed entirely by Apple App Store or Google Play. Spinini never stores
          your payment details.{"\n\n"}
          After purchase completes, tap "Already purchased? Restore" if ads don't disappear
          immediately. For support, contact support@spinini.app.{"\n\n"}
          The app remains 100% free with limited parent-side ads if you choose not to upgrade.
          Your family data, child profiles, and all features stay fully intact regardless of
          your payment status — always.
        </Text>
      </View>

    </ScreenContainer>
  );
}

const ACCENT = "#6C3CE1";

const s = StyleSheet.create({
  // ── Active (already ad-free) ─────────────────────────────────────────────
  activeHero: { alignItems: "center", paddingVertical: Spacing.xl, gap: 10 },
  activeIcon: { fontSize: 64 },
  activeTitle: { fontSize: FontSize.xxl, fontWeight: "900", color: Colors.success },
  activeSub: {
    fontSize: FontSize.base, color: Colors.textSecondary,
    textAlign: "center", lineHeight: 24,
  },
  activeCard: {
    backgroundColor: Colors.success + "12", borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: Colors.success + "30", gap: 12,
  },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkMark: { fontSize: FontSize.md, fontWeight: "900", color: Colors.success },
  checkText: { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary, flex: 1 },

  // ── Hero ─────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: "#1E0A4E", borderRadius: Radius.xl,
    padding: Spacing.lg, alignItems: "center",
    marginBottom: Spacing.lg, gap: 10,
  },
  heroIcon: { fontSize: 56 },
  heroTitle: { fontSize: FontSize.xxl, fontWeight: "900", color: "#fff" },
  heroSub: {
    fontSize: FontSize.base, color: "rgba(255,255,255,0.80)",
    textAlign: "center", lineHeight: 24,
  },
  freeBadgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 4 },
  freeBadge: {
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  freeBadgeText: { fontSize: FontSize.xs, color: "#fff", fontWeight: "700" },

  // ── Perks ────────────────────────────────────────────────────────────────
  perksCard: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: Spacing.md,
    ...Shadow.sm, borderWidth: 1, borderColor: Colors.border,
  },
  perksTitle: {
    fontSize: FontSize.md, fontWeight: "900", color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  perkRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 10 },
  perkRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  perkEmoji: { fontSize: 24, marginTop: 2 },
  perkTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  perkSub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18, marginTop: 2 },

  // ── Price ────────────────────────────────────────────────────────────────
  priceCard: {
    backgroundColor: ACCENT + "14", borderRadius: Radius.xl,
    padding: Spacing.lg, marginBottom: Spacing.md,
    alignItems: "center",
    borderWidth: 1.5, borderColor: ACCENT + "50",
  },
  priceLabel: {
    fontSize: FontSize.xs, fontWeight: "900", color: ACCENT,
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 4,
  },
  priceRow: { flexDirection: "row", alignItems: "baseline" },
  price: { fontSize: 52, fontWeight: "900", color: ACCENT },
  pricePer: { fontSize: FontSize.lg, fontWeight: "700", color: ACCENT + "99" },
  priceSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 6, textAlign: "center" },

  // ── Store buttons ─────────────────────────────────────────────────────────
  storeLabel: {
    fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary,
    marginBottom: 10, textAlign: "center",
  },
  storeBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: Radius.xl, paddingVertical: 12,
    paddingHorizontal: Spacing.lg, marginBottom: 10, ...Shadow.sm,
  },
  storeBtnIcon: { fontSize: 30, color: "#fff", width: 34, textAlign: "center" },
  storeBtnSub: { fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: "500" },
  storeBtnMain: { fontSize: FontSize.lg, color: "#fff", fontWeight: "800" },
  storeBtnArrow: { fontSize: 24, color: "rgba(255,255,255,0.6)", marginLeft: "auto" },

  // ── Restore ──────────────────────────────────────────────────────────────
  restoreBtn: {
    alignSelf: "center", paddingVertical: 10, paddingHorizontal: 24,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  restoreBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600" },

  // ── Legal ─────────────────────────────────────────────────────────────────
  legalBox: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg,
    padding: Spacing.md, marginTop: Spacing.sm, marginBottom: Spacing.xl,
    borderWidth: 1, borderColor: Colors.border,
  },
  legalText: {
    fontSize: FontSize.xs, color: Colors.textMuted,
    lineHeight: 18, textAlign: "center",
  },
});
