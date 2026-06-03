/**
 * AlarmOverlay — full-screen modal that fires when an unacknowledged alarm ping
 * arrives for a kid. Loops vibration and audio until the child taps "I Got It!".
 *
 * High-intensity alarms:
 *  - Force-sets Android stream volume to maximum (STREAM_ALARM)
 *  - Disables Do Not Disturb / silent mode on Android
 *  - Uses expo-audio for reliable playback (falls back gracefully)
 *  - Pulsing full-screen animation + shake effect
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Animated, Vibration, Platform,
} from "react-native";
import * as Location from "expo-location";
import { useData } from "../lib/data/store";
import type { KidNotification } from "../lib/data/types";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../lib/theme";
import { forceMaxVolume as nativeForceMaxVolume, getDefaultAlarmUri, playSystemAlarm, stopSystemAlarm, fireFullScreenAlarm, cancelFullScreenAlarm } from "expo-loud-alarm";

// Vibration patterns (ms): [wait, vibrate, pause, ...]
const PATTERN_NORMAL: number[] = [0, 400, 200, 400, 200, 400];
const PATTERN_HIGH:   number[] = [0, 800, 100, 800, 100, 800, 100, 800];

function forceMaxVolume() {
  if (Platform.OS !== "android") return;
  nativeForceMaxVolume();
}

// ─── expo-audio / expo-av sound loading ──────────────────────────────────────
// Try expo-audio first (SDK 54 preferred), fall back to expo-av Audio.Sound
let createAudioPlayer: ((source: any, options?: any) => any) | null = null;
let AudioModule: any = null;

try {
  const ea = require("expo-audio");
  if (ea.createAudioPlayer) {
    createAudioPlayer = ea.createAudioPlayer;
    AudioModule = ea;
  }
} catch {}

// Fallback to expo-av
let AvAudio: any = null;
try {
  if (!createAudioPlayer) AvAudio = require("expo-av").Audio;
} catch {}

async function startAlarmSound(level: "normal" | "high"): Promise<() => void> {
  const vol = level === "high" ? 1.0 : 0.65;

  // Attempt 0 (Android): play the system alarm ringtone NATIVELY on the alarm
  // stream. This is the most reliable — it doesn't depend on expo-audio being
  // able to decode a content:// ringtone URI (which often loads but stays
  // silent, leaving only vibration).
  if (Platform.OS === "android") {
    try {
      playSystemAlarm();
      return () => { try { stopSystemAlarm(); } catch {} };
    } catch {}
  }

  // Fallback: a real audio file via expo-audio / expo-av.
  const audioUri = "https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3";

  // Attempt 1: expo-audio createAudioPlayer
  if (createAudioPlayer && AudioModule) {
    try {
      await AudioModule.setAudioModeAsync?.({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      });
      const player = createAudioPlayer(
        { uri: audioUri },
        { volume: vol, loop: true },
      );
      player.play?.();
      return () => { try { player.pause?.(); player.remove?.(); } catch {} };
    } catch {}
  }

  // Attempt 2: expo-av Audio.Sound
  if (AvAudio) {
    try {
      await AvAudio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
      });
      const { sound } = await AvAudio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true, isLooping: true, volume: vol },
      );
      return () => { try { sound.stopAsync(); sound.unloadAsync(); } catch {} };
    } catch {}
  }

  return () => {}; // no-op cleanup
}

// ─── Ripple ring ──────────────────────────────────────────────────────────────
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
    <Animated.View
      pointerEvents="none"
      style={[pulseS.ring, { borderColor: color, transform: [{ scale }], opacity }]}
    />
  );
}

const pulseS = StyleSheet.create({
  ring: { position: "absolute", width: 140, height: 140, borderRadius: 70, borderWidth: 3 },
});

// ─── Main component ───────────────────────────────────────────────────────────
interface Props { kidId: string }

export function AlarmOverlay({ kidId }: Props) {
  const { state, dispatch } = useData();
  const [alarm, setAlarm]   = useState<KidNotification | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const stopSoundRef  = useRef<(() => void) | null>(null);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const shakeAnim     = useRef(new Animated.Value(0)).current;
  const flashAnim     = useRef(new Animated.Value(1)).current;

  // Watch for new unacknowledged alarm pings for this kid
  useEffect(() => {
    const kid = state.kids.find(k => k.profile.id === kidId);
    if (!kid) return;
    const active = kid.notifications.find(
      n => n.kind === "ping" && n.alarmMode === true && !n.acknowledged
    );
    setAlarm(active ?? null);
  }, [state.kids, kidId]);

  // Start/stop effects when alarm changes
  useEffect(() => {
    if (!alarm) {
      Vibration.cancel();
      stopSoundRef.current?.();
      stopSoundRef.current = null;
      if (Platform.OS === "android") cancelFullScreenAlarm();
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      setElapsed(0);
      shakeAnim.setValue(0);
      flashAnim.setValue(1);
      return;
    }

    const isHigh  = alarm.soundLevel === "high";
    const pattern = isHigh ? PATTERN_HIGH : PATTERN_NORMAL;

    // Force-unmute Android for high-level alarms
    if (isHigh) forceMaxVolume();

    // BRING THE APP TO THE FRONT even if the kid is in another app or the
    // screen is off/locked. Fires a full-screen-intent notification that
    // launches our activity, and starts the looping alarm natively. The Modal
    // below then renders on top once the activity is foregrounded.
    if (Platform.OS === "android") {
      fireFullScreenAlarm(
        isHigh ? "🚨 URGENT — Mom & Dad need you!" : "🔔 Parent Ping",
        alarm.body || "Open Spinini now",
      );
    }

    // Vibration
    if (alarm.forceVibrate !== false) {
      Vibration.vibrate(pattern, true);
    }

    // Audio
    startAlarmSound(alarm.soundLevel ?? "normal").then(stop => {
      stopSoundRef.current = stop;
    });

    // Elapsed timer
    setElapsed(0);
    intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);

    // Shake loop
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

    // Screen flash for high-intensity alarms
    let flashLoop: Animated.CompositeAnimation | null = null;
    if (isHigh) {
      flashLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 0.4, duration: 350, useNativeDriver: true }),
          Animated.timing(flashAnim, { toValue: 1.0, duration: 350, useNativeDriver: true }),
        ])
      );
      flashLoop.start();
    }

    return () => {
      Vibration.cancel();
      stopSoundRef.current?.();
      stopSoundRef.current = null;
      if (Platform.OS === "android") cancelFullScreenAlarm();
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      shakeLoop.stop();
      flashLoop?.stop();
      shakeAnim.setValue(0);
      flashAnim.setValue(1);
    };
  }, [alarm?.id]);

  const [sendingLoc, setSendingLoc] = useState(false);

  function acknowledge() {
    if (!alarm) return;
    Vibration.cancel();
    stopSoundRef.current?.();
    if (Platform.OS === "android") cancelFullScreenAlarm();
    dispatch({ type: "NOTIFICATION_ACKNOWLEDGE", kidId, notifId: alarm.id });
  }

  // Location-check alarm: grab the kid's current position, send it to the parent
  // (it syncs via LOCATION_UPDATE), then stop the alarm.
  async function sendLocationAndAck() {
    if (!alarm || sendingLoc) return;
    setSendingLoc(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        dispatch({
          type: "LOCATION_UPDATE",
          kidId,
          location: { lat: loc.coords.latitude, lng: loc.coords.longitude, accuracy: loc.coords.accuracy ?? undefined, timestamp: new Date().toISOString() },
        });
      }
    } catch {}
    setSendingLoc(false);
    acknowledge();
  }

  if (!alarm) return null;

  const isHigh = alarm.soundLevel === "high";
  const mins = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const secs = (elapsed % 60).toString().padStart(2, "0");
  const bgColor = isHigh ? "#1A0505" : "#0D0A1E";
  const accentColor = isHigh ? Colors.error : Colors.primary;

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent>
      <Animated.View style={[s.screen, { backgroundColor: bgColor, opacity: flashAnim }]}>

        {/* Ripple rings */}
        <View style={s.ringWrap} pointerEvents="none">
          <PulseRing delay={0}   color={accentColor} />
          <PulseRing delay={460} color={accentColor} />
          <PulseRing delay={920} color={accentColor} />
        </View>

        {/* Shaking alarm icon */}
        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          <View style={[s.iconCircle, { backgroundColor: accentColor + "30" }]}>
            <Text style={s.iconEmoji}>{isHigh ? "🚨" : "🔔"}</Text>
          </View>
        </Animated.View>

        {/* Level badge */}
        <View style={[s.levelBadge, { backgroundColor: accentColor + "30", borderColor: accentColor + "60" }]}>
          <Text style={[s.levelText, { color: accentColor }]}>
            {alarm.requestLocation ? "📍 LOCATION CHECK — PLEASE RESPOND" : isHigh ? "🔊 LOUD ALARM — CANNOT BE SILENCED" : "🔔 PARENT PING"}
          </Text>
        </View>

        <Text style={s.senderText}>From Mom & Dad 👨‍👩‍👧</Text>

        {/* Message */}
        <View style={s.messageBubble}>
          <Text style={s.messageText}>{alarm.body}</Text>
        </View>

        {/* Status indicators */}
        <View style={s.indicators}>
          {alarm.forceVibrate !== false && (
            <View style={s.indBadge}><Text style={s.indText}>📳 Vibrating</Text></View>
          )}
          <View style={s.indBadge}>
            <Text style={s.indText}>{isHigh ? "🔊 Max Volume" : "🔉 Normal"}</Text>
          </View>
          {isHigh && Platform.OS === "android" && (
            <View style={[s.indBadge, { backgroundColor: Colors.error + "20" }]}>
              <Text style={[s.indText, { color: Colors.error }]}>📵 Mute bypassed</Text>
            </View>
          )}
        </View>

        {/* Timer */}
        <Text style={s.elapsed}>{mins}:{secs}</Text>

        {/* Acknowledge — location-check alarms must SEND location to stop. */}
        {alarm.requestLocation ? (
          <TouchableOpacity style={[s.ackBtn, { backgroundColor: Colors.primary }]} onPress={sendLocationAndAck} activeOpacity={0.85} disabled={sendingLoc}>
            <Text style={s.ackBtnText}>{sendingLoc ? "📡 Sending…" : "📍 Send My Location"}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.ackBtn} onPress={acknowledge} activeOpacity={0.85}>
            <Text style={s.ackBtnText}>✅ I Got It!</Text>
          </TouchableOpacity>
        )}

        <Text style={s.hint}>
          {alarm.requestLocation ? "Send your location to let your parent know you're safe" : "Tap the button to stop the alarm"}
        </Text>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  ringWrap: { position: "absolute", alignItems: "center", justifyContent: "center", top: 0, left: 0, right: 0, bottom: 0 },

  iconCircle: {
    width: 140, height: 140, borderRadius: 70,
    alignItems: "center", justifyContent: "center", marginBottom: Spacing.md,
  },
  iconEmoji: { fontSize: 64 },

  levelBadge: {
    borderRadius: Radius.full, borderWidth: 1.5,
    paddingHorizontal: 16, paddingVertical: 6, marginBottom: Spacing.sm,
  },
  levelText: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },

  senderText: { fontSize: FontSize.base, color: "rgba(255,255,255,0.6)", marginBottom: Spacing.lg },

  messageBubble: {
    backgroundColor: "rgba(255,255,255,0.1)", borderRadius: Radius.xl,
    paddingHorizontal: 28, paddingVertical: 18,
    marginBottom: Spacing.md, maxWidth: "88%",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  messageText: {
    fontSize: FontSize.lg, fontWeight: "700", color: "#fff",
    textAlign: "center", lineHeight: 28,
  },

  indicators: { flexDirection: "row", gap: 8, marginBottom: Spacing.md, flexWrap: "wrap", justifyContent: "center" },
  indBadge: {
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: Radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  indText: { fontSize: FontSize.xs, color: "rgba(255,255,255,0.8)", fontWeight: "600" },

  elapsed: {
    fontSize: 36, fontWeight: "200", color: "rgba(255,255,255,0.3)",
    fontVariant: ["tabular-nums"], letterSpacing: 4, marginBottom: Spacing.xl,
  },

  ackBtn: {
    backgroundColor: Colors.success, borderRadius: Radius.full,
    paddingHorizontal: 56, paddingVertical: 20,
    ...Shadow.md, marginBottom: 16,
  },
  ackBtnText: { color: "#fff", fontSize: FontSize.xl, fontWeight: "800" },
  hint: { fontSize: FontSize.xs, color: "rgba(255,255,255,0.3)" },
});
