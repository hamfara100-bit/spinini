// Trystero/WebRTC Hermes polyfills — MUST be first so crypto.subtle,
// getRandomValues and the WebRTC globals exist before any comms code runs.
import "../lib/comms/trystero-polyfills";
import React, { useState, useEffect, useRef } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, Linking, AppState as RNAppState, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as NavigationBar from "expo-navigation-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { DataProvider, useData } from "../lib/data/store";
import { trpc } from "../lib/trpc";
import { useAppScheduler } from "../lib/app-scheduler";
import { useAppOpenAd } from "../hooks/use-app-open-ad";
import { uid, nowIso } from "../lib/utils";
import { ErrorBoundary } from "../components/error-boundary";
// Import background module at module scope — this registers TaskManager task handlers
// before any rendering occurs, which is required by expo-task-manager.
import { startBackgroundTasks, readBgEvents, clearBgEvents } from "../lib/background";
import { startAppMonitor, stopAppMonitor } from "../lib/app-monitor-bridge";
import { OfflineBanner } from "../components/offline-banner";
import * as Notifications from "expo-notifications";
import { getRemainingMinutes } from "../lib/data/logic";

// Starts background tasks on mount and replays any events they produced
// while the app was not in the foreground.
function BackgroundBridge() {
  const { dispatch } = useData();
  const appState = useRef(RNAppState.currentState);

  async function flushBgEvents() {
    const events = await readBgEvents();
    if (!events.length) return;
    await clearBgEvents();
    for (const ev of events) {
      try { dispatch(ev as any); } catch {}
    }
  }

  async function hideNavBar() {
    if (Platform.OS !== "android") return;
    try {
      await NavigationBar.setVisibilityAsync("hidden");
      await NavigationBar.setBehaviorAsync("overlay-swipe");
    } catch {}
  }

  useEffect(() => {
    // Start background tasks (idempotent — safe to call multiple times)
    startBackgroundTasks();
    // Start app monitor (real usage + blocked app overlay)
    startAppMonitor();
    // Flush any events produced while the app was killed/backgrounded
    flushBgEvents();
    // Hide Android system navigation bar (back/home/recents)
    hideNavBar();

    // Re-flush + re-hide nav bar whenever the app returns to foreground
    const sub = RNAppState.addEventListener("change", nextState => {
      if (appState.current !== "active" && nextState === "active") {
        flushBgEvents();
        hideNavBar();
      }
      appState.current = nextState;
    });
    return () => { sub.remove(); stopAppMonitor(); };
  }, []);

  return null;
}

function AppOpenAdBridge() {
  useAppOpenAd();
  return null;
}

function SchedulerBridge() {
  const { state, dispatch } = useData();
  useAppScheduler(state.kids, dispatch);

  useEffect(() => {
    const approvedChores = state.kids.reduce(
      (sum, k) => sum + k.chores.filter(c => c.status === "approved").length, 0
    );
    maybeRequestReview(approvedChores);
  }, []);

  return null;
}

// Prompts for an App Store / Play Store review after the app has been used for 7 days
// or after 3 chore approvals — whichever comes first.
// Requires: npx expo install expo-store-review
const REVIEW_KEY = "@famkids/review-prompted";
const INSTALL_DATE_KEY = "@famkids/install-date";
async function maybeRequestReview(approvedChores: number) {
  try {
    const StoreReview = require("expo-store-review");
    if (!StoreReview.isAvailableAsync || !(await StoreReview.isAvailableAsync())) return;

    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    const alreadyPrompted = await AsyncStorage.getItem(REVIEW_KEY);
    if (alreadyPrompted) return;

    let installDate = await AsyncStorage.getItem(INSTALL_DATE_KEY);
    if (!installDate) {
      installDate = new Date().toISOString();
      await AsyncStorage.setItem(INSTALL_DATE_KEY, installDate);
    }
    const daysSinceInstall = (Date.now() - new Date(installDate).getTime()) / 86_400_000;
    if (daysSinceInstall >= 7 || approvedChores >= 3) {
      await StoreReview.requestReview();
      await AsyncStorage.setItem(REVIEW_KEY, "1");
    }
  } catch {}
}

// Fires a parent notification the first time a kid's remaining screen time hits 0.
function ScreenTimeLimitNotifier() {
  const { state } = useData();
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => {
      for (const kid of state.kids) {
        const remaining = getRemainingMinutes(kid);
        const key = `${kid.profile.id}-${new Date().toDateString()}`;
        if (remaining <= 0 && !notifiedRef.current.has(key)) {
          notifiedRef.current.add(key);
          Notifications.scheduleNotificationAsync({
            content: {
              title: "⏰ Screen time limit reached",
              body: `${kid.profile.name} has used their full screen time for today.`,
              sound: true,
            },
            trigger: null,
          }).catch(() => {});
        }
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [state.kids]);

  return null;
}

// Handles deep links for voice commands:
//   famkids://ping/:kidId?message=…
//   famkids://alarm/:kidId
//   famkids://lock/:kidId?reason=…
function DeepLinkHandler() {
  const { state, dispatch } = useData();

  function handleUrl(url: string) {
    try {
      // Strip scheme prefix so we can parse the path
      const withoutScheme = url.replace(/^famkids:\/\//, "");
      const [rawPath, rawQuery] = withoutScheme.split("?");
      const parts = rawPath.split("/").filter(Boolean);
      const action = parts[0];
      const kidId  = parts[1];

      const params: Record<string, string> = {};
      if (rawQuery) {
        rawQuery.split("&").forEach(pair => {
          const [k, v] = pair.split("=");
          if (k) params[k] = decodeURIComponent(v ?? "");
        });
      }

      const kid = state.kids.find(k => k.profile.id === kidId);
      if (!kid) return;

      if (action === "ping") {
        dispatch({
          type: "NOTIFICATION_ADD",
          kidId,
          notification: {
            id: uid(),
            kidId,
            kind: "ping",
            title: "📣 Parent",
            body: params.message || "Your parent is calling you!",
            read: false,
            createdAt: nowIso(),
          },
        });
      } else if (action === "alarm") {
        dispatch({
          type: "NOTIFICATION_ADD",
          kidId,
          notification: {
            id: uid(),
            kidId,
            kind: "ping",
            title: "🚨 Alarm",
            body: params.message || "Your parent needs you RIGHT NOW!",
            read: false,
            createdAt: nowIso(),
            alarmMode: true,
            soundLevel: "high",
            forceVibrate: true,
            acknowledged: false,
          },
        });
      } else if (action === "lock") {
        dispatch({
          type: "SET_INSTANT_LOCK",
          kidId,
          locked: true,
          message: params.reason || "Locked by voice command",
        });
      }
    } catch {
      // Ignore malformed deep links
    }
  }

  useEffect(() => {
    Linking.getInitialURL().then(url => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kids]);

  return null;
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }));
  const apiBase = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: `${apiBase}/trpc` })],
    })
  );

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
              <DataProvider>
                <BackgroundBridge />
                <AppOpenAdBridge />
                <SchedulerBridge />
                <DeepLinkHandler />
                <ScreenTimeLimitNotifier />
                <OfflineBanner />
                {/* Hide the Android status bar (time/battery strip at top) */}
                <StatusBar hidden />
                <Stack screenOptions={{ headerShown: false }} />
              </DataProvider>
            </QueryClientProvider>
          </trpc.Provider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </View>
  );
}
