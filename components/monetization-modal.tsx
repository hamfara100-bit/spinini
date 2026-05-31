/**
 * MonetizationModal
 *
 * Full-screen, forced-view modal shown ONCE on the very first app launch.
 * Parent must read the full message and tap "I Understand — Let's Go!" before
 * it can be dismissed. A countdown timer prevents early dismissal.
 *
 * • Free forever with limited ads on parent side only
 * • $19.99 one-time fee = no ads (yearly renewal keeps it ad-free)
 * • All data, features, and kids' side remain 100% free and ad-free regardless
 *
 * On second launch onwards this modal is NOT shown again.
 * Instead AdBanner renders quietly at the top of the parent dashboard.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Dimensions, StatusBar,
} from "react-native";
import { useRouter } from "expo-router";
import { Colors, FontSize, Radius, Spacing } from "../lib/theme";
import { useData } from "../lib/data/store";

const { width: W, height: H } = Dimensions.get("window");
const COUNTDOWN_SEC = 6; // seconds before dismiss button lights up

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

function CheckRow({ text, sub }: { text: string; sub?: string }) {
  return (
    <View style={s.checkRow}>
      <View style={s.checkCircle}><Text style={s.checkMark}>✓</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={s.checkText}>{text}</Text>
        {sub ? <Text style={s.checkSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}


export function MonetizationModal({ visible, onDismiss }: Props) {
  const { dispatch } = useData();
  const router = useRouter();
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const [canDismiss, setCanDismiss] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeIn    = useRef(new Animated.Value(0)).current;

  // Fade in the modal
  useEffect(() => {
    if (visible) {
      setCountdown(COUNTDOWN_SEC);
      setCanDismiss(false);
      Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [visible]);

  // Countdown ticker
  useEffect(() => {
    if (!visible) return;
    if (countdown <= 0) { setCanDismiss(true); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [visible, countdown]);

  // Pulse the dismiss button once it's active
  useEffect(() => {
    if (!canDismiss) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [canDismiss]);

  function handleDismiss() {
    if (!canDismiss) return;
    dispatch({ type: "AD_DISCLOSURE_SEEN" });
    onDismiss();
  }

  function handleUpgrade() {
    // Mark disclosure seen so the modal doesn't reappear, then navigate to the upgrade screen.
    dispatch({ type: "AD_DISCLOSURE_SEEN" });
    onDismiss();
    // Small delay to let the modal animate out before pushing the new screen.
    setTimeout(() => router.push("/parent/(more)/upgrade-adfree" as any), 300);
  }

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => { /* block hardware back — must see full screen */ }}
    >
      <StatusBar barStyle="light-content" backgroundColor="#1E0A4E" />
      <Animated.View style={[s.root, { opacity: fadeIn }]}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >

          {/* ── HERO ── */}
          <View style={s.hero}>
            <Text style={s.heroIcon}>🛡️</Text>
            <Text style={s.heroTitle}>Spinini is{"\n"}Completely Free</Text>
            <Text style={s.heroSub}>
              Every feature, every child, forever — no trials, no subscriptions.{"\n"}
              Here's how we keep the lights on. 💜
            </Text>
          </View>

          {/* ── AD MODEL SUMMARY ── */}
          <View style={s.adModelRow}>
            <View style={s.adModelCard}>
              <Text style={s.adModelEmoji}>👶</Text>
              <Text style={s.adModelTitle}>Kids Side</Text>
              <Text style={s.adModelValue}>Zero Ads</Text>
              <Text style={s.adModelSub}>Always — non-negotiable</Text>
            </View>
            <View style={[s.adModelCard, { borderColor: "#F97316" + "60" }]}>
              <Text style={s.adModelEmoji}>👤</Text>
              <Text style={s.adModelTitle}>Parent Side</Text>
              <Text style={[s.adModelValue, { color: "#F97316" }]}>Limited Ads</Text>
              <Text style={s.adModelSub}>Small banner only · removable</Text>
            </View>
          </View>

          {/* ── PROMISE CHECKLIST ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Our Promise to You</Text>
            <CheckRow
              text="Always free — forever"
              sub="Every feature, every kid, every screen — always free to use."
            />
            <CheckRow
              text="Kids' side is 100% ad-free"
              sub="Children never see a single ad, ever. Non-negotiable."
            />
            <CheckRow
              text="Your data stays on your device"
              sub="No servers, no selling, no tracking. It's all yours."
            />
            <CheckRow
              text="All features stay unlocked"
              sub="Whether you upgrade or not, nothing is paywalled."
            />
            <CheckRow
              text="You can always upgrade or cancel"
              sub="No tricks, no dark patterns, no pressure."
            />
          </View>

          {/* ── HOW ADS WORK ── */}
          <View style={s.adInfoBox}>
            <Text style={s.adInfoTitle}>📢 About Ads on the Parent Side</Text>
            <Text style={s.adInfoBody}>
              To keep Spinini free for every family, we show a small banner ad at the top of the{" "}
              <Text style={{ fontWeight: "800" }}>parent dashboard only</Text>. Ads are:
            </Text>
            <View style={{ marginTop: 10, gap: 6 }}>
              {[
                "Non-targeted — we never build a profile on you",
                "Family-friendly — filtered for appropriate content",
                "Never shown to children — kids see zero ads",
                "Never placed near sensitive content (reports, documents, location)",
                "Removable — upgrade once to eliminate them entirely",
              ].map((item, i) => (
                <Text key={i} style={s.adInfoItem}>✅  {item}</Text>
              ))}
            </View>
          </View>

          {/* ── UPGRADE OPTION ── */}
          <Text style={s.sectionTitle}>Optional Upgrade</Text>
          <TouchableOpacity style={s.upgradeCard} onPress={handleUpgrade} activeOpacity={0.88}>
            <View style={s.upgradeCardHeader}>
              <View style={s.upgradeBadge}><Text style={s.upgradeBadgeText}>AD-FREE</Text></View>
              <View style={{ flex: 1 }} />
              <Text style={s.upgradePrice}>$19.99 <Text style={s.upgradePer}>/year</Text></Text>
            </View>
            <Text style={s.upgradeDesc}>Remove all ads from the parent dashboard</Text>
            <View style={{ gap: 5, marginTop: 8 }}>
              {[
                "Zero ads anywhere in the app",
                "One-time purchase — not a subscription",
                "$19.99/year renewal keeps ads gone",
                "Let it lapse → returns to free, no data lost",
              ].map((f, i) => (
                <Text key={i} style={s.upgradeFeature}>• {f}</Text>
              ))}
            </View>
            <View style={s.upgradeBtn}>
              <Text style={s.upgradeBtnText}>Remove Ads — Upgrade Now →</Text>
            </View>
          </TouchableOpacity>

          {/* ── RENEWAL CLARIFICATION ── */}
          <View style={s.renewalBox}>
            <Text style={s.renewalTitle}>💡 How the $19.99 Renewal Works</Text>
            <Text style={s.renewalBody}>
              The Ad-Free upgrade is a <Text style={{ fontWeight: "800" }}>one-time purchase</Text> of $19.99.
              Your app stays ad-free for 12 months. After that, you can renew for $19.99/year to keep ads away —
              or simply let it lapse and return to the free version with limited ads.{"\n\n"}
              <Text style={{ fontWeight: "800" }}>Either way, all your data, all features, and your entire kids' setup
              remain completely intact and fully working. We will never delete your data or restrict features
              based on your payment status.</Text>
            </Text>
          </View>

          {/* ── DISMISS BUTTON ── */}
          <View style={s.dismissWrap}>
            <Animated.View style={{ transform: [{ scale: canDismiss ? pulseAnim : 1 }], width: "100%" }}>
              <TouchableOpacity
                style={[s.dismissBtn, !canDismiss && s.dismissBtnDisabled]}
                onPress={handleDismiss}
                activeOpacity={canDismiss ? 0.85 : 1}
                disabled={!canDismiss}
              >
                <Text style={[s.dismissBtnText, !canDismiss && s.dismissBtnTextDisabled]}>
                  {canDismiss
                    ? "I Understand — Let's Go! 🚀"
                    : `Please read above… (${countdown})`
                  }
                </Text>
              </TouchableOpacity>
            </Animated.View>
            <Text style={s.dismissHint}>
              You will not see this screen again.{"\n"}
              Upgrade to Ad-Free any time — Help page or tap the banner.
            </Text>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1E0A4E",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
  },

  // Hero
  hero: { alignItems: "center", marginBottom: 32 },
  heroIcon: { fontSize: 64, marginBottom: 16 },
  heroTitle: {
    fontSize: 36, fontWeight: "900", color: "#fff",
    textAlign: "center", lineHeight: 42, marginBottom: 14,
  },
  heroSub: {
    fontSize: FontSize.base, color: "rgba(255,255,255,0.78)",
    textAlign: "center", lineHeight: 24,
  },

  // Section
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: FontSize.base, fontWeight: "900", color: "#fff",
    textTransform: "uppercase", letterSpacing: 0.8,
    marginBottom: 14,
  },

  // Check rows
  checkRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    marginBottom: 10,
  },
  checkCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#10B981", alignItems: "center", justifyContent: "center",
    flexShrink: 0, marginTop: 1,
  },
  checkMark: { color: "#fff", fontWeight: "900", fontSize: 14 },
  checkText: { fontSize: FontSize.base, fontWeight: "700", color: "#fff", lineHeight: 22 },
  checkSub: { fontSize: FontSize.sm, color: "rgba(255,255,255,0.6)", marginTop: 2, lineHeight: 18 },

  // Ad info box
  adInfoBox: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: Radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: 28,
  },
  adInfoTitle: { fontSize: FontSize.base, fontWeight: "900", color: "#fff", marginBottom: 8 },
  adInfoBody: { fontSize: FontSize.sm, color: "rgba(255,255,255,0.75)", lineHeight: 20 },
  adInfoItem: { fontSize: FontSize.sm, color: "rgba(255,255,255,0.82)", lineHeight: 22 },

  // Ad model summary cards
  adModelRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  adModelCard: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: Radius.xl, padding: 14,
    alignItems: "center", gap: 3,
    borderWidth: 1.5, borderColor: "#10B98160",
  },
  adModelEmoji:  { fontSize: 28 },
  adModelTitle:  { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.60)", textTransform: "uppercase", letterSpacing: 0.5 },
  adModelValue:  { fontSize: FontSize.base, fontWeight: "900", color: "#10B981" },
  adModelSub:    { fontSize: 10, color: "rgba(255,255,255,0.50)", textAlign: "center" },

  // Upgrade card
  upgradeCard: {
    backgroundColor: "rgba(108,60,225,0.18)",
    borderRadius: Radius.xl, padding: 18,
    borderWidth: 1.5, borderColor: "#6C3CE180",
    marginBottom: 20,
  },
  upgradeCardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  upgradeBadge: {
    backgroundColor: "#6C3CE1", borderRadius: 100,
    paddingVertical: 4, paddingHorizontal: 12,
  },
  upgradeBadgeText: { fontSize: 11, fontWeight: "900", color: "#fff", letterSpacing: 0.5 },
  upgradePrice: { fontSize: FontSize.lg, fontWeight: "900", color: "#fff" },
  upgradePer: { fontSize: FontSize.sm, fontWeight: "500", color: "rgba(255,255,255,0.60)" },
  upgradeDesc: { fontSize: FontSize.sm, color: "rgba(255,255,255,0.75)", lineHeight: 19 },
  upgradeFeature: { fontSize: 11, color: "rgba(255,255,255,0.70)", lineHeight: 17 },
  upgradeBtn: {
    marginTop: 14, backgroundColor: "#6C3CE1",
    borderRadius: Radius.lg, paddingVertical: 13, alignItems: "center",
    shadowColor: "#6C3CE1", shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 6,
  },
  upgradeBtnText: { fontSize: FontSize.base, fontWeight: "900", color: "#fff" },

  // Renewal box
  renewalBox: {
    backgroundColor: "rgba(108,60,225,0.25)",
    borderRadius: Radius.xl, padding: 20,
    borderWidth: 1, borderColor: "rgba(108,60,225,0.5)",
    marginBottom: 32,
  },
  renewalTitle: { fontSize: FontSize.base, fontWeight: "900", color: "#fff", marginBottom: 10 },
  renewalBody: { fontSize: FontSize.sm, color: "rgba(255,255,255,0.80)", lineHeight: 21 },

  // Dismiss
  dismissWrap: { alignItems: "center", gap: 14 },
  dismissBtn: {
    backgroundColor: "#6C3CE1",
    borderRadius: Radius.xl, paddingVertical: 18,
    alignItems: "center", width: "100%",
    shadowColor: "#6C3CE1", shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 12,
    elevation: 8,
  },
  dismissBtnDisabled: {
    backgroundColor: "rgba(255,255,255,0.1)",
    shadowOpacity: 0,
    elevation: 0,
  },
  dismissBtnText: { fontSize: FontSize.md, fontWeight: "900", color: "#fff" },
  dismissBtnTextDisabled: { color: "rgba(255,255,255,0.35)" },
  dismissHint: {
    fontSize: FontSize.xs, color: "rgba(255,255,255,0.45)",
    textAlign: "center", lineHeight: 18,
  },
});
