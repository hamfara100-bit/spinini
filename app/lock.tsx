import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAudioPlayer } from "expo-audio";
import { useData, useKid } from "../lib/data/store";
import { hashPin } from "../lib/utils";
import { isLocked } from "../lib/data/logic";
import { PinPad } from "../components/pin-pad";
import { Mascot } from "../components/mascot";
import { Colors, FontSize, Radius, Spacing } from "../lib/theme";

export default function LockScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useData();
  const kid = useKid(id);
  const router = useRouter();
  const [showPinGate, setShowPinGate] = useState(false);
  const [pinError, setPinError] = useState("");
  const [deadTaps, setDeadTaps] = useState(0);

  // Auto-navigate to kid home when the parent unlocks from their side
  useEffect(() => {
    if (!kid || !id) return;
    if (!isLocked(kid) || kid.rules.freeMode) {
      router.replace(`/kid/${id}/home` as any);
    }
  }, [kid]);

  if (!id) return null;

  async function handleBackPin(pin: string) {
    // If the parent never set a PIN there's nothing to verify — allow exit so the
    // kid isn't trapped on the lock screen.
    if (!state.parentSettings.pin) {
      setShowPinGate(false);
      router.replace("/");
      return;
    }
    const hashed = await hashPin(pin);
    if (hashed === state.parentSettings.pin) {
      setShowPinGate(false);
      router.replace("/");
    } else {
      setPinError("Wrong PIN. Try again.");
    }
  }

  const backButton = (
    <TouchableOpacity style={styles.back} onPress={() => { setPinError(""); setShowPinGate(true); }}>
      <Text style={styles.backText}>← Back to Profiles</Text>
    </TouchableOpacity>
  );

  const pinGateModal = (
    <Modal visible={showPinGate} animationType="slide" transparent onRequestClose={() => setShowPinGate(false)}>
      <View style={styles.pinOverlay}>
        <View style={styles.pinCard}>
          <PinPad
            title="Parent PIN Required"
            subtitle="Enter your PIN to leave the lock screen."
            onComplete={handleBackPin}
            onClearError={() => setPinError("")}
            error={pinError}
          />
          <TouchableOpacity onPress={() => setShowPinGate(false)} style={styles.cancelBack}>
            <Text style={styles.cancelBackText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ── Fake "dead phone" — completely black, looks powered off. ──────────────
  // A hidden 4-tap anywhere reveals the parent PIN gate so it can be exited.
  if (kid?.rules.deadPhone) {
    return (
      <TouchableOpacity
        activeOpacity={1}
        style={styles.deadScreen}
        onPress={() => {
          const next = deadTaps + 1;
          if (next >= 4) { setDeadTaps(0); setPinError(""); setShowPinGate(true); }
          else setDeadTaps(next);
        }}
      >
        {pinGateModal}
      </TouchableOpacity>
    );
  }

  const fl = kid?.rules.funLock;
  const useFunLock = fl?.enabled && kid?.rules.instantLocked;

  // Play the custom sound when fun lock is active
  const player = useAudioPlayer(useFunLock && fl?.soundUri ? fl.soundUri : "");
  useEffect(() => {
    if (useFunLock && fl?.soundUri) {
      player.play();
    }
    return () => { try { player.pause(); } catch {} };
  }, [useFunLock]);

  const message = useFunLock && fl?.message
    ? fl.message
    : kid?.rules.lockMessage ?? "Screen time is paused 🌙";

  // If the parent locked the device behind a quiz, the kid MUST be able to reach
  // the quiz to answer it and unlock — otherwise they're stuck. Show a button
  // straight to the quiz whenever one is waiting.
  const pendingQuiz = (kid?.quizzes ?? []).find(
    q => q.status === "pending" || q.status === "in_progress"
  );
  const quizUnlockBtn = pendingQuiz ? (
    <TouchableOpacity
      style={styles.quizBtn}
      onPress={() => { if (id) router.push(`/kid/${id}/(more)/quiz` as any); }}
      accessibilityLabel="Answer quiz to unlock"
      accessibilityRole="button"
    >
      <Text style={styles.quizEmoji}>📝</Text>
      <View>
        <Text style={styles.quizLabel}>Answer Quiz to Unlock</Text>
        <Text style={styles.quizSub} numberOfLines={1}>{pendingQuiz.title}</Text>
      </View>
    </TouchableOpacity>
  ) : null;

  // Call family button — always available even when locked
  const callFamilyBtn = (
    <TouchableOpacity
      style={styles.callFamilyBtn}
      onPress={() => { if (id) router.push(`/kid/${id}/(more)/communicate` as any); }}
      accessibilityLabel="Call or text family"
      accessibilityRole="button"
    >
      <Text style={styles.callFamilyEmoji}>📞</Text>
      <View>
        <Text style={styles.callFamilyLabel}>Call or Text Family</Text>
        <Text style={styles.callFamilySub}>Always available</Text>
      </View>
    </TouchableOpacity>
  );

  if (useFunLock && fl?.imageUri) {
    return (
      <View style={styles.funContainer}>
        {pinGateModal}
        <Image source={{ uri: fl.imageUri }} style={styles.funImage} resizeMode="cover" />
        <View style={styles.funOverlay}>
          <Text style={styles.funMessage}>{message}</Text>
          <Text style={styles.funSub}>Ask a parent to unlock your screen. 🔒</Text>
          {quizUnlockBtn}
          {callFamilyBtn}
          <TouchableOpacity style={styles.funBackBtn} onPress={() => { setPinError(""); setShowPinGate(true); }}>
            <Text style={styles.funBackText}>← Back to Profiles</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {pinGateModal}
      <Mascot type={kid?.profile.mascot ?? "panda"} size={100} animate />
      <Text style={styles.name}>{kid?.profile.name ?? "Hey!"}</Text>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.sub}>Ask a parent to unlock your screen.</Text>

      {quizUnlockBtn}
      {callFamilyBtn}

      {backButton}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", padding: Spacing.xl },
  deadScreen: { flex: 1, backgroundColor: "#000" },
  name: { fontSize: FontSize.xxl, fontWeight: "800", color: "#fff", marginTop: Spacing.lg },
  message: { fontSize: FontSize.lg, color: "#fff", textAlign: "center", marginTop: Spacing.md, opacity: 0.9 },
  sub: { fontSize: FontSize.base, color: "#fff", opacity: 0.7, marginTop: Spacing.sm, textAlign: "center" },
  back: { marginTop: Spacing.lg, padding: Spacing.md },
  backText: { color: "#fff", fontSize: FontSize.base, opacity: 0.8 },

  // Always-available call family button
  callFamilyBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: Radius.xl, borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    marginTop: Spacing.xl,
  },
  callFamilyEmoji: { fontSize: 36 },
  callFamilyLabel: { fontSize: FontSize.md, fontWeight: "800", color: "#fff" },
  callFamilySub:   { fontSize: FontSize.xs, color: "rgba(255,255,255,0.7)", marginTop: 2 },

  // Answer-quiz-to-unlock button (shown when a quiz is gating the lock)
  quizBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    marginTop: Spacing.xl,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  quizEmoji: { fontSize: 36 },
  quizLabel: { fontSize: FontSize.md, fontWeight: "800", color: Colors.primary },
  quizSub:   { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, maxWidth: 200 },

  // PIN gate modal
  pinOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: Spacing.lg },
  pinCard: { backgroundColor: "#fff", borderRadius: Radius.xl, padding: Spacing.md },
  cancelBack: { padding: Spacing.md, alignItems: "center" },
  cancelBackText: { color: Colors.textSecondary, fontWeight: "600" },

  // Fun lock styles
  funContainer: { flex: 1 },
  funImage: { ...StyleSheet.absoluteFillObject },
  funOverlay: {
    flex: 1, backgroundColor: "#00000070",
    alignItems: "center", justifyContent: "flex-end",
    padding: Spacing.xl, paddingBottom: 60,
  },
  funMessage: {
    fontSize: 28, fontWeight: "800", color: "#fff",
    textAlign: "center", textShadowColor: "#000", textShadowRadius: 8, marginBottom: 12,
  },
  funSub: { fontSize: FontSize.base, color: "rgba(255,255,255,0.8)", textAlign: "center", marginBottom: 24 },
  funBackBtn: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 24, paddingHorizontal: 28, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" },
  funBackText: { color: "#fff", fontSize: FontSize.base, fontWeight: "700" },
});
