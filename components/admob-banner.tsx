/**
 * AdMob banner component for parent screens.
 * Renders a standard banner ad at the bottom of the screen.
 * Hides itself gracefully if ads fail to load or on simulator.
 */

import React, { useState } from "react";
import { View, StyleSheet, Platform } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import { AD_UNITS } from "../lib/ads";

interface AdMobBannerProps {
  /** Extra bottom padding to push content above the banner */
  onHeightChange?: (height: number) => void;
}

const BANNER_UNIT_ID = __DEV__
  ? (Platform.OS === "ios" ? TestIds.BANNER : TestIds.BANNER)
  : AD_UNITS.PARENT_BANNER;

export function AdMobBanner({ onHeightChange }: AdMobBannerProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <View style={[styles.container, !loaded && styles.hidden]}>
      <BannerAd
        unitId={BANNER_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,   // Families policy: no personalised ad targeting
        }}
        onAdLoaded={() => {
          setLoaded(true);
          onHeightChange?.(50);
        }}
        onAdFailedToLoad={() => {
          setFailed(true);
          onHeightChange?.(0);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  hidden: {
    height: 0,
    overflow: "hidden",
  },
});
