import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso } from "../../../lib/utils";
import { CameraWatchSession } from "../../../lib/data/types";

export default function ParentWatchScreen() {
  const { state, dispatch } = useData();
  const [starting, setStarting] = useState<string | null>(null);

  async function startWatch(kidId: string, kidName: string) {
    setStarting(kidId);

    const session: CameraWatchSession = {
      id: uid(),
      hostKidId: kidId,
      sensitivity: "medium",
      facing: "front",
      notificationsEnabled: true,
      active: true,
      startedAt: nowIso(),
    };

    dispatch({ type: "CAMERA_WATCH_START", kidId, session });

    // Notify the kid
    dispatch({
      type: "NOTIFICATION_ADD",
      kidId,
      notification: {
        id: uid(),
        kidId,
        kind: "ping",
        title: "👁️ Check-in Request",
        body: `${state.parent.name} wants to check on you. Open Camera Watch to send a selfie!`,
        read: false,
        createdAt: nowIso(),
      },
    });

    // Also send a family message
    dispatch({
      type: "FAMILY_CHAT_PUSH",
      message: {
        id: uid(),
        authorId: "parent",
        authorName: state.parent.name,
        text: `👁️ Hey ${kidName}, can you send me a check-in photo? Open the Camera Watch screen 📷`,
        sentAt: nowIso(),
        recipients: [],
        readBy: [],
      },
    });

    setTimeout(() => setStarting(null), 1000);
  }

  function stopWatch(kidId: string) {
    Alert.alert("End Camera Watch?", "This will stop the check-in session.", [
      { text: "Cancel", style: "cancel" },
      { text: "End Watch", style: "destructive", onPress: () => {
        dispatch({ type: "CAMERA_WATCH_STOP", kidId });
      }},
    ]);
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>👁️ Camera Watch</Text>
      <Text style={styles.sub}>Request a check-in from your kids. They'll get a notification to send you a selfie photo so you know they're safe.</Text>

      {state.kids.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 52 }}>👁️</Text>
          <Text style={styles.emptyText}>No kids added yet</Text>
        </View>
      ) : (
        state.kids.map(kid => {
          const session = kid.cameraWatchSession;
          const isActive = session?.active ?? false;
          const isStarting = starting === kid.profile.id;

          // Get recent check-in photos from family messages
          const recentCheckIn = state.familyMessages
            .filter(m => m.authorId === kid.profile.id && m.text?.includes("Check-in"))
            .sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];

          return (
            <View key={kid.profile.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.kidInfo}>
                  <Text style={{ fontSize: 28 }}>👤</Text>
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.kidName}>{kid.profile.name}</Text>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: isActive ? Colors.success : Colors.textMuted }]} />
                      <Text style={[styles.statusText, { color: isActive ? Colors.success : Colors.textMuted }]}>
                        {isActive ? "Watch Active" : "Inactive"}
                      </Text>
                    </View>
                  </View>
                </View>

                {isActive ? (
                  <TouchableOpacity style={styles.stopBtn} onPress={() => stopWatch(kid.profile.id)}>
                    <Text style={styles.stopBtnText}>End Watch</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.startBtn, isStarting && { opacity: 0.6 }]}
                    onPress={() => startWatch(kid.profile.id, kid.profile.name)}
                    disabled={isStarting}
                  >
                    <Text style={styles.startBtnText}>{isStarting ? "Sending…" : "Check In 👁️"}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {isActive && (
                <View style={styles.activeInfo}>
                  <Text style={styles.activeInfoText}>
                    🔔 {kid.profile.name} has been notified to send you a selfie. Check Family Chat for their photo!
                  </Text>
                </View>
              )}

              {recentCheckIn && (
                <View style={styles.lastCheckIn}>
                  <Text style={styles.lastCheckInLabel}>Last check-in</Text>
                  <Text style={styles.lastCheckInText}>
                    {new Date(recentCheckIn.sentAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              )}
            </View>
          );
        })
      )}

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>💡 How it works</Text>
        <Text style={styles.infoText}>• Tap "Check In" to send your kid a notification</Text>
        <Text style={styles.infoText}>• They open Camera Watch and take a selfie to send back</Text>
        <Text style={styles.infoText}>• The photo appears in Family Chat and the shared Album</Text>
        <Text style={styles.infoText}>• Works even when the kid's screen is locked (notification)</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
  empty: { alignItems: "center", paddingVertical: Spacing.xl, gap: 12 },
  emptyText: { fontSize: FontSize.base, color: Colors.textSecondary },
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 10, ...Shadow.sm },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kidInfo: { flexDirection: "row", alignItems: "center" },
  kidName: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: FontSize.xs, fontWeight: "600" },
  startBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8, ...Shadow.sm },
  startBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  stopBtn: { backgroundColor: Colors.error + "15", borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8 },
  stopBtnText: { color: Colors.error, fontWeight: "700", fontSize: FontSize.sm },
  activeInfo: { backgroundColor: Colors.success + "12", borderRadius: Radius.md, padding: 10, marginTop: 10 },
  activeInfoText: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 18 },
  lastCheckIn: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  lastCheckInLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: "600" },
  lastCheckInText: { fontSize: FontSize.xs, color: Colors.textPrimary },
  infoCard: { backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md, gap: 6 },
  infoTitle: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textPrimary, marginBottom: 4 },
  infoText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
});
