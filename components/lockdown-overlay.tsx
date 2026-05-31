/**
 * LockdownOverlay — shows a remote "countdown to lockdown" that a parent starts
 * from the Remote Lock screen. While the countdown runs the child can keep using
 * the phone (a big warning popup, then a small floating timer pill). When the
 * countdown reaches zero the device locks automatically via SET_INSTANT_LOCK.
 *
 * Mounted once in the kid tab layout, above the tabs.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Image, Vibration,
} from "react-native";
import { useData } from "../lib/data/store";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../lib/theme";

interface Props { kidId: string }

function fmt(totalSec: number): string {
  const s = Math.max(0, totalSec);
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

export function LockdownOverlay({ kidId }: Props) {
  const { state, dispatch } = useData();
  const kid = state.kids.find(k => k.profile.id === kidId);
  const timer = kid?.rules.lockdownTimer ?? null;

  const [now, setNow] = useState(Date.now());
  const [dismissed, setDismissed] = useState(false);
  const firedRef = useRef(false);

  // Tick every second while a timer is active
  useEffect(() => {
    if (!timer) return;
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [timer?.startedAt]);

  // Reset local UI state whenever a brand-new countdown starts
  useEffect(() => {
    setDismissed(false);
    firedRef.current = false;
    if (timer) { try { Vibration.vibrate(400); } catch {} }
  }, [timer?.startedAt]);

  const endMs = timer ? new Date(timer.startedAt).getTime() + timer.minutes * 60000 : 0;
  const remainingSec = timer ? Math.round((endMs - now) / 1000) : 0;

  // Countdown finished → lock the device, then clear the timer (in an effect,
  // never during render).
  useEffect(() => {
    if (!timer || remainingSec > 0 || firedRef.current) return;
    firedRef.current = true;
    dispatch({
      type: "SET_INSTANT_LOCK",
      kidId,
      locked: true,
      message: timer.message || "Time's up! Your device is now locked. 🔒",
    });
    dispatch({ type: "SET_LOCKDOWN_TIMER", kidId, timer: null });
    try { Vibration.vibrate([0, 600, 200, 600]); } catch {}
  }, [timer, remainingSec, kidId]);

  if (!timer || !kid) return null;
  if (remainingSec <= 0) return null;

  // Small floating pill once the child has acknowledged the warning
  if (dismissed) {
    return (
      <View pointerEvents="box-none" style={s.pillWrap}>
        <TouchableOpacity style={s.pill} activeOpacity={0.85} onPress={() => setDismissed(false)}>
          <Text style={s.pillEmoji}>⏳</Text>
          <Text style={s.pillText}>{fmt(remainingSec)} until lockdown</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Big warning popup
  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent>
      <View style={s.overlay}>
        <View style={s.card}>
          {timer.imageUri ? (
            <Image source={{ uri: timer.imageUri }} style={s.image} resizeMode="cover" />
          ) : (
            <View style={[s.image, s.imageFallback]}>
              <Text style={{ fontSize: 64 }}>⏰</Text>
            </View>
          )}

          <Text style={s.badge}>⏳ COUNTDOWN STARTED</Text>
          <Text style={s.message}>{timer.message}</Text>

          <Text style={s.countdown}>{fmt(remainingSec)}</Text>
          <Text style={s.sub}>
            When the timer reaches 0:00 your device will lock. Finish what you're doing!
          </Text>

          <TouchableOpacity style={s.okBtn} activeOpacity={0.85} onPress={() => setDismissed(true)}>
            <Text style={s.okBtnText}>OK, I'll wrap up! 👍</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#000000B0", alignItems: "center", justifyContent: "center", padding: Spacing.lg },
  card: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl,
    padding: Spacing.xl, alignItems: "center", width: "100%", maxWidth: 380,
    gap: 12, ...Shadow.md,
  },
  image: { width: "100%", height: 180, borderRadius: Radius.lg, backgroundColor: Colors.cardLight },
  imageFallback: { alignItems: "center", justifyContent: "center" },
  badge: {
    fontSize: 12, fontWeight: "800", letterSpacing: 1.2, color: Colors.error,
    backgroundColor: Colors.error + "18", paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: Radius.full, overflow: "hidden",
  },
  message: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary, textAlign: "center", lineHeight: 26 },
  countdown: {
    fontSize: 56, fontWeight: "300", color: Colors.error,
    fontVariant: ["tabular-nums"], letterSpacing: 3,
  },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  okBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 40, paddingVertical: 16, marginTop: 4, ...Shadow.sm,
  },
  okBtnText: { color: "#fff", fontSize: FontSize.base, fontWeight: "800" },

  // floating pill
  pillWrap: { position: "absolute", top: 50, left: 0, right: 0, alignItems: "center" },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.error, borderRadius: Radius.full,
    paddingHorizontal: 16, paddingVertical: 8, ...Shadow.md,
  },
  pillEmoji: { fontSize: 16 },
  pillText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm, fontVariant: ["tabular-nums"] },
});
