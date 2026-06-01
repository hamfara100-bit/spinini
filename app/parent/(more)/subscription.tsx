import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { nowIso } from "../../../lib/utils";

type Tier = "free" | "family" | "premium";

const PLANS: {
  id: Tier;
  name: string;
  price: string;
  period: string;
  color: string;
  emoji: string;
  features: string[];
  cta: string;
}[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    color: Colors.textSecondary,
    emoji: "🌱",
    features: [
      "1 kid profile",
      "7-day usage history",
      "AI Buddy chat (10 msgs/day)",
      "Chores & rewards",
      "Journal & drawing",
      "Basic school tools",
      "Family calendar",
    ],
    cta: "Current Plan",
  },
  {
    id: "family",
    name: "Spinini+",
    price: "$4.99",
    period: "/ month",
    color: Colors.primary,
    emoji: "⭐",
    features: [
      "Unlimited kid profiles",
      "90-day usage history",
      "Unlimited AI Buddy & Homework Helper",
      "AI story generator with character memory",
      "AI coloring pages",
      "Morning Routine unlock gate",
      "Screen Time Borrowing",
      "Allowance Automation",
      "Weekly Digest Email",
      "Mood Check-in & graph",
      "Trophy Room & achievements",
      "Teen Mode",
      "Behavior Insights",
      "Sibling Leaderboard",
      "Cloud backup & sync",
      "Family album & messaging",
      "Location & safe zones",
      "Parent AI agent",
    ],
    cta: "Upgrade to Spinini+",
  },
  {
    id: "premium",
    name: "Premium",
    price: "$9.99",
    period: "/ month",
    color: Colors.secondary,
    emoji: "💎",
    features: [
      "Everything in Spinini+",
      "Priority AI (faster responses)",
      "iOS Screen Time API controls",
      "Early access to new features",
      "Email support",
      "Family account sharing (2 parents)",
    ],
    cta: "Upgrade to Premium",
  },
];

const FAQS = [
  {
    q: "Will I be charged during the trial?",
    a: "No. Your card won't be charged until the trial ends. Cancel anytime before then.",
  },
  {
    q: "What happens if I downgrade?",
    a: "Your data is always preserved. You'll lose access to premium features but all your profiles, chores, and history stay intact.",
  },
  {
    q: "Can I use Spinini on multiple devices?",
    a: "Yes — the parent app and kid app can run on separate devices. Family and Premium plans allow full multi-device sync.",
  },
  {
    q: "Is the AI chat safe for kids?",
    a: "Yes. The AI Buddy is configured with strict age-appropriate guidelines. It won't discuss violence, adult content, or provide harmful information.",
  },
];

