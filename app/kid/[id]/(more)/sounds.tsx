import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Easing,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";

// ─── Sound definitions ───────────────────────────────────────────────────────
// Add real audio assets at assets/sounds/*.mp3 and update the `asset` fields.
// Until then, sounds display the visual player without audio playback.

const SOUNDS = [
  { id: "rain",      emoji: "🌧️", label: "Gentle Rain",    color: "#38BDF8", shadow: "#0369A1", desc: "Soft rainfall on leaves" },
  { id: "ocean",     emoji: "🌊", label: "Ocean Waves",    color: "#06B6D4", shadow: "#0E7490", desc: "Calm waves on the shore" },
  { id: "forest",    emoji: "🌳", label: "Night Forest",   color: "#34D399", shadow: "#065F46", desc: "Crickets and rustling trees" },
  { id: "lullaby",   emoji: "🎵", label: "Lullaby",        color: "#A78BFA", shadow: "#4C1D95", desc: "Gentle bedtime melody" },
  { id: "whitenoise",emoji: "🔆", label: "White Noise",    color: "#94A3B8", shadow: "#334155", desc: "Steady calming hum" },
  { id: "fireplace", emoji: "🔥", label: "Fireplace",      color: "#FB923C", shadow: "#9A3412", desc: "Warm crackling fire" },
  { id: "stars",     emoji: "✨", label: "Starry Night",   color: "#818CF8", shadow: "#3730A3", desc: "Deep space ambience" },
  { id: "wind",      emoji: "🍃", label: "Gentle Wind",    color: "#86EFAC", shadow: "#166534", desc: "Soft breeze through trees" },
];

const TIMERS = [
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "All night", minutes: 0 },
];

// ─── Pulsing ring animation ───────────────────────────────────────────────────

function PulseRing({ color, playing }: { color: string; playing: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!playing) {
      scale.setValue(1);
      opacity.setValue(0.6);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.35, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [playing]);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        { borderRadius: 999, backgroundColor: color, transform: [{ scale }], opacity },
      ]}
    />
  );
}

// ─── Timer countdown ─────────────────────────────────────────────────────────

