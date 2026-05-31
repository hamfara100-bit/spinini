import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import type { BorrowRequest } from "../../../../lib/data/types";

const AMOUNTS = [10, 15, 20, 30];

const STATUS_COLORS = { pending: Colors.warning ?? "#F59E0B", approved: Colors.success, denied: Colors.error };
const STATUS_LABELS = { pending: "⏳ Pending", approved: "✅ Approved", denied: "❌ Denied" };

export default function BorrowTimeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);
  const [minutes, setMinutes] = useState(15);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  const requests = kid?.borrowRequests ?? [];
  const hasPending = requests.some(r => r.status === "pending");

  function sendRequest() {
    if (hasPending) {
      Alert.alert("Request Pending", "You already have a pending borrow request. Wait for your parent to respond.");
      return;
    }
    const req: BorrowRequest = {
      id: uid(),
      kidId: id,
      minutes,
      reason: reason.trim() || "I need a bit more time.",
      requestedAt: nowIso(),
      status: "pending",
    };
    dispatch({ type: "BORROW_REQUEST", kidId: id, request: req });
    // Also send a notification to the parent
    dispatch({
      type: "NOTIFICATION_ADD",
      kidId: id,
      notification: {
        id: uid(),
        kidId: id,
        kind: "ping",
        title: `⏱️ ${kid?.profile.name} wants to borrow ${minutes} min`,
        body: reason.trim() || "I need a bit more time.",
        read: false,
        createdAt: nowIso(),
      },
    });
    setSent(true);
    setReason("");
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>⏱️ Borrow Screen Time</Text>
      <Text style={styles.sub}>
        Ask a parent to lend you extra minutes from tomorrow's allowance. They'll approve or deny your request.
      </Text>

      {sent && (
        <View style={styles.sentBanner}>
          <Text style={styles.sentText}>✅ Request sent! Wait for a parent to respond.</Text>
        </View>
      )}

      {/* Amount selector */}
      <Text style={styles.label}>How many minutes?</Text>
      <View style={styles.amountRow}>
        {AMOUNTS.map(a => (
          <TouchableOpacity
            key={a}
            style={[styles.amountChip, minutes === a && styles.amountChipActive]}
            onPress={() => { setMinutes(a); setSent(false); }}
          >
            <Text style={[styles.amountText, minutes === a && styles.amountTextActive]}>{a}m</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Reason */}
      <Text style={styles.label}>Why do you need more time?</Text>
      <TextInput
        style={styles.input}
        value={reason}
        onChangeText={v => { setReason(v); setSent(false); }}
        placeholder="e.g. I'm in the middle of a movie"
        multiline
      />

      <TouchableOpacity
        style={[styles.sendBtn, hasPending && styles.sendBtnDisabled]}
        onPress={sendRequest}
        disabled={hasPending}
      >
        <Text style={styles.sendBtnText}>
          {hasPending ? "⏳ Request Pending…" : `Send Request for ${minutes} Minutes`}
        </Text>
      </TouchableOpacity>

      {/* History */}
      {requests.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>REQUEST HISTORY</Text>
          {requests.slice(0, 10).map(r => (
            <View key={r.id} style={styles.historyCard}>
              <View style={styles.historyRow}>
                <Text style={styles.historyMinutes}>{r.minutes} min</Text>
                <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS as any)[r.status] + "20" }]}>
                  <Text style={[styles.statusText, { color: (STATUS_COLORS as any)[r.status] }]}>
                    {(STATUS_LABELS as any)[r.status]}
                  </Text>
                </View>
              </View>
              <Text style={styles.historyReason}>"{r.reason}"</Text>
              {r.parentNote && <Text style={styles.parentNote}>Parent: {r.parentNote}</Text>}
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
  label: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, marginBottom: 8, marginTop: 8 },
  amountRow: { flexDirection: "row", gap: 10, marginBottom: Spacing.md },
  amountChip: { flex: 1, borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.xl, alignItems: "center", paddingVertical: 14 },
  amountChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  amountText: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textSecondary },
  amountTextActive: { color: "#fff" },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg, padding: 12, fontSize: FontSize.base, minHeight: 80, textAlignVertical: "top", marginBottom: Spacing.md },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 16, ...Shadow.md },
  sendBtnDisabled: { backgroundColor: Colors.textMuted },
  sendBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  sentBanner: { backgroundColor: "#F0FDF4", borderRadius: Radius.lg, padding: 12, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.success },
  sentText: { color: Colors.success, fontWeight: "700", textAlign: "center" },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textMuted, letterSpacing: 0.8, textTransform: "uppercase", marginTop: Spacing.lg, marginBottom: 8 },
  historyCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: 12, marginBottom: 8, ...Shadow.sm },
  historyRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  historyMinutes: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary, flex: 1 },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: FontSize.xs, fontWeight: "700" },
  historyReason: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: "italic" },
  parentNote: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600", marginTop: 4 },
});