export default function SubscriptionScreen() {
  const { state, dispatch } = useData();
  const router = useRouter();
  const current = state.parentSettings.subscriptionTier ?? "free";
  const isAdFree = state.parentSettings.adFree ?? false;
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);

  async function restorePurchases() {
    setRestoring(true);
    // In production this calls your payment provider (RevenueCat, StoreKit, etc.)
    // For now simulate a restore check
    await new Promise(r => setTimeout(r, 1500));
    setRestoring(false);
    Alert.alert(
      "Restore Purchases",
      current !== "free"
        ? `✅ Your ${PLANS.find(p => p.id === current)?.name} plan has been restored.`
        : "No active purchases found on this Apple ID.\n\nIf you believe this is an error, contact support@spinini.app.",
      [{ text: "OK" }]
    );
  }

  function selectPlan(tier: Tier) {
    if (tier === "free") {
      Alert.alert("Downgrade to Free?", "You'll keep your data but lose premium features.", [
        { text: "Cancel" },
        {
          text: "Downgrade",
          style: "destructive",
          onPress: () => dispatch({ type: "SET_PARENT_SETTINGS", payload: { subscriptionTier: "free", subscriptionExpiresAt: undefined } }),
        },
      ]);
      return;
    }

    // In production this would open your payment provider (RevenueCat, Stripe, etc.)
    const planName = PLANS.find(p => p.id === tier)?.name ?? tier;
    Alert.alert(
      `Upgrade to ${planName}`,
      `In a production build this opens your payment provider (App Store / Google Play).\n\nFor now we'll activate it directly.`,
      [
        { text: "Cancel" },
        {
          text: `Activate ${planName} ✓`,
          onPress: () => {
            const expires = new Date();
            expires.setDate(expires.getDate() + 365); // 1-year billing cycle
            dispatch({
              type: "SET_PARENT_SETTINGS",
              payload: {
                subscriptionTier: tier,
                subscriptionExpiresAt: expires.toISOString(),
              },
            });
            Alert.alert(`${planName} Activated! 🎉`, `Your ${planName} plan is now active. Enjoy all the features!`);
          },
        },
      ]
    );
  }

  const expiry = state.parentSettings.subscriptionExpiresAt
    ? new Date(state.parentSettings.subscriptionExpiresAt).toLocaleDateString()
    : null;

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>💎 Subscription</Text>

      {/* ── Ad-Free Upgrade shortcut ── */}
      <TouchableOpacity
        style={[styles.adFreeShortcut, isAdFree && styles.adFreeShortcutActive]}
        onPress={() => router.push("/parent/(more)/upgrade-adfree" as any)}
        activeOpacity={0.85}
      >
        <Text style={styles.adFreeShortcutIcon}>{isAdFree ? "🎉" : "🚫📢"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.adFreeShortcutTitle}>
            {isAdFree ? "Ad-Free — Active ✓" : "Remove Ads — Go Ad-Free"}
          </Text>
          <Text style={styles.adFreeShortcutSub}>
            {isAdFree
              ? "Your parent dashboard is completely ad-free."
              : "Completely free app · $19.99 one-time removes all parent-side ads"}
          </Text>
        </View>
        <Text style={styles.adFreeShortcutArrow}>›</Text>
      </TouchableOpacity>

      {/* Current plan banner */}
      {current !== "free" && expiry && (
        <View style={styles.activeBanner}>
          <Text style={styles.activeBannerText}>
            ✅ {PLANS.find(p => p.id === current)?.name} plan active · renews {expiry}
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL("https://spinini.app/billing")}>
            <Text style={styles.manageLink}>Manage →</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.tagline}>Unlock the full Spinini experience for your family</Text>

      {/* Restore Purchases — Apple requires this to be visible on the paywall */}
      <TouchableOpacity style={styles.restoreBtn} onPress={restorePurchases} disabled={restoring}>
        <Text style={styles.restoreBtnText}>
          {restoring ? "Checking purchases…" : "↩ Restore Purchases"}
        </Text>
      </TouchableOpacity>

      {/* Legal links — Apple requires ToS + Privacy on the paywall */}
      <View style={styles.legalRow}>
        <TouchableOpacity onPress={() => Linking.openURL("https://spinini.app/terms")}>
          <Text style={styles.legalLink}>Terms of Service</Text>
        </TouchableOpacity>
        <Text style={styles.legalSep}>·</Text>
        <TouchableOpacity onPress={() => Linking.openURL("https://spinini.app/privacy")}>
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>

      {/* Plan cards */}
      {PLANS.map(plan => {
        const isCurrent = current === plan.id;
        return (
          <View key={plan.id} style={[styles.planCard, isCurrent && { borderColor: plan.color, borderWidth: 2 }]}>
            {isCurrent && (
              <View style={[styles.currentBadge, { backgroundColor: plan.color }]}>
                <Text style={styles.currentBadgeText}>Current Plan</Text>
              </View>
            )}
            {plan.id === "family" && !isCurrent && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>🔥 Most Popular</Text>
              </View>
            )}

            <View style={styles.planHeader}>
              <Text style={styles.planEmoji}>{plan.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
                <View style={styles.priceRow}>
                  <Text style={[styles.planPrice, { color: plan.color }]}>{plan.price}</Text>
                  <Text style={styles.planPeriod}>{plan.period}</Text>
                </View>
              </View>
            </View>

            <View style={styles.featureList}>
              {plan.features.map(f => (
                <View key={f} style={styles.featureRow}>
                  <Text style={[styles.featureCheck, { color: plan.color }]}>✓</Text>
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.planBtn, { backgroundColor: isCurrent ? Colors.cardLight : plan.color }]}
              onPress={() => !isCurrent && selectPlan(plan.id)}
              disabled={isCurrent}
            >
              <Text style={[styles.planBtnText, isCurrent && { color: Colors.textSecondary }]}>
                {isCurrent ? "✓ Active" : plan.cta}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}

      {/* Feature comparison note */}
      <View style={styles.noteCard}>
        <Text style={styles.noteTitle}>🍎 iOS Screen Time Controls</Text>
        <Text style={styles.noteText}>
          Full app blocking, downtime scheduling, and web filtering on iOS requires Apple's Screen Time API approval. This is included in the Premium plan and will be enabled once our Apple entitlement is approved.
        </Text>
      </View>

      {/* FAQ */}
      <Text style={styles.faqTitle}>Frequently Asked Questions</Text>
      {FAQS.map((faq, i) => (
        <TouchableOpacity
          key={i}
          style={styles.faqCard}
          onPress={() => setExpandedFaq(expandedFaq === i ? null : i)}
        >
          <View style={styles.faqRow}>
            <Text style={styles.faqQ}>{faq.q}</Text>
            <Text style={styles.faqChevron}>{expandedFaq === i ? "▲" : "▼"}</Text>
          </View>
          {expandedFaq === i && (
            <Text style={styles.faqA}>{faq.a}</Text>
          )}
        </TouchableOpacity>
      ))}

      <Text style={styles.footer}>
        Subscriptions are billed monthly. Cancel anytime. Prices in USD.{"\n"}
        Contact support@spinini.app for billing issues.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title:   { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.sm },
  tagline: { fontSize: FontSize.base, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 22 },

  adFreeShortcut: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#6C3CE1",
    borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md,
    shadowColor: "#6C3CE1", shadowOpacity: 0.30,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 5,
  },
  adFreeShortcutActive: { backgroundColor: Colors.success },
  adFreeShortcutIcon:  { fontSize: 26 },
  adFreeShortcutTitle: { fontSize: FontSize.base, fontWeight: "900", color: "#fff" },
  adFreeShortcutSub:   { fontSize: FontSize.xs, color: "rgba(255,255,255,0.78)", marginTop: 2, lineHeight: 16 },
  adFreeShortcutArrow: { fontSize: 22, color: "rgba(255,255,255,0.60)" },

  activeBanner:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: Colors.success + "18", borderRadius: Radius.lg, padding: Spacing.sm, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.success + "40" },
  activeBannerText: { fontSize: FontSize.sm, color: Colors.success, fontWeight: "600", flex: 1 },
  manageLink:       { color: Colors.primary, fontWeight: "700", fontSize: FontSize.sm, marginLeft: 8 },

  planCard: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl,
    padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm,
    borderWidth: 1, borderColor: Colors.border, overflow: "hidden",
  },
  currentBadge:     { position: "absolute", top: 0, right: 0, backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 4, borderBottomLeftRadius: Radius.md },
  currentBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  popularBadge:     { position: "absolute", top: 0, right: 0, backgroundColor: Colors.secondary, paddingHorizontal: 12, paddingVertical: 4, borderBottomLeftRadius: Radius.md },
  popularBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  planHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: Spacing.md },
  planEmoji:  { fontSize: 40 },
  planName:   { fontSize: FontSize.lg, fontWeight: "800" },
  priceRow:   { flexDirection: "row", alignItems: "baseline", gap: 4 },
  planPrice:  { fontSize: FontSize.xl, fontWeight: "900" },
  planPeriod: { fontSize: FontSize.sm, color: Colors.textSecondary },

  featureList: { gap: 8, marginBottom: Spacing.md },
  featureRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  featureCheck:{ fontSize: 14, fontWeight: "800" },
  featureText: { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },

  planBtn:     { borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  planBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },

  noteCard: {
    backgroundColor: Colors.info + "12", borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: Colors.info + "30",
  },
  noteTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.info, marginBottom: 6 },
  noteText:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  faqTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary, marginBottom: Spacing.sm },
  faqCard:  { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  faqRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  faqQ:     { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary, flex: 1 },
  faqChevron: { color: Colors.textSecondary, marginLeft: 8 },
  faqA:     { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginTop: 8 },

  footer: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: "center", lineHeight: 18, marginTop: Spacing.md, marginBottom: Spacing.xl },

  restoreBtn: { alignSelf: "center", paddingVertical: 8, paddingHorizontal: 20, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  restoreBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600" },

  legalRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: Spacing.lg },
  legalLink: { fontSize: FontSize.xs, color: Colors.primary, textDecorationLine: "underline" },
  legalSep:  { fontSize: FontSize.xs, color: Colors.textSecondary },
});