function useCountdown(minutes: number, playing: boolean, onDone: () => void) {
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);

  useEffect(() => {
    setSecondsLeft(minutes * 60);
  }, [minutes]);

  useEffect(() => {
    if (!playing || minutes === 0) return;
    if (secondsLeft <= 0) { onDone(); return; }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [playing, secondsLeft, minutes]);

  if (minutes === 0) return "∞";
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SoundsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const kid = useKid(id);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [timerIdx, setTimerIdx] = useState(1); // 30 min default
  const selectedTimer = TIMERS[timerIdx];

  const countdown = useCountdown(selectedTimer.minutes, playingId !== null, () => setPlayingId(null));

  function toggleSound(soundId: string) {
    if (playingId === soundId) {
      setPlayingId(null);
    } else {
      setPlayingId(soundId);
    }
  }

  const playingSound = SOUNDS.find(s => s.id === playingId);

  if (!kid) return null;

  return (
    <ScreenContainer scroll bg="#0F0B2A">
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>🌙 Sleep Sounds</Text>
        <Text style={s.subtitle}>Tap a sound to start. Sweet dreams!</Text>
      </View>

      {/* Now playing bar */}
      {playingSound ? (
        <View style={[s.nowPlaying, { borderColor: playingSound.color + "60" }]}>
          <View style={s.nowPlayingLeft}>
            <Text style={{ fontSize: 28 }}>{playingSound.emoji}</Text>
            <View style={{ marginLeft: 12 }}>
              <Text style={s.nowPlayingLabel}>Now playing</Text>
              <Text style={s.nowPlayingName}>{playingSound.label}</Text>
            </View>
          </View>
          <View style={s.nowPlayingRight}>
            <Text style={[s.countdown, { color: playingSound.color }]}>{countdown}</Text>
            <TouchableOpacity onPress={() => setPlayingId(null)} style={s.stopBtn}>
              <Text style={s.stopBtnText}>■ Stop</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={s.idleBanner}>
          <Text style={s.idleText}>Choose a sound below to begin 🌟</Text>
        </View>
      )}

      {/* Timer selector */}
      <View style={s.timerRow}>
        <Text style={s.timerLabel}>Sleep timer:</Text>
        {TIMERS.map((t, i) => (
          <TouchableOpacity
            key={t.label}
            style={[s.timerBtn, timerIdx === i && s.timerBtnActive]}
            onPress={() => setTimerIdx(i)}
          >
            <Text style={[s.timerBtnText, timerIdx === i && s.timerBtnTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sound grid */}
      <View style={s.grid}>
        {SOUNDS.map(sound => {
          const isPlaying = playingId === sound.id;
          return (
            <TouchableOpacity
              key={sound.id}
              style={[s.card, { backgroundColor: sound.color + (isPlaying ? "30" : "18") }]}
              onPress={() => toggleSound(sound.id)}
              activeOpacity={0.8}
            >
              {/* Pulse rings behind emoji */}
              <View style={s.emojiWrap}>
                <PulseRing color={sound.color} playing={isPlaying} />
                <View style={[s.emojiCircle, { backgroundColor: sound.color + (isPlaying ? "AA" : "40") }]}>
                  <Text style={s.emoji}>{sound.emoji}</Text>
                </View>
              </View>
              <Text style={[s.cardLabel, isPlaying && { color: sound.color }]}>{sound.label}</Text>
              <Text style={s.cardDesc}>{sound.desc}</Text>
              {isPlaying && (
                <View style={[s.activeBadge, { backgroundColor: sound.color }]}>
                  <Text style={s.activeBadgeText}>▶ Playing</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Note */}
      <View style={s.note}>
        <Text style={s.noteText}>
          🔇 Make sure your volume is up and do not disturb is off.{"\n"}
          Keep the app open for sound to continue playing.
        </Text>
      </View>

      <View style={{ height: 48 }} />
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: { alignItems: "center", paddingVertical: Spacing.md, marginBottom: Spacing.sm },
  title: { fontSize: FontSize.xl, fontWeight: "800", color: "#E2D5FF" },
  subtitle: { fontSize: FontSize.sm, color: "#9B8FCC", marginTop: 4 },

  nowPlaying: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#1A1040", borderRadius: Radius.xl, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1,
  },
  nowPlayingLeft: { flexDirection: "row", alignItems: "center" },
  nowPlayingLabel: { fontSize: FontSize.xs, color: "#9B8FCC", fontWeight: "600" },
  nowPlayingName: { fontSize: FontSize.md, fontWeight: "800", color: "#E2D5FF" },
  nowPlayingRight: { alignItems: "flex-end", gap: 6 },
  countdown: { fontSize: FontSize.lg, fontWeight: "800" },
  stopBtn: { backgroundColor: "#ffffff20", borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 6 },
  stopBtnText: { color: "#E2D5FF", fontWeight: "700", fontSize: FontSize.sm },

  idleBanner: {
    backgroundColor: "#1A1040", borderRadius: Radius.xl, padding: Spacing.md,
    alignItems: "center", marginBottom: Spacing.sm,
  },
  idleText: { color: "#9B8FCC", fontSize: FontSize.sm, fontWeight: "600" },

  timerRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginBottom: Spacing.md, flexWrap: "wrap",
  },
  timerLabel: { fontSize: FontSize.xs, color: "#9B8FCC", fontWeight: "700", marginRight: 4 },
  timerBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: "#1A1040" },
  timerBtnActive: { backgroundColor: "#7C5CFF" },
  timerBtnText: { fontSize: FontSize.xs, fontWeight: "700", color: "#9B8FCC" },
  timerBtnTextActive: { color: "#fff" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "47%", borderRadius: Radius.xl, padding: Spacing.md,
    alignItems: "center", minHeight: 150,
  },
  emojiWrap: { width: 70, height: 70, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  emojiCircle: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 30 },
  cardLabel: { fontSize: FontSize.base, fontWeight: "800", color: "#E2D5FF", textAlign: "center" },
  cardDesc: { fontSize: FontSize.xs, color: "#9B8FCC", textAlign: "center", marginTop: 3 },
  activeBadge: {
    marginTop: 8, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3,
  },
  activeBadgeText: { fontSize: FontSize.xs, fontWeight: "800", color: "#fff" },

  note: {
    backgroundColor: "#1A1040", borderRadius: Radius.lg, padding: Spacing.md,
    marginTop: Spacing.md,
  },
  noteText: { fontSize: FontSize.xs, color: "#9B8FCC", textAlign: "center", lineHeight: 18 },
});
