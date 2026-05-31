import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useData } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import type { CoParentScheduleEvent } from "../../../../lib/data/types";

const EVENT_LABELS: Record<string, { label: string; emoji: string }> = {
  pickup:       { label: "Pickup",       emoji: "🚗" },
  dropoff:      { label: "Drop-off",     emoji: "📍" },
  school_drop:  { label: "School Drop",  emoji: "🏫" },
  quality_time: { label: "Quality Time", emoji: "💛" },
  work:         { label: "Work",         emoji: "💼" },
  custom:       { label: "Event",        emoji: "📅" },
};

function daysFromNow(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function relativeLabel(dateStr: string): string {
  const diff = daysFromNow(dateStr);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  if (diff < 0) return `${-diff} days ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function fmt12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export default function ParentScheduleKidScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useData();

  const shareEnabled = state.parentSettings?.shareScheduleWithKids !== false;
  const allEvents: CoParentScheduleEvent[] = state.coParentSchedule ?? [];

  const events = allEvents
    .filter(e =>
      e.shareWithKids &&
      e.status !== "cancelled" &&
      (e.kidIds === undefined || e.kidIds.length === 0 || e.kidIds.includes(id))
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const upcoming = events.filter(e => daysFromNow(e.date) >= 0);
  const past     = events.filter(e => daysFromNow(e.date) < 0);

  if (!shareEnabled) {
    return (
      <ScreenContainer>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyTitle}>Schedule not available</Text>
          <Text style={styles.emptySub}>Your parent hasn't shared the schedule yet.</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>📅 My Schedule</Text>
      <Text style={styles.sub}>Upcoming pickups, drop-offs and events from your parents.</Text>

      {upcoming.length === 0 && past.length === 0 && (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>🌟</Text>
          <Text style={styles.emptyTitle}>Nothing scheduled yet</Text>
          <Text style={styles.emptySub}>Your parents will add pickups and events here.</Text>
        </View>
      )}

      {upcoming.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>UPCOMING</Text>
          {upcoming.map(ev => <EventCard key={ev.id} ev={ev} />)}
        </>
      )}

      {past.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: Spacing.md }]}>PAST</Text>
          {past.map(ev => <EventCard key={ev.id} ev={ev} faded />)}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScreenContainer>
  );
}

function EventCard({ ev, faded }: { ev: CoParentScheduleEvent; faded?: boolean }) {
  const info = EVENT_LABELS[ev.type] ?? { label: ev.customLabel ?? "Event", emoji: "📅" };
  const rel  = relativeLabel(ev.date);
  const isToday = daysFromNow(ev.date) === 0;

  return (
    <View style={[styles.card, faded && styles.cardFaded, isToday && styles.cardToday]}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardEmoji}>{info.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={[styles.cardTitle, faded && styles.fadedText]}>
            {ev.customLabel || info.label}
          </Text>
          {isToday && <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>Today!</Text></View>}
        </View>
        <Text style={[styles.cardTime, faded && styles.fadedText]}>
          {rel} · {fmt12(ev.time)}{ev.endTime ? ` – ${fmt12(ev.endTime)}` : ""}
        </Text>
        {ev.notes ? <Text style={styles.cardNotes}>{ev.notes}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: "800", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },

  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "flex-start", gap: 12, ...Shadow.sm },
  cardToday: { borderWidth: 2, borderColor: Colors.primary, backgroundColor: Colors.primary + "08" },
  cardFaded: { opacity: 0.55 },
  cardLeft: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  cardEmoji: { fontSize: 20 },
  cardTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  cardTime: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  cardNotes: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, fontStyle: "italic" },
  fadedText: { color: Colors.textSecondary },
  todayBadge: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  todayBadgeText: { fontSize: FontSize.xs, fontWeight: "800", color: "#fff" },

  emptyWrap: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
});
