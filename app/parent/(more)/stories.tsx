/**
 * Parent Stories Studio
 *
 * Four creation modes:
 *  1. AI Story      — type a prompt, AI writes the story, kids read with word-by-word highlight
 *  2. Voice Audio   — parent records themselves reading; kids hear the recording
 *  3. Voice Video   — parent films themselves reading; kids watch the video
 *  4. AI + My Voice — AI writes story + parent's recorded voice sample stored for future
 *                     voice-clone narration (TTS fallback until backend is wired)
 *
 * Existing YouTube / video / audio link sharing is preserved on the Media tab.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Modal, Image, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { useAudioRecorder, useAudioPlayer, AudioModule, RecordingPresets } from "expo-audio";
import { useVideoPlayer, VideoView } from "expo-video";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso } from "../../../lib/utils";
import { uploadMedia } from "../../../lib/media-upload";
import { claudeGenerateStory } from "../../../lib/ai";
import type { StoryItem, StoryMedia, StoryMediaKind, VoiceSample, StoryRecordingType } from "../../../lib/data/types";

const { width: SW } = Dimensions.get("window");

// ─── YouTube helper ───────────────────────────────────────────────────────────
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([^&#]+)/,
    /youtu\.be\/([^?&#]+)/,
    /youtube\.com\/embed\/([^?&#/]+)/,
    /youtube\.com\/shorts\/([^?&#/]+)/,
  ];
  for (const p of patterns) { const m = url.match(p); if (m?.[1]) return m[1]; }
  return null;
}

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ─── Mode meta ────────────────────────────────────────────────────────────────
type CreateMode = "ai-text" | "voice-audio" | "voice-video" | "ai-voice-clone";

const MODES: { mode: CreateMode; emoji: string; title: string; sub: string; color: string }[] = [
  {
    mode: "ai-text",
    emoji: "✨",
    title: "AI Story",
    sub: "Type a plot idea — AI writes the full story. Kids read along with word-by-word highlight.",
    color: Colors.primary,
  },
  {
    mode: "voice-audio",
    emoji: "🎙",
    title: "Record Your Voice",
    sub: "Record yourself reading a story out loud. Audio only — perfect for bedtime.",
    color: "#F97316",
  },
  {
    mode: "voice-video",
    emoji: "🎥",
    title: "Record Video",
    sub: "Film yourself reading the story. Kids see you and hear you — just like a bedtime call.",
    color: "#EF4444",
  },
  {
    mode: "ai-voice-clone",
    emoji: "🤖",
    title: "AI + My Voice",
    sub: "AI writes the story and narrates it in a voice that sounds like you (voice sample needed).",
    color: "#10B981",
  },
];

// ─── Kid selector row (shared) ────────────────────────────────────────────────
function KidSelector({
  kids,
  selected,
  onToggle,
}: {
  kids: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <View style={ks.wrap}>
      <Text style={ks.label}>Send to</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <TouchableOpacity
          style={[ks.chip, selected.length === 0 && ks.chipActive]}
          onPress={() => kids.forEach(k => selected.includes(k.id) && onToggle(k.id))}
        >
          <Text style={[ks.chipText, selected.length === 0 && ks.chipTextActive]}>All Kids</Text>
        </TouchableOpacity>
        {kids.map(k => (
          <TouchableOpacity
            key={k.id}
            style={[ks.chip, selected.includes(k.id) && ks.chipActive]}
            onPress={() => onToggle(k.id)}
          >
            <Text style={[ks.chipText, selected.includes(k.id) && ks.chipTextActive]}>{k.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const ks = StyleSheet.create({
  wrap: { marginBottom: Spacing.md },
  label: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontWeight: "600", color: Colors.textSecondary, fontSize: FontSize.sm },
  chipTextActive: { color: "#fff" },
});

// ─── Voice Sample Manager ─────────────────────────────────────────────────────
function VoiceSampleSection({
  samples,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
}: {
  samples: VoiceSample[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (sample: VoiceSample) => void;
  onDelete: (id: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [showRecorder, setShowRecorder] = useState(false);
  const [sampleName, setSampleName] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    try { recorder.stop(); } catch {}
  }, []);

  async function startRec() {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted) { Alert.alert("Microphone access needed to record your voice."); return; }
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
    setRecordSec(0);
    timerRef.current = setInterval(() => setRecordSec(s => s + 1), 1000);
  }

  async function stopRec() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    await recorder.stop();
    setRecording(false);
    if (recorder.uri) {
      const name = sampleName.trim() || "My voice sample";
      const sample: VoiceSample = { id: uid(), name, uri: recorder.uri, durationSec: recordSec, createdAt: nowIso() };
      onAdd(sample);
      onSelect(sample.id);
      setSampleName("");
      setShowRecorder(false);
    }
  }

  return (
    <View style={vs.wrap}>
      <Text style={vs.title}>🎤 Voice Sample</Text>
      <Text style={vs.sub}>Record a short voice clip (15–30 sec) so the AI can narrate the story in a voice that sounds like yours.</Text>

      {samples.length > 0 && (
        <View style={{ gap: 6, marginBottom: 10 }}>
          {samples.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[vs.sampleRow, selectedId === s.id && vs.sampleRowActive]}
              onPress={() => onSelect(s.id)}
            >
              <Text style={vs.sampleCheck}>{selectedId === s.id ? "✓" : " "}</Text>
              <View style={{ flex: 1 }}>
                <Text style={vs.sampleName}>{s.name}</Text>
                <Text style={vs.sampleMeta}>{fmtTime(s.durationSec)} · {new Date(s.createdAt).toLocaleDateString()}</Text>
              </View>
              <TouchableOpacity
                onPress={() => Alert.alert("Delete sample?", s.name, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => { onDelete(s.id); if (selectedId === s.id) onSelect(""); } },
                ])}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={vs.sampleDelete}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!showRecorder ? (
        <TouchableOpacity style={vs.addBtn} onPress={() => setShowRecorder(true)}>
          <Text style={vs.addBtnText}>+ Record New Voice Sample</Text>
        </TouchableOpacity>
      ) : (
        <View style={vs.recorder}>
          <TextInput
            style={vs.nameInput}
            value={sampleName}
            onChangeText={setSampleName}
            placeholder="Label e.g. 'Calm bedtime voice'"
            placeholderTextColor={Colors.textMuted}
          />
          {!recording ? (
            <TouchableOpacity style={vs.recBtn} onPress={startRec}>
              <Text style={vs.recBtnText}>🎙 Start Recording</Text>
            </TouchableOpacity>
          ) : (
            <View style={vs.recActive}>
              <View style={vs.recDot} />
              <Text style={vs.recTimer}>Recording… {fmtTime(recordSec)}</Text>
              <TouchableOpacity style={vs.recStopBtn} onPress={stopRec}>
                <Text style={vs.recStopText}>⏹ Done</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity onPress={() => { setShowRecorder(false); setRecording(false); }}>
            <Text style={vs.cancelSmall}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const vs = StyleSheet.create({
  wrap: { backgroundColor: "#10B98112", borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: "#10B98130" },
  title: { fontSize: FontSize.base, fontWeight: "800", color: "#047857", marginBottom: 2 },
  sub: { fontSize: FontSize.xs, color: "#065F46", lineHeight: 18, marginBottom: Spacing.sm },
  sampleRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: Radius.lg, padding: 10, borderWidth: 1.5, borderColor: Colors.border },
  sampleRowActive: { borderColor: "#10B981" },
  sampleCheck: { fontSize: 16, fontWeight: "700", color: "#10B981", width: 20, textAlign: "center" },
  sampleName: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  sampleMeta: { fontSize: FontSize.xs, color: Colors.textMuted },
  sampleDelete: { fontSize: 14, color: Colors.error, fontWeight: "700" },
  addBtn: { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: "#10B981" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  recorder: { gap: 8 },
  nameInput: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: 10, fontSize: FontSize.sm, backgroundColor: "#fff" },
  recBtn: { backgroundColor: Colors.error, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12 },
  recBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  recActive: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.error + "15", borderRadius: Radius.lg, padding: 12 },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.error },
  recTimer: { flex: 1, fontWeight: "700", color: Colors.error, fontSize: FontSize.base },
  recStopBtn: { backgroundColor: Colors.error, borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8 },
  recStopText: { color: "#fff", fontWeight: "700" },
  cancelSmall: { textAlign: "center", color: Colors.textMuted, fontSize: FontSize.sm, paddingVertical: 4 },
});

// ─── Create Story Modal ───────────────────────────────────────────────────────
type CreateStep = "pick" | "creating";

function CreateStoryModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (story: StoryItem) => void;
}) {
  const { state, dispatch } = useData();
  const kids = state.kids.map(k => ({ id: k.profile.id, name: k.profile.name }));

  const [step, setStep] = useState<CreateStep>("pick");
  const [mode, setMode] = useState<CreateMode>("ai-text");

  // Shared
  const [title, setTitle] = useState("");
  const [targetKids, setTargetKids] = useState<string[]>([]);
  const [coverEmoji, setCoverEmoji] = useState("🌙");

  // AI story
  const [prompt, setPrompt] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [generating, setGenerating] = useState(false);

  // Voice audio recording
  const [recSec, setRecSec] = useState(0);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const audioTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const audioPlayer = useAudioPlayer(audioUri ?? null);

  // Voice video recording
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [recordingVideo, setRecordingVideo] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<"front" | "back">("front");
  const cameraRef = useRef<CameraView>(null);
  const videoPlayer = useVideoPlayer(videoUri ?? null, p => { p.loop = false; });

  // AI voice clone
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);

  useEffect(() => () => {
    if (audioTimerRef.current) clearInterval(audioTimerRef.current);
    try { audioRecorder.stop(); } catch {}
  }, []);

  function toggleKid(id: string) {
    setTargetKids(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  // ── Audio recording ──
  async function startAudioRec() {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted) { Alert.alert("Microphone permission needed."); return; }
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
    setRecordingAudio(true); setRecSec(0); setAudioUri(null);
    audioTimerRef.current = setInterval(() => setRecSec(s => s + 1), 1000);
  }

  async function stopAudioRec() {
    if (audioTimerRef.current) { clearInterval(audioTimerRef.current); audioTimerRef.current = null; }
    await audioRecorder.stop();
    setRecordingAudio(false);
    if (audioRecorder.uri) setAudioUri(audioRecorder.uri);
  }

  // ── Video recording ──
  async function ensureVideoPerms(): Promise<boolean> {
    if (!cameraPermission?.granted) {
      const r = await requestCameraPermission();
      if (!r.granted) { Alert.alert("Camera permission needed."); return false; }
    }
    if (!micPermission?.granted) {
      const r = await requestMicPermission();
      if (!r.granted) { Alert.alert("Microphone permission needed."); return false; }
    }
    return true;
  }

  async function startVideoRec() {
    if (!await ensureVideoPerms()) return;
    if (!cameraRef.current) return;
    setRecordingVideo(true);
    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: 300 });
      if (result?.uri) setVideoUri(result.uri);
    } catch {}
    setRecordingVideo(false);
  }

  function stopVideoRec() {
    cameraRef.current?.stopRecording();
    setRecordingVideo(false);
  }

  // ── AI generation ──
  async function generateStory() {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const kidName = targetKids.length === 1
        ? state.kids.find(k => k.profile.id === targetKids[0])?.profile.name ?? "the kids"
        : "the kids";
      const age = targetKids.length === 1
        ? state.kids.find(k => k.profile.id === targetKids[0])?.profile.age ?? 8
        : 8;
      const char = targetKids.length === 1
        ? state.kids.find(k => k.profile.id === targetKids[0])?.rules.storyCharacter
        : undefined;
      const text = await claudeGenerateStory(prompt.trim(), kidName, age, char);
      setGeneratedText(text);
    } catch {
      Alert.alert("Generation failed", "Check your internet connection and try again.");
    } finally {
      setGenerating(false);
    }
  }

  // ── Save ──
  async function save() {
    const t = title.trim();
    if (!t) { Alert.alert("Give the story a title first."); return; }

    if (mode === "voice-audio" && !audioUri) { Alert.alert("Record your voice first."); return; }
    if (mode === "voice-video" && !videoUri) { Alert.alert("Record a video first."); return; }
    if ((mode === "ai-text" || mode === "ai-voice-clone") && !generatedText.trim()) {
      Alert.alert("Generate a story first."); return;
    }
    if (mode === "ai-voice-clone" && !selectedSampleId) {
      Alert.alert("Add a voice sample first so the AI knows what you sound like."); return;
    }

    // Upload recordings so the kids' devices can play them (needs the bucket).
    const sharedAudio = audioUri ? (await uploadMedia(audioUri, { folder: "stories" })) ?? audioUri : undefined;
    const sharedVideo = videoUri ? (await uploadMedia(videoUri, { folder: "stories" })) ?? videoUri : undefined;
    const story: StoryItem = {
      id: uid(),
      title: t,
      text: generatedText.trim() || (mode === "voice-audio" ? "(Voice recording — tap to listen)" : "(Video story — tap to watch)"),
      recordingType: mode,
      audioUri: sharedAudio,
      videoUri: sharedVideo,
      coverEmoji,
      duration: mode === "voice-audio" ? recSec : undefined,
      authorId: "parent",
      authorName: state.parent.name,
      targetKids,
      readBy: [],
      aiGenerated: mode === "ai-text" || mode === "ai-voice-clone",
      createdAt: nowIso(),
    };

    onSave(story);
  }

  const canSave = (() => {
    if (!title.trim()) return false;
    if (mode === "voice-audio") return !!audioUri;
    if (mode === "voice-video") return !!videoUri;
    if (mode === "ai-text") return !!generatedText;
    if (mode === "ai-voice-clone") return !!generatedText && !!selectedSampleId;
    return false;
  })();

  const modeColor = MODES.find(m => m.mode === mode)?.color ?? Colors.primary;
  const isVideoReady = mode === "voice-video" && !!videoUri;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgLight }}>

        {/* Header */}
        <View style={cm.header}>
          <TouchableOpacity onPress={onClose}><Text style={cm.headerCancel}>Cancel</Text></TouchableOpacity>
          <Text style={cm.headerTitle}>
            {step === "pick" ? "Create Story" : (MODES.find(m => m.mode === mode)?.emoji + " " + MODES.find(m => m.mode === mode)?.title)}
          </Text>
          {step === "creating" ? (
            <TouchableOpacity onPress={save} disabled={!canSave}>
              <Text style={[cm.headerSave, !canSave && { opacity: 0.35 }]}>Save</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 50 }} />}
        </View>

        <ScrollView
          contentContainerStyle={cm.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Step 1: pick mode ── */}
          {step === "pick" && (
            <>
              <Text style={cm.pickTitle}>How would you like to create this story?</Text>
              <View style={cm.modeGrid}>
                {MODES.map(m => (
                  <TouchableOpacity
                    key={m.mode}
                    style={[cm.modeCard, { borderColor: m.color + "60" }]}
                    onPress={() => { setMode(m.mode); setStep("creating"); }}
                    activeOpacity={0.8}
                  >
                    <Text style={cm.modeEmoji}>{m.emoji}</Text>
                    <Text style={[cm.modeTitle, { color: m.color }]}>{m.title}</Text>
                    <Text style={cm.modeSub}>{m.sub}</Text>
                    <View style={[cm.modeArrow, { backgroundColor: m.color }]}>
                      <Text style={cm.modeArrowText}>Choose →</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* ── Step 2: Configure ── */}
          {step === "creating" && (
            <>
              {/* Back to mode picker */}
              <TouchableOpacity style={cm.backRow} onPress={() => { setStep("pick"); setGeneratedText(""); }}>
                <Text style={cm.backText}>← Change mode</Text>
              </TouchableOpacity>

              {/* Title */}
              <Text style={cm.fieldLabel}>Story Title</Text>
              <TextInput
                style={cm.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. The Dragon Who Was Afraid of the Dark"
                placeholderTextColor={Colors.textMuted}
              />

              {/* Cover emoji */}
              <Text style={cm.fieldLabel}>Cover Emoji</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: Spacing.md }}>
                {["🌙","📖","🦁","🐉","🧚","🌟","🚀","🏰","🌊","🦋","🦄","🌈"].map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[cm.emojiChip, coverEmoji === e && cm.emojiChipActive]}
                    onPress={() => setCoverEmoji(e)}
                  >
                    <Text style={{ fontSize: 24 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* ── Mode-specific fields ── */}

              {/* AI Story */}
              {(mode === "ai-text" || mode === "ai-voice-clone") && (
                <>
                  {mode === "ai-voice-clone" && (
                    <VoiceSampleSection
                      samples={state.voiceSamples ?? []}
                      selectedId={selectedSampleId}
                      onSelect={setSelectedSampleId}
                      onAdd={sample => dispatch({ type: "VOICE_SAMPLE_ADD", sample })}
                      onDelete={id => dispatch({ type: "VOICE_SAMPLE_DELETE", sampleId: id })}
                    />
                  )}
                  <Text style={cm.fieldLabel}>Story Prompt</Text>
                  <TextInput
                    style={[cm.input, { minHeight: 80, textAlignVertical: "top" }]}
                    value={prompt}
                    onChangeText={setPrompt}
                    placeholder="e.g. A little bunny who's scared of thunder learns courage from a wise old owl…"
                    placeholderTextColor={Colors.textMuted}
                    multiline
                  />
                  <TouchableOpacity
                    style={[cm.genBtn, { backgroundColor: modeColor }, (generating || !prompt.trim()) && { opacity: 0.6 }]}
                    onPress={generateStory}
                    disabled={generating || !prompt.trim()}
                  >
                    {generating
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={cm.genBtnText}>{generatedText ? "🔄 Regenerate Story" : "✨ Generate Story"}</Text>}
                  </TouchableOpacity>
                  {mode === "ai-voice-clone" && selectedSampleId && (
                    <View style={cm.voiceCloneNote}>
                      <Text style={cm.voiceCloneNoteText}>
                        🎤 Voice sample saved! When the AI narration service is connected, this story will be read in your voice. For now, the kid side uses text-to-speech with word highlighting.
                      </Text>
                    </View>
                  )}
                  {!!generatedText && (
                    <View style={cm.storyPreviewBox}>
                      <Text style={cm.storyPreviewLabel}>Generated story preview</Text>
                      <Text style={cm.storyPreviewText} numberOfLines={8}>{generatedText}</Text>
                    </View>
                  )}
                </>
              )}

              {/* Voice Audio */}
              {mode === "voice-audio" && (
                <View style={cm.recordBox}>
                  <Text style={cm.recordTitle}>🎙 Record Yourself Reading</Text>
                  <Text style={cm.recordSub}>Tap Record and read the story aloud. Your voice is saved and plays for your kids at bedtime.</Text>

                  {!recordingAudio && !audioUri && (
                    <TouchableOpacity style={[cm.recBtn, { backgroundColor: Colors.error }]} onPress={startAudioRec}>
                      <Text style={cm.recBtnEmoji}>🎙</Text>
                      <Text style={cm.recBtnText}>Start Recording</Text>
                    </TouchableOpacity>
                  )}

                  {recordingAudio && (
                    <View style={cm.recLive}>
                      <View style={cm.recLiveDot} />
                      <Text style={cm.recLiveTimer}>Recording… {fmtTime(recSec)}</Text>
                      <TouchableOpacity style={cm.recStopBtn} onPress={stopAudioRec}>
                        <Text style={cm.recStopText}>⏹ Stop</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {!recordingAudio && audioUri && (
                    <View style={cm.recDoneRow}>
                      <Text style={cm.recDoneText}>✅ Recorded {fmtTime(recSec)}</Text>
                      <View style={cm.recDoneBtns}>
                        <TouchableOpacity
                          style={[cm.recPlayBtn, audioPlayer.playing && cm.recPlayBtnActive]}
                          onPress={() => audioPlayer.playing ? audioPlayer.pause() : audioPlayer.play()}
                        >
                          <Text style={cm.recPlayText}>{audioPlayer.playing ? "⏸ Pause" : "▶ Preview"}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={cm.reRecordBtn}
                          onPress={() => { setAudioUri(null); setRecSec(0); }}
                        >
                          <Text style={cm.reRecordText}>🔄 Re-record</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Voice Video */}
              {mode === "voice-video" && (
                <View style={cm.videoBox}>
                  <Text style={cm.recordTitle}>🎥 Film Yourself Reading</Text>
                  <Text style={cm.recordSub}>Tap Record and read the story on camera. Your kids will see and hear you — just like a bedtime video call.</Text>

                  {!videoUri ? (
                    <>
                      {/* Camera preview */}
                      {cameraPermission?.granted ? (
                        <View style={cm.cameraWrap}>
                          <CameraView
                            ref={cameraRef}
                            style={cm.camera}
                            facing={cameraFacing}
                            mode="video"
                          />
                          {recordingVideo && (
                            <View style={cm.camRecBadge}>
                              <View style={cm.camRecDot} />
                              <Text style={cm.camRecText}>REC</Text>
                            </View>
                          )}
                          <View style={cm.camControls}>
                            <TouchableOpacity style={cm.camFlipBtn} onPress={() => setCameraFacing(f => f === "front" ? "back" : "front")}>
                              <Text style={cm.camFlipText}>🔄</Text>
                            </TouchableOpacity>
                            {!recordingVideo ? (
                              <TouchableOpacity style={cm.camRecordBtn} onPress={startVideoRec}>
                                <View style={cm.camRecordCircle} />
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity style={cm.camStopBtn} onPress={stopVideoRec}>
                                <View style={cm.camStopRect} />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity style={cm.permBtn} onPress={ensureVideoPerms}>
                          <Text style={cm.permBtnText}>📸 Allow Camera Access</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <View style={cm.videoPreviewWrap}>
                      <VideoView player={videoPlayer} style={cm.videoPreview} nativeControls />
                      <TouchableOpacity style={cm.reRecordBtn} onPress={() => setVideoUri(null)}>
                        <Text style={cm.reRecordText}>🔄 Re-record</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* Kid selector (always visible) */}
              <KidSelector kids={kids} selected={targetKids} onToggle={toggleKid} />

              {/* Save button */}
              <TouchableOpacity
                style={[cm.saveBtn, { backgroundColor: modeColor }, !canSave && { opacity: 0.4 }]}
                onPress={save}
                disabled={!canSave}
              >
                <Text style={cm.saveBtnText}>
                  {mode === "voice-audio" || mode === "voice-video" ? "📤 Send to Kids" : "📤 Save & Send to Kids"}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Send Media Modal (unchanged from original) ───────────────────────────────
const KIND_OPTIONS: { kind: StoryMediaKind; emoji: string; label: string; placeholder: string; hint: string }[] = [
  { kind: "youtube", emoji: "▶", label: "YouTube", placeholder: "https://www.youtube.com/watch?v=...", hint: "Paste any YouTube link — rain sounds, lullabies, bedtime stories, nature videos…" },
  { kind: "video",   emoji: "🎬", label: "Video",   placeholder: "https://example.com/video.mp4",       hint: "Direct link to an MP4 video file you want to share." },
  { kind: "audio",   emoji: "🎵", label: "Audio",   placeholder: "https://example.com/audio.mp3",       hint: "Direct link to an MP3 or audio file — plays right inside the app." },
];

function SendMediaModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useData();
  const [kind, setKind] = useState<StoryMediaKind>("youtube");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [selectedKids, setSelectedKids] = useState<string[]>([]);
  const kindMeta = KIND_OPTIONS.find(k => k.kind === kind)!;

  function toggleKid(kidId: string) {
    setSelectedKids(s => s.includes(kidId) ? s.filter(x => x !== kidId) : [...s, kidId]);
  }

  function send() {
    if (!url.trim()) { Alert.alert("URL needed"); return; }
    if (!title.trim()) { Alert.alert("Title needed"); return; }
    const thumbUrl = kind === "youtube" ? (() => { const id = extractYouTubeId(url.trim()); return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : undefined; })() : undefined;
    const media: StoryMedia = { id: uid(), kind, title: title.trim(), description: desc.trim() || undefined, url: url.trim(), thumbnailUrl: thumbUrl, fromParentName: state.parent.name, targetKids: selectedKids, addedAt: nowIso() };
    dispatch({ type: "STORY_MEDIA_ADD", media });
    Alert.alert("Sent! ✅", `"${title.trim()}" is now in your kids' Stories screen.`);
    setUrl(""); setTitle(""); setDesc(""); setKind("youtube"); setSelectedKids([]);
    onClose();
  }

  const ytId = kind === "youtube" && url ? extractYouTubeId(url) : null;
  const previewThumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: Colors.bgLight }}>
        <View style={mm.header}>
          <TouchableOpacity onPress={onClose}><Text style={mm.cancel}>Cancel</Text></TouchableOpacity>
          <Text style={mm.title}>📺 Send Media to Kids</Text>
          <TouchableOpacity onPress={send}><Text style={mm.send}>Send</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={mm.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={mm.label}>Type</Text>
          <View style={mm.kindRow}>
            {KIND_OPTIONS.map(opt => (
              <TouchableOpacity key={opt.kind} style={[mm.kindBtn, kind === opt.kind && mm.kindBtnActive]} onPress={() => setKind(opt.kind)}>
                <Text style={mm.kindEmoji}>{opt.emoji}</Text>
                <Text style={[mm.kindLabel, kind === opt.kind && mm.kindLabelActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={mm.hint}><Text style={mm.hintText}>{kindMeta.hint}</Text></View>
          <Text style={mm.label}>Link / URL</Text>
          <TextInput style={mm.input} value={url} onChangeText={setUrl} placeholder={kindMeta.placeholder} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          {previewThumb && (
            <View style={{ borderRadius: Radius.lg, overflow: "hidden", marginTop: 8 }}>
              <Image source={{ uri: previewThumb }} style={{ width: "100%", height: 160 }} resizeMode="cover" />
            </View>
          )}
          <Text style={mm.label}>Title (shown to kids)</Text>
          <TextInput style={mm.input} value={title} onChangeText={setTitle} placeholder="e.g. Rainy Day Sounds" />
          <Text style={mm.label}>Description (optional)</Text>
          <TextInput style={[mm.input, { height: 72, textAlignVertical: "top" }]} value={desc} onChangeText={setDesc} placeholder="A short note…" multiline />
          <Text style={mm.label}>Send to</Text>
          <View style={mm.kidRow}>
            <TouchableOpacity style={[mm.kidChip, selectedKids.length === 0 && mm.kidChipActive]} onPress={() => setSelectedKids([])}>
              <Text style={[mm.kidText, selectedKids.length === 0 && mm.kidTextActive]}>All kids</Text>
            </TouchableOpacity>
            {state.kids.map(k => (
              <TouchableOpacity key={k.profile.id} style={[mm.kidChip, selectedKids.includes(k.profile.id) && mm.kidChipActive]} onPress={() => toggleKid(k.profile.id)}>
                <Text style={[mm.kidText, selectedKids.includes(k.profile.id) && mm.kidTextActive]}>{k.profile.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={mm.sendBtn} onPress={send}>
            <Text style={mm.sendBtnText}>📤 Send to Kids</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Story Card ───────────────────────────────────────────────────────────────
const TYPE_META: Record<string, { badge: string; color: string }> = {
  "ai-text":        { badge: "✨ AI Story",      color: Colors.primary },
  "voice-audio":    { badge: "🎙 Voice Audio",   color: "#F97316" },
  "voice-video":    { badge: "🎥 Video",          color: "#EF4444" },
  "ai-voice-clone": { badge: "🤖 AI + My Voice", color: "#10B981" },
};

function StoryCard({
  story,
  kids,
  onDelete,
}: {
  story: StoryItem;
  kids: { id: string; name: string }[];
  onDelete: () => void;
}) {
  const meta = TYPE_META[story.recordingType ?? "ai-text"] ?? TYPE_META["ai-text"];
  const forNames = story.targetKids.length === 0
    ? "All kids"
    : story.targetKids.map(id => kids.find(k => k.id === id)?.name ?? id).join(", ");

  return (
    <View style={sc.card}>
      <View style={sc.cardTop}>
        <Text style={sc.cardEmoji}>{story.coverEmoji ?? "📖"}</Text>
        <View style={{ flex: 1 }}>
          <Text style={sc.cardTitle}>{story.title}</Text>
          <View style={sc.badgeRow}>
            <View style={[sc.badge, { backgroundColor: meta.color + "20" }]}>
              <Text style={[sc.badgeText, { color: meta.color }]}>{meta.badge}</Text>
            </View>
            {story.duration != null && (
              <View style={sc.durationBadge}>
                <Text style={sc.durationText}>⏱ {fmtTime(story.duration)}</Text>
              </View>
            )}
          </View>
          <Text style={sc.cardMeta}>For: {forNames} · {story.readBy.length} read</Text>
          <Text style={sc.cardMeta}>{new Date(story.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text>
        </View>
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={sc.deleteBtn}>🗑</Text>
        </TouchableOpacity>
      </View>
      {!!story.text && story.recordingType !== "voice-audio" && story.recordingType !== "voice-video" && (
        <Text style={sc.cardPreview} numberOfLines={2}>{story.text}</Text>
      )}
    </View>
  );
}

const sc = StyleSheet.create({
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 10, ...Shadow.sm },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardEmoji: { fontSize: 32, marginTop: 2 },
  cardTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary, marginBottom: 4 },
  badgeRow: { flexDirection: "row", gap: 6, marginBottom: 4, flexWrap: "wrap" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  badgeText: { fontSize: 10, fontWeight: "800" },
  durationBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, backgroundColor: Colors.cardLight },
  durationText: { fontSize: 10, fontWeight: "600", color: Colors.textSecondary },
  cardMeta: { fontSize: FontSize.xs, color: Colors.textMuted },
  deleteBtn: { fontSize: 18, color: Colors.textMuted },
  cardPreview: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 6, lineHeight: 18 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ParentStoriesScreen() {
  const { state, dispatch } = useData();
  const [tab, setTab] = useState<"stories" | "media">("stories");
  const [showCreate, setShowCreate] = useState(false);
  const [showSendMedia, setShowSendMedia] = useState(false);

  const kids = state.kids.map(k => ({ id: k.profile.id, name: k.profile.name }));
  const allMedia = state.storyMedia ?? [];

  function handleSaveStory(story: StoryItem) {
    dispatch({ type: "STORY_ADD", story });
    setShowCreate(false);
    Alert.alert("Story saved! ✅", `"${story.title}" has been sent to ${story.targetKids.length === 0 ? "all kids" : "selected kids"}.`);
  }

  function handleDeleteStory(storyId: string, title: string) {
    Alert.alert("Delete story?", `Remove "${title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => dispatch({ type: "STORY_DELETE", storyId }) },
    ]);
  }

  function removeMedia(mediaId: string) {
    Alert.alert("Remove?", "Remove this from your kids' library?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => dispatch({ type: "STORY_MEDIA_REMOVE", mediaId }) },
    ]);
  }

  return (
    <ScreenContainer scroll>
      <Text style={s.title}>🌙 Stories Studio</Text>
      <Text style={s.sub}>Create stories for your kids — AI-written, your voice, or on camera.</Text>

      {/* Tab bar */}
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, tab === "stories" && s.tabActive]} onPress={() => setTab("stories")}>
          <Text style={[s.tabText, tab === "stories" && s.tabTextActive]}>
            📖 Stories {state.stories.length > 0 ? `(${state.stories.length})` : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === "media" && s.tabActive]} onPress={() => setTab("media")}>
          <Text style={[s.tabText, tab === "media" && s.tabTextActive]}>
            📺 Videos & Audio {allMedia.length > 0 ? `(${allMedia.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Stories tab ── */}
      {tab === "stories" && (
        <>
          {/* Mode hint cards */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }} style={{ marginBottom: Spacing.md }}>
            {MODES.map(m => (
              <TouchableOpacity
                key={m.mode}
                style={[s.hintCard, { borderColor: m.color + "50" }]}
                onPress={() => setShowCreate(true)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 28 }}>{m.emoji}</Text>
                <Text style={[s.hintCardTitle, { color: m.color }]}>{m.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={s.createBtn} onPress={() => setShowCreate(true)}>
            <Text style={s.createBtnText}>＋ Create New Story</Text>
          </TouchableOpacity>

          {state.stories.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 56 }}>🌙</Text>
              <Text style={s.emptyTitle}>No stories yet</Text>
              <Text style={s.emptySub}>Tap Create to record your voice, film a video, or let AI write a bedtime story for your kids.</Text>
            </View>
          ) : (
            state.stories.map(story => (
              <StoryCard
                key={story.id}
                story={story}
                kids={kids}
                onDelete={() => handleDeleteStory(story.id, story.title)}
              />
            ))
          )}
        </>
      )}

      {/* ── Media tab ── */}
      {tab === "media" && (
        <>
          <TouchableOpacity style={s.sendMediaBtn} onPress={() => setShowSendMedia(true)}>
            <Text style={s.sendMediaBtnText}>📤 Send YouTube / Video / Audio to Kids</Text>
          </TouchableOpacity>
          <View style={s.infoBox}>
            <Text style={s.infoText}>
              Share YouTube links (lullabies, rain sounds, nature videos) or direct MP4/MP3 files directly to your kids' Stories page.
            </Text>
          </View>
          {allMedia.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 48 }}>📺</Text>
              <Text style={s.emptyTitle}>Nothing shared yet</Text>
              <Text style={s.emptySub}>Tap the button above to share your first video or audio with the kids.</Text>
            </View>
          ) : (
            allMedia.map(item => {
              const thumb = item.thumbnailUrl ?? (item.kind === "youtube" ? (() => { const id = extractYouTubeId(item.url); return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : undefined; })() : undefined);
              const kindColor = { youtube: "#EF4444", video: "#8B5CF6", audio: "#10B981" }[item.kind];
              const kindIcon  = { youtube: "▶ YouTube", video: "🎬 Video", audio: "🎵 Audio" }[item.kind];
              const forKids = item.targetKids.length === 0
                ? "All kids"
                : item.targetKids.map(id => kids.find(k => k.id === id)?.name ?? id).join(", ");
              return (
                <View key={item.id} style={s.mediaCard}>
                  {thumb && <Image source={{ uri: thumb }} style={s.mediaThumb} resizeMode="cover" />}
                  <View style={s.mediaBody}>
                    <View style={[s.kindBadge, { backgroundColor: kindColor + "20" }]}>
                      <Text style={[s.kindBadgeText, { color: kindColor }]}>{kindIcon}</Text>
                    </View>
                    <Text style={s.mediaTitle}>{item.title}</Text>
                    {item.description ? <Text style={s.mediaDesc}>{item.description}</Text> : null}
                    <Text style={s.mediaMeta}>For: {forKids}</Text>
                    <TouchableOpacity onPress={() => removeMedia(item.id)} style={{ alignSelf: "flex-start", marginTop: 4 }}>
                      <Text style={{ fontSize: FontSize.xs, color: Colors.error, fontWeight: "700" }}>✕ Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </>
      )}

      <View style={{ height: 32 }} />

      {showCreate && <CreateStoryModal onClose={() => setShowCreate(false)} onSave={handleSaveStory} />}
      {showSendMedia && <SendMediaModal onClose={() => setShowSendMedia(false)} />}
    </ScreenContainer>
  );
}

// ─── Main styles ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  title:  { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 2 },
  sub:    { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  tabs: { flexDirection: "row", backgroundColor: Colors.cardLight, borderRadius: Radius.full, padding: 4, marginBottom: Spacing.md, gap: 4 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: Radius.full },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary },
  tabTextActive: { color: "#fff" },

  hintCard: { width: 90, alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: 12, gap: 4, borderWidth: 1.5, ...Shadow.sm },
  hintCardTitle: { fontSize: 10, fontWeight: "800", textAlign: "center" },

  createBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, marginBottom: Spacing.md, ...Shadow.md },
  createBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },

  empty: { alignItems: "center", paddingTop: 48, gap: 12 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", maxWidth: 300, lineHeight: 20 },

  sendMediaBtn: { backgroundColor: "#6C3CE1", borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, marginBottom: Spacing.sm, ...Shadow.md },
  sendMediaBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  infoBox: { backgroundColor: Colors.primary + "12", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderLeftWidth: 4, borderLeftColor: Colors.primary },
  infoText: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  mediaCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, marginBottom: 10, overflow: "hidden", ...Shadow.sm },
  mediaThumb: { width: "100%", height: 160 },
  mediaBody: { padding: Spacing.md, gap: 4 },
  kindBadge: { alignSelf: "flex-start", borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 2 },
  kindBadgeText: { fontSize: FontSize.xs, fontWeight: "800" },
  mediaTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  mediaDesc: { fontSize: FontSize.sm, color: Colors.textSecondary },
  mediaMeta: { fontSize: FontSize.xs, color: Colors.textMuted },
});

// ─── Create modal styles ──────────────────────────────────────────────────────
const cm = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surfaceLight },
  headerTitle: { fontSize: FontSize.md, fontWeight: "800", color: Colors.primary },
  headerCancel: { color: Colors.textSecondary, fontWeight: "700", fontSize: FontSize.base, minWidth: 50 },
  headerSave: { color: Colors.primary, fontWeight: "800", fontSize: FontSize.base, minWidth: 50, textAlign: "right" },
  scroll: { padding: Spacing.lg },

  // Pick step
  pickTitle: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary, marginBottom: Spacing.md, textAlign: "center" },
  modeGrid: { gap: 12 },
  modeCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1.5, gap: 6, ...Shadow.sm },
  modeEmoji: { fontSize: 36 },
  modeTitle: { fontSize: FontSize.md, fontWeight: "800" },
  modeSub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  modeArrow: { alignSelf: "flex-start", borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 6, marginTop: 4 },
  modeArrowText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },

  // Create step
  backRow: { marginBottom: Spacing.md },
  backText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.sm },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: Spacing.sm },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: 12, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surfaceLight, marginBottom: 4 },
  emojiChip: { width: 44, height: 44, borderRadius: Radius.md, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  emojiChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "15" },

  // AI story
  genBtn: { borderRadius: Radius.full, alignItems: "center", paddingVertical: 13, marginVertical: Spacing.sm, ...Shadow.sm },
  genBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  storyPreviewBox: { backgroundColor: Colors.cardLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.sm },
  storyPreviewLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, marginBottom: 6 },
  storyPreviewText: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 20 },
  voiceCloneNote: { backgroundColor: "#10B98112", borderRadius: Radius.lg, padding: 10, marginBottom: Spacing.sm, borderLeftWidth: 3, borderLeftColor: "#10B981" },
  voiceCloneNoteText: { fontSize: FontSize.xs, color: "#047857", lineHeight: 18 },

  // Voice audio recording
  recordBox: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm, gap: 8 },
  videoBox: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm, gap: 8 },
  recordTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary },
  recordSub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  recBtn: { borderRadius: Radius.full, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  recBtnEmoji: { fontSize: 22 },
  recBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  recLive: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.error + "15", borderRadius: Radius.lg, padding: 12 },
  recLiveDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.error },
  recLiveTimer: { flex: 1, fontWeight: "700", color: Colors.error, fontSize: FontSize.base },
  recStopBtn: { backgroundColor: Colors.error, borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8 },
  recStopText: { color: "#fff", fontWeight: "700" },
  recDoneRow: { gap: 8 },
  recDoneText: { fontSize: FontSize.base, fontWeight: "700", color: Colors.success, textAlign: "center" },
  recDoneBtns: { flexDirection: "row", gap: 10 },
  recPlayBtn: { flex: 1, backgroundColor: Colors.success, borderRadius: Radius.full, alignItems: "center", paddingVertical: 10 },
  recPlayBtnActive: { backgroundColor: Colors.warning },
  recPlayText: { color: "#fff", fontWeight: "700" },
  reRecordBtn: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.full, alignItems: "center", paddingVertical: 10 },
  reRecordText: { color: Colors.textSecondary, fontWeight: "700" },

  // Camera
  cameraWrap: { borderRadius: Radius.xl, overflow: "hidden", marginBottom: 8, position: "relative" },
  camera: { width: "100%", height: SW * 0.75, borderRadius: Radius.xl },
  camRecBadge: { position: "absolute", top: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  camRecDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" },
  camRecText: { color: "#EF4444", fontWeight: "800", fontSize: FontSize.xs },
  camControls: { position: "absolute", bottom: 16, left: 0, right: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 28 },
  camFlipBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  camFlipText: { fontSize: 22 },
  camRecordBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" },
  camRecordCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#EF4444" },
  camStopBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" },
  camStopRect: { width: 26, height: 26, borderRadius: 4, backgroundColor: "#EF4444" },
  videoPreviewWrap: { gap: 10 },
  videoPreview: { width: "100%", height: SW * 0.56, borderRadius: Radius.xl },
  permBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 14 },
  permBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },

  // Save
  saveBtn: { borderRadius: Radius.full, alignItems: "center", paddingVertical: 14, marginTop: Spacing.sm, ...Shadow.md },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },
});

// ─── Send-media modal styles ──────────────────────────────────────────────────
const mm = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md, backgroundColor: Colors.surfaceLight, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: FontSize.md, fontWeight: "800", color: Colors.primary },
  cancel: { color: Colors.textSecondary, fontWeight: "700", fontSize: FontSize.base },
  send: { color: Colors.primary, fontWeight: "800", fontSize: FontSize.base },
  scroll: { padding: Spacing.lg },
  label: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  kindRow: { flexDirection: "row", gap: 8 },
  kindBtn: { flex: 1, alignItems: "center", padding: 12, borderRadius: Radius.lg, backgroundColor: Colors.cardLight, gap: 4 },
  kindBtnActive: { backgroundColor: Colors.primary },
  kindEmoji: { fontSize: 22 },
  kindLabel: { fontSize: 10, fontWeight: "700", color: Colors.textSecondary },
  kindLabelActive: { color: "#fff" },
  hint: { backgroundColor: Colors.primary + "10", borderRadius: Radius.lg, padding: 10, marginTop: 8 },
  hintText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: "600", lineHeight: 18 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: 12, fontSize: FontSize.base, backgroundColor: Colors.surfaceLight, marginTop: 4 },
  kidRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  kidChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight },
  kidChipActive: { backgroundColor: Colors.primary },
  kidText: { fontWeight: "600", color: Colors.textSecondary, fontSize: FontSize.sm },
  kidTextActive: { color: "#fff" },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 16, marginTop: Spacing.lg, ...Shadow.md },
  sendBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },
});
