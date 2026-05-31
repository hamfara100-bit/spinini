import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Linking, Alert,
  ScrollView, ActivityIndicator,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso } from "../../../lib/utils";
import { useAudioPlayer } from "expo-audio";
import type { VideoMessage } from "../../../lib/data/types";

function makeRoomId(kidId: string) {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `Spinini-${kidId.slice(0, 5)}-${rand}`;
}

function fmtDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Voice message playback component ─────────────────────────────────────────
function VoicePlayer({ msg, onMarkRead }: { msg: VideoMessage; onMarkRead: () => void }) {
  const player = useAudioPlayer(msg.mediaUri);

  function toggle() {
    if (player.playing) {
      player.pause();
    } else {
      onMarkRead();
      player.play();
    }
  }

  return (
    <TouchableOpacity style={styles.playBtn} onPress={toggle}>
      <Text style={styles.playBtnIcon}>{player.playing ? "⏸" : "▶"}</Text>
      <Text style={styles.playBtnText}>{player.playing ? "Playing…" : `Play (${fmtDuration(msg.durationSeconds)})`}</Text>
    </TouchableOpacity>
  );
}

export default function ParentVideoScreen() {
  const { state, dispatch } = useData();
  const [activeRooms, setActiveRooms] = useState<Record<string, string>>({});
  const [calling, setCalling] = useState<string | null>(null);
  const [tab, setTab] = useState<"calls" | "messages">("calls");

  // Collect all messages across all kids
  const allMessages = state.kids.flatMap(k =>
    k.videoMessages.map(m => ({ ...m, kidName: k.profile.name, kidId: k.profile.id }))
  ).sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

  const unreadCount = allMessages.filter(m => !m.read).length;

  async function callKid(kidId: string, kidName: string) {
    if (calling) return;
    setCalling(kidId);
    const roomId = activeRooms[kidId] ?? makeRoomId(kidId);
    const url = `https://meet.jit.si/${roomId}`;
    setActiveRooms(r => ({ ...r, [kidId]: roomId }));

    dispatch({
      type: "FAMILY_CHAT_PUSH",
      message: {
        id: uid(), authorId: "parent", authorName: state.parent?.name ?? "Parent",
        text: `📹 ${state.parent?.name ?? "Your parent"} is calling you on video! Join here:\n${url}`,
        sentAt: nowIso(), recipients: [], readBy: [],
      },
    });
    dispatch({
      type: "NOTIFICATION_ADD", kidId,
      notification: {
        id: uid(), kidId, kind: "ping",
        title: `📹 ${state.parent?.name ?? "Your parent"} is calling!`,
        body: "Your parent wants to video call you. Tap to join!",
        read: false, createdAt: nowIso(),
      },
    });

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) await Linking.openURL(url);
      else Alert.alert("Video Call Link", url, [{ text: "OK" }]);
    } catch {
      Alert.alert("Couldn't open", "Please open: " + url);
    }
    setCalling(null);
  }

  function showLink(kidId: string) {
    const roomId = activeRooms[kidId];
    if (!roomId) return;
    const url = `https://meet.jit.si/${roomId}`;
    Alert.alert("Active Room", url, [
      { text: "Open Again", onPress: () => Linking.openURL(url) },
      { text: "End Call", style: "destructive", onPress: () => setActiveRooms(r => { const n = { ...r }; delete n[kidId]; return n; }) },
      { text: "Close" },
    ]);
  }

  function deleteMessage(kidId: string, messageId: string) {
    Alert.alert("Delete Message?", "This will permanently remove this message.", [
      { text: "Cancel" },
      { text: "Delete", style: "destructive", onPress: () => dispatch({ type: "VIDEO_MESSAGE_DELETE", kidId, messageId }) },
    ]);
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>📹 Video</Text>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, tab === "calls" && styles.tabActive]} onPress={() => setTab("calls")}>
          <Text style={[styles.tabText, tab === "calls" && styles.tabTextActive]}>📞 Calls</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "messages" && styles.tabActive]} onPress={() => setTab("messages")}>
          <Text style={[styles.tabText, tab === "messages" && styles.tabTextActive]}>
            📨 Messages{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Calls tab ── */}
      {tab === "calls" && (
        <View>
          <Text style={styles.sub}>
            Start a free video call with any of your kids. They'll get a notification to join!
          </Text>
          {state.kids.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 52 }}>📹</Text>
              <Text style={styles.emptyText}>No kids added yet</Text>
            </View>
          ) : (
            state.kids.map(kid => {
              const isActive = !!activeRooms[kid.profile.id];
              const isCalling = calling === kid.profile.id;
              const kidMsgs = kid.videoMessages.filter(m => !m.read).length;
              return (
                <View key={kid.profile.id} style={styles.kidCard}>
                  <View style={styles.kidInfo}>
                    <Text style={{ fontSize: 28 }}>👤</Text>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.kidName}>{kid.profile.name}</Text>
                      {isActive && <Text style={styles.activeText}>📡 Room active</Text>}
                      {kidMsgs > 0 && (
                        <TouchableOpacity onPress={() => setTab("messages")}>
                          <Text style={styles.unreadBadge}>📨 {kidMsgs} unread message{kidMsgs > 1 ? "s" : ""}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <View style={styles.kidBtns}>
                    <TouchableOpacity
                      style={[styles.callBtn, isCalling && { opacity: 0.6 }]}
                      onPress={() => callKid(kid.profile.id, kid.profile.name)}
                      disabled={!!calling}
                    >
                      {isCalling
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={styles.callBtnText}>{isActive ? "📞 Rejoin" : "📞 Call"}</Text>
                      }
                    </TouchableOpacity>
                    {isActive && (
                      <TouchableOpacity style={styles.linkBtn} onPress={() => showLink(kid.profile.id)}>
                        <Text style={styles.linkBtnText}>Link</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>💡 How it works</Text>
            <Text style={styles.infoText}>• Tap "Call" — a Jitsi Meet room opens in your browser</Text>
            <Text style={styles.infoText}>• Your kid gets a notification with the join link</Text>
            <Text style={styles.infoText}>• If you miss their call, they can leave you a voice or video message 📨</Text>
            <Text style={styles.infoText}>• Free, no sign-up, end-to-end encrypted 🔒</Text>
          </View>
        </View>
      )}

      {/* ── Messages tab ── */}
      {tab === "messages" && (
        <View>
          {allMessages.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 52 }}>📭</Text>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySub}>When your kids leave voice or video messages, they'll appear here.</Text>
            </View>
          ) : (
            allMessages.map(msg => (
              <View key={msg.id} style={[styles.msgCard, !msg.read && styles.msgCardUnread]}>
                {/* Header */}
                <View style={styles.msgHeader}>
                  <View style={styles.msgMeta}>
                    <Text style={styles.msgIcon}>{msg.kind === "voice" ? "🎙" : "📹"}</Text>
                    <View>
                      <Text style={styles.msgAuthor}>{msg.authorName}</Text>
                      <Text style={styles.msgTime}>{timeAgo(msg.sentAt)} · {fmtDuration(msg.durationSeconds)}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    {!msg.read && <View style={styles.unreadDot} />}
                    <TouchableOpacity onPress={() => deleteMessage(msg.kidId, msg.id)}>
                      <Text style={styles.deleteIcon}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Playback */}
                {msg.kind === "voice" ? (
                  <VoicePlayer
                    msg={msg}
                    onMarkRead={() => dispatch({ type: "VIDEO_MESSAGE_READ", kidId: msg.kidId, messageId: msg.id })}
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.videoPlayBtn}
                    onPress={async () => {
                      dispatch({ type: "VIDEO_MESSAGE_READ", kidId: msg.kidId, messageId: msg.id });
                      await Linking.openURL(msg.mediaUri).catch(() =>
                        Alert.alert("Can't play", "Unable to open this video file.")
                      );
                    }}
                  >
                    <Text style={styles.videoPlayIcon}>▶</Text>
                    <Text style={styles.videoPlayText}>Play Video ({fmtDuration(msg.durationSeconds)})</Text>
                  </TouchableOpacity>
                )}

                {/* Reply by calling back */}
                <TouchableOpacity
                  style={styles.replyCallBtn}
                  onPress={() => {
                    setTab("calls");
                    callKid(msg.kidId, msg.authorName);
                  }}
                >
                  <Text style={styles.replyCallText}>📞 Call {msg.authorName} Back</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.sm },
  sub:   { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },

  tabBar:       { flexDirection: "row", gap: 8, marginBottom: Spacing.md },
  tab:          { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: Radius.md, backgroundColor: Colors.cardLight },
  tabActive:    { backgroundColor: Colors.primary },
  tabText:      { fontWeight: "600", color: Colors.textSecondary, fontSize: FontSize.sm },
  tabTextActive:{ color: "#fff" },

  empty:    { alignItems: "center", paddingVertical: Spacing.xl, gap: 12 },
  emptyText:{ fontSize: FontSize.base, fontWeight: "700", color: Colors.textSecondary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", maxWidth: 260, lineHeight: 20 },

  kidCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 10, ...Shadow.sm },
  kidInfo: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  kidName: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  activeText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: "600", marginTop: 2 },
  unreadBadge:{ fontSize: FontSize.xs, color: Colors.primary, fontWeight: "700", marginTop: 2 },
  kidBtns: { flexDirection: "row", gap: 8 },
  callBtn: { flex: 1, backgroundColor: Colors.success, borderRadius: Radius.full, alignItems: "center", paddingVertical: 10, ...Shadow.sm, flexDirection: "row", justifyContent: "center" },
  callBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  linkBtn: { paddingHorizontal: 16, borderRadius: Radius.full, alignItems: "center", justifyContent: "center", backgroundColor: Colors.cardLight },
  linkBtnText: { color: Colors.primary, fontWeight: "600", fontSize: FontSize.sm },

  infoCard:  { backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md, gap: 6 },
  infoTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary, marginBottom: 4 },
  infoText:  { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },

  // Message cards
  msgCard: {
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: 10, ...Shadow.sm,
    borderWidth: 1.5, borderColor: "transparent",
  },
  msgCardUnread: { borderColor: Colors.primary + "50", backgroundColor: Colors.primary + "05" },
  msgHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  msgMeta:   { flexDirection: "row", alignItems: "center", gap: 10 },
  msgIcon:   { fontSize: 28 },
  msgAuthor: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  msgTime:   { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  deleteIcon:{ fontSize: 18 },

  // Voice player
  playBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.primary + "15", borderRadius: Radius.full,
    paddingHorizontal: 20, paddingVertical: 12, borderWidth: 1, borderColor: Colors.primary + "30",
  },
  playBtnIcon: { fontSize: 20, color: Colors.primary },
  playBtnText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.base },

  // Video player
  videoPlayBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.success + "15", borderRadius: Radius.full,
    paddingHorizontal: 20, paddingVertical: 12, borderWidth: 1, borderColor: Colors.success + "30",
  },
  videoPlayIcon: { fontSize: 20, color: Colors.success },
  videoPlayText: { color: Colors.success, fontWeight: "700", fontSize: FontSize.base },

  // Reply call back
  replyCallBtn: {
    marginTop: 10, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.full, alignItems: "center", paddingVertical: 9,
  },
  replyCallText: { color: Colors.textSecondary, fontWeight: "600", fontSize: FontSize.sm },
});
