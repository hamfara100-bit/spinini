/**
 * Hook that loads an interstitial ad and shows it automatically
 * every N navigations (controlled by INTERSTITIAL_FREQUENCY in lib/ads.ts).
 *
 * Usage:
 *   const { showInterstitial } = useInterstitialAd();
 *   // Call showInterstitial() on screen navigation
 */

import { useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import {
  InterstitialAd,
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import { AD_UNITS, INTERSTITIAL_FREQUENCY } from "../lib/ads";

const UNIT_ID = __DEV__
  ? (Platform.OS === "ios" ? TestIds.INTERSTITIAL : TestIds.INTERSTITIAL)
  : AD_UNITS.PARENT_INTERSTITIAL;

export function useInterstitialAd() {
  const adRef = useRef<InterstitialAd | null>(null);
  const loadedRef = useRef(false);
  const navCountRef = useRef(0);

  const loadAd = useCallback(() => {
    if ((INTERSTITIAL_FREQUENCY as number) === 0) return;
    try {
      const ad = InterstitialAd.createForAdRequest(UNIT_ID, {
        requestNonPersonalizedAdsOnly: false,
      });
      const unsubscribeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
        loadedRef.current = true;
      });
      const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        loadedRef.current = false;
        unsubscribeLoaded();
        unsubscribeClosed();
        // Preload the next one
        loadAd();
      });
      ad.load();
      adRef.current = ad;
    } catch {
      // Ads not available (simulator, no network, etc.) — silent fail
    }
  }, []);

  useEffect(() => {
    loadAd();
  }, [loadAd]);

  const showInterstitial = useCallback(() => {
    if ((INTERSTITIAL_FREQUENCY as number) === 0) return;
    navCountRef.current += 1;
    if (navCountRef.current >= INTERSTITIAL_FREQUENCY && loadedRef.current && adRef.current) {
      navCountRef.current = 0;
      try {
        adRef.current.show();
      } catch {
        // Silent fail
      }
    }
  }, []);

  return { showInterstitial };
}
