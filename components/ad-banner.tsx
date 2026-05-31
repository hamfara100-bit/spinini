/**
 * AdBanner — parent-side ad placeholder
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️  ADMOB NOT YET CONFIGURED
 *
 * Before building the APK / submitting to Apple or Google:
 *   1. Install:  npx expo install react-native-google-mobile-ads
 *   2. Add your AdMob App IDs to app.json under
 *      expo.plugins → react-native-google-mobile-ads:
 *        "androidAppId": "ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX"
 *        "iosAppId":     "ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX"
 *   3. Replace the placeholder <View> below with:
 *        import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";
 *        const BANNER_ID = __DEV__ ? TestIds.BANNER : "ca-app-pub-XXXX/XXXX";
 *        <BannerAd unitId={BANNER_ID} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
 *                  onAdLoaded={() => setShowUpgradeHint(true)} />
 *   4. Remove the placeholder styles + the TODO comment.
 *   5. See full checklist: ADMOB_REMINDER.md
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This component is ONLY rendered on the parent side of the app.
 * It is NEVER imported or rendered anywhere inside the kid view.
 * Kids see ZERO ads — always.
 *
 * The small "Upgrade to Ad-Free" hint appears a few seconds after the ad loads
 * (simulated here with a 3-second delay; with real AdMob use the onAdLoaded
 * callback to trigger it instead).
 */

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Colors, FontSize, Radius, Spacing } from "../lib/theme";

interface Props {
  /** Pass true to hide the banner (ad-free purchase active) */
  hidden?: boolean;
}

/** Delay (ms) after ad appears before showing the upgrade nudge */
const UPGRADE_HINT_DELAY = 3000;

export function AdBanner({ hidden }: Props) {
  const router = useRouter();
  const [showUpgradeHint, setShowUpgradeHint] = useState(false);

  // Show the upgrade nudge after the ad has been visible for a moment.
  // When real AdMob is wired, call setShowUpgradeHint(true) inside onAdLoaded instead.
  useEffect(() => {
    const t = setTimeout(() => setShowUpgradeHint(true), UPGRADE_HINT_DELAY);
    return () => clearTimeout(t);
  }, []);

  if (hidden) return null;

  return (
    <View style={styles.container}>
      {/* ── REPLACE THIS BLOCK WITH REAL ADMOB BANNER WHEN READY ── */}
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>📢 Advertisement</Text>
        <Text style={styles.placeholderSub}>Ad placeholder — AdMob not yet configured</Text>
      </View>
      {/* ──────────────────────────────────────────────────────────── */}

      {/* Upgrade nudge — fades in once the ad has played */}
      {showUpgradeHint && (
        <TouchableOpacity
          style={styles.upgradeHint}
          onPress={() => router.push("/parent/(more)/upgrade-adfree" as any)}
          activeOpacity={0.7}
        >
          <Text style={styles.upgradeHintText}>
            Remove ads —{" "}
            <Text style={styles.upgradeHintLink}>Upgrade to Ad-Free</Text>
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    backgroundColor: Colors.surfaceLight,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },

  // ── Placeholder (remove when AdMob is live) ──────────────────────────────
  placeholder: {
    width: "100%",
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    gap: 2,
  },
  placeholderText: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  placeholderSub: {
    fontSize: 10,
    color: Colors.textMuted,
  },

  // ── Upgrade nudge ─────────────────────────────────────────────────────────
  upgradeHint: {
    width: "100%",
    paddingVertical: 5,
    paddingHorizontal: Spacing.sm,
    alignItems: "center",
    backgroundColor: Colors.bgLight,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  upgradeHintText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  upgradeHintLink: {
    color: Colors.primary,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
