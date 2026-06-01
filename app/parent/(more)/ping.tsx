import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert } from "react-native";
import { createAudioPlayer } from "expo-audio";
import { VoiceTextInput } from "../../../components/voice-text-input";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso } from "../../../lib/utils";

const MESSAGES = ["Dinner's ready! 🍽️", "Time to come home! 🏠", "I love you! ❤️", "Call me! 📞", "5 more minutes! ⏱️"];

export default function PingScreen() {
  const { state, dispatch } = useData();
  const [message, setMessage] = useState(MESSAGES[0]);
  const [selectedKids, setSelectedKids] = useState<string[]>([]);
  const [listeningKidId, setListeningKidId] = useState<string | null>(null);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const [playingRecId, setPlayingRecId] = useState<string | null>(null);

  function sendPing() {
    if (!message.trim()) return;
    selectedKids.forEach(kidId => {
      dispatch({ type: "NOTIFICATION_ADD", kidId, notification: { id: uid(), kidId, kind: "ping", title: "Message from Parent 📩", body: message.trim(), emoji: "🔔", read: false, createdAt: nowIso() } });
    });
    setSelectedKids([]);
  }

  function requestAmbientListen(kidId: string) {
    Alert.alert(
      "🎙️ Voice Check-in",
      "When your child next opens the app, they will see a banner and receive a notification letting them know you requested a 30-second voice check-in. The recording will be available here.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Request Check-in", onPress: () => {
          dispatch({ type: "AMBIENT_LISTEN_REQUEST", kidId, request: { requestedAt: nowIso(), durationSecs: 30, fulfilled: false } });
          Alert.alert("✅ Requested", "Your child will be notified when they open the app.");
        }},
      ]
    );
  }

  function togglePlayRecording(kidId: string, recId: string, uri: string) {
    if (playingRecId === recId) {
      playerRef.current?.pause();
      setPlayingRecId(null);
    } else {
      playerRef.current?.pause();
      const p = createAudioPlayer(uri);
      p.play();
      playerRef.current = p;
      setPlayingRecId(recId);
      dispatch({ type: "AMBIENT_RECORDING_LISTEN", kidId, recordingId: recId });
    }
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🔔 Ping Family</Text>

      {/* ── 🎙️ Listen to Surroundings ── */}
      <View style={ls.section}>
        <Text style={ls.sectionTitle}>🎙️ Listen to Surroundings</Text>
        <Text style={ls.sectionSub}>Request a 30-second voice check-in. Your child will be notified with a banner and notification before recording starts.</Text>
        {state.kids.map(k => {
          const recordings = (k.ambientRecordings ?? []).slice(0, 5);
          const pendingReq = k.ambientListenRequest && !k.ambientListenRequest.fulfilled;
          return (
            <View key={k.profile.id} style={ls.kidSection}>
              <View style={ls.kidRow}>
                <Text style={ls.kidName}>{k.profile.name}</Text>
                {pendingReq ? (
                  <View style={ls.pendingBadge}><Text style={ls.pendingText}>⏳ Waiting for device…</Text></View>
                ) : (
                  <TouchableOpacity style={ls.listenBtn} onPress={() => requestAmbientListen(k.profile.id)}>
                    <Text style={ls.listenBtnText}>🎙️ Request Recording</Text>
                  </TouchableOpacity>
                )}
              </View>
              {recordings.length > 0 && (
                <View style={ls.recordings}>
                  {recordings.map(rec => (
                    <View key={rec.id} style={ls.recRow}>
                      <TouchableOpacity
                        style={[ls.playBtn, playingRecId === rec.id && { backgroundColor: Colors.error + "20" }]}
                        onPress={() => togglePlayRecording(k.profile.id, rec.id, rec.uri)}
                      >
                        <Text style={{ fontSize: 16 }}>{playingRecId === rec.id ? "⏸" : "▶"}</Text>
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <Text style={ls.recDate}>{new Date(rec.recordedAt).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</Text>
                        <Text style={ls.recDur}>{rec.durationSecs}s recording{rec.listenedAt ? " · Listened" : " · New"}</Text>
                      </View>
                      {!rec.listenedAt && <View style={ls.newDot} />}
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Message</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
          {MESSAGES.map(m => (
            <TouchableOpacity key={m} style={[styles.msgChip, message === m && styles.msgChipActive]} onPress={() => setMessage(m)}>
              <Text style={[styles.msgChipText, message === m && styles.msgChipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <VoiceTextInput value={message} onChangeText={setMessage} placeholder="Custom message… or tap 🎙️ to speak" appendTranscript={false} containerStyle={styles.input} style={{ borderWidth: 0, paddingVertical: 8 }} />
        <Text style={styles.label}>Send to:</Text>
        <View style={styles.kidRow}>
          {state.kids.map(k => (
            <TouchableOpacity key={k.profile.id} style={[styles.kidChip, selectedKids.includes(k.profile.id) && styles.kidChipActive]} onPress={() => setSelectedKids(s => s.includes(k.profile.id) ? s.filter(x => x !== k.profile.id) : [...s, k.profile.id])}>
              <Text style={[styles.kidChipText, selectedKids.includes(k.profile.id) && styles.kidChipTextActive]}>{k.profile.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.sendBtn, selectedKids.length === 0 && { opacity: 0.5 }]} onPress={sendPing} disabled={selectedKids.length === 0 || !message.trim()}>
          <Text style={styles.sendBtnText}>🔔 Send Ping</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md },
  form: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.md, gap: 8 },
  label: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  msgChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.cardLight, marginRight: 8 },
  msgChipActive: { backgroundColor: Colors.primary },
  msgChipText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  msgChipTextActive: { color: "#fff" },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.base },
  kidRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kidChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.cardLight },
  kidChipActive: { backgroundColor: Colors.primary },
  kidChipText: { fontWeight: "600", color: Colors.textSecondary },
  kidChipTextActive: { color: "#fff" },
  sendBtn: { backgroundColor: Colors.secondary, borderRadius: Radius.full, alignItems: "center", padding: Spacing.md, marginHorizontal: Spacing.sm },
  sendBtnText: { color: Colors.textPrimary, fontWeight: "700", fontSize: FontSize.base },
});

const ls = StyleSheet.create({
  section: { backgroundColor: "#F0F9FF", borderRadius: 18, padding: 14, marginBottom: 16, borderWidth: 1.5, borderColor: "#BAE6FD" },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#0369A1", marginBottom: 4 },
  sectionSub: { fontSize: 12, color: "#0284C7", marginBottom: 12 },
  kidSection: { marginBottom: 12 },
  kidRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  kidName: { fontSize: 14, fontWeight: "800", color: Colors.textPrimary },
  pendingBadge: { backgroundColor: Colors.warning + "25", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pendingText: { fontSize: 11, fontWeight: "700", color: "#92400E" },
  listenBtn: { backgroundColor: "#0EA5E9", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  listenBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  recordings: { gap: 6 },
  recRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.surfaceLight, borderRadius: 12, padding: 10 },
  playBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#0EA5E9" + "20", alignItems: "center", justifyContent: "center" },
  recDate: { fontSize: 13, fontWeight: "700", color: Colors.textPrimary },
  recDur: { fontSize: 11, color: Colors.textMuted },
  newDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
});
