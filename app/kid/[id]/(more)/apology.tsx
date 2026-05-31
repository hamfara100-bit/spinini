import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { AudioRecorder, useAudioRecorder, RecordingPresets } from "expo-audio";
import { createAudioPlayer } from "expo-audio";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import type { ApologyNote, ApologyReason } from "../../../../lib/data/types";
import { APOLOGY_REASON_LABELS } from "../../../../lib/data/types";

const KID_REASONS: [ApologyReason, string][] = [
  ["yelled",         "😤 I yelled"],
  ["unfair_rule",    "😤 I thought it was unfair"],
  ["was_wrong",      "❌ I was wrong"],
  ["missed_event",   "😔 I acted out"],
  ["other",          "💬 Something else"],
];

// ─── Voice recorder ───────────────────────────────────────────────────────────
function VoiceRecorderRow({ uri, durationSecs, onRecord, onClear }: {
  uri?: string; durationSecs?: number;
  onRecord: (uri: string, secs: number) => void; onClear: () => void;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const [playing, setPlaying] = useState(false);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  async function start() {
    try { await recorder.prepareToRecordAsync(); recorder.record(); setRecording(true); setElapsed(0); timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000); }
    catch { Alert.alert("Mic error", "Could not access microphone."); }
  }
  async function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false); await recorder.stop();
    const u = recorder.uri; if (u) onRecord(u, elapsed);
  }
  function togglePlay() {
    if (!uri) return;
    if (playing) { playerRef.current?.pause(); setPlaying(false); }
    else { const p = createAudioPlayer(uri); p.play(); playerRef.current = p; setPlaying(true); }
  }

  if (uri) return (
    <View style={vr.row}>
      <TouchableOpacity style={vr.playBtn} onPress={togglePlay}><Text style={{ fontSize: 18 }}>{playing ? "⏸" : "▶"}</Text></TouchableOpacity>
      <Text style={vr.label}>🎙️ Voice recorded ({fmt(durationSecs ?? 0)})</Text>
      <TouchableOpacity onPress={onClear}><Text style={{ color: Colors.error, fontWeight: "700" }}>✕</Text></TouchableOpacity>
    </View>
  );

  return (
    <TouchableOpacity
      style={[vr.btn, recording && { borderColor: Colors.error, backgroundColor: Colors.error + "10" }]}
      onPress={recording ? stop : start} activeOpacity={0.8}
    >
      <Text style={{ fontSize: 22 }}>{recording ? "⏹" : "🎙️"}</Text>
      <Text style={[vr.btnLabel, recording && { color: Colors.error }]}>
        {recording ? `Recording… ${fmt(elapsed)}` : "Add Voice Note"}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Apology card for kid view ────────────────────────────────────────────────
function ApologyCard({ note, kidId, dispatch }: { note: ApologyNote; kidId: string; dispatch: any }) {
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const [playing, setPlaying] = useState(false);
  const isFromParent = note.from === "parent";
  const reasonLabel = APOLOGY_REASON_LABELS[note.reason as ApologyReason] ?? note.reason;

  function togglePlay() {
    if (!note.voiceNoteUri) return;
    if (playing) { playerRef.current?.pause(); setPlaying(false); }
    else { const p = createAudioPlayer(note.voiceNoteUri); p.play(); playerRef.current = p; setPlaying(true); }
  }

  function markRead() {
    if (!note.readAt) dispatch({ type: "APOLOGY_READ", kidId, apologyId: note.id });
  }

  return (
    <TouchableOpacity
      style={[ac.card, isFromParent ? ac.parentCard : ac.myCard, !note.readAt && isFromParent && ac.unreadCard]}
      onPress={markRead} activeOpacity={0.9}
    >
      {!note.readAt && isFromParent && (
        <View style={ac.newBadge}><Text style={ac.newBadgeText}>NEW 💌</Text></View>
      )}
      <View style={ac.header}>
        <Text style={ac.from}>{isFromParent ? "💌 From your parent" : "📝 My explanation"}</Text>
        <Text style={ac.date}>{new Date(note.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</Text>
      </View>
      <Text style={ac.reason}>{reasonLabel}</Text>
      <Text style={ac.msg}>{note.message}</Text>
      {isFromParent && note.pointsGiven ? (
        <View style={ac.points}><Text style={ac.pointsText}>🎁 +{note.pointsGiven} bonus points given!</Text></View>
      ) : null}
      {note.voiceNoteUri ? (
        <TouchableOpacity style={ac.playRow} onPress={togglePlay}>
          <Text style={{ fontSize: 18 }}>{playing ? "⏸" : "▶"}</Text>
          <Text style={ac.playLabel}>🎙️ Voice message</Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function KidApologyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const kid = useKid(id);
  const { dispatch } = useData();

  const [tab, setTab] = useState<"parent" | "mine">("parent");
  const [showWrite, setShowWrite] = useState(false);
  const [reason, setReason] = useState<ApologyReason>("yelled");
  const [message, setMessage] = useState("");
  const [voiceUri, setVoiceUri] = useState<string | undefined>();
  const [voiceSecs, setVoiceSecs] = useState(0);

  if (!kid) return null;

  const apologies = kid.apologies ?? [];
  const parentApologies = apologies.filter(a => a.from === "parent");
  const myApologies = apologies.filter(a => a.from === "kid");
  const unreadCount = parentApologies.filter(a => !a.readAt).length;

  function submit() {
    if (!message.trim()) { Alert.alert("Write something", "Your message can't be empty."); return; }
    const note: ApologyNote = {
      id: uid(), from: "kid", kidId: id,
      reason, message: message.trim(),
      voiceNoteUri: voiceUri, voiceNoteDurationSecs: voiceSecs > 0 ? voiceSecs : undefined,
      createdAt: nowIso(),
    };
    dispatch({ type: "APOLOGY_SEND", kidId: id, note });
    setShowWrite(false); setMessage(""); setVoiceUri(undefined); setVoiceSecs(0);
    Alert.alert("📤 Sent!", "Your parent will see your message.");
  }

  const shown = tab === "parent" ? parentApologies : myApologies;

  return (
    <ScreenContainer scroll bg="#FFF8F0">
      <View style={s.header}>
        <Text style={s.title}>💌 Heart to Heart</Text>
        <Text style={s.sub}>Apologies &amp; honest conversations</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(["parent", "mine"] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === "parent"
                ? `💌 From Parent${unreadCount > 0 ? ` (${unreadCount} new)` : ""}`
                : `📝 My Words (${myApologies.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Write button (kid side) */}
      {tab === "mine" && (
        <TouchableOpacity style={s.writeBtn} onPress={() => setShowWrite(true)}>
          <Text style={s.writeBtnText}>✏️ Write an Explanation</Text>
        </TouchableOpacity>
      )}

      {/* List */}
      {shown.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 52 }}>{tab === "parent" ? "💌" : "✏️"}</Text>
          <Text style={s.emptyTitle}>
            {tab === "parent" ? "No messages from parent yet" : "You haven't written anything yet"}
          </Text>
          <Text style={s.emptySub}>
            {tab === "parent"
              ? "When your parent sends an apology, it will show up here."
              : "When something happens, you can explain yourself here."}
          </Text>
        </View>
      ) : (
        shown.map(note => (
          <ApologyCard key={note.id} note={note} kidId={id} dispatch={dispatch} />
        ))
      )}

      {/* Write modal */}
      <Modal visible={showWrite} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowWrite(false)}>
        <View style={{ flex: 1, backgroundColor: "#FFF8F0" }}>
          <View style={m.handle} />
          <ScrollView contentContainerStyle={m.body} keyboardShouldPersistTaps="handled">
            <Text style={m.title}>✏️ Explain Yourself</Text>
            <Text style={m.sub}>Tell your parent what happened in your own words.</Text>

            <Text style={m.label}>What happened?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {KID_REASONS.map(([key, label]) => (
                <TouchableOpacity key={key} style={[m.chip, reason === key && m.chipActive]} onPress={() => setReason(key)}>
                  <Text style={[m.chipText, reason === key && { color: "#fff" }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={m.label}>Tell your story</Text>
            <TextInput
              style={m.input} multiline numberOfLines={6}
              placeholder="What happened? How were you feeling? What will you do next time?"
              placeholderTextColor={Colors.textMuted}
              value={message} onChangeText={setMessage}
            />

            <Text style={m.label}>Voice Note (optional)</Text>
            <VoiceRecorderRow
              uri={voiceUri} durationSecs={voiceSecs}
              onRecord={(u, s) => { setVoiceUri(u); setVoiceSecs(s); }}
              onClear={() => { setVoiceUri(undefined); setVoiceSecs(0); }}
            />

            <View style={m.btnRow}>
              <TouchableOpacity style={m.cancelBtn} onPress={() => setShowWrite(false)}>
                <Text style={m.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={m.sendBtn} onPress={submit}>
                <Text style={m.sendText}>📤 Send to Parent</Text>
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
  header: { alignItems: "center", marginBottom: 16, gap: 4 },
  title: { fontSize: 24, fontWeight: "800", color: Colors.primary },
  sub: { fontSize: 13, color: Colors.textSecondary },
  tabs: { flexDirection: "row", backgroundColor: Colors.border + "60", borderRadius: 14, padding: 4, marginBottom: 14, gap: 4 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  tabActive: { backgroundColor: Colors.surfaceLight, ...Shadow.sm },
  tabText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary, fontWeight: "800" },
  writeBtn: { backgroundColor: Colors.primary, borderRadius: 20, paddingVertical: 13, alignItems: "center", marginBottom: 14 },
  writeBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: Colors.textPrimary },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: "center", paddingHorizontal: 24 },
});

const ac = StyleSheet.create({
  card: { borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1.5, ...Shadow.sm },
  parentCard: { backgroundColor: "#FFF7ED", borderColor: "#FCD34D60" },
  myCard: { backgroundColor: "#F0FDF4", borderColor: "#34D39960" },
  unreadCard: { borderColor: Colors.primary, borderWidth: 2 },
  newBadge: { backgroundColor: Colors.primary, borderRadius: 20, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, marginBottom: 8 },
  newBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  from: { fontSize: 12, fontWeight: "800", color: Colors.textSecondary },
  date: { fontSize: 11, color: Colors.textMuted },
  reason: { fontSize: 14, fontWeight: "700", color: Colors.primary, marginBottom: 8 },
  msg: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20, marginBottom: 8 },
  points: { backgroundColor: Colors.secondary + "30", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start", marginBottom: 8 },
  pointsText: { fontSize: 12, fontWeight: "700", color: "#B45309" },
  playRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.primary + "12", borderRadius: 10, padding: 8 },
  playLabel: { fontSize: 12, color: Colors.primary, fontWeight: "600" },
});

const m = StyleSheet.create({
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginTop: 10, marginBottom: 4 },
  body: { padding: Spacing.lg, paddingBottom: 60, gap: 8 },
  title: { fontSize: 22, fontWeight: "800", color: Colors.primary },
  sub: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary, marginTop: 8 },
  input: { backgroundColor: Colors.surfaceLight, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, padding: 14, fontSize: 14, color: Colors.textPrimary, textAlignVertical: "top", minHeight: 130 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.border + "80", borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: "700", color: Colors.textPrimary },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 24 },
  cancelBtn: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: 50, alignItems: "center", paddingVertical: 14 },
  cancelText: { fontWeight: "700", color: Colors.textSecondary, fontSize: 14 },
  sendBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: 50, alignItems: "center", paddingVertical: 14 },
  sendText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});

const vr = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.primary + "10", borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: Colors.primary + "30" },
  btnLabel: { fontSize: 13, fontWeight: "700", color: Colors.primary },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.success + "12", borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: Colors.success + "40" },
  playBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.success + "25", alignItems: "center", justifyContent: "center" },
  label: { flex: 1, fontSize: 13, fontWeight: "700", color: Colors.success },
});
