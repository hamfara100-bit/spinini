import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, SectionList,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Mascot } from "../../../components/mascot";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { PASTEL_COLORS } from "../../../lib/data/types";
import type { KidNotification } from "../../../lib/data/types";

const KIND_EMOJI: Record<KidNotification["kind"], string> = {
  chore_approved:      "✅",
  chore_rejected:      "❌",
  story:               "🌙",
  advice:              "💎",
  ping:                "📣",
  lock:                "🔒",
  wish_decision:       "🌟",
  achievement_awarded: "🏆",
  workout_approved:    "💪",
  stranger_alert:      "🚨",
  smart_screen_time:   "⏱️",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

function groupKey(iso: string) {
  return new Date(iso).toDateString();
}

export default function ParentNotificationsScreen() {
  const { state, dispatch } = useData();

  // All kids' notifications merged with kid info, newest first
  const allNotifs = useMemo(() => {
    const items: (KidNotification & { kidName: string; kidMascot: string; kidColor: string })[] = [];
    for (const kid of state.kids) {
      for (const n of kid.notifications) {
        items.push({ ...n, kidName: kid.profile.name, kidMascot: kid.profile.mascot, kidColor: kid.profile.color });
      }
    }
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [state.kids]);

  // Available date strings for filter chips
  const availableDates = useMemo(() => {
    const seen = new Set<string>();
    const dates: { key: string; label: string }[] = [];
    for (const n of allNotifs) {
      const key = groupKey(n.createdAt);
      if (!seen.has(key)) { seen.add(key); dates.push({ key, label: formatDate(n.createdAt) }); }
    }
    return dates;
  }, [allNotifs]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedKid, setSelectedKid] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = allNotifs;
    if (selectedDate) list = list.filter(n => groupKey(n.createdAt) === selectedDate);
    if (selectedKid)  list = list.filter(n => n.kidId === selectedKid);
    return list;
  }, [allNotifs, selectedDate, selectedKid]);

  // Group into SectionList sections by date
  const sections = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const n of filtered) {
      const key = groupKey(n.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    return Array.from(map.entries()).map(([key, data]) => ({
      title: formatDate(data[0].createdAt),
      data,
    }));
  }, [filtered]);

  const totalUnread = allNotifs.filter(n => !n.read).length;

  function deleteOne(kidId: string, notifId: string) {
    dispatch({ type: "NOTIFICATION_DELETE", kidId, notifId });
  }

  function clearKid(kidId: string, kidName: string) {
    Alert.alert(
      `Clear ${kidName}'s notifications`,
      "This will delete all notifications for this kid. Cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear All", style: "destructive", onPress: () => dispatch({ type: "NOTIFICATION_CLEAR_ALL", kidId }) },
      ]
    );
  }

  function clearAll() {
    Alert.alert(
      "Clear All Notifications",
      "Delete all notifications from all kids? Cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All", style: "destructive",
          onPress: () => state.kids.forEach(k => dispatch({ type: "NOTIFICATION_CLEAR_ALL", kidId: k.profile.id })),
        },
      ]
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🔔 Notifications</Text>
          <Text style={styles.sub}>
            {totalUnread > 0 ? `${totalUnread} unread across all kids` : "All caught up"}
          </Text>
        </View>
        {allNotifs.length > 0 && (
          <TouchableOpacity style={styles.clearAllBtn} onPress={clearAll}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Kid filter chips */}
      {state.kids.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kidChipRow} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
          <TouchableOpacity
            style={[styles.kidChip, !selectedKid && styles.kidChipActive]}
            onPress={() => setSelectedKid(null)}
          >
            <Text style={[styles.kidChipText, !selectedKid && styles.kidChipTextActive]}>All</Text>
          </TouchableOpacity>
          {state.kids.map(kid => (
            <TouchableOpacity
              key={kid.profile.id}
              style={[styles.kidChip, selectedKid === kid.profile.id && styles.kidChipActive, { backgroundColor: selectedKid === kid.profile.id ? Colors.primary : PASTEL_COLORS[kid.profile.color] + "80" }]}
              onPress={() => setSelectedKid(selectedKid === kid.profile.id ? null : kid.profile.id)}
            >
              <Text style={styles.kidChipEmoji}>{kid.profile.name.charAt(0)}</Text>
              <Text style={[styles.kidChipText, selectedKid === kid.profile.id && styles.kidChipTextActive]}>
                {kid.profile.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Date filter chips */}
      {availableDates.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateChipRow} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
          <TouchableOpacity
            style={[styles.dateChip, !selectedDate && styles.dateChipActive]}
            onPress={() => setSelectedDate(null)}
          >
            <Text style={[styles.dateChipText, !selectedDate && styles.dateChipTextActive]}>All dates</Text>
          </TouchableOpacity>
          {availableDates.map(d => (
            <TouchableOpacity
              key={d.key}
              style={[styles.dateChip, selectedDate === d.key && styles.dateChipActive]}
              onPress={() => setSelectedDate(selectedDate === d.key ? null : d.key)}
            >
              <Text style={[styles.dateChipText, selectedDate === d.key && styles.dateChipTextActive]}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Per-kid clear buttons */}
      {selectedKid && (
        <TouchableOpacity
          style={styles.clearKidBtn}
          onPress={() => {
            const kid = state.kids.find(k => k.profile.id === selectedKid);
            if (kid) clearKid(selectedKid, kid.profile.name);
          }}
        >
          <Text style={styles.clearKidText}>🗑 Clear {state.kids.find(k => k.profile.id === selectedKid)?.profile.name}'s notifications</Text>
        </TouchableOpacity>
      )}

      {/* Notification list */}
      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 48 }}>🔕</Text>
          <Text style={styles.emptyText}>No notifications</Text>
          <Text style={styles.emptySub}>Notifications sent to kids will appear here</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionLine} />
            </View>
          )}
          renderItem={({ item }) => (
            <NotifCard
              notif={item}
              onDelete={() => deleteOne(item.kidId, item.id)}
            />
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </ScreenContainer>
  );
}

function NotifCard({ notif, onDelete }: {
  notif: KidNotification & { kidName: string; kidColor: string };
  onDelete: () => void;
}) {
  const time = new Date(notif.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  function confirmDelete() {
    Alert.alert("Delete notification", "Remove this notification?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onDelete },
    ]);
  }

  return (
    <View style={[styles.card, !notif.read && styles.cardUnread]}>
      {!notif.read && <View style={styles.unreadDot} />}
      <View style={styles.cardIcon}>
        <Text style={styles.kindEmoji}>{KIND_EMOJI[notif.kind] ?? "🔔"}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle}>{notif.title}</Text>
          <Text style={styles.cardTime}>{time}</Text>
        </View>
        <Text style={styles.cardBody} numberOfLines={2}>{notif.body}</Text>
        <Text style={styles.kidTag}>👤 {notif.kidName}</Text>
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={confirmDelete}>
        <Text style={styles.deleteBtnText}>🗑</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: Spacing.md },
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  clearAllBtn: { backgroundColor: Colors.error + "15", borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 6 },
  clearAllText: { color: Colors.error, fontWeight: "700", fontSize: FontSize.sm },
  kidChipRow: { marginBottom: 10, flexGrow: 0 },
  kidChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.cardLight },
  kidChipActive: { backgroundColor: Colors.primary },
  kidChipEmoji: { fontSize: 14, fontWeight: "800" },
  kidChipText: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  kidChipTextActive: { color: "#fff" },
  dateChipRow: { marginBottom: 10, flexGrow: 0 },
  dateChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.cardLight },
  dateChipActive: { backgroundColor: Colors.primary },
  dateChipText: { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textSecondary },
  dateChipTextActive: { color: "#fff" },
  clearKidBtn: { backgroundColor: Colors.error + "10", borderRadius: Radius.md, padding: 10, alignItems: "center", marginBottom: 10 },
  clearKidText: { color: Colors.error, fontWeight: "700", fontSize: FontSize.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 10 },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: "800", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  sectionLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  card: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: 8, ...Shadow.sm, position: "relative",
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: Colors.primary },
  unreadDot: { position: "absolute", top: 12, left: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary },
  cardIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  kindEmoji: { fontSize: 20 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary, flex: 1 },
  cardTime: { fontSize: 11, color: Colors.textMuted, marginLeft: 8 },
  cardBody: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2, lineHeight: 18 },
  kidTag: { fontSize: 11, color: Colors.textMuted, marginTop: 4, fontWeight: "600" },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 18 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },
});
