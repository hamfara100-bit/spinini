/**
 * ParentSosOverlay — when a child presses SOS, the PARENT device raises a loud,
 * non-stop alarm (looping system-alarm sound + vibration) and a full-screen
 * banner until the parent taps "I'm responding". Also fires a system
 * notification so a backgrounded/locked parent device still alerts.
 *
 * Mounted once in the parent tab layout.
 */
import React, { useEffect, useRef, useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, Vibration, Platform, Animated } from "react-native";
import * as Notifications from "expo-notifications";
import { useData } from "../lib/data/store";
import type { SosAlert } from "../lib/data/types";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../lib/theme";
import { forceMaxVolume, playSystemAlarm, stopSystemAlarm } from "expo-loud-alarm";

const PATTERN: number[] = [0, 800, 100, 800, 100, 800, 100, 800];

export function ParentSosOverlay() {
  const { state, dispatch } = useData();
  const [alert, setAlert] = useState<SosAlert | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());
  const flash = useRef(new Animated.Value(1)).current;

  // Track the active (unacknowledged) SOS.
  useEffect(() => {
    const active = (state.sosAlerts ?? []).find(a => !a.acknowledged);
    setAlert(active ?? null);
  }, [state.sosAlerts]);

  // Fire a system notification ONCE per new SOS (covers backgrounded parent).
  useEffect(() => {
    if (!alert || notifiedRef.current.has(alert.id)) return;
    notifiedRef.current.add(alert.id);
    Notifications.scheduleNotificationAsync({
      content: {
        title: `🚨 SOS from ${alert.kidName}!`,
        body: alert.lat ? `Location: ${alert.lat.toFixed(4)}, ${alert.lng?.toFixed(4)}` : "Check on your child NOW!",
        sound: true,
      },
      trigger: null,
    }).catch(() => {});
  }, [alert?.id]);

  // Loud looping alarm + vibration + screen flash while an SOS is active.
  useEffect(() => {
    if (!alert) { Vibration.cancel(); try { stopSystemAlarm(); } catch {} flash.setValue(1); return; }
    if (Platform.OS === "android") { try { forceMaxVolume(); } catch {} try { playSystemAlarm(); } catch {} }
    Vibration.vibrate(PATTERN, true);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(flash, { toValue: 0.45, duration: 350, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]));
    loop.start();
    return () => { Vibration.cancel(); try { stopSystemAlarm(); } catch {} loop.stop(); flash.setValue(1); };
  }, [alert?.id]);

  if (!alert) return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <Animated.View style={[s.screen, { opacity: flash }]}>
        <Text style={s.emoji}>🚨</Text>
        <Text style={s.badge}>🔊 SOS — LOUD ALARM</Text>
        <Text style={s.title}>{alert.kidName} needs help!</Text>
        <View style={s.card}>
          <Text style={s.cardText}>
            {alert.lat
              ? `📍 Location: ${alert.lat.toFixed(5)}, ${alert.lng?.toFixed(5)}`
              : "📍 Location unavailable — check on them NOW!"}
          </Text>
          <Text style={s.time}>Sent {new Date(alert.timestamp).toLocaleTimeString()}</Text>
        </View>
        <TouchableOpacity style={s.ackBtn} activeOpacity={0.85} onPress={() => dispatch({ type: "SOS_ACK", alertId: alert.id })}>
          <Text style={s.ackText}>✅ I'm Responding</Text>
        </TouchableOpacity>
        <Text style={s.hint}>The alarm keeps sounding until you respond</Text>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#1A0505", alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  emoji: { fontSize: 80, marginBottom: 8 },
  badge: { fontSize: 12, fontWeight: "900", letterSpacing: 1.2, color: Colors.error, backgroundColor: Colors.error + "25", borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 6, overflow: "hidden", marginBottom: 12 },
  title: { fontSize: 28, fontWeight: "900", color: "#fff", textAlign: "center", marginBottom: 16 },
  card: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: Radius.xl, padding: 18, marginBottom: 24, maxWidth: "90%", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  cardText: { fontSize: FontSize.base, color: "#fff", fontWeight: "700", textAlign: "center", lineHeight: 24 },
  time: { fontSize: FontSize.xs, color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 8 },
  ackBtn: { backgroundColor: Colors.success, borderRadius: Radius.full, paddingHorizontal: 48, paddingVertical: 18, ...Shadow.md },
  ackText: { color: "#fff", fontSize: FontSize.lg, fontWeight: "800" },
  hint: { fontSize: FontSize.xs, color: "rgba(255,255,255,0.4)", marginTop: 16 },
});
