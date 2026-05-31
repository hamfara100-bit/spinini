import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, Alert, FlatList,
} from "react-native";
import { VoiceTextInput, MicButton } from "../../../components/voice-text-input";
import { useLocalSearchParams } from "expo-router";
import { AudioRecorder, useAudioRecorder, RecordingPresets } from "expo-audio";
import { useAudioPlayer, createAudioPlayer } from "expo-audio";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso } from "../../../lib/utils";
import { PointsInput } from "../../../components/points-input";
import type { ApologyNote, ApologyReason } from "../../../lib/data/types";
import { APOLOGY_REASON_LABELS } from "../../../lib/data/types";

const REASON_LIST = Object.entries(APOLOGY_REASON_LABELS) as [ApologyReason, string][];

// ─── Voice recorder row ───────────────────────────────────────────────────────
function VoiceRecorderRow({
  uri, durationSecs, onRecord, onClear,
}: { uri?: string; durationSecs?: number; onRecord: (uri: string, secs: number) => void; onClear: () => void }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const [playing, setPlaying] = useState(false);

  async function start() {
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } catch (e) { Alert.alert("Mic error", "Could not access microphone."); }
  }

  async function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    await recorder.stop();
    const uri2 = recorder.uri;
    if (uri2) onRecord(uri2, elapsed);
  }

  function togglePlay() {
    if (!uri) return;
    if (playing) {
      playerRef.current?.pause();
      setPlaying(false);
    } else {
      const p = createAudioPlayer(uri);
      p.play();
      playerRef.current = p;
      setPlaying(true);
    }
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (uri) {
    return (
      <View style={vr.row}>
        <TouchableOpacity style={[vr.btn, { backgroundColor: playing ? Colors.error + "20" : Colors.success + "20" }]} onPress={togglePlay}>
          <Text style={vr.btnIcon}>{playing ? "⏸" : "▶"}</Text>
        </TouchableOpacity>
        <Text style={vr.label}>🎙️ Voice note recorded ({fmt(durationSecs ?? 0)})</Text>
        <TouchableOpacity onPress={onClear} style={vr.clear}>
          <Text style={{ color: Colors.error, fontWeight: "700", fontSize: 13 }}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[vr.recordBtn, recording && { backgroundColor: Colors.error + "18", borderColor: Colors.error }]}
      onPress={recording ? stop : start}
      activeOpacity={0.8}
    >
      <Text style={vr.recordIcon}>{recording ? "⏹" : "🎙️"}</Text>
      <Text style={[vr.recordLabel, recording && { color: Colors.error }]}>
        {recording ? `Recording… ${fmt(elapsed)} (tap to stop)` : "Add Voice Note (optional)"}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Single apology card ──────────────────────────────────────────────────────
function ApologyCard({ note, onDelete }: { note: ApologyNote; onDelete: () => void }) {
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const [playing, setPlaying] = useState(false);
  const isFromParent = note.from === "parent";
  const reasonLabel = APOLOGY_REASON_LABELS[note.reason as ApologyReason] ?? note.reason;

  function togglePlay() {
    if (!note.voiceNoteUri) return;
    if (playing) {
      playerRef.current?.pause();
      setPlaying(false);
    } else {
      const p = createAudioPlayer(note.voiceNoteUri);
      p.play();
      playerRef.current = p;
      setPlaying(true);
    }
  }

  return (
    <View style={[ac.card, isFromParent ? ac.parentCard : ac.kidCard]}>
      <View style={ac.header}>
        <Text style={ac.from}>{isFromParent ? "💌 You apologised to kid" : "📝 Kid's explanation"}</Text>
        <Text style={ac.date}>{new Date(note.createdAt).toLocaleDateString()}</Text>
      </View>
      <View style={ac.reasonRow}>
        <Text style={ac.reason}>{reasonLabel}</Text>
      </View>
      <Text style={ac.msg}>{note.message}</Text>
      {note.pointsGiven ? (
        <View style={ac.points}>
          <Text style={ac.pointsText}>🎁 Gave {note.pointsGiven} bonus points</Text>
        </View>
      ) : null}
      {note.voiceNoteUri ? (
        <TouchableOpacity style={ac.playRow} onPress={togglePlay}>
          <Text style={{ fontSize: 18 }}>{playing ? "⏸" : "▶"}</Text>
          <Text style={ac.playLabel}>Voice message ({note.voiceNoteDurationSecs ?? 0}s)</Text>
        </TouchableOpacity>
      ) : null}
      {!note.readAt && isFromParent && (
        <View style={ac.unread}><Text style={ac.unreadText}>● Unread by kid</Text></View>
      )}
      <TouchableOpacity style={ac.del} onPress={() => Alert.alert("Delete?", "Remove this apology?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
      ])}>
        <Text style={{ color: Colors.error, fontSize: 11, fontWeight: "700" }}>🗑 Delete</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ParentApologyScreen() {
  const { id: kidId } = useLocalSearchParams<{ id?: string }>();
  const { state, dispatch } = useData();

  const kids = state.kids;
  const [selectedKidId, setSelectedKidId] = useState(kidId ?? kids[0]?.profile.id ?? "");
  const kid = kids.find(k => k.profile.id === selectedKidId);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedReason, setSelectedReason] = useState<ApologyReason>("yelled");
  const [message, setMessage] = useState("");
  const [points, setPoints] = useState("");
  const [voiceUri, setVoiceUri] = useState<string | undefined>();
  const [voiceSecs, setVoiceSecs] = useState(0);
  const [tab, setTab] = useState<"my" | "kid">("my");

  const apologies = kid?.apologies ?? [];
  const parentApologies = apologies.filter(a => a.from === "parent");
  const kidApologies = apologies.filter(a => a.from === "kid");

  function send() {
    if (!selectedKidId) return;
    if (!message.trim()) { Alert.alert("Add a message", "Write a few words."); return; }
    const pts = parseInt(points) || 0;
    const note: ApologyNote = {
      id: uid(),
      from: "parent",
      kidId: selectedKidId,
      reason: selectedReason,
      message: message.trim(),
      pointsGiven: pts > 0 ? pts : undefined,
      voiceNoteUri: voiceUri,
      voiceNoteDurationSecs: voiceSecs > 0 ? voiceSecs : undefined,
      createdAt: nowIso(),
    };
    dispatch({ type: "APOLOGY_SEND", kidId: selectedKidId, note });
    // Bonus points
    if (pts > 0) {
      dispatch({ type: "BEHAVIOR_ADD_EVENT", kidId: selectedKidId, event: {
        id: uid(), points: pts, reason: "💌 Apology bonus points from parent", date: new Date().toISOString().slice(0, 10),
      }});
    }
    // Notify kid
    dispatch({ type: "NOTIFICATION_ADD", kidId: selectedKidId, notification: {
      id: uid(), kidId: selectedKidId, kind: "advice",
      title: "💌 A message from your parent",
      body: "Your parent has sent you an apology. Go check it out!",
      read: false, createdAt: nowIso(), route: "/apology",
    }});
    setShowCreate(false);
    setMessage(""); setPoints(""); setVoiceUri(undefined); setVoiceSecs(0);
    Alert.alert("✅ Sent!", "Your apology has been delivered to your kid.");
  }

  const shown = tab === "my" ? parentApologies : kidApologies;

  return (
    <ScreenContainer scroll>
      {/* Kid selector */}
      {kids.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
          {kids.map(k => (
            <TouchableOpacity
              key={k.profile.id}
              style={[s.kidChip, selectedKidId === k.profile.id && s.kidChipActive]}
              onPress={() => setSelectedKidId(k.profile.id)}
            >
              <Text style={[s.kidChipText, selectedKidId === k.profile.id && { color: "#fff" }]}>{k.profile.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>💌 Explain Yourself</Text>
          <Text style={s.sub}>Apologies & honest conversations</Text>
        </View>
        <TouchableOpacity style={s.newBtn} onPress={() => setShowCreate(true)}>
          <Text style={s.newBtnText}>+ New Apology</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(["my", "kid"] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === "my" ? `💌 My Apologies (${parentApologies.length})` : `📝 Kid's Explanations (${kidApologies.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {shown.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 52, marginBottom: 12 }}>{tab === "my" ? "💌" : "📝"}</Text>
          <Text style={s.emptyTitle}>{tab === "my" ? "No apologies sent yet" : "No explanations from kid"}</Text>
          <Text style={s.emptySub}>
            {tab === "my"
              ? "Send a heartfelt note to your kid — they'll see it right away."
              : "When your kid writes an explanation, it will appear here."}
          </Text>
        </View>
      ) : (
        shown.map(note => (
          <ApologyCard
            key={note.id}
            note={note}
            onDelete={() => dispatch({ type: "APOLOGY_DELETE", kidId: selectedKidId, apologyId: note.id })}
          />
        ))
      )}

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <View style={{ flex: 1, backgroundColor: Colors.bgLight }}>
          <View style={m.handle} />
          <ScrollView contentContainerStyle={m.body} keyboardShouldPersistTaps="handled">
            <Text style={m.title}>💌 Write an Apology</Text>
            <Text style={m.sub}>A sincere note can mean the world to your child.</Text>

            {/* Reason picker */}
            <Text style={m.label}>What are you apologising for?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {REASON_LIST.map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[m.reasonChip, selectedReason === key && m.reasonChipActive]}
                  onPress={() => setSelectedReason(key)}
                >
                  <Text style={[m.reasonText, selectedReason === key && { color: "#fff" }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Message */}
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <Text style={[m.label, { flex: 1 }]}>Your message</Text>
              <MicButton appendTo={message} onAppend={setMessage} onResult={setMessage} size={32} />
            </View>
            <TextInput
              style={m.input}
              multiline
              numberOfLines={5}
              placeholder="Write from the heart… explain what happened, how you felt, and what you'll do differently."
              placeholderTextColor={Colors.textMuted}
              value={message}
              onChangeText={setMessage}
            />

            {/* Points */}
            <Text style={m.label}>Bonus points (optional)</Text>
            <PointsInput
              inputStyle={[m.input, { height: 48 }]}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              value={points}
              onChangeText={setPoints}
            />
            <Text style={m.hint}>Give bonus points as a small apology gift 🎁</Text>

            {/* Voice note */}
            <Text style={m.label}>Voice Note (optional)</Text>
            <VoiceRecorderRow
              uri={voiceUri}
              durationSecs={voiceSecs}
              onRecord={(u, s) => { setVoiceUri(u); setVoiceSecs(s); }}
              onClear={() => { setVoiceUri(undefined); setVoiceSecs(0); }}
            />

            {/* Buttons */}
            <View style={m.btnRow}>
              <TouchableOpacity style={m.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={m.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={m.sendBtn} onPress={send}>
                <Text style={m.sendText}>💌 Send Apology</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "800", color: Colors.textPrimary },
  sub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  newBtn: { backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9 },
  newBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  kidChip: { backgroundColor: Colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  kidChipActive: { backgroundColor: Colors.primary },
  kidChipText: { fontWeight: "700", color: Colors.textPrimary, fontSize: 13 },
  tabs: { flexDirection: "row", backgroundColor: Colors.border + "60", borderRadius: 14, padding: 4, marginBottom: 16, gap: 4 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  tabActive: { backgroundColor: Colors.surfaceLight, ...Shadow.sm },
  tabText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary, fontWeight: "800" },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: Colors.textPrimary },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 24 },
});

const ac = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1.5, ...Shadow.sm },
  parentCard: { backgroundColor: "#FFF7ED", borderColor: "#FCD34D60" },
  kidCard: { backgroundColor: "#F0FDF4", borderColor: "#34D39960" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  from: { fontSize: 12, fontWeight: "800", color: Colors.textSecondary },
  date: { fontSize: 11, color: Colors.textMuted },
  reasonRow: { marginBottom: 8 },
  reason: { fontSize: 14, fontWeight: "700", color: Colors.primary },
  msg: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20, marginBottom: 8 },
  points: { backgroundColor: Colors.secondary + "25", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start", marginBottom: 8 },
  pointsText: { fontSize: 12, fontWeight: "700", color: "#B45309" },
  playRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.primary + "12", borderRadius: 10, padding: 8, marginBottom: 8 },
  playLabel: { fontSize: 12, color: Colors.primary, fontWeight: "600" },
  unread: { backgroundColor: Colors.warning + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginBottom: 6 },
  unreadText: { fontSize: 11, color: Colors.warning, fontWeight: "700" },
  del: { alignSelf: "flex-end", marginTop: 4 },
});

const m = StyleSheet.create({
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  body: { padding: Spacing.lg, paddingBottom: 60, gap: 6 },
  title: { fontSize: 22, fontWeight: "800", color: Colors.textPrimary, marginBottom: 4 },
  sub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary, marginTop: 10, marginBottom: 6 },
  hint: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  input: {
    backgroundColor: Colors.surfaceLight, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    padding: 14, fontSize: 14, color: Colors.textPrimary,
    textAlignVertical: "top", minHeight: 120,
  },
  reasonChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.border + "80", borderWidth: 1, borderColor: Colors.border },
  reasonChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  reasonText: { fontSize: 13, fontWeight: "700", color: Colors.textPrimary },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 24 },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: 50, alignItems: "center", paddingVertical: 14 },
  cancelText: { fontWeight: "700", color: Colors.textSecondary, fontSize: 14 },
  sendBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: 50, alignItems: "center", paddingVertical: 14 },
  sendText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});

const vr = StyleSheet.create({
  recordBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.primary + "10", borderRadius: 14,
    padding: 14, borderWidth: 1.5, borderColor: Colors.primary + "30",
  },
  recordIcon: { fontSize: 22 },
  recordLabel: { fontSize: 13, fontWeight: "700", color: Colors.primary },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.success + "12", borderRadius: 14,
    padding: 12, borderWidth: 1.5, borderColor: Colors.success + "40",
  },
  btn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  btnIcon: { fontSize: 20 },
  label: { flex: 1, fontSize: 13, fontWeight: "700", color: Colors.success },
  clear: { padding: 6 },
});
