/**
 * Google AdMob configuration — Spinini Parental Control
 *
 * App IDs (set in app.json plugins):
 *   Android: ca-app-pub-6547633616671165~1006775154
 *   iOS:     ca-app-pub-3940256099942544~1458002511  (update when iOS unit created)
 */

import { Platform } from "react-native";

// ─── Ad Unit IDs ──────────────────────────────────────────────────────────────

export const AD_UNITS = {
  /** Banner shown at the top of parent screens */
  PARENT_BANNER: Platform.select({
    android: "ca-app-pub-6547633616671165/4484197185",
    ios:     "ca-app-pub-6547633616671165/4484197185",
    default: "ca-app-pub-6547633616671165/4484197185",
  })!,

  /** App Open ad — shown when app is launched or foregrounded */
  APP_OPEN: Platform.select({
    android: "ca-app-pub-6547633616671165/1194854715",
    ios:     "ca-app-pub-6547633616671165/1194854715",
    default: "ca-app-pub-6547633616671165/1194854715",
  })!,

  /** Interstitial shown occasionally when navigating */
  PARENT_INTERSTITIAL: Platform.select({
    android: "ca-app-pub-3940256099942544/1033173712", // update with real unit when ready
    ios:     "ca-app-pub-3940256099942544/4411468910",
    default: "ca-app-pub-3940256099942544/1033173712",
  })!,

  /** Rewarded ad — parent watches to unlock bonus AI queries */
  PARENT_REWARDED: Platform.select({
    android: "ca-app-pub-3940256099942544/5224354917", // update with real unit when ready
    ios:     "ca-app-pub-3940256099942544/1712485313",
    default: "ca-app-pub-3940256099942544/5224354917",
  })!,
} as const;

/**
 * How many screen navigations before showing an interstitial.
 * Set to 0 to disable interstitials.
 */
export const INTERSTITIAL_FREQUENCY = 5;
