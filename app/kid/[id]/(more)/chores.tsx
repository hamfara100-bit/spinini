import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Animated,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { nowIso, pointsToMoney } from "../../../../lib/utils";

const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function timeToMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function useDeadlineCountdown(deadlineTime?: string): { label: string; urgent: boolean } | null {
  const [mins, setMins] = useState<number | null>(null);

  useEffect(() => {
    if (!deadlineTime) return;
    function calc() {
      const now = new Date();
      const currentMins = now.getHours() * 60 + now.getMinutes();
      const deadlineMins = timeToMins(deadlineTime!);
      const diff = deadlineMins - currentMins;
      setMins(diff);
    }
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, [deadlineTime]);

  if (mins === null || !deadlineTime) return null;
  if (mins <= 0) return { label: "Deadline passed!", urgent: true };
  if (mins < 60) return { label: `${mins}m left!`, urgent: true };
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return { label: m > 0 ? `${h}h ${m}m left` : `${h}h left`, urgent: h < 2 };
}

function ChoreCard({ c, kidId, onSubmit }: {
  c: { id: string; title: string; description?: string; points: number; status: string;
       proofs: Array<{ kidId: string; submittedAt: string }>; assignedKids: string[];
       autoChore?: boolean; deadlineTime?: string; penaltyPoints?: number;
       recurringDays?: number[]; penaltyAppliedDates?: string[] };
  kidId: string;
  onSubmit: (choreId: string, note: string) => void;
}) {
  const [note, setNote] = useState("");
  const countdown = useDeadlineCountdown(c.autoChore ? c.deadlineTime : undefined);
  const urgentAnim = useRef(new Animated.Value(1)).current;

  const today = new Date().toISOString().split("T")[0];
  const penaltyApplied = c.penaltyAppliedDates?.includes(today);

  useEffect(() => {
    if (!countdown?.urgent) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(urgentAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        Animated.timing(urgentAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [countdown?.urgent]);

  const STATUS_ICON: Record<string, string> = { open: "📋", submitted: "⏳", approved: "✅", rejected: "❌" };

  return (
    <View style={[
      styles.card,
      countdown?.urgent && !penaltyApplied && styles.cardUrgent,
      penaltyApplied && styles.cardPenalty,
    ]}>
      <View style={styles.cardHeader}>
        <Text style={{ fontSize: 22 }}>{STATUS_ICON[c.status] ?? "📋"}</Text>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.choreTitle}>{c.title}</Text>
          {c.description ? <Text style={styles.choreDesc}>{c.description}</Text> : null}
          <Text style={styles.chorePoints}>+{c.points} pts ({pointsToMoney(c.points)})</Text>
        </View>
        {c.autoChore && (
          <View style={styles.autoBadge}>
            <Text style={styles.autoBadgeText}>🔁</Text>
          </View>
        )}
      </View>

      {/* Deadline + countdown */}
      {c.autoChore && c.deadlineTime && (
        <View style={styles.deadlineRow}>
          {penaltyApplied ? (
            <Text style={styles.penaltyText}>⚠️ -{c.penaltyPoints ?? 0}pts — missed deadline</Text>
          ) : countdown ? (
            <Animated.Text style={[styles.countdown, countdown.urgent && { opacity: urgentAnim, color: Colors.error }]}>
              ⏰ {countdown.label} (due {c.deadlineTime})
            </Animated.Text>
          ) : (
            <Text style={styles.deadlineText}>⏰ Due by {c.deadlineTime}</Text>
          )}
          {c.recurringDays && (
            <View style={styles.dayRow}>
              {DAY_LABELS.map((d, i) => (
                <View key={i} style={[styles.dayDot, c.recurringDays!.includes(i) && styles.dayDotActive]}>
                  <Text style={[styles.dayDotText, c.recurringDays!.includes(i) && styles.dayDotTextActive]}>{d[0]}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {c.status === "open" && (
        <>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Add a note (optional)…"
          />
          <TouchableOpacity style={styles.submitBtn} onPress={() => onSubmit(c.id, note)}>
            <Text style={styles.submitBtnText}>
              {countdown?.urgent ? "⚡ Submit Now!" : "Submit as Done ✓"}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {c.status === "submitted" && (
        <Text style={styles.waitingText}>⏳ Waiting for parent approval…</Text>
      )}
      {c.status === "approved" && (
        <Text style={styles.approvedText}>✅ Approved! Great job! 🌟</Text>
      )}
      {c.status === "rejected" && (
        <Text style={styles.rejectedText}>❌ Try again — check with a parent.</Text>
      )}
    </View>
  );
}

export default function ChoresScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);

  const myChores = (kid?.chores ?? []).filter(c => c.assignedKids.includes(id));
  const today = new Date().getDay();
  // Sort: open + auto-today first, then submitted, then done
  const sorted = [...myChores].sort((a, b) => {
    const score = (c: typeof a) => {
      if (c.status === "approved") return 2;
      if (c.status === "submitted") return 1;
      return 0;
    };
    return score(a) - score(b);
  });

  function submit(choreId: string, note: string) {
    dispatch({
      type: "CHORE_SUBMIT_PROOF",
      choreId,
      proof: { kidId: id, note: note || "Done!", submittedAt: nowIso() },
    });
  }

  if (myChores.length === 0) {
    return (
      <ScreenContainer scroll>
        <Text style={styles.title}>✅ My Chores</Text>
        <View style={styles.empty}>
          <Text style={{ fontSize: 64 }}>🧹</Text>
          <Text style={styles.emptyTitle}>All done!</Text>
          <Text style={styles.emptyText}>No chores assigned right now. Enjoy your day! 🎉</Text>
        </View>
      </ScreenContainer>
    );
  }

  const openCount    = myChores.filter(c => c.status === "open").length;
  const urgentCount  = myChores.filter(c => {
    if (!c.autoChore || !c.deadlineTime) return false;
    const diff = timeToMins(c.deadlineTime) - (new Date().getHours() * 60 + new Date().getMinutes());
    return diff > 0 && diff < 60;
  }).length;

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>✅ My Chores</Text>

      {/* Summary bar */}
      {openCount > 0 && (
        <View style={[styles.summaryBar, urgentCount > 0 && styles.summaryBarUrgent]}>
          <Text style={styles.summaryText}>
            {urgentCount > 0
              ? `⚡ ${urgentCount} chore${urgentCount > 1 ? "s" : ""} due soon!`
              : `📋 ${openCount} chore${openCount > 1 ? "s" : ""} to do`}
          </Text>
        </View>
      )}

      {sorted.map(c => (
        <ChoreCard key={c.id} c={c} kidId={id} onSubmit={submit} />
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title:        { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.sm },
  empty:        { alignItems: "center", padding: Spacing.xl, gap: 8 },
  emptyTitle:   { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary },
  emptyText:    { color: Colors.textSecondary, textAlign: "center", fontSize: FontSize.base },

  summaryBar:      { backgroundColor: Colors.primary + "15", borderRadius: Radius.lg, padding: 12, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.primary + "30" },
  summaryBarUrgent:{ backgroundColor: Colors.error + "15", borderColor: Colors.error + "40" },
  summaryText:     { fontWeight: "700", color: Colors.primary, textAlign: "center" },

  card:        { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 10, ...Shadow.sm },
  cardUrgent:  { borderLeftWidth: 4, borderLeftColor: Colors.error, backgroundColor: Colors.error + "05" },
  cardPenalty: { borderLeftWidth: 4, borderLeftColor: "#9CA3AF", opacity: 0.8 },
  cardHeader:  { flexDirection: "row", alignItems: "flex-start", marginBottom: Spacing.sm },
  autoBadge:   { backgroundColor: Colors.primary + "15", borderRadius: Radius.full, width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  autoBadgeText: { fontSize: 14 },

  choreTitle:  { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  choreDesc:   { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  chorePoints: { fontSize: FontSize.sm, color: Colors.success, fontWeight: "700", marginTop: 4 },

  deadlineRow:   { marginBottom: Spacing.sm },
  deadlineText:  { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "600" },
  countdown:     { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "800" },
  penaltyText:   { fontSize: FontSize.sm, color: Colors.error, fontWeight: "600" },
  dayRow:        { flexDirection: "row", gap: 4, marginTop: 6 },
  dayDot:        { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  dayDotActive:  { backgroundColor: Colors.primary },
  dayDotText:    { fontSize: 9, fontWeight: "700", color: Colors.textSecondary },
  dayDotTextActive: { color: "#fff" },

  noteInput:    { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.sm, marginBottom: Spacing.sm },
  submitBtn:    { backgroundColor: Colors.success, borderRadius: Radius.full, alignItems: "center", padding: 12 },
  submitBtnText:{ color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  waitingText:  { color: Colors.warning, fontWeight: "600", textAlign: "center", paddingVertical: 4 },
  approvedText: { color: Colors.success, fontWeight: "700", textAlign: "center", paddingVertical: 4 },
  rejectedText: { color: Colors.error, fontWeight: "600", textAlign: "center", paddingVertical: 4 },
});
