import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Tabs, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Colors } from "../../../lib/theme";
import { AlarmOverlay } from "../../../components/alarm-overlay";
import { LockdownOverlay } from "../../../components/lockdown-overlay";
import { useData } from "../../../lib/data/store";

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

      {/* Full-screen alarm overlay — mounts above tabs when parent sends an alarm ping */}
      {id && <AlarmOverlay kidId={id} />}

      {/* Remote lockdown countdown — warning popup + floating timer, then auto-lock */}
      {id && <LockdownOverlay kidId={id} />}
    </View>
  );
}
