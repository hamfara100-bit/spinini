/**
 * App Open Ad hook — shows a full-screen ad when the app is launched or
 * brought back to the foreground (AppState "active").
 *
 * Ad unit: ca-app-pub-6547633616671165/1194854715
 *
 * Usage: call useAppOpenAd() once inside a component that is always mounted
 * (e.g. the root layout bridge). It self-manages loading and showing.
 */

import { useEffect, useRef } from "react";
import { AppState as RNAppState, Platform } from "react-native";
import {
  AppOpenAd,
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import { AD_UNITS } from "../lib/ads";

const UNIT_ID = __DEV__
  ? (Platform.OS === "ios" ? TestIds.APP_OPEN : TestIds.APP_OPEN)
  : AD_UNITS.APP_OPEN;

/** Minimum gap between App Open shows — 4 hours */
const MIN_INTERVAL_MS = 4 * 60 * 60 * 1000;

export function useAppOpenAd() {
  const adRef = useRef<AppOpenAd | null>(null);
  const loadedRef = useRef(false);
  const lastShownRef = useRef(0);
  const appStateRef = useRef(RNAppState.currentState);

  function loadAd() {
    try {
      const ad = AppOpenAd.createForAdRequest(UNIT_ID, {
        requestNonPersonalizedAdsOnly: false,
      });

      const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
        loadedRef.current = true;
      });

      const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        loadedRef.current = false;
        unsubLoaded();
        unsubClosed();
        // Preload for next time
        loadAd();
      });

      ad.addAdEventListener(AdEventType.ERROR, () => {
        loadedRef.current = false;
        // Retry after 60s on error
        setTimeout(loadAd, 60_000);
      });

      ad.load();
      adRef.current = ad;
    } catch {
      // Ads unavailable (emulator without Play Services, etc.)
    }
  }

  function tryShow() {
    const now = Date.now();
    if (!loadedRef.current || !adRef.current) return;
    if (now - lastShownRef.current < MIN_INTERVAL_MS) return;
    try {
      lastShownRef.current = now;
      adRef.current.show();
    } catch {
      // Silent fail
    }
  }

  useEffect(() => {
    // Load immediately on mount (cold launch)
    loadAd();

    // Show when returning from background
    const sub = RNAppState.addEventListener("change", nextState => {
      if (appStateRef.current !== "active" && nextState === "active") {
        tryShow();
      }
      appStateRef.current = nextState;
    });

    // Show on initial launch after a short delay to let the UI settle
    const timer = setTimeout(tryShow, 1500);

    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
