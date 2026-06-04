/**
 * ParentTamperOverlay — when a child turns OFF a protection permission on their
 * device (Accessibility, overlay, Usage Access, Notification Access), the PARENT
 * device raises a loud alarm + banner so parental controls can't be silently
 * disabled. Mounted once in the parent tab layout.
 */
import React, { useEffect, useRef, useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, Vibration, Platform, Animated } from "react-native";
import * as Notifications from "expo-notifications";
import { ALERT_TRIGGER } from "../lib/notify";
import { useData } from "../lib/data/store";
import type { TamperAlert } from "../lib/data/types";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../lib/theme";
import { forceMaxVolume, playSystemAlarm, stopSystemAlarm } from "expo-loud-alarm";

const PATTERN: number[] = [0, 700, 130, 700, 130, 700];

export function ParentTamperOverlay() {
  const { state, dispatch } = useData();
  const [alert, setAlert] = useState<TamperAlert | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());
  const flash = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const active = (state.tamperAlerts ?? []).find(a => !a.acknowledged);
    setAlert(active ?? null);
  }, [state.tamperAlerts]);

  useEffect(() => {
    if (!alert || notifiedRef.current.has(alert.id)) return;
    notifiedRef.current.add(alert.id);
    Notifications.scheduleNotificationAsync({
      content: {
        title: `⚠️ Protection disabled on ${alert.kidName}'s phone`,
        body: `${alert.label} was turned off. Parental controls may not work.`,
        sound: true,
      },
      trigger: ALERT_TRIGGER,
    }).catch(() => {});
  }, [alert?.id]);

  useEffect(() => {
    if (!alert) { Vibration.cancel(); try { stopSystemAlarm(); } catch {} flash.setValue(1); return; }
    if (Platform.OS === "android") { try { forceMaxVolume(); } catch {} try { playSystemAlarm(); } catch {} }
    Vibration.vibrate(PATTERN, true);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(flash, { toValue: 0.55, duration: 400, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]));
    loop.start();
    return () => { Vibration.cancel(); try { stopSystemAlarm(); } catch {} loop.stop(); flash.setValue(1); };
  }, [alert?.id]);

  if (!alert) return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <Animated.View style={[s.screen, { opacity: flash }]}>
        <Text style={s.emoji}>🛡️</Text>
        <Text style={s.badge}>⚠️ PROTECTION TURNED OFF</Text>
        <Text style={s.title}>{alert.kidName}'s phone</Text>

        <View style={s.card}>
          <Text style={s.what}>“{alert.label}” was disabled</Text>
          <Text style={s.desc}>
            This permission is required for monitoring, screen-time limits and the lock to work.
            Re-enable it on {alert.kidName}'s device (Setup Health screen).
          </Text>
          <Text style={s.time}>Detected {new Date(alert.detectedAt).toLocaleTimeString()}</Text>
        </View>

        <TouchableOpacity style={s.ackBtn} activeOpacity={0.85} onPress={() => dispatch({ type: "TAMPER_ALERT_ACK", alertId: alert.id })}>
          <Text style={s.ackText}>✅ I've seen it</Text>
        </TouchableOpacity>
        <Text style={s.hint}>The alarm keeps sounding until you acknowledge</Text>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#1A0505", alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  emoji: { fontSize: 72, marginBottom: 8 },
  badge: { fontSize: 12, fontWeight: "900", letterSpacing: 1.2, color: Colors.error, backgroundColor: Colors.error + "25", borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 6, overflow: "hidden", marginBottom: 12 },
  title: { fontSize: 24, fontWeight: "900", color: "#fff", textAlign: "center", marginBottom: 16 },
  card: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: Radius.xl, padding: 18, marginBottom: 24, width: "100%", maxWidth: 420, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  what: { color: "#FF8A8A", fontWeight: "900", fontSize: FontSize.lg, textAlign: "center", marginBottom: 8 },
  desc: { color: "rgba(255,255,255,0.85)", fontSize: FontSize.sm, textAlign: "center", lineHeight: 20 },
  time: { color: "rgba(255,255,255,0.5)", fontSize: FontSize.xs, textAlign: "center", marginTop: 10 },
  ackBtn: { backgroundColor: Colors.success, borderRadius: Radius.full, paddingHorizontal: 48, paddingVertical: 18, ...Shadow.md },
  ackText: { color: "#fff", fontSize: FontSize.lg, fontWeight: "800" },
  hint: { fontSize: FontSize.xs, color: "rgba(255,255,255,0.4)", marginTop: 14 },
});
