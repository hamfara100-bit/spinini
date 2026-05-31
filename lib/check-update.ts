/**
 * checkForUpdates — shared update-check utility for parent and kid help screens.
 *
 * iOS:  Queries the iTunes Lookup API with the app's bundle ID.
 *       Compares the store version to the installed version.
 *       If a newer version is found → Alert with "Update Now" button (App Store link).
 *       If already current / API says nothing → "You're up to date" message.
 *
 * Android: Google Play has no official public version API.
 *       Shows current version and offers a direct link to the Play Store page
 *       so the user can check / tap "Update" there.
 *
 * Both platforms gracefully handle offline / lookup failure by showing the
 * installed version and a "check manually" note.
 *
 * TODO: Replace APP_STORE_URL with the real App Store listing URL before release.
 */

import Constants from "expo-constants";
import { Platform, Alert, Linking } from "react-native";

export const APP_VERSION: string = Constants.expoConfig?.version ?? "1.0.0";

const BUNDLE_ID      = "com.famkids.app";
const APP_STORE_URL  = "https://apps.apple.com/app/id000000000"; // TODO: replace with real App Store ID
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${BUNDLE_ID}`;

/** Returns true if version string a is strictly greater than b (semver-style). */
function versionGT(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na > nb;
  }
  return false;
}

/**
 * Run the update check and show an Alert with the result.
 *
 * @param setChecking - state setter to show/hide a loading indicator in the UI
 */
export async function checkForUpdates(setChecking: (v: boolean) => void): Promise<void> {
  setChecking(true);

  try {
    if (Platform.OS === "ios") {
      // ── iOS: use Apple's public iTunes Lookup API ──────────────────────────
      const res = await fetch(
        `https://itunes.apple.com/lookup?bundleId=${BUNDLE_ID}`,
        { headers: { Accept: "application/json" } }
      );
      const json = await res.json();
      const storeVersion: string | undefined = json?.results?.[0]?.version;
      const storeUrl: string = json?.results?.[0]?.trackViewUrl ?? APP_STORE_URL;

      setChecking(false);

      if (!storeVersion) {
        // App not yet published to the store, or lookup returned no results
        Alert.alert(
          "✅ You're up to date!",
          `You have version ${APP_VERSION}, which is the latest available.`
        );
        return;
      }

      if (versionGT(storeVersion, APP_VERSION)) {
        Alert.alert(
          "🎉 Update Available!",
          `Version ${storeVersion} is now on the App Store.\nYou have version ${APP_VERSION}.`,
          [
            { text: "Later", style: "cancel" },
            { text: "Update Now →", onPress: () => Linking.openURL(storeUrl) },
          ]
        );
      } else {
        Alert.alert(
          "✅ You're up to date!",
          `Version ${APP_VERSION} is the latest version available.`
        );
      }
    } else {
      // ── Android: no public version API — link to Play Store ───────────────
      setChecking(false);
      Alert.alert(
        "Check for Updates",
        `Installed version: ${APP_VERSION}\n\nTap "Open Google Play" to check if a newer version is available.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Google Play →", onPress: () => Linking.openURL(PLAY_STORE_URL) },
        ]
      );
    }
  } catch {
    // Network error or unexpected parse failure
    setChecking(false);
    Alert.alert(
      "✅ You're up to date!",
      `You have version ${APP_VERSION}.\n\n(Could not reach the app store to verify — you may want to check manually.)`
    );
  }
}
