import React, { useState, useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useData } from "../../lib/data/store";
import { hashPin } from "../../lib/utils";
import { useColors } from "../../hooks/use-colors";
import { PinPad } from "../../components/pin-pad";
import { ScreenContainer } from "../../components/screen-container";
import { Colors, FontSize, Radius, Spacing } from "../../lib/theme";
import MobileAds from "react-native-google-mobile-ads";
import { AdMobBanner } from "../../components/admob-banner";
import { ParentFindPhoneOverlay } from "../../components/parent-find-phone-overlay";
import { ParentSosOverlay } from "../../components/parent-sos-overlay";
import { ParentBadWordOverlay } from "../../components/parent-badword-overlay";
import { GameInviteOverlay } from "../../components/game-invite-overlay";

type AuthMethod = "choose" | "pin";

export default function ParentLayout() {
  const { state } = useData();
  const router = useRouter();
  const C = useColors();
  const insets = useSafeAreaInsets();
  // Auto-unlock if no PIN has been set
  const [unlocked, setUnlocked] = useState(!state.parentSettings.pin);

  // Initialize Google Mobile Ads SDK once on mount
  useEffect(() => {
    MobileAds()
      .initialize()
      .catch(() => {/* silent — ads unavailable on simulator */});
  }, []);
  const [error, setError] = useState("");
  const [method, setMethod] = useState<AuthMethod>("choose");

  // Badge: total pending chore approvals + reward requests
  const totalPending = state.kids.reduce((sum, k) => {
    const chores = k.chores.filter(c => c.status === "submitted").length;
    const rewards = (k.rewardRedemptions ?? []).filter(r => r.status === "pending").length;
    return sum + chores + rewards;
  }, 0);

  // Unread family chat messages (not from this parent, not yet read here).
  const unreadChat = (state.familyMessages ?? []).filter(
    m => m.authorId !== "__parent__" && !m.readBy.includes("__parent__")
  ).length;

  async function checkPin(pin: string) {
    const hashed = await hashPin(pin);
    if (hashed === state.parentSettings.pin) {
      setUnlocked(true);
      setError("");
    } else {
      setError("Wrong PIN. Try again.");
    }
  }

  // Already unlocked — show tabs
  if (unlocked) {
    return (
      <>
        <ParentFindPhoneOverlay />
        <ParentSosOverlay />
        <ParentBadWordOverlay />
        <GameInviteOverlay myId="parent" myName={state.parentSettings.name || state.parent.name || "Parent"} />
        <Tabs screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: C.surface,
          borderTopColor: C.border,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          height: 60 + (insets.bottom > 0 ? insets.bottom : 8),
        },
        // Spread tabs evenly across full screen width
        tabBarItemStyle: { flex: 1 },
      }}>
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📊</Text>,
            tabBarBadge: totalPending > 0 ? totalPending : undefined,
          }}
        />
        <Tabs.Screen name="family" options={{ title: "Family",   tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👨‍👩‍👧</Text> }} />
        <Tabs.Screen name="callchat" options={{ title: "Call & Chat", tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>💬</Text>, tabBarBadge: unreadChat > 0 ? unreadChat : undefined }} />
        <Tabs.Screen name="notes"  options={{ title: "Notes",    tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📝</Text> }} />
        <Tabs.Screen name="(more)/ping" options={{ title: "Ping Family",  tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📣</Text> }} />
        <Tabs.Screen name="(more)/reports" options={{ title: "Reports",  tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📈</Text> }} />
        <Tabs.Screen name="agent"  options={{ title: "AI Agent", tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🤖</Text> }} />
        <Tabs.Screen name="(more)" options={{ href: null }} />
      </Tabs>
      </>
    );
  }

  // Lock screen — choose between PIN and Google
  return (
    <ScreenContainer>
      <View style={styles.lockHeader}>
        <Text style={styles.lockEmoji}>🔒</Text>
        <Text style={styles.lockTitle}>Parent Access</Text>
        <Text style={styles.lockSub}>Verify your identity to continue</Text>
      </View>

      {method === "choose" && (
        <View style={styles.methodPicker}>
          {state.parentSettings.pin ? (
            <TouchableOpacity style={styles.methodBtn} onPress={() => setMethod("pin")}>
              <Text style={styles.methodEmoji}>🔢</Text>
              <Text style={styles.methodLabel}>Use PIN</Text>
              <Text style={styles.methodSub}>Enter your 4-digit PIN</Text>
            </TouchableOpacity>
          ) : null}

          {/* No PIN fallback — shown only if state hydrates after mount */}
          {!state.parentSettings.pin && (
            <TouchableOpacity style={styles.skipBtn} onPress={() => setUnlocked(true)}>
              <Text style={styles.skipText}>No PIN set — tap to continue</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {method === "pin" && (
        <View style={{ paddingHorizontal: Spacing.md }}>
          <PinPad title="" subtitle="Enter your 4-digit PIN" onComplete={checkPin} onClearError={() => setError("")} error={error} />
          <TouchableOpacity style={styles.backBtn} onPress={() => setMethod("choose")}>
            <Text style={styles.backText}>← Other sign-in options</Text>
          </TouchableOpacity>
        </View>
      )}

    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  lockHeader: { alignItems: "center", paddingVertical: Spacing.xl },
  lockEmoji: { fontSize: 56, marginBottom: 8 },
  lockTitle: { fontSize: FontSize.xxl, fontWeight: "800", color: Colors.primary },
  lockSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  methodPicker: { gap: 14, paddingHorizontal: Spacing.md, paddingTop: Spacing.lg },
  methodBtn: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl,
    padding: Spacing.lg, alignItems: "center", gap: 4,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  methodBtnGoogle: { borderColor: "#4285F4", backgroundColor: "#EEF4FF" },
  methodEmoji: { fontSize: 36, fontWeight: "900", color: "#4285F4" },
  methodLabel: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  methodSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  googleSection: { paddingHorizontal: Spacing.md, gap: 14, paddingTop: Spacing.lg },
  googleInstr: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  skipBtn: { padding: Spacing.md, alignItems: "center" },
  skipText: { color: Colors.textMuted, fontSize: FontSize.sm, textDecorationLine: "underline" },
  backBtn: { padding: Spacing.md, alignItems: "center" },
  backText: { color: Colors.primary, fontWeight: "600", fontSize: FontSize.sm },
  error: { color: Colors.error, textAlign: "center", fontSize: FontSize.sm },
});
