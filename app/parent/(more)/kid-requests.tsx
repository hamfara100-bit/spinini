import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView } from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { nowIso } from "../../../lib/utils";

const TABS = ["Requests", "Borrow Time"] as const;
type Tab = typeof TABS[number];

const STATUS_COLORS = { pending: "#F59E0B", approved: Colors.success, denied: Colors.error };
const STATUS_LABELS = { pending: "Pending", approved: "Approved", denied: "Denied" };

export default function KidRequestsScreen() {
  const { state, dispatch } = useData();
  const [tab, setTab] = useState<Tab>("Requests");
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  function setNote(id: string, val: string) {
    setNoteInputs(prev => ({ ...prev, [id]: val }));
  }

  function decideRequest(kidId: string, requestId: string, status: "approved" | "denied") {
    dispatch({ type: "KID_REQUEST_DECIDE", kidId, requestId, status, parentNote: noteInputs[requestId]?.trim() || undefined });
    setNoteInputs(prev => { const n = { ...prev }; delete n[requestId]; return n; });
  }

  function decideBorrow(kidId: string, requestId: string, status: "approved" | "denied") {
    dispatch({ type: "BORROW_DECIDE", kidId, requestId, status, parentNote: noteInputs[requestId]?.trim() || undefined });
    setNoteInputs(prev => { const n = { ...prev }; delete n[requestId]; return n; });
  }

  // Gather all pending requests across all kids
  const allKidRequests = state.kids.flatMap(k =>
    (k.kidRequests ?? []).map(r => ({ ...r, kid: k }))
  ).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  const allBorrowRequests = state.kids.flatMap(k =>
    (k.borrowRequests ?? []).map(r => ({ ...r, kid: k }))
  ).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  const pendingCount = allKidRequests.filter(r => r.status === "pending").length
    + allBorrowRequests.filter(r => r.status === "pending").length;

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Text style={styles.title}>📩 Kid Requests</Text>
        {pendingCount > 0 && (
          <View style={styles.badge}><Text style={styles.badgeText}>{pendingCount}</Text></View>
        )}
      </View>
      <Text style={styles.sub}>Approve or deny requests from your kids.</Text>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "Requests" && (
        <>
          {allKidRequests.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyText}>No requests yet.</Text></View>
          ) : (
            allKidRequests.map(r => (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>{r.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardKid}>{r.kid.profile.name}</Text>
                    <Text style={styles.cardSubject}>{r.subject}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS as any)[r.status] + "20" }]}>
                    <Text style={[styles.statusText, { color: (STATUS_COLORS as any)[r.status] }]}>
                      {(STATUS_LABELS as any)[r.status]}
                    </Text>
                  </View>
                </View>
                {r.body ? <Text style={styles.cardBody}>{r.body}</Text> : null}
                {r.status === "pending" && (
                  <>
                    <TextInput
                      style={styles.noteInput}
                      value={noteInputs[r.id] ?? ""}
                      onChangeText={v => setNote(r.id, v)}
                      placeholder="Optional note to kid…"
                    />
                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.denyBtn} onPress={() => decideRequest(r.kid.profile.id, r.id, "denied")}>
                        <Text style={styles.denyBtnText}>Deny</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.approveBtn} onPress={() => decideRequest(r.kid.profile.id, r.id, "approved")}>
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
                {r.parentNote && <Text style={styles.parentNote}>Your note: {r.parentNote}</Text>}
              </View>
            ))
          )}
        </>
      )}

      {tab === "Borrow Time" && (
        <>
          {allBorrowRequests.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyText}>No borrow requests yet.</Text></View>
          ) : (
            allBorrowRequests.map(r => (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>⏱️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardKid}>{r.kid.profile.name}</Text>
                    <Text style={styles.cardSubject}>Wants to borrow {r.minutes} minutes</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS as any)[r.status] + "20" }]}>
                    <Text style={[styles.statusText, { color: (STATUS_COLORS as any)[r.status] }]}>
                      {(STATUS_LABELS as any)[r.status]}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardBody}>"{r.reason}"</Text>
                {r.status === "pending" && (
                  <>
                    <TextInput
                      style={styles.noteInput}
                      value={noteInputs[r.id] ?? ""}
                      onChangeText={v => setNote(r.id, v)}
                      placeholder="Optional note…"
                    />
                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.denyBtn} onPress={() => decideBorrow(r.kid.profile.id, r.id, "denied")}>
                        <Text style={styles.denyBtnText}>Deny</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.approveBtn} onPress={() => decideBorrow(r.kid.profile.id, r.id, "approved")}>
                        <Text style={styles.approveBtnText}>+{r.minutes} min</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
                {r.parentNote && <Text style={styles.parentNote}>Your note: {r.parentNote}</Text>}
              </View>
            ))
          )}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, flex: 1 },
  badge: { backgroundColor: Colors.error, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: FontSize.xs, fontWeight: "700" },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  tabRow: { flexDirection: "row", backgroundColor: Colors.surfaceLight, borderRadius: Radius.full, padding: 4, marginBottom: Spacing.md },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: Radius.full },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textMuted },
  tabTextActive: { color: "#fff" },
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, marginBottom: 10, ...Shadow.sm },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  cardEmoji: { fontSize: 26 },
  cardKid: { fontSize: FontSize.xs, fontWeight: "600", color: Colors.textMuted },
  cardSubject: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  cardBody: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: "italic", marginBottom: 10 },
  statusBadge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: "700" },
  noteInput: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.lg, padding: 10, fontSize: FontSize.sm, marginBottom: 10 },
  actionRow: { flexDirection: "row", gap: 10 },
  denyBtn: { flex: 1, borderWidth: 2, borderColor: Colors.error, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12 },
  denyBtnText: { color: Colors.error, fontWeight: "700" },
  approveBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", paddingVertical: 12 },
  approveBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  parentNote: { fontSize: FontSize.xs, color: Colors.textMuted, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 6, marginTop: 4 },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.base },
});
