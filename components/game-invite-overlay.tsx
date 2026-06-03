/**
 * GameInviteOverlay — when another family member invites THIS device to a
 * cross-device Game Night match, raise a loud non-stop alarm + full-screen
 * banner (brings the app to the front even from the background) until the
 * person taps "Join" or "Dismiss".
 *
 * Mounted once in BOTH the parent layout (myId="parent") and the kid layout
 * (myId = kid profile id). It only fires for invites addressed to `myId`.
 */
import React, { useEffect, useRef, useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, Vibration, Platform, Animated } from "react-native";
import { useRouter } from "expo-router";
import { useData } from "../lib/data/store";
import type { OnlineGameInvite } from "../lib/data/types";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../lib/theme";
import { forceMaxVolume, playSystemAlarm, stopSystemAlarm, fireFullScreenAlarm, cancelFullScreenAlarm } from "expo-loud-alarm";

const PATTERN: number[] = [0, 600, 150, 600, 150, 600];

const GAME_EMOJI: Record<string, string> = {
  ttt: "⭕", connect4: "🔴", hangman: "🔤", memory: "🧠", checkers: "🔵", chess: "♟️", trash: "🃏",
};

export function GameInviteOverlay({ myId, myName }: { myId: string; myName: string }) {
  const { state, dispatch } = useData();
  const router = useRouter();
  const [invite, setInvite] = useState<OnlineGameInvite | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const mine = (state.gameInvites ?? []).find(i => i.toId === myId);
    setInvite(mine ?? null);
  }, [state.gameInvites, myId]);

  // Loud looping alarm + vibration + bring-to-front while an invite is pending.
  useEffect(() => {
    if (!invite) {
      Vibration.cancel();
      if (Platform.OS === "android") { try { cancelFullScreenAlarm(); } catch {} }
      try { stopSystemAlarm(); } catch {}
      pulse.setValue(1);
      return;
    }
    if (Platform.OS === "android") {
      try { forceMaxVolume(); } catch {}
      // Brings the app to the front even if backgrounded / screen off, and loops.
      try { fireFullScreenAlarm("🎮 Game Night invite!", `${invite.fromName} wants to play ${invite.gameName}`); } catch {}
    } else {
      try { playSystemAlarm(); } catch {}
    }
    Vibration.vibrate(PATTERN, true);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.12, duration: 500, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => {
      Vibration.cancel();
      if (Platform.OS === "android") { try { cancelFullScreenAlarm(); } catch {} }
      try { stopSystemAlarm(); } catch {}
      loop.stop();
      pulse.setValue(1);
    };
  }, [invite?.id]);

  function stopAlarm() {
    Vibration.cancel();
    if (Platform.OS === "android") { try { cancelFullScreenAlarm(); } catch {} }
    try { stopSystemAlarm(); } catch {}
  }

  function join() {
    if (!invite) return;
    stopAlarm();
    dispatch({ type: "OGAME_INVITE_CLEAR", toId: myId });
    router.push(`/online-game?me=${encodeURIComponent(myId)}&name=${encodeURIComponent(myName)}` as any);
  }

  function dismiss() {
    stopAlarm();
    dispatch({ type: "OGAME_INVITE_CLEAR", toId: myId });
  }

  if (!invite) return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <View style={s.screen}>
        <Animated.Text style={[s.emoji, { transform: [{ scale: pulse }] }]}>
          {GAME_EMOJI[invite.gameId] ?? "🎮"}
        </Animated.Text>
        <Text style={s.badge}>🎮 GAME NIGHT INVITE</Text>
        <Text style={s.title}>{invite.fromName} wants to play!</Text>
        <View style={s.card}>
          <Text style={s.cardText}>{invite.gameName}</Text>
          <Text style={s.time}>Tap Join to play together on your phone</Text>
        </View>
        <TouchableOpacity style={s.joinBtn} activeOpacity={0.85} onPress={join}>
          <Text style={s.joinText}>🎮 Join Game!</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.dismissBtn} activeOpacity={0.85} onPress={dismiss}>
          <Text style={s.dismissText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0D0A1E", alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  emoji: { fontSize: 84, marginBottom: 10 },
  badge: { fontSize: 12, fontWeight: "900", letterSpacing: 1.2, color: Colors.primary, backgroundColor: Colors.primary + "25", borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 6, overflow: "hidden", marginBottom: 12 },
  title: { fontSize: 26, fontWeight: "900", color: "#fff", textAlign: "center", marginBottom: 16 },
  card: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: Radius.xl, padding: 18, marginBottom: 24, maxWidth: "90%", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  cardText: { fontSize: FontSize.lg, color: "#fff", fontWeight: "800", textAlign: "center", lineHeight: 26 },
  time: { fontSize: FontSize.xs, color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 8 },
  joinBtn: { backgroundColor: Colors.success, borderRadius: Radius.full, paddingHorizontal: 56, paddingVertical: 18, ...Shadow.md },
  joinText: { color: "#fff", fontSize: FontSize.lg, fontWeight: "800" },
  dismissBtn: { marginTop: 16, padding: 12 },
  dismissText: { color: "rgba(255,255,255,0.5)", fontSize: FontSize.base, fontWeight: "700" },
});
