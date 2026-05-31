import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Linking, Alert,
  ActivityIndicator, ScrollView, Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import * as ImagePicker from "expo-image-picker";
import { useAudioRecorder, AudioModule, RecordingPresets } from "expo-audio";

function makeRoomId(kidId: string) {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `Spinini-${kidId.slice(0, 5)}-${rand}`;
}

type Mode = "home" | "calling" | "leave_choice" | "recording_voice" | "recording_video" | "sending" | "sent";

export default function VideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useData();
  const kid = useKid(id);

  const [mode, setMode] = useState<Mode>("home");
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ── Start video call ────────────────────────────────────────────────────────
  async function startCall() {
    setMode("calling");
    const roomId = makeRoomId(id);
    const url = `https://meet.jit.si/${roomId}`;
    setActiveRoom(roomId);

    dispatch({
      type: "FAMILY_CHAT_PUSH",
      message: {
        id: uid(), authorId: id, authorName: kid?.profile.name ?? "Kid",
        text: `📹 ${kid?.profile.name} is starting a video call! Join here:\n${url}`,
        sentAt: nowIso(), recipients: [], readBy: [],
      },
    });
    dispatch({
      type: "NOTIFICATION_ADD", kidId: id,
      notification: {
        id: uid(), kidId: id, kind: "ping",
        title: `📹 ${kid?.profile.name} wants to video call!`,
        body: `Tap to join: ${url}`,
        read: false, createdAt: nowIso(),
      },
    });

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) await Linking.openURL(url);
      else Alert.alert("Can't open browser", "Please open:\n" + url);
    } catch {
      Alert.alert("Couldn't open video call", "Please try opening meet.jit.si in your browser.");
    }

    // After launching call, offer "no answer?" after a moment
    setMode("leave_choice");
  }

  // ── Voice recording ─────────────────────────────────────────────────────────
  async function startVoiceRecording() {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Please allow microphone access to record voice messages.");
        return;
      }
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setRecordingSecs(0);
      setMode("recording_voice");
      timerRef.current = setInterval(() => setRecordingSecs(s => s + 1), 1000);
    } catch (e) {
      Alert.alert("Recording error", "Could not start recording. Please try again.");
    }
  }

  async function stopVoiceRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) { Alert.alert("Error", "No audio recorded."); setMode("leave_choice"); return; }
      await sendMessage("voice", uri, recordingSecs);
    } catch {
      Alert.alert("Error", "Failed to stop recording.");
      setMode("leave_choice");
    }
  }

  // ── Video recording ─────────────────────────────────────────────────────────
  async function recordVideo() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Please allow camera access to record video messages.");
        return;
      }
      setMode("recording_video");
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "videos",
        videoMaxDuration: 60,
        quality: 0.7,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        await sendMessage("video", asset.uri, Math.round(asset.duration ?? 10));
      } else {
        setMode("leave_choice");
      }
    } catch {
      Alert.alert("Error", "Could not record video. Please try again.");
      setMode("leave_choice");
    }
  }

  // ── Send the message ─────────────────────────────────────────────────────────
  async function sendMessage(kind: "video" | "voice", mediaUri: string, durationSeconds: number) {
    setMode("sending");
    dispatch({
      type: "VIDEO_MESSAGE_ADD",
      kidId: id,
      message: {
        id: uid(),
        authorId: id,
        authorName: kid?.profile.name ?? "Kid",
        kind,
        mediaUri,
        durationSeconds,
        sentAt: nowIso(),
        read: false,
      },
    });
    // Notify parent
    dispatch({
      type: "NOTIFICATION_ADD", kidId: id,
      notification: {
        id: uid(), kidId: id, kind: "ping",
        title: `${kind === "voice" ? "🎙" : "📹"} ${kid?.profile.name} left you a ${kind} message!`,
        body: `You missed their call — they left a ${durationSeconds}s ${kind} message. Tap to listen!`,
        read: false, createdAt: nowIso(),
      },
    });
    // Short delay for feel-good UX
    await new Promise(r => setTimeout(r, 800));
    setMode("sent");
  }

  function fmtTime(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Render states
  // ══════════════════════════════════════════════════════════════════════════

  // ── Sent confirmation ───────────────────────────────────────────────────────
  if (mode === "sent") {
    return (
      <ScreenContainer>
        <View style={styles.centeredBlock}>
          <Text style={{ fontSize: 72 }}>✅</Text>
          <Text style={styles.sentTitle}>Message Sent!</Text>
          <Text style={styles.sentSub}>Your parent was notified and will see your message soon.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setMode("home")}>
            <Text style={styles.primaryBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // ── Sending spinner ─────────────────────────────────────────────────────────
  if (mode === "sending") {
    return (
      <ScreenContainer>
        <View style={styles.centeredBlock}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.sendingText}>Sending your message…</Text>
        </View>
      </ScreenContainer>
    );
  }

  // ── Voice recording in progress ─────────────────────────────────────────────
  if (mode === "recording_voice") {
    return (
      <ScreenContainer>
        <View style={styles.centeredBlock}>
          <View style={styles.recordingPulse}>
            <Text style={{ fontSize: 52 }}>🎙</Text>
          </View>
          <Text style={styles.recTimer}>{fmtTime(recordingSecs)}</Text>
          <Text style={styles.recLabel}>Recording voice message…</Text>
          <TouchableOpacity style={styles.stopBtn} onPress={stopVoiceRecording}>
            <Text style={styles.stopBtnText}>⏹ Stop & Send</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelLink} onPress={async () => {
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
            try { audioRecorder.stop(); } catch {}
            setMode("leave_choice");
          }}>
            <Text style={styles.cancelLinkText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // ── Leave a message — choose type ───────────────────────────────────────────
  if (mode === "leave_choice" || mode === "recording_video") {
    return (
      <ScreenContainer>
        <Text style={styles.title}>📨 Leave a Message</Text>
        <Text style={styles.sub}>
          {activeRoom ? "They didn't answer? Leave a message and they'll see it when they're free!" : "Record a message for your parent."}
        </Text>

        {/* Re-join call option */}
        {activeRoom && (
          <TouchableOpacity
            style={styles.rejoinBtn}
            onPress={async () => {
              const url = `https://meet.jit.si/${activeRoom}`;
              await Linking.openURL(url).catch(() => {});
            }}
          >
            <Text style={styles.rejoinBtnText}>📞 Try Call Again</Text>
          </TouchableOpacity>
        )}

        <View style={styles.choiceRow}>
          {/* Voice message */}
          <TouchableOpacity
            style={styles.choiceCard}
            onPress={startVoiceRecording}
            disabled={mode === "recording_video"}
          >
            <Text style={{ fontSize: 48 }}>🎙</Text>
            <Text style={styles.choiceTitle}>Voice Message</Text>
            <Text style={styles.choiceSub}>Record what you want to say — up to 2 minutes</Text>
          </TouchableOpacity>

          {/* Video message */}
          <TouchableOpacity
            style={styles.choiceCard}
            onPress={recordVideo}
            disabled={mode === "recording_video"}
          >
            <Text style={{ fontSize: 48 }}>📹</Text>
            <Text style={styles.choiceTitle}>Video Message</Text>
            <Text style={styles.choiceSub}>Record a short video — up to 60 seconds</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.cancelLink} onPress={() => setMode("home")}>
          <Text style={styles.cancelLinkText}>← Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  // ── Home / calling screen ────────────────────────────────────────────────────
  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>📹 Video Call</Text>

      <View style={styles.hero}>
        <Text style={{ fontSize: 72 }}>📹</Text>
        <Text style={styles.heroTitle}>Call Your Family</Text>
        <Text style={styles.heroSub}>
          Start a free video call — your parent gets a notification with the link to join!
        </Text>
      </View>

      {activeRoom && (
        <View style={styles.activeCard}>
          <Text style={styles.activeLabel}>📡 Active Room</Text>
          <Text style={styles.activeRoom}>{activeRoom}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <TouchableOpacity
              style={styles.rejoinSmallBtn}
              onPress={async () => {
                const url = `https://meet.jit.si/${activeRoom}`;
                await Linking.openURL(url).catch(() => {});
              }}
            >
              <Text style={styles.rejoinSmallText}>📞 Rejoin</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.leaveSmallBtn}
              onPress={() => setMode("leave_choice")}
            >
              <Text style={styles.leaveSmallText}>📨 Leave Message</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.callBtn, mode === "calling" && { opacity: 0.7 }]}
        onPress={startCall}
        disabled={mode === "calling"}
      >
        {mode === "calling"
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.callBtnText}>📞 Start Video Call</Text>
        }
      </TouchableOpacity>

      {/* Leave message without calling first */}
      <TouchableOpacity style={styles.leaveDirectBtn} onPress={() => setMode("leave_choice")}>
        <Text style={styles.leaveDirectText}>📨 Leave a Message Instead</Text>
      </TouchableOpacity>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How it works</Text>
        <Text style={styles.infoText}>1. Tap "Start Video Call" — a meeting room opens in your browser</Text>
        <Text style={styles.infoText}>2. Your parent gets a notification with the link to join</Text>
        <Text style={styles.infoText}>3. If they miss the call — leave a voice or video message! 📨</Text>
        <Text style={styles.infoText}>4. They'll see your message when they're available 💜</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title:    { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub:      { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.lg },
  hero:     { alignItems: "center", paddingVertical: Spacing.lg, gap: 8 },
  heroTitle: { fontSize: FontSize.xl, fontWeight: "700", color: Colors.textPrimary },
  heroSub:   { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", maxWidth: 280 },

  activeCard: {
    backgroundColor: Colors.primary + "15", borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    alignItems: "center", borderWidth: 1, borderColor: Colors.primary + "40",
  },
  activeLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.primary, textTransform: "uppercase", marginBottom: 4 },
  activeRoom:  { fontSize: FontSize.base, fontWeight: "800", color: Colors.primary, letterSpacing: 1 },

  callBtn:     { backgroundColor: Colors.success, borderRadius: Radius.full, alignItems: "center", paddingVertical: 16, marginBottom: Spacing.sm, ...Shadow.md, flexDirection: "row", justifyContent: "center", gap: 8 },
  callBtnText: { color: "#fff", fontSize: FontSize.lg, fontWeight: "800" },

  leaveDirectBtn:  { borderWidth: 2, borderColor: Colors.primary + "50", borderRadius: Radius.full, alignItems: "center", paddingVertical: 13, marginBottom: Spacing.lg },
  leaveDirectText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.base },

  rejoinSmallBtn:  { flex: 1, backgroundColor: Colors.success + "20", borderRadius: Radius.full, alignItems: "center", paddingVertical: 8, borderWidth: 1, borderColor: Colors.success + "50" },
  rejoinSmallText: { color: Colors.success, fontWeight: "700", fontSize: FontSize.sm },
  leaveSmallBtn:   { flex: 1, backgroundColor: Colors.primary + "15", borderRadius: Radius.full, alignItems: "center", paddingVertical: 8, borderWidth: 1, borderColor: Colors.primary + "40" },
  leaveSmallText:  { color: Colors.primary, fontWeight: "700", fontSize: FontSize.sm },

  infoCard:  { backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: Spacing.md, gap: 6 },
  infoTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary, marginBottom: 4 },
  infoText:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  // Leave a message
  rejoinBtn:     { backgroundColor: Colors.success, borderRadius: Radius.full, alignItems: "center", paddingVertical: 13, marginBottom: Spacing.md, ...Shadow.sm },
  rejoinBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },

  choiceRow:   { flexDirection: "row", gap: 12, marginBottom: Spacing.lg },
  choiceCard:  {
    flex: 1, backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl,
    padding: Spacing.md, alignItems: "center", gap: 8, ...Shadow.sm,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  choiceTitle: { fontSize: FontSize.base, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  choiceSub:   { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: "center", lineHeight: 16 },

  // Recording voice
  centeredBlock:  { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingVertical: 40 },
  recordingPulse: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.error + "20",
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: Colors.error + "60",
  },
  recTimer:  { fontSize: 48, fontWeight: "800", color: Colors.error, letterSpacing: 2 },
  recLabel:  { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: "600" },
  stopBtn:   { backgroundColor: Colors.error, borderRadius: Radius.full, paddingHorizontal: 36, paddingVertical: 14, ...Shadow.md },
  stopBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },

  // Sending / sent
  sendingText: { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: "600", marginTop: 16 },
  sentTitle:   { fontSize: FontSize.xl, fontWeight: "800", color: Colors.success },
  sentSub:     { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", maxWidth: 260, lineHeight: 20 },
  primaryBtn:  { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 40, paddingVertical: 14, marginTop: 8, ...Shadow.sm },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },

  cancelLink:     { alignItems: "center", paddingVertical: 12 },
  cancelLinkText: { color: Colors.textSecondary, fontWeight: "600", fontSize: FontSize.base },
});
