import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, Modal,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAudioRecorder, useAudioPlayer, createAudioPlayer, RecordingPresets } from "expo-audio";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import type { FamilyMessage } from "../../../../lib/data/types";

// ─── Sound Effects ────────────────────────────────────────────────────────────

interface SoundEffect {
  id: string;
  emoji: string;
  label: string;
  rate: number;           // playback rate (affects pitch + speed)
  color: string;
}

const EFFECTS: SoundEffect[] = [
  { id: "normal",    emoji: "🎙️", label: "Normal",       rate: 1.00, color: "#6366F1" },
  { id: "deep",      emoji: "🎸", label: "Deep Voice",   rate: 0.55, color: "#1E293B" },
  { id: "giant",     emoji: "🏔️", label: "Giant",        rate: 0.42, color: "#374151" },
  { id: "monster",   emoji: "👹", label: "Monster",      rate: 0.60, color: "#B91C1C" },
  { id: "ghost",     emoji: "👻", label: "Ghost",        rate: 0.72, color: "#6B7280" },
  { id: "cave",      emoji: "🗻", label: "Cave Echo",    rate: 0.78, color: "#44403C" },
  { id: "robot",     emoji: "🤖", label: "Robot",        rate: 0.88, color: "#0284C7" },
  { id: "slow",      emoji: "🐢", label: "Slow-Mo",      rate: 0.50, color: "#059669" },
  { id: "whisper",   emoji: "🤫", label: "Whisper",      rate: 0.93, color: "#7C3AED" },
  { id: "sleepy",    emoji: "😴", label: "Sleepy",       rate: 0.82, color: "#9333EA" },
  { id: "girl",      emoji: "💁", label: "Girl Voice",   rate: 1.30, color: "#EC4899" },
  { id: "fast",      emoji: "⚡", label: "Fast Talk",    rate: 1.45, color: "#F59E0B" },
  { id: "baby",      emoji: "👶", label: "Baby Voice",   rate: 1.55, color: "#FB923C" },
  { id: "alien",     emoji: "👽", label: "Alien",        rate: 1.65, color: "#10B981" },
  { id: "helium",    emoji: "🎈", label: "Helium",       rate: 1.75, color: "#06B6D4" },
  { id: "chipmunk",  emoji: "🐿️", label: "Chipmunk",    rate: 2.00, color: "#F97316" },
  { id: "squirrel",  emoji: "🐾", label: "Squirrel",     rate: 1.88, color: "#84CC16" },
  { id: "turbo",     emoji: "🚀", label: "Turbo",        rate: 2.20, color: "#EF4444" },
  { id: "dummy",     emoji: "🎭", label: "Dummy Voice",  rate: 1.40, color: "#8B5CF6" },
  { id: "underwater",emoji: "🌊", label: "Underwater",   rate: 0.65, color: "#2563EB" },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function VoiceChangerScreen() {
  const { id }        = useLocalSearchParams<{ id: string }>();
  const { dispatch, state } = useData();
  const kid           = useKid(id);

  // Recording state
  const recorder     = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording]   = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordSecs, setRecordSecs]     = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Playback
  const playerRef   = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [selectedFx, setSelectedFx] = useState<SoundEffect>(EFFECTS[0]);

  // Send modal
  const [showSend, setShowSend]   = useState(false);
  const [sendNote, setSendNote]   = useState("");
  const [sending, setSending]     = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Recording ──────────────────────────────────────────────────────────────

  async function startRecording() {
    try {
      setRecordingUri(null);
      setRecordSecs(0);
      await recorder.record();
      setIsRecording(true);
      timerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000);
    } catch (e) {
      Alert.alert("Microphone Error", "Could not start recording. Check microphone permissions.");
    }
  }

  async function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        setRecordingUri(uri);
      }
    } catch (e) {
      Alert.alert("Error", "Could not save the recording.");
    }
    setIsRecording(false);
  }

  // ── Playback with effect ────────────────────────────────────────────────────

  function stopPlayback() {
    if (playerRef.current) {
      try { playerRef.current.pause(); playerRef.current.remove(); } catch {}
      playerRef.current = null;
    }
    setIsPlaying(false);
  }

  async function playWithEffect(fx: SoundEffect) {
    if (!recordingUri) {
      Alert.alert("Record first!", "Tap the big microphone button to record your voice.");
      return;
    }
    stopPlayback();
    try {
      const player = createAudioPlayer(recordingUri);
      player.setPlaybackRate(fx.rate);
      player.play();
      playerRef.current = player;
      setIsPlaying(true);
      setSelectedFx(fx);
      // Auto-stop when done (approx)
      const durationMs = (recordSecs + 1) / fx.rate * 1000 + 500;
      setTimeout(() => { stopPlayback(); }, durationMs);
    } catch (e) {
      Alert.alert("Playback Error", "Could not play back the recording.");
    }
  }

  // ── Send ────────────────────────────────────────────────────────────────────

  async function sendToFamily() {
    if (!recordingUri) return;
    setSending(true);
    try {
      // Send as a FamilyMessage — text describes the voice effect, imageUri holds audio URI
      const message: FamilyMessage = {
        id: uid(),
        text: `🎙️ Voice message with ${selectedFx.emoji} ${selectedFx.label} effect${sendNote.trim() ? `\n"${sendNote.trim()}"` : ""}`,
        imageUri: recordingUri,   // repurposed to carry audio URI locally
        authorId: id,
        authorName: kid?.profile.name ?? "Kid",
        recipients: [],           // broadcast to whole family
        sentAt: nowIso(),
        readBy: [id],
      };
      dispatch({ type: "FAMILY_CHAT_PUSH", message });
      setSendNote("");
      setShowSend(false);
      Alert.alert("Sent! 🎉", "Your voice message was sent to the family chat!");
    } catch {
      Alert.alert("Error", "Could not send the message.");
    }
    setSending(false);
  }

  // ── UI helpers ──────────────────────────────────────────────────────────────

  const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <ScreenContainer>
      <Text style={s.screenTitle}>🎙️ Voice Changer</Text>
      <Text style={s.screenSub}>Record your voice and play it with fun sound effects!</Text>

      {/* ── Big Record Button ── */}
      <View style={s.recordSection}>
        <TouchableOpacity
          style={[s.recordBtn, isRecording && s.recordBtnActive]}
          onPress={isRecording ? stopRecording : startRecording}
          activeOpacity={0.85}
        >
          <Text style={s.recordBtnIcon}>{isRecording ? "⏹" : "🎙️"}</Text>
          <Text style={s.recordBtnLabel}>
            {isRecording ? `Recording… ${fmtSecs(recordSecs)}` : "Tap to Record"}
          </Text>
          {isRecording && <View style={s.recordPulse} />}
        </TouchableOpacity>

        {recordingUri && !isRecording && (
          <View style={s.recordedPill}>
            <Text style={s.recordedText}>✅ Recorded {fmtSecs(recordSecs)}</Text>
          </View>
        )}
      </View>

      {/* ── Effects Grid ── */}
      <Text style={s.sectionLabel}>CHOOSE AN EFFECT — TAP TO PLAY</Text>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.effectsGrid}
        showsVerticalScrollIndicator={false}
      >
        {EFFECTS.map(fx => {
          const isSel = selectedFx.id === fx.id;
          return (
            <TouchableOpacity
              key={fx.id}
              style={[
                s.fxCard,
                { borderColor: isSel ? fx.color : "transparent", backgroundColor: isSel ? fx.color + "18" : Colors.cardLight },
              ]}
              onPress={() => playWithEffect(fx)}
              activeOpacity={0.75}
            >
              <Text style={s.fxEmoji}>{fx.emoji}</Text>
              <Text style={[s.fxLabel, isSel && { color: fx.color }]} numberOfLines={2}>
                {fx.label}
              </Text>
              {isPlaying && isSel && (
                <View style={[s.playingDot, { backgroundColor: fx.color }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Bottom action bar ── */}
      {recordingUri && (
        <View style={s.actionBar}>
          <TouchableOpacity
            style={[s.actionBtn, s.actionBtnPlay]}
            onPress={() => playWithEffect(selectedFx)}
          >
            <Text style={s.actionBtnText}>
              {isPlaying ? "⏸ Playing…" : `▶ Play (${selectedFx.emoji} ${selectedFx.label})`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, s.actionBtnSend]}
            onPress={() => setShowSend(true)}
          >
            <Text style={s.actionBtnText}>📤 Send</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Send Modal ── */}
      <Modal visible={showSend} transparent animationType="slide" onRequestClose={() => setShowSend(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>📤 Send Voice Message</Text>
            <Text style={s.modalSub}>
              Sending with {selectedFx.emoji} <Text style={{ fontWeight: "800" }}>{selectedFx.label}</Text> effect
            </Text>
            <Text style={s.modalFieldLabel}>Add a note (optional)</Text>
            <TextInput
              style={s.modalInput}
              value={sendNote}
              onChangeText={setSendNote}
              placeholder="e.g. Listen to this funny voice! 😂"
              multiline
              maxLength={120}
            />
            <Text style={s.modalInfo}>Your voice message will appear in the family chat 💬</Text>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowSend(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalSendBtn} onPress={sendToFamily} disabled={sending}>
                {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.modalSendText}>🚀 Send!</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const EFFECT_COL_W = 76;

const s = StyleSheet.create({
  screenTitle: { fontSize: FontSize.xl, fontWeight: "900", color: Colors.primary, marginBottom: 4 },
  screenSub:   { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },

  sectionLabel: {
    fontSize: 10, fontWeight: "800", color: Colors.textMuted,
    letterSpacing: 1.2, marginBottom: 10,
  },

  // Record button
  recordSection: { alignItems: "center", marginBottom: Spacing.lg, gap: 12 },
  recordBtn: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: Colors.primary + "18",
    borderWidth: 3, borderColor: Colors.primary + "40",
    alignItems: "center", justifyContent: "center", gap: 6,
    ...Shadow.md,
    position: "relative", overflow: "hidden",
  },
  recordBtnActive: {
    backgroundColor: Colors.error + "18",
    borderColor: Colors.error,
  },
  recordBtnIcon: { fontSize: 52, lineHeight: 58 },
  recordBtnLabel: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.primary, textAlign: "center" },
  recordPulse: {
    position: "absolute",
    width: 180, height: 180, borderRadius: 90,
    borderWidth: 3, borderColor: Colors.error + "50",
  },
  recordedPill: {
    backgroundColor: Colors.success + "18", borderRadius: Radius.full,
    paddingHorizontal: 18, paddingVertical: 8,
    borderWidth: 1.5, borderColor: Colors.success + "50",
  },
  recordedText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.success },

  // Effects grid (wrap)
  effectsGrid: {
    flexDirection: "row", flexWrap: "wrap",
    gap: 8, paddingBottom: 16,
  },
  fxCard: {
    width: EFFECT_COL_W, alignItems: "center", gap: 4,
    borderRadius: Radius.lg, paddingVertical: 12, paddingHorizontal: 4,
    borderWidth: 2, position: "relative",
  },
  fxEmoji:  { fontSize: 28 },
  fxLabel:  { fontSize: 10, fontWeight: "700", color: Colors.textSecondary, textAlign: "center", lineHeight: 13 },
  playingDot: {
    position: "absolute", top: 6, right: 6,
    width: 8, height: 8, borderRadius: 4,
  },

  // Bottom action bar
  actionBar: {
    flexDirection: "row", gap: 10,
    paddingTop: 12, paddingBottom: 4,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  actionBtn:      { flex: 1, borderRadius: Radius.full, paddingVertical: 14, alignItems: "center", ...Shadow.sm },
  actionBtnPlay:  { backgroundColor: Colors.primary },
  actionBtnSend:  { backgroundColor: Colors.success },
  actionBtnText:  { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },

  // Send modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: Colors.bgLight, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.lg, gap: 10, paddingBottom: 40, ...Shadow.md,
  },
  modalTitle:      { fontSize: FontSize.lg, fontWeight: "900", color: Colors.primary, textAlign: "center" },
  modalSub:        { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },
  modalFieldLabel: { fontSize: FontSize.xs, fontWeight: "800", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  modalInput: {
    borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.lg,
    padding: Spacing.md, fontSize: FontSize.base, color: Colors.textPrimary,
    backgroundColor: Colors.surfaceLight, minHeight: 72, textAlignVertical: "top",
  },
  modalInfo:       { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "center" },
  modalBtns:       { flexDirection: "row", gap: 10, marginTop: 4 },
  modalCancelBtn:  { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  modalCancelText: { fontWeight: "700", color: Colors.textSecondary, fontSize: FontSize.base },
  modalSendBtn:    { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, ...Shadow.sm },
  modalSendText:   { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
});
