// Trystero/WebRTC Hermes polyfills — MUST be first so crypto.subtle,
// getRandomValues and the WebRTC globals exist before any comms code runs.
import "../lib/comms/trystero-polyfills";
import React, { useState, useEffect, useRef } from "react";
import { Stack, usePathname, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, Linking, AppState as RNAppState, Platform, Vibration } from "react-native";
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
import { startForegroundService, requestBatteryExemption, isBatteryExempt } from "../modules/expo-foreground-service/src";
import { OfflineBanner } from "../components/offline-banner";
import * as Notifications from "expo-notifications";
import { getRemainingMinutes } from "../lib/data/logic";

// ── Global notification behaviour ────────────────────────────────────────────
// Show every notification (banner + list), play sound, even while the app is in
// the foreground. Set at module scope so it's active before anything renders.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Creates the high-importance Android notification channel. On Android, sound /
 * vibration / heads-up / lock-screen visibility are decided by the CHANNEL, not
 * the individual notification — so without this, notifications may be silent or
 * not appear when the screen is off. Overriding the "default" channel (the one
 * expo-notifications uses when no channelId is given) means EVERY notification
 * in the app gets sound + vibration + shows on the lock screen.
 */
function NotificationSetup() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    Notifications.setNotificationChannelAsync("default", {
      name: "Spinini Alerts",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 350, 200, 350],
      sound: "default",
      enableVibrate: true,
      enableLights: true,
      lightColor: "#7C5CFF",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    }).catch(() => {});
  }, []);
  return null;
}

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

  // Prompt once (per device) to exempt the app from battery optimization so the
  // keep-alive service is not killed during Doze. Guarded so we never nag.
  async function maybePromptBatteryExemption() {
    try {
      if (Platform.OS !== "android") return;
      if (isBatteryExempt()) return;
      const AsyncStorage = require("@react-native-async-storage/async-storage").default;
      const asked = await AsyncStorage.getItem("@spinini/battery-exempt-asked");
      if (asked) return;
      await AsyncStorage.setItem("@spinini/battery-exempt-asked", "1");
      requestBatteryExemption();
    } catch {}
  }

  useEffect(() => {
    // Start background tasks (idempotent — safe to call multiple times)
    startBackgroundTasks();
    // Start app monitor (real usage + blocked app overlay)
    startAppMonitor();
    // Keep the app process alive so the Supabase sync poll keeps ringing for
    // alerts/calls/messages even when the screen is off (persistent FG service).
    startForegroundService();
    maybePromptBatteryExemption();
    // Flush any events produced while the app was killed/backgrounded
    flushBgEvents();
    // Hide Android system navigation bar (back/home/recents)
    hideNavBar();

    // Re-flush + re-hide nav bar whenever the app returns to foreground
    const sub = RNAppState.addEventListener("change", nextState => {
      if (appState.current !== "active" && nextState === "active") {
        flushBgEvents();
        hideNavBar();
        startForegroundService();
      }
      appState.current = nextState;
    });
    return () => { sub.remove(); stopAppMonitor(); };
  }, []);

  return null;
}

function AppOpenAdBridge() {
  // Never show ads while a kid screen is active. We read the pathname here
  // (inside the Expo Router context) so the check is always current.
  // The ad still preloads so it's ready the moment the parent returns.
  const pathname = usePathname();
  const isKidRoute = pathname.startsWith("/kid/");
  useAppOpenAd(!isKidRoute);
  return null;
}

/**
 * Fires a notification + beep + vibration whenever a new family chat message
 * arrives from someone else AND you're not currently looking at the chat. Runs
 * for both parent and kid (myId derived from the route).
 */
function ChatNotifier() {
  const { state } = useData();
  const pathname = usePathname();
  const seen = useRef<Set<string>>(new Set());
  const seeded = useRef(false);

  // Who am I on this device? Parent uses a fixed id; kid uses their profile id.
  const myId = pathname.startsWith("/parent")
    ? "__parent__"
    : (pathname.match(/^\/kid\/([^/]+)/)?.[1] ?? null);
  // Already looking at a chat/call screen? Then don't interrupt.
  const onChatRef = useRef(false);
  onChatRef.current = /callchat|communicate|\/chat/.test(pathname);
  const myIdRef = useRef(myId);
  myIdRef.current = myId;

  useEffect(() => {
    // First pass: seed the "already seen" set with existing messages so we don't
    // notify for history on launch.
    if (!seeded.current) {
      state.familyMessages.forEach(m => seen.current.add(m.id));
      seeded.current = true;
      return;
    }
    for (const m of state.familyMessages) {
      if (seen.current.has(m.id)) continue;
      seen.current.add(m.id);
      if (myIdRef.current && m.authorId === myIdRef.current) continue; // my own message
      if (onChatRef.current) continue;                                  // already viewing chat
      const chatRoute = myIdRef.current === "__parent__"
        ? "/parent/(more)/communicate"
        : `/kid/${myIdRef.current}/(more)/communicate`;
      Vibration.vibrate([0, 350, 180, 350]);
      Notifications.scheduleNotificationAsync({
        content: { title: `💬 ${m.authorName}`, body: m.text || "New message", sound: true, data: { route: chatRoute } },
        trigger: null,
      }).catch(() => {});
    }
  }, [state.familyMessages]);

  return null;
}

