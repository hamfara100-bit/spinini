import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Image, Alert, ActivityIndicator,
} from "react-native";
import * as Speech from "expo-speech";
import * as ImagePicker from "expo-image-picker";
import { useAudioRecorder, useAudioPlayer, AudioModule, RecordingPresets } from "expo-audio";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { Mascot } from "../../../components/mascot";
import { PASTEL_COLORS } from "../../../lib/data/types";
import { FUNNY_PRESETS, type FunnyPreset } from "../../../lib/funny-sounds";
import { uid, nowIso } from "../../../lib/utils";

// ─── Preset Card ──────────────────────────────────────────────────────────────

function PresetCard({
  preset,
  selected,
  onSelect,
}: {
  preset: FunnyPreset;
  selected: boolean;
  onSelect: () => void;
}) {
  const [previewing, setPreviewing] = useState(false);

  async function preview(e: any) {
    e.stopPropagation?.();
    if (previewing) {
      Speech.stop();
      setPreviewing(false);
      return;
    }
    setPreviewing(true);
    await Speech.speak(preset.text, {
      pitch: preset.pitch,
      rate: preset.rate,
      onDone: () => setPreviewing(false),
      onError: () => setPreviewing(false),
    });
  }

  return (
    <TouchableOpacity
      style={[
        styles.presetCard,
        { backgroundColor: preset.color },
        selected && styles.presetCardSelected,
      ]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <Text style={styles.presetEmoji}>{preset.emoji}</Text>
      <Text style={styles.presetLabel}>{preset.label}</Text>
      <TouchableOpacity style={[styles.previewBtn, previewing && styles.previewBtnActive]} onPress={preview}>
        <Text style={styles.previewBtnText}>{previewing ? "⏹" : "▶"}</Text>
      </TouchableOpacity>
      {selected && <View style={styles.presetCheck}><Text style={styles.presetCheckText}>✓</Text></View>}
    </TouchableOpacity>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function FunnySoundsScreen() {
  const { state, dispatch } = useData();
  const parentName = state.parentSettings.name || "Parent";

  // Recipient kids
  const [selectedKids, setSelectedKids] = useState<string[]>([]);

  // Mode: preset | record | video
  const [mode, setMode] = useState<"preset" | "record" | "video">("preset");

  // Preset selection
  const [selectedPreset, setSelectedPreset] = useState<FunnyPreset | null>(null);

  // Recording
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [recUri, setRecUri] = useState<string | null>(null);
  const recPlayer = useAudioPlayer(recUri ?? "");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Video
  const [videoUri, setVideoUri] = useState<string | null>(null);

  // Caption
  const [caption, setCaption] = useState("");

  // Sending
  const [sending, setSending] = useState(false);

  useEffect(() => () => { Speech.stop(); }, []);

  function toggleKid(kidId: string) {
    setSelectedKids(prev =>
      prev.includes(kidId) ? prev.filter(x => x !== kidId) : [...prev, kidId]
    );
  }

  async function startRecording() {
    try {
      await AudioModule.requestRecordingPermissionsAsync();
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch {
      Alert.alert("Mic Error", "Could not access microphone.");
    }
  }

  async function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
    await recorder.stop();
    if (recorder.uri) setRecUri(recorder.uri);
  }

  async function pickVideo() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsEditing: true,
      videoMaxDuration: 30,
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]) setVideoUri(res.assets[0].uri);
  }

  async function recordVideo() {
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ["videos"],
      allowsEditing: true,
      videoMaxDuration: 30,
      quality: 0.7,
    });
    if (!res.canceled && res.assets[0]) setVideoUri(res.assets[0].uri);
  }

  function canSend() {
    if (selectedKids.length === 0) return false;
    if (mode === "preset") return !!selectedPreset;
    if (mode === "record") return !!recUri;
    if (mode === "video") return !!videoUri;
    return false;
  }

  function send() {
    if (!canSend()) return;
    setSending(true);
    const baseMsg = {
      id: uid(),
      fromName: parentName,
      message: caption.trim() || undefined,
      sentAt: nowIso(),
      played: false,
    };

    selectedKids.forEach(kidId => {
      dispatch({
        type: "ADD_FUNNY_SOUND",
        kidId,
        msg: {
          ...baseMsg,
          id: uid(),
          kidId,
          ...(mode === "preset" && selectedPreset ? { presetId: selectedPreset.id } : {}),
          ...(mode === "record" && recUri ? { soundUri: recUri } : {}),
          ...(mode === "video" && videoUri ? { videoUri } : {}),
        },
      });
    });

    setTimeout(() => {
      setSending(false);
      setSelectedKids([]);
      setSelectedPreset(null);
      setRecUri(null);
      setVideoUri(null);
      setCaption("");
      Alert.alert("🎵 Sent!", `Funny message sent to ${selectedKids.length} kid${selectedKids.length > 1 ? "s" : ""}! It will pop up when they open the app.`);
    }, 400);
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🎵 Funny Sounds & Videos</Text>
      <Text style={styles.sub}>Send a surprise to your kids! It pops up when they open the app.</Text>

      {/* Kid selector */}
      <Text style={styles.sectionLabel}>Send To</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, alignItems: "center" }} style={{ marginBottom: Spacing.md }}>
        {state.kids.map(kid => {
          const on = selectedKids.includes(kid.profile.id);
          return (
            <TouchableOpacity
              key={kid.profile.id}
              style={[styles.kidChip, { backgroundColor: PASTEL_COLORS[kid.profile.color] }, on && styles.kidChipOn]}
              onPress={() => toggleKid(kid.profile.id)}
              activeOpacity={0.8}
            >
              <Mascot type={kid.profile.mascot} size={28} animate={false} />
              <Text style={[styles.kidChipName, on && styles.kidChipNameOn]}>{kid.profile.name}</Text>
              {on && <Text style={styles.kidChipCheck}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Mode tabs */}
      <Text style={styles.sectionLabel}>Type</Text>
      <View style={styles.modeTabs}>
        {(["preset", "record", "video"] as const).map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.modeTab, mode === m && styles.modeTabActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.modeTabText, mode === m && styles.modeTabTextActive]}>
              {m === "preset" ? "🎭 Funny Voices" : m === "record" ? "🎙️ Record" : "🎬 Video"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Preset Mode ── */}
      {mode === "preset" && (
        <>
          <Text style={styles.hint}>Tap ▶ to preview a voice. Tap the card to select it.</Text>
          <View style={styles.presetGrid}>
            {FUNNY_PRESETS.map(preset => (
              <PresetCard
                key={preset.id}
                preset={preset}
                selected={selectedPreset?.id === preset.id}
                onSelect={() => setSelectedPreset(prev => prev?.id === preset.id ? null : preset)}
              />
            ))}
          </View>
        </>
      )}

      {/* ── Record Mode ── */}
      {mode === "record" && (
        <View style={styles.recordCard}>
          <Text style={styles.recordTitle}>🎙️ Record a Funny Message</Text>
          <Text style={styles.recordSub}>Record your own voice — it plays on the kid's device when they open the app!</Text>

          {recUri && !recording ? (
            <View style={styles.recDoneBox}>
              <Text style={styles.recDoneText}>✅ Recording saved ({recSeconds}s)</Text>
              <View style={styles.recBtnsRow}>
                <TouchableOpacity
                  style={[styles.recActionBtn, { backgroundColor: Colors.success }]}
                  onPress={() => recPlayer.playing ? recPlayer.pause() : recPlayer.play()}
                >
                  <Text style={styles.recActionBtnText}>{recPlayer.playing ? "⏸ Pause" : "▶ Play Back"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.recActionBtn, { backgroundColor: Colors.error }]}
                  onPress={() => { setRecUri(null); setRecSeconds(0); }}
                >
                  <Text style={styles.recActionBtnText}>🗑 Redo</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : recording ? (
            <View style={styles.recordingLive}>
              <View style={styles.recDotLive} />
              <Text style={styles.recTimerText}>{recSeconds}s — Recording… tap Stop when done</Text>
              <TouchableOpacity style={styles.stopBtn} onPress={stopRecording}>
                <Text style={styles.stopBtnText}>⏹ Stop</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.startRecBtn} onPress={startRecording}>
              <Text style={styles.startRecBtnText}>🔴 Start Recording</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Video Mode ── */}
      {mode === "video" && (
        <View style={styles.recordCard}>
          <Text style={styles.recordTitle}>🎬 Send a Funny Video</Text>
          <Text style={styles.recordSub}>Pick a video from your gallery or record a quick one — up to 30 seconds!</Text>

          {videoUri ? (
            <View style={styles.recDoneBox}>
              <Text style={styles.recDoneText}>✅ Video ready to send!</Text>
              <TouchableOpacity
                style={[styles.recActionBtn, { backgroundColor: Colors.error }]}
                onPress={() => setVideoUri(null)}
              >
                <Text style={styles.recActionBtnText}>🗑 Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.videoBtnsRow}>
              <TouchableOpacity style={styles.videoBtn} onPress={pickVideo}>
                <Text style={styles.videoBtnEmoji}>🖼️</Text>
                <Text style={styles.videoBtnText}>Pick from Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.videoBtn} onPress={recordVideo}>
                <Text style={styles.videoBtnEmoji}>📷</Text>
                <Text style={styles.videoBtnText}>Record Video</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Caption */}
      <Text style={styles.sectionLabel}>Caption (optional)</Text>
      <TextInput
        style={styles.captionInput}
        value={caption}
        onChangeText={setCaption}
        placeholder="e.g. Gotcha! 😂 Love you!"
        maxLength={80}
      />

      {/* Send button */}
      <TouchableOpacity
        style={[styles.sendBtn, (!canSend() || sending) && styles.sendBtnDisabled]}
        onPress={send}
        disabled={!canSend() || sending}
      >
        {sending
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.sendBtnText}>
              🚀 Send to {selectedKids.length > 0
                ? selectedKids.map(id => state.kids.find(k => k.profile.id === id)?.profile.name).join(", ")
                : "..."}
            </Text>}
      </TouchableOpacity>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  hint: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 10, textAlign: "center" },

  // Kid chips
  kidChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full,
    borderWidth: 2, borderColor: "transparent", ...Shadow.sm,
  },
  kidChipOn: { borderColor: Colors.primary, ...Shadow.md },
  kidChipName: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  kidChipNameOn: { color: Colors.primary },
  kidChipCheck: { fontSize: 14, color: Colors.primary, fontWeight: "800" },

  // Mode tabs
  modeTabs: { flexDirection: "row", gap: 8, marginBottom: Spacing.md },
  modeTab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: Radius.md, backgroundColor: Colors.cardLight },
  modeTabActive: { backgroundColor: Colors.primary },
  modeTabText: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary },
  modeTabTextActive: { color: "#fff" },

  // Preset grid
  presetGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: Spacing.md },
  presetCard: {
    width: "30%", borderRadius: Radius.lg, padding: Spacing.sm,
    alignItems: "center", gap: 4, ...Shadow.sm,
    borderWidth: 2, borderColor: "transparent", position: "relative",
  },
  presetCardSelected: { borderColor: Colors.primary, ...Shadow.md },
  presetEmoji: { fontSize: 28 },
  presetLabel: { fontSize: 10, fontWeight: "700", color: Colors.textPrimary, textAlign: "center" },
  previewBtn: {
    marginTop: 4, backgroundColor: "rgba(0,0,0,0.12)", borderRadius: Radius.full,
    width: 28, height: 28, alignItems: "center", justifyContent: "center",
  },
  previewBtnActive: { backgroundColor: Colors.error + "30" },
  previewBtnText: { fontSize: 12, fontWeight: "800", color: Colors.textPrimary },
  presetCheck: {
    position: "absolute", top: 6, right: 6,
    backgroundColor: Colors.primary, borderRadius: 10, width: 18, height: 18,
    alignItems: "center", justifyContent: "center",
  },
  presetCheckText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  // Record / Video cards
  recordCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm, gap: 10 },
  recordTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  recordSub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  startRecBtn: { backgroundColor: Colors.error, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  startRecBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  recordingLive: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.error + "15", borderRadius: Radius.lg, padding: 14 },
  recDotLive: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.error },
  recTimerText: { flex: 1, color: Colors.error, fontWeight: "700", fontSize: FontSize.sm },
  stopBtn: { backgroundColor: Colors.error, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  stopBtnText: { color: "#fff", fontWeight: "700" },
  recDoneBox: { gap: 10 },
  recDoneText: { fontSize: FontSize.base, fontWeight: "700", color: Colors.success },
  recBtnsRow: { flexDirection: "row", gap: 10 },
  recActionBtn: { flex: 1, borderRadius: Radius.full, alignItems: "center", paddingVertical: 10 },
  recActionBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  videoBtnsRow: { flexDirection: "row", gap: 10 },
  videoBtn: {
    flex: 1, backgroundColor: Colors.primary + "12", borderRadius: Radius.lg,
    alignItems: "center", paddingVertical: 20, gap: 8,
    borderWidth: 1.5, borderColor: Colors.primary + "30",
  },
  videoBtnEmoji: { fontSize: 28 },
  videoBtnText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.primary },

  // Caption
  captionInput: {
    borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.md,
    padding: Spacing.sm, fontSize: FontSize.base, marginBottom: Spacing.md,
    color: Colors.textPrimary,
  },

  // Send button
  sendBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 15, ...Shadow.md, marginBottom: Spacing.xl, marginHorizontal: Spacing.xs },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
});
