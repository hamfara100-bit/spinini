import React, { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { uid, nowIso } from "../../../lib/utils";
import { Colors, FontSize, Radius, Spacing } from "../../../lib/theme";
import { ScreenContainer } from "../../../components/screen-container";
import { Mascot } from "../../../components/mascot";
import { useColors } from "../../../hooks/use-colors";

export default function ParentFindPhoneScreen() {
  const { state, dispatch } = useData();
  const C = useColors();
  const [sentTo, setSentTo] = useState<string | null>(null);

  function triggerFindKidPhone(kidId: string, kidName: string) {
    Alert.alert(
      `📱 Find ${kidName}'s Phone`,
      `This will send a LOUD alarm and forced vibration to ${kidName}'s device. It cannot be silenced until they tap "I Got It!".`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Alarm", style: "destructive", onPress: () => {
            dispatch({
              type: "NOTIFICATION_ADD",
              kidId,
              notification: {
                id: uid(),
                kidId,
                kind: "ping",
                title: "📱 Find My Phone",
                body: "FIND MY PHONE! 📱 Ring Ring Ring!",
                emoji: "📱",
                read: false,
                createdAt: nowIso(),
                alarmMode: true,
                soundLevel: "high",
                forceVibrate: true,
              },
            });
            setSentTo(kidId);
            setTimeout(() => setSentTo(null), 4000);
          },
        },
      ]
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>📱</Text>
        <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Find a Phone</Text>
        <Text style={[styles.headerSub, { color: C.textSecondary }]}>
          Trigger a loud alarm + vibration on any device to locate it
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: 100 }}>

        {/* ── Parent's own phone section ───────────────────────── */}
        <View style={[styles.infoBox, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={styles.infoEmoji}>ℹ️</Text>
          <Text style={[styles.infoText, { color: C.textSecondary }]}>
            Kids can ring your phone from their <Text style={{ fontWeight: "700" }}>Find a Phone</Text> screen.
            The alarm will appear over whatever you're doing.
          </Text>
        </View>

        {/* ── Ring a kid's phone ───────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: C.textPrimary }]}>
          Ring a Kid's Phone
        </Text>

        {state.kids.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: C.surface }]}>
            <Text style={styles.emptyEmoji}>👶</Text>
            <Text style={[styles.emptyText, { color: C.textSecondary }]}>
              No kids added yet. Add a kid profile first.
            </Text>
          </View>
        ) : (
          state.kids.map(k => {
            const justSent = sentTo === k.profile.id;
            return (
              <View key={k.profile.id} style={[styles.kidCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <View style={styles.kidRow}>
                  <Mascot type={k.profile.mascot} size={36} animate={false} />
                  <View style={styles.kidInfo}>
                    <Text style={[styles.kidName, { color: C.textPrimary }]}>{k.profile.name}</Text>
                    <Text style={[styles.kidAge, { color: C.textSecondary }]}>Age {k.profile.age}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.ringBtn, justSent && styles.ringBtnSent]}
                    onPress={() => triggerFindKidPhone(k.profile.id, k.profile.name)}
                  >
                    <Text style={styles.ringBtnText}>
                      {justSent ? "✅ Sent!" : "📳 Ring Phone"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {/* ── How it works ──────────────────────────────────────── */}
        <View style={[styles.howBox, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.howTitle, { color: C.textPrimary }]}>How It Works</Text>
          <Text style={[styles.howItem, { color: C.textSecondary }]}>📳  Forces maximum volume — bypasses silent mode</Text>
          <Text style={[styles.howItem, { color: C.textSecondary }]}>🔊  Plays a continuous loud alarm tone</Text>
          <Text style={[styles.howItem, { color: C.textSecondary }]}>📲  Overlays the whole screen — can't be ignored</Text>
          <Text style={[styles.howItem, { color: C.textSecondary }]}>✅  Kid must tap "I Got It!" to stop the alarm</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", paddingVertical: Spacing.xl },
  headerEmoji: { fontSize: 56 },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: "800", marginTop: 8 },
  headerSub: { fontSize: FontSize.sm, marginTop: 4, textAlign: "center", paddingHorizontal: Spacing.lg },
  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.lg,
  },
  infoEmoji: { fontSize: 20, marginTop: 2 },
  infoText: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },
  sectionLabel: { fontSize: FontSize.md, fontWeight: "800", marginBottom: Spacing.sm },
  emptyBox: { borderRadius: Radius.xl, padding: Spacing.xl, alignItems: "center", marginBottom: 20 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyText: { textAlign: "center", fontSize: FontSize.sm },
  kidCard: {
    borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.md, marginBottom: 12,
  },
  kidRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  kidAvatar: { fontSize: 36 },
  kidInfo: { flex: 1 },
  kidName: { fontSize: FontSize.md, fontWeight: "700" },
  kidAge: { fontSize: FontSize.sm, marginTop: 2 },
  ringBtn: {
    backgroundColor: Colors.error, borderRadius: Radius.lg,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  ringBtnSent: { backgroundColor: Colors.success },
  ringBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  howBox: {
    borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.md, marginTop: Spacing.lg, gap: 8,
  },
  howTitle: { fontSize: FontSize.md, fontWeight: "800", marginBottom: 4 },
  howItem: { fontSize: FontSize.sm, lineHeight: 22 },
});
