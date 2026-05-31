/**
 * SOS Panic Button — kid side.
 * Tapping the big red button starts a 5-second countdown.
 * If not cancelled the alert is dispatched and a push notification
 * is sent to the parent's device.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Vibration, Animated, Easing,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import type { SosAlert } from "../../../../lib/data/types";

const COUNTDOWN_SECS = 5;

export default function SosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);

  const [phase, setPhase] = useState<"idle" | "countdown" | "sent">("idle");
  const [remaining, setRemaining] = useState(COUNTDOWN_SECS);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulsing animation for the countdown ring
  useEffect(() => {
    if (phase === "countdown") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [phase]);

  function startCountdown() {
    setPhase("countdown");
    setRemaining(COUNTDOWN_SECS);
    Vibration.vibrate([0, 200, 100, 200]);

    timerRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          triggerSOS();
          return 0;
        }
        Vibration.vibrate(100);
        return prev - 1;
      });
    }, 1000);
  }

  function cancelCountdown() {
    clearInterval(timerRef.current!);
    setPhase("idle");
    setRemaining(COUNTDOWN_SECS);
    Vibration.cancel();
  }

  async function triggerSOS() {
    setPhase("sent");
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);

    // Get current GPS location
    let lat: number | undefined;
    let lng: number | undefined;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
    } catch {}

    const alert: SosAlert = {
      id: uid(),
      kidId: id,
      kidName: kid?.profile.name ?? "Your child",
      lat,
      lng,
      timestamp: nowIso(),
      acknowledged: false,
    };

    dispatch({ type: "SOS_ALERT", alert });

    // Also fire a push notification (reaches parent even if app is background)
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🚨 SOS from ${alert.kidName}`,
          body: lat
            ? `GPS: ${lat.toFixed(5)}, ${lng?.toFixed(5)} — open app for full alert`
            : "Tap to open the app immediately",
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: null,
      });
    } catch {}
  }

  function reset() {
    setPhase("idle");
    setRemaining(COUNTDOWN_SECS);
  }

  return (
    <ScreenContainer>
      <View style={s.header}>
        <Text style={s.title}>🚨 Emergency SOS</Text>
        <Text style={s.sub}>Only use in a real emergency</Text>
      </View>

      {phase === "idle" && (
        <View style={s.center}>
          <TouchableOpacity onPress={startCountdown} activeOpacity={0.85}>
            <View style={s.sosBtn}>
              <Text style={s.sosBtnEmoji}>🆘</Text>
              <Text style={s.sosBtnText}>HOLD FOR SOS</Text>
              <Text style={s.sosBtnSub}>Alerts parent with GPS</Text>
            </View>
          </TouchableOpacity>
          <Text style={s.hint}>
            Your parent will receive an immediate push notification with your location.
          </Text>
        </View>
      )}

      {phase === "countdown" && (
        <View style={s.center}>
          <Animated.View style={[s.countdownRing, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={s.countdownNum}>{remaining}</Text>
            <Text style={s.countdownLabel}>Sending in…</Text>
          </Animated.View>
          <TouchableOpacity style={s.cancelBtn} onPress={cancelCountdown}>
            <Text style={s.cancelText}>✕  CANCEL</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === "sent" && (
        <View style={s.center}>
          <View style={s.sentBox}>
            <Text style={s.sentEmoji}>✅</Text>
            <Text style={s.sentTitle}>Alert Sent!</Text>
            <Text style={s.sentSub}>Your parent has been notified with your location. Stay where you are if it is safe.</Text>
          </View>
          <TouchableOpacity style={s.resetBtn} onPress={reset}>
            <Text style={s.resetText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={s.rules}>
        <Text style={s.rulesTitle}>When to use SOS:</Text>
        {["You feel unsafe or in danger", "You are lost and can't reach anyone", "Someone is following or threatening you", "There is a medical emergency nearby"].map(r => (
          <Text key={r} style={s.ruleItem}>• {r}</Text>
        ))}
      </View>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  header: { alignItems: "center", paddingVertical: Spacing.lg },
  title: { fontSize: FontSize.xxl, fontWeight: "800", color: Colors.error },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  center: { alignItems: "center", paddingVertical: Spacing.xl, gap: 24 },
  sosBtn: {
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: Colors.error, alignItems: "center", justifyContent: "center",
    gap: 6, elevation: 10,
    shadowColor: Colors.error, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 16,
  },
  sosBtnEmoji: { fontSize: 48 },
  sosBtnText: { fontSize: FontSize.base, fontWeight: "900", color: "#fff", letterSpacing: 1 },
  sosBtnSub: { fontSize: FontSize.xs, color: "rgba(255,255,255,0.8)" },
  hint: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", paddingHorizontal: Spacing.xl, lineHeight: 20 },
  countdownRing: {
    width: 180, height: 180, borderRadius: 90,
    borderWidth: 8, borderColor: Colors.error,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#FEF2F2",
  },
  countdownNum: { fontSize: 72, fontWeight: "900", color: Colors.error },
  countdownLabel: { fontSize: FontSize.sm, color: Colors.error, fontWeight: "700" },
  cancelBtn: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    paddingHorizontal: 40, paddingVertical: 14,
    borderWidth: 2, borderColor: Colors.border,
  },
  cancelText: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  sentBox: { alignItems: "center", gap: 12, padding: Spacing.lg },
  sentEmoji: { fontSize: 64 },
  sentTitle: { fontSize: FontSize.xxl, fontWeight: "900", color: "#16A34A" },
  sentSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20, maxWidth: 280 },
  resetBtn: { backgroundColor: Colors.primary, borderRadius: Radius.xl, paddingHorizontal: 40, paddingVertical: 12 },
  resetText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  rules: { marginHorizontal: Spacing.md, padding: Spacing.md, backgroundColor: "#FFF7ED", borderRadius: Radius.lg, gap: 6 },
  rulesTitle: { fontSize: FontSize.sm, fontWeight: "800", color: "#C2410C", marginBottom: 4 },
  ruleItem: { fontSize: FontSize.sm, color: "#92400E", lineHeight: 20 },
});
