/**
 * Check-In screen — kid side.
 * Kid taps "I'm here!" at a named location. Parent gets a push
 * notification with GPS coordinates and the selected location name.
 */

import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import type { CheckInRequest } from "../../../../lib/data/types";

const PRESETS = [
  { emoji: "🏫", label: "School" },
  { emoji: "🏠", label: "Home" },
  { emoji: "🏋️", label: "Sports / Gym" },
  { emoji: "🍔", label: "Restaurant" },
  { emoji: "🛍️", label: "Mall / Shop" },
  { emoji: "👨‍👩‍👧", label: "Friend's house" },
  { emoji: "🎭", label: "Activity / Club" },
  { emoji: "🌳", label: "Park / Outdoors" },
  { emoji: "🚌", label: "On the bus" },
  { emoji: "📍", label: "Other…" },
];

export default function CheckInScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);

  const [selected, setSelected] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function sendCheckIn() {
    const label = selected === "Other…" ? customLabel.trim() : selected;
    if (!label) return;

    setSending(true);
    let lat: number | undefined;
    let lng: number | undefined;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
    } catch {}

    const request: CheckInRequest = {
      id: uid(),
      kidId: id,
      requestedAt: nowIso(),
      respondedAt: nowIso(),
      status: "safe",
      kidLat: lat,
      kidLng: lng,
    };

    dispatch({ type: "CHECK_IN_REQUEST", kidId: id, request });

    // Push notification to parent
    const preset = PRESETS.find(p => p.label === label);
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${preset?.emoji ?? "📍"} ${kid?.profile.name ?? "Your child"} checked in`,
          body: `At: ${label}${lat ? ` · GPS: ${lat.toFixed(4)}, ${lng?.toFixed(4)}` : ""}`,
          sound: true,
        },
        trigger: null,
      });
    } catch {}

    setSending(false);
    setDone(true);
  }

  if (done) {
    return (
      <ScreenContainer>
        <View style={s.doneBox}>
          <Text style={s.doneEmoji}>✅</Text>
          <Text style={s.doneTitle}>Check-In Sent!</Text>
          <Text style={s.doneSub}>Your parent knows where you are.</Text>
          <TouchableOpacity style={s.doneBtn} onPress={() => { setDone(false); setSelected(null); setCustomLabel(""); }}>
            <Text style={s.doneBtnText}>Check in again</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={s.title}>📍 Check In</Text>
      <Text style={s.sub}>Tell your parent where you are right now.</Text>

      <ScrollView contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
        {PRESETS.map(p => (
          <TouchableOpacity
            key={p.label}
            style={[s.preset, selected === p.label && s.presetSelected]}
            onPress={() => setSelected(p.label)}
          >
            <Text style={s.presetEmoji}>{p.emoji}</Text>
            <Text style={[s.presetLabel, selected === p.label && s.presetLabelSelected]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {selected === "Other…" && (
        <TextInput
          style={s.customInput}
          placeholder="Where are you? (e.g. Library)"
          value={customLabel}
          onChangeText={setCustomLabel}
          maxLength={40}
          autoFocus
        />
      )}

      <TouchableOpacity
        style={[s.sendBtn, (!selected || (selected === "Other…" && !customLabel.trim())) && s.sendBtnDisabled]}
        onPress={sendCheckIn}
        disabled={!selected || (selected === "Other…" && !customLabel.trim()) || sending}
      >
        {sending
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.sendText}>📤 Send Check-In to Parent</Text>
        }
      </TouchableOpacity>

      <Text style={s.gpsNote}>
        📡 GPS location will be included if you allow location access.
      </Text>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: Spacing.md },
  preset: {
    width: "30%", aspectRatio: 1, borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceLight, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: Colors.border, gap: 4,
  },
  presetSelected: { borderColor: Colors.primary, backgroundColor: "#EDE9FE" },
  presetEmoji: { fontSize: 28 },
  presetLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: "center" },
  presetLabelSelected: { color: Colors.primary, fontWeight: "700" },
  customInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    padding: Spacing.sm, fontSize: FontSize.base, marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
  },
  sendBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.xl,
    padding: Spacing.md, alignItems: "center", marginVertical: Spacing.sm,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  gpsNote: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "center" },
  doneBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  doneEmoji: { fontSize: 72 },
  doneTitle: { fontSize: FontSize.xxl, fontWeight: "900", color: "#16A34A" },
  doneSub: { fontSize: FontSize.base, color: Colors.textSecondary },
  doneBtn: { backgroundColor: Colors.primary, borderRadius: Radius.xl, paddingHorizontal: 32, paddingVertical: 12, marginTop: 8 },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
});