/**
 * Fires a notification when someone likes or comments on YOUR family-social post,
 * or shares a new post — so activity surfaces even if you're not on the feed.
 * Runs for both parent and kid (myId from the route; social uses "parent").
 */
function SocialNotifier() {
  const { state } = useData();
  const pathname = usePathname();
  const seenLikes = useRef<Set<string>>(new Set());
  const seenComments = useRef<Set<string>>(new Set());
  const seenPosts = useRef<Set<string>>(new Set());
  const seeded = useRef(false);

  const myId = pathname.startsWith("/parent")
    ? "parent"
    : (pathname.match(/^\/kid\/([^/]+)/)?.[1] ?? null);
  const onSocialRef = useRef(false);
  onSocialRef.current = /\/social/.test(pathname);
  const myIdRef = useRef(myId);
  myIdRef.current = myId;

  function nameOf(authorId: string): string {
    if (authorId === "parent") return state.parentSettings.name || "Parent";
    return state.kids.find(k => k.profile.id === authorId)?.profile.name ?? "Someone";
  }

  useEffect(() => {
    const posts = state.familySocialPosts ?? [];
    // Seed existing activity on first pass so we don't notify for history.
    if (!seeded.current) {
      for (const p of posts) {
        seenPosts.current.add(p.id);
        p.likes.forEach(l => seenLikes.current.add(`${p.id}:${l}`));
        p.comments.forEach(c => seenComments.current.add(c.id));
      }
      seeded.current = true;
      return;
    }
    const me = myIdRef.current;
    const socialRoute = me === "parent" ? "/parent/(more)/social" : me ? `/kid/${me}/(more)/social` : undefined;
    for (const p of posts) {
      // New post by someone else
      if (!seenPosts.current.has(p.id)) {
        seenPosts.current.add(p.id);
        if (me && p.authorId !== me && !onSocialRef.current) {
          Vibration.vibrate([0, 250, 120, 250]);
          Notifications.scheduleNotificationAsync({
            content: { title: `📱 ${nameOf(p.authorId)} posted`, body: p.caption || "New family post", sound: true, data: { route: socialRoute } },
            trigger: null,
          }).catch(() => {});
        }
      }
      // Likes + comments on MY post
      const mine = me && p.authorId === me;
      for (const liker of p.likes) {
        const key = `${p.id}:${liker}`;
        if (seenLikes.current.has(key)) continue;
        seenLikes.current.add(key);
        if (mine && liker !== me) {
          Vibration.vibrate([0, 250]);
          Notifications.scheduleNotificationAsync({
            content: { title: `❤️ ${nameOf(liker)} liked your post`, body: p.caption || "Family Social", sound: true, data: { route: socialRoute } },
            trigger: null,
          }).catch(() => {});
        }
      }
      for (const c of p.comments) {
        if (seenComments.current.has(c.id)) continue;
        seenComments.current.add(c.id);
        if (mine && c.authorId !== me) {
          Vibration.vibrate([0, 250, 120, 250]);
          Notifications.scheduleNotificationAsync({
            content: { title: `💬 ${nameOf(c.authorId)} commented`, body: c.text || "New comment", sound: true, data: { route: socialRoute } },
            trigger: null,
          }).catch(() => {});
        }
      }
    }
  }, [state.familySocialPosts]);

  return null;
}

/**
 * Tapping a notification opens the screen it belongs to. Every notification we
 * post carries `data.route` (e.g. the chat or social page); this listener reads
 * it and navigates. Also handles the cold-start case where tapping a
 * notification launched the app.
 */
function NotificationRouter() {
  useEffect(() => {
    function go(resp: Notifications.NotificationResponse | null) {
      const route = (resp?.notification?.request?.content?.data as any)?.route;
      if (route && typeof route === "string") {
        // Small delay so the navigation tree is mounted on cold start.
        setTimeout(() => { try { router.push(route as any); } catch {} }, 300);
      }
    }
    const sub = Notifications.addNotificationResponseReceivedListener(go);
    Notifications.getLastNotificationResponseAsync().then(go).catch(() => {});
    return () => sub.remove();
  }, []);
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
              data: { route: `/parent/(more)/kid/${kid.profile.id}` },
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
                <NotificationSetup />
                <AppOpenAdBridge />
                <SchedulerBridge />
                <ChatNotifier />
                <SocialNotifier />
                <NotificationRouter />
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
