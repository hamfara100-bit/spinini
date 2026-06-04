/**
 * ParentBadWordOverlay — when a bad word is detected in an incoming notification
 * on a child's device, the PARENT device raises a loud non-stop alarm and a
 * full-screen banner showing the bad word, the message, and WHICH APP sent it,
 * until the parent taps "I've seen it".
 *
 * Mounted once in the parent tab layout.
 */
import React, { useEffect, useRef, useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, Vibration, Platform, Animated, ScrollView } from "react-native";
import * as Notifications from "expo-notifications";
import { ALERT_TRIGGER } from "../lib/notify";
import { useData } from "../lib/data/store";
import type { BadWordAlert } from "../lib/data/types";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../lib/theme";
import { forceMaxVolume, playSystemAlarm, stopSystemAlarm } from "expo-loud-alarm";

const PATTERN: number[] = [0, 700, 120, 700, 120, 700];

/** Highlight the matched bad word inside the message text. */
function Highlighted({ text, word }: { text: string; word: string }) {
  if (!text) return null;
  const idx = text.toLowerCase().indexOf(word.toLowerCase());
  if (idx < 0) return <Text style={s.msgText}>{text}</Text>;
  return (
    <Text style={s.msgText}>
      {text.slice(0, idx)}
      <Text style={s.msgBad}>{text.slice(idx, idx + word.length)}</Text>
      {text.slice(idx + word.length)}
    </Text>
  );
}

export function ParentBadWordOverlay() {
  const { state, dispatch } = useData();
  const [alert, setAlert] = useState<BadWordAlert | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());
  const flash = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const active = (state.badWordAlerts ?? []).find(a => !a.acknowledged);
    setAlert(active ?? null);
  }, [state.badWordAlerts]);

  // System notification once per alert (covers a backgrounded parent).
  useEffect(() => {
    if (!alert || notifiedRef.current.has(alert.id)) return;
    notifiedRef.current.add(alert.id);
    Notifications.scheduleNotificationAsync({
      content: {
        title: `🚨 Bad word from ${alert.kidName} (${alert.appName})`,
        body: `"${alert.word}" — ${alert.text || alert.title}`,
        sound: true,
      },
      trigger: ALERT_TRIGGER,
    }).catch(() => {});
  }, [alert?.id]);

  // Loud looping alarm + vibration + flash while an alert is active.
  useEffect(() => {
    if (!alert) { Vibration.cancel(); try { stopSystemAlarm(); } catch {} flash.setValue(1); return; }
    if (Platform.OS === "android") { try { forceMaxVolume(); } catch {} try { playSystemAlarm(); } catch {} }
    Vibration.vibrate(PATTERN, true);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(flash, { toValue: 0.5, duration: 380, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]));
    loop.start();
    return () => { Vibration.cancel(); try { stopSystemAlarm(); } catch {} loop.stop(); flash.setValue(1); };
  }, [alert?.id]);

  if (!alert) return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <Animated.View style={[s.screen, { opacity: flash }]}>
        <Text style={s.emoji}>🚨</Text>
        <Text style={s.badge}>⚠️ BAD WORD DETECTED</Text>
        <Text style={s.title}>In a notification on {alert.kidName}'s phone</Text>

        {/* The matched bad word */}
        <View style={s.wordPill}><Text style={s.wordText}>“{alert.word}”</Text></View>

        <View style={s.card}>
          <View style={s.appRow}>
            <Text style={s.appIcon}>📱</Text>
            <Text style={s.appName}>{alert.appName}</Text>
          </View>
          {!!alert.title && <Text style={s.notifTitle}>{alert.title}</Text>}
          <ScrollView style={{ maxHeight: 160 }}>
            <Highlighted text={alert.text || alert.title} word={alert.word} />
          </ScrollView>
          <Text style={s.time}>Detected {new Date(alert.detectedAt).toLocaleTimeString()}</Text>
        </View>

        <TouchableOpacity style={s.ackBtn} activeOpacity={0.85} onPress={() => dispatch({ type: "BADWORD_ALERT_ACK", alertId: alert.id })}>
          <Text style={s.ackText}>✅ I've seen it</Text>
        </TouchableOpacity>
        <Text style={s.hint}>The alarm keeps sounding until you acknowledge</Text>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#1A0505", alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  emoji: { fontSize: 64, marginBottom: 6 },
  badge: { fontSize: 12, fontWeight: "900", letterSpacing: 1.2, color: Colors.error, backgroundColor: Colors.error + "25", borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 6, overflow: "hidden", marginBottom: 10 },
  title: { fontSize: 19, fontWeight: "800", color: "#fff", textAlign: "center", marginBottom: 12 },
  wordPill: { backgroundColor: Colors.error, borderRadius: Radius.full, paddingHorizontal: 22, paddingVertical: 8, marginBottom: 16 },
  wordText: { color: "#fff", fontSize: 20, fontWeight: "900" },
  card: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: Radius.xl, padding: 16, marginBottom: 22, width: "100%", maxWidth: 420, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  appRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  appIcon: { fontSize: 20 },
  appName: { color: "#FFD27A", fontWeight: "800", fontSize: FontSize.base },
  notifTitle: { color: "#fff", fontWeight: "700", fontSize: FontSize.base, marginBottom: 4 },
  msgText: { color: "rgba(255,255,255,0.9)", fontSize: FontSize.base, lineHeight: 22 },
  msgBad: { color: "#FF6B6B", fontWeight: "900", textDecorationLine: "underline" },
  time: { color: "rgba(255,255,255,0.5)", fontSize: FontSize.xs, marginTop: 10 },
  ackBtn: { backgroundColor: Colors.success, borderRadius: Radius.full, paddingHorizontal: 48, paddingVertical: 18, ...Shadow.md },
  ackText: { color: "#fff", fontSize: FontSize.lg, fontWeight: "800" },
  hint: { fontSize: FontSize.xs, color: "rgba(255,255,255,0.4)", marginTop: 14 },
});
