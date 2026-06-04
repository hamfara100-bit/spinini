import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from "react-native";
import { Tabs, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Notifications from "expo-notifications";
import { ALERT_TRIGGER } from "../../../lib/notify";
import { wasLocallyNotified } from "../../../lib/notification-map";
import { Colors } from "../../../lib/theme";
import { AlarmOverlay } from "../../../components/alarm-overlay";
import { LockdownOverlay } from "../../../components/lockdown-overlay";
import { GameInviteOverlay } from "../../../components/game-invite-overlay";
import { KidLockEnforcer } from "../../../components/kid-lock-enforcer";
import { useData } from "../../../lib/data/store";
import { notificationFeature } from "../../../lib/data/badges";

/**
 * Fires a system notification + sound + vibration when a NEW parent ping (or
 * other notification) arrives on the kid device — e.g. via cross-device sync.
 * Without this the ping is added to the list silently.
 */
function KidPingNotifier({ kidId }: { kidId: string }) {
  const { state } = useData();
  const kid = state.kids.find(k => k.profile.id === kidId);
  const notifs = kid?.notifications ?? [];
  const seen = useRef<Set<string>>(new Set());
  const seeded = useRef(false);

  useEffect(() => {
    if (!seeded.current) {
      notifs.forEach(n => seen.current.add(n.id));
      seeded.current = true;
      return;
    }
    for (const n of notifs) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      if (wasLocallyNotified(n.id)) continue; // already shown by the bg sync drain
      // Tapping opens the feature this notification is about: its explicit route,
      // else the feature mapped from its kind, else the kid's home.
      const feat = notificationFeature(n);
      const seg = n.route ? n.route.replace(/^\//, "") : feat;
      const kidName = kid?.profile.name ?? "Me";
      // "communicate" → Call & Chat tab; "online-game" → the full-screen
      // top-level match; everything else under (more).
      const route = !seg
        ? `/kid/${kidId}/home`
        : seg === "communicate"
        ? `/kid/${kidId}/callchat`
        : seg === "online-game"
        ? `/online-game?me=${encodeURIComponent(kidId)}&name=${encodeURIComponent(kidName)}`
        : `/kid/${kidId}/(more)/${seg}`;
      Vibration.vibrate([0, 300, 150, 300]);
      Notifications.scheduleNotificationAsync({
        content: { title: `${n.emoji ?? "🔔"} ${n.title}`, body: n.body || "", sound: true, data: { route } },
        trigger: ALERT_TRIGGER,
      }).catch(() => {});
    }
  }, [notifs.length]);

  return null;
}

// Tab definitions — must match the Tabs.Screen names below
const TAB_DEFS = [
  { name: "home",     emoji: "🏠", label: "Home"       },
  { name: "create",   emoji: "🎨", label: "Create"      },
  { name: "apps",     emoji: "📱", label: "My Apps"     },
  { name: "callchat", emoji: "📞", label: "Call & Chat" },
  { name: "agent",    emoji: "🤖", label: "AI Buddy"    },
];

function KidTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const pb = insets.bottom > 0 ? insets.bottom : 8;
  const router = useRouter();
  // Get the kid id so we can build full paths like /kid/kid1/home
  // This ensures [id] is preserved when switching tabs from any (more) sub-screen
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state: appState } = useData();
  // Unread family chat messages for this kid (not theirs, not yet read here).
  const unreadChat = (appState.familyMessages ?? []).filter(
    m => m.authorId !== id && !m.readBy.includes(id)
  ).length;

  return (
    <View style={[tabStyles.bar, { paddingBottom: pb, height: 56 + pb }]}>
      {TAB_DEFS.map((def) => {
        const routeIndex = state.routes.findIndex(r => r.name === def.name);
        if (routeIndex === -1) return null;
        const focused = state.index === routeIndex;
        const color = focused ? Colors.primary : Colors.textMuted;

        return (
          <TouchableOpacity
            key={def.name}
            style={tabStyles.item}
            activeOpacity={0.7}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: state.routes[routeIndex].key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                // Use full path with id so dynamic segment is never lost
                if (id) {
                  router.navigate(`/kid/${id}/${def.name}` as any);
                } else {
                  navigation.navigate(def.name);
                }
              }
            }}
            onLongPress={() => navigation.emit({ type: "tabLongPress", target: state.routes[routeIndex].key })}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
          >
            <View>
              <Text style={{ fontSize: 20, lineHeight: 24, textAlign: "center" }}>{def.emoji}</Text>
              {def.name === "callchat" && unreadChat > 0 && (
                <View style={tabStyles.badge}>
                  <Text style={tabStyles.badgeText}>{unreadChat > 9 ? "9+" : unreadChat}</Text>
                </View>
              )}
            </View>
            <Text style={[tabStyles.label, { color }]}>{def.label}</Text>
            {focused && <View style={[tabStyles.dot, { backgroundColor: Colors.primary }]} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceLight,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    // Spread children edge-to-edge
    alignItems: "center",
    justifyContent: "space-evenly",
    width: "100%",
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 6,
    gap: 2,
  },
  label: {
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  badge: {
    position: "absolute", top: -6, right: -12,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.error, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4, borderWidth: 1.5, borderColor: Colors.surfaceLight,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});

export default function KidLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state: kidLayoutState } = useData();
  const kidName = kidLayoutState.kids.find(k => k.profile.id === id)?.profile.name ?? "Me";

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <KidTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🏠</Text>,
          }}
        />
        {/* Ideas — accessible from home, hidden from tab bar */}
        <Tabs.Screen name="ideas" options={{ href: null }} />
        <Tabs.Screen
          name="create"
          options={{
            title: "Create",
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🎨</Text>,
          }}
        />
        {/* My Apps */}
        <Tabs.Screen
          name="apps"
          options={{
            title: "My Apps",
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📱</Text>,
          }}
        />
        {/* Call & Chat — top-level shim so it reliably appears in the tab bar */}
        <Tabs.Screen
          name="callchat"
          options={{
            title: "Call & Chat",
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📞</Text>,
          }}
        />
        {/* Keep the old chat screen registered but hidden from the tab bar */}
        <Tabs.Screen name="chat" options={{ href: null }} />
        <Tabs.Screen
          name="agent"
          options={{
            title: "AI Buddy",
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🤖</Text>,
          }}
        />
        {/* (more) group — all other feature screens, hidden from tab bar */}
        <Tabs.Screen
          name="(more)"
          options={{ tabBarButton: () => null }}
        />
      </Tabs>

      {/* Surface parent pings as system notifications */}
      {id && <KidPingNotifier kidId={id} />}

      {/* Full-screen alarm overlay — mounts above tabs when parent sends an alarm ping */}
      {id && <AlarmOverlay kidId={id} />}

      {/* Game Night invite — loud alarm + Join when a family member invites this kid */}
      {id && <GameInviteOverlay myId={id} myName={kidName} />}

      {/* Remote lockdown countdown — warning popup + floating timer, then auto-lock */}
      {id && <LockdownOverlay kidId={id} />}

      {/* Instant lock — bring app to front + enforce the un-leaveable lock screen */}
      {id && <KidLockEnforcer kidId={id} />}
    </View>
  );
}
