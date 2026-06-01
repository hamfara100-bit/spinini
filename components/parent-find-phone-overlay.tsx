/**
 * ParentFindPhoneOverlay — full-screen alarm that fires when a kid triggers
 * "Find Parent's Phone". Mirrors AlarmOverlay but for the parent side.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Animated, Vibration, Platform,
} from "react-native";
import { useData } from "../lib/data/store";
import { Colors, FontSize, Radius, Spacing } from "../lib/theme";
import { forceMaxVolume as nativeForceMaxVolume, getDefaultAlarmUri, playSystemAlarm, stopSystemAlarm } from "expo-loud-alarm";

const PATTERN_HIGH: number[] = [0, 800, 100, 800, 100, 800, 100, 800];

function forceMaxVolume() {
  if (Platform.OS !== "android") return;
  nativeForceMaxVolume();
}

let createAudioPlayer: ((source: any, options?: any) => any) | null = null;
let AudioModule: any = null;
try {
  const ea = require("expo-audio");
  if (ea.createAudioPlayer) { createAudioPlayer = ea.createAudioPlayer; AudioModule = ea; }
} catch {}
let AvAudio: any = null;
try {
  if (!createAudioPlayer) AvAudio = require("expo-av").Audio;
} catch {}

async function startAlarmSound(): Promise<() => void> {
  // Android: play the system alarm ringtone natively — reliable on the alarm
  // stream (the expo-audio URI path often loads but stays silent).
  if (Platform.OS === "android") {
    try {
      playSystemAlarm();
      return () => { try { stopSystemAlarm(); } catch {} };
    } catch {}
  }
  const audioUri = "https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3";

  if (createAudioPlayer && AudioModule) {
    try {
      await AudioModule.setAudioModeAsync?.({ playsInSilentModeIOS: true, staysActiveInBackground: true, shouldDuckAndroid: false });
      const player = createAudioPlayer({ uri: audioUri }, { volume: 1.0, loop: true });
      player.play?.();
      return () => { try { player.pause?.(); player.remove?.(); } catch {} };
    } catch {}
  }
  if (AvAudio) {
    try {
      await AvAudio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true, shouldDuckAndroid: false });
      const { sound } = await AvAudio.Sound.createAsync({ uri: audioUri }, { shouldPlay: true, isLooping: true, volume: 1.0 });
      return () => { try { sound.stopAsync(); sound.unloadAsync(); } catch {} };
    } catch {}
  }
  return () => {};
}

function PulseRing({ delay, color }: { delay: number; color: string }) {
  const scale   = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.timing(scale,   { toValue: 2.2, duration: 1400, delay, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0,   duration: 1400, delay, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [delay]);
  return (
    <Animated.View pointerEvents="none"
      style={[{ position: "absolute", width: 140, height: 140, borderRadius: 70, borderWidth: 3, borderColor: color }, { transform: [{ scale }], opacity }]}
    />
  );
}

export function ParentFindPhoneOverlay() {
  const { state, dispatch } = useData();
  const active = state.parentSettings.findPhoneActive ?? false;
  const kidName = state.parentSettings.findPhoneFromKidName ?? "Your child";

  const stopSoundRef = useRef<(() => void) | null>(null);
  const shakeAnim    = useRef(new Animated.Value(0)).current;
  const flashAnim    = useRef(new Animated.Value(1)).current;
  const [elapsed, setElapsed] = useState(0);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      Vibration.cancel();
      stopSoundRef.current?.();
      stopSoundRef.current = null;
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      setElapsed(0);
      shakeAnim.setValue(0);
      flashAnim.setValue(1);
      return;
    }

    forceMaxVolume();
    Vibration.vibrate(PATTERN_HIGH, true);
    startAlarmSound().then(stop => { stopSoundRef.current = stop; });

    setElapsed(0);
    intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);

    const shakeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  10, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8,  duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  8,  duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  0,  duration: 55, useNativeDriver: true }),
        Animated.delay(1400),
      ])
    );
    shakeLoop.start();

    const flashLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 0.4, duration: 350, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 1.0, duration: 350, useNativeDriver: true }),
      ])
    );
    flashLoop.start();

    return () => {
      Vibration.cancel();
      stopSoundRef.current?.();
      stopSoundRef.current = null;
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      shakeLoop.stop();
      flashLoop.stop();
      shakeAnim.setValue(0);
      flashAnim.setValue(1);
    };
  }, [active]);

  function dismiss() {
    Vibration.cancel();
    stopSoundRef.current?.();
    dispatch({ type: "FIND_PHONE_DISMISS_PARENT" });
  }

  if (!active) return null;

  const mins = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const secs = (elapsed % 60).toString().padStart(2, "0");

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent>
      <Animated.View style={[s.screen, { opacity: flashAnim }]}>
        <View style={s.ringWrap} pointerEvents="none">
          <PulseRing delay={0}   color={Colors.primary} />
          <PulseRing delay={460} color={Colors.primary} />
          <PulseRing delay={920} color={Colors.primary} />
        </View>

        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          <View style={s.iconCircle}>
            <Text style={s.iconEmoji}>📱</Text>
          </View>
        </Animated.View>

        <View style={s.levelBadge}>
          <Text style={s.levelText}>🔊 FIND MY PHONE — FROM YOUR KID</Text>
        </View>

        <Text style={s.senderText}>From {kidName} 👧</Text>

        <View style={s.messageBubble}>
          <Text style={s.messageText}>
            {kidName} is trying to find your phone!{"\n"}Pick it up! 📱
          </Text>
        </View>

        <View style={s.indicators}>
          <View style={s.indBadge}><Text style={s.indText}>📳 Vibrating</Text></View>
          <View style={s.indBadge}><Text style={s.indText}>🔊 Max Volume</Text></View>
        </View>

        <Text style={s.elapsed}>{mins}:{secs}</Text>

        <TouchableOpacity style={s.ackBtn} onPress={dismiss} activeOpacity={0.85}>
          <Text style={s.ackBtnText}>📍 Found It!</Text>
        </TouchableOpacity>

        <Text style={s.hint}>Tap to stop the alarm</Text>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: Spacing.xl, backgroundColor: "#0A0D1E",
  },
  ringWrap: { position: "absolute", alignItems: "center", justifyContent: "center", top: 0, left: 0, right: 0, bottom: 0 },
  iconCircle: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: Colors.primary + "30",
    alignItems: "center", justifyContent: "center", marginBottom: Spacing.md,
  },
  iconEmoji: { fontSize: 64 },
  levelBadge: {
    borderRadius: Radius.full, borderWidth: 1.5,
    borderColor: Colors.primary + "60", backgroundColor: Colors.primary + "30",
    paddingHorizontal: 16, paddingVertical: 6, marginBottom: Spacing.sm,
  },
  levelText: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2, color: Colors.primary, textTransform: "uppercase" },
  senderText: { fontSize: FontSize.base, color: "rgba(255,255,255,0.6)", marginBottom: Spacing.lg },
  messageBubble: {
    backgroundColor: "rgba(255,255,255,0.1)", borderRadius: Radius.xl,
    paddingHorizontal: 28, paddingVertical: 18, marginBottom: Spacing.md, maxWidth: "88%",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  messageText: { fontSize: FontSize.lg, fontWeight: "700", color: "#fff", textAlign: "center", lineHeight: 28 },
  indicators: { flexDirection: "row", gap: 8, marginBottom: Spacing.md, flexWrap: "wrap", justifyContent: "center" },
  indBadge: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  indText: { fontSize: FontSize.xs, color: "rgba(255,255,255,0.8)", fontWeight: "600" },
  elapsed: { fontSize: 36, fontWeight: "200", color: "rgba(255,255,255,0.3)", fontVariant: ["tabular-nums"], letterSpacing: 4, marginBottom: Spacing.xl },
  ackBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingHorizontal: 56, paddingVertical: 20, marginBottom: 16,
  },
  ackBtnText: { color: "#fff", fontSize: FontSize.xl, fontWeight: "800" },
  hint: { fontSize: FontSize.xs, color: "rgba(255,255,255,0.3)" },
});
