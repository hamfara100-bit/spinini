import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import type { KidRequest } from "../../../../lib/data/types";

const EMOJIS = ["🙏","🎮","🎬","🍕","🎉","🏖️","🛍️","🎵","🌈","💬","⏰","🤝","💡","🎁","🚗"];
const STATUS_COLORS = { pending: "#F59E0B", approved: Colors.success, denied: Colors.error };
const STATUS_LABELS = { pending: "⏳ Pending", approved: "✅ Approved", denied: "❌ Denied" };

export default function KidRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);

  const requests = kid?.kidRequests ?? [];
  const hasPending = requests.some(r => r.status === "pending");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [emoji, setEmoji] = useState("🙏");
  const [sent, setSent] = useState(false);

  function send() {
    if (!subject.trim()) { Alert.alert("Please add a subject"); return; }
    if (hasPending) {
      Alert.alert("Already pending", "Wait for your parent to respond to your current request first.");
      return;
    }
    const request: KidRequest = {
      id: uid(),
      subject: subject.trim(),
      body: body.trim() || "",
      emoji,
      requestedAt: nowIso(),
      status: "pending",
    };
    dispatch({ type: "KID_REQUEST_SEND", kidId: id, request });
    dispatch({
      type: "NOTIFICATION_ADD",
      kidId: id,
      notification: {
        id: uid(),
        kidId: id,
        kind: "ping",
        title: `${emoji} ${kid?.profile.name} sent a request`,
        body: subject.trim(),
        read: false,
        createdAt: nowIso(),
      },
    });
    setSubject("");
    setBody("");
    setEmoji("🙏");
    setSent(true);
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>📩 Ask a Parent</Text>
      <Text style={styles.sub}>Send a formal request to your parent — they'll see it and respond.</Text>

      {sent && (
        <View style={styles.sentBanner}>
          <Text style={styles.sentText}>✅ Request sent! Your parent will reply soon.</Text>
        </View>
      )}

      {/* Emoji picker */}
      <Text style={styles.label}>Pick an emoji</Text>
      <View style={styles.emojiRow}>
        {EMOJIS.map(e => (
          <TouchableOpacity
            key={e}
            style={[styles.emojiBtn, emoji === e && styles.emojiBtnActive]}
            onPress={() => { setEmoji(e); setSent(false); }}
          >
            <Text style={{ fontSize: 22 }}>{e}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Subject</Text>
      <TextInput
        style={styles.input}
        value={subject}
        onChangeText={v => { setSubject(v); setSent(false); }}
        placeholder="What's this about?"
      />

      <Text style={styles.label}>Details (optional)</Text>
      <TextInput
        style={[styles.input, { minHeight: 80 }]}
        value={body}
        onChangeText={v => { setBody(v); setSent(false); }}
        placeholder="Give more details…"
        multiline
      />

      <TouchableOpacity
        style={[styles.sendBtn, hasPending && styles.sendBtnDisabled]}
        onPress={send}
        disabled={hasPending}
      >
        <Text style={styles.sendBtnText}>{hasPending ? "⏳ Awaiting Response…" : `${emoji} Send Request`}</Text>
      </TouchableOpacity>

      {/* History */}
      {requests.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>MY REQUESTS</Text>
          {requests.slice(0, 20).map(r => (
            <View key={r.id} style={styles.historyCard}>
              <View style={styles.historyTop}>
                <Text style={styles.historyEmoji}>{r.emoji}</Text>
                <Text style={styles.historySubject}>{r.subject}</Text>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS as any)[r.status] + "20" }]}>
                  <Text style={[styles.statusText, { color: (STATUS_COLORS as any)[r.status] }]}>
                    {(STATUS_LABELS as any)[r.status]}
                  </Text>
                </View>
              </View>
              {r.body ? <Text style={styles.historyBody}>{r.body}</Text> : null}
              {r.parentNote && <Text style={styles.parentNote}>💬 Parent: {r.parentNote}</Text>}
            </View>
          ))}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
  label: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, marginBottom: 8, marginTop: 4 },
  emojiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: Spacing.md },
  emojiBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: Radius.md, backgroundColor: Colors.surfaceLight, borderWidth: 1.5, borderColor: Colors.border },
  emojiBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "15" },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg, padding: 12, fontSize: FontSize.base, marginBottom: Spacing.sm, textAlignVertical: "top" },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 16, ...Shadow.md, marginBottom: Spacing.md },
  sendBtnDisabled: { backgroundColor: Colors.textMuted },
  sendBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  sentBanner: { backgroundColor: "#F0FDF4", borderRadius: Radius.lg, padding: 12, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.success },
  sentText: { color: Colors.success, fontWeight: "700", textAlign: "center" },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginTop: Spacing.lg, marginBottom: 8 },
  historyCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: 12, marginBottom: 8, ...Shadow.sm },
  historyTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  historyEmoji: { fontSize: 20 },
  historySubject: { flex: 1, fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary },
  historyBody: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 4 },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: "700" },
  parentNote: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600", marginTop: 4, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 6 },
});
