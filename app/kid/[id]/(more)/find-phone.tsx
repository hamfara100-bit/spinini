import React, { useState } from "react";
import {
  View, Text, TouchableOpacity,
  StyleSheet, Alert, Animated,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { Colors, FontSize, Radius, Spacing } from "../../../../lib/theme";
import { ScreenContainer } from "../../../../components/screen-container";
import { useColors } from "../../../../hooks/use-colors";

export default function KidFindPhoneScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useData();
  const kid = useKid(id ?? "");
  const C = useColors();
  const [sent, setSent] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  function startPulse() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0,  duration: 400, useNativeDriver: true }),
      ])
    ).start();
  }

  function triggerParentAlarm() {
    const parentName = state.parentSettings.name || "Parent";
    Alert.alert(
      "📱 Ring Parent's Phone?",
      `This will send a LOUD alarm to ${parentName}'s phone so they can find it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Ring It! 📳", onPress: () => {
            dispatch({
              type: "FIND_PHONE_TRIGGER_PARENT",
              kidId: id ?? "",
              kidName: kid?.profile.name ?? "Your child",
            });
            setSent(true);
            startPulse();
            setTimeout(() => { setSent(false); Animated.timing(pulseAnim, { toValue: 1, duration: 100, useNativeDriver: true }).stop(); }, 10000);
          },
        },
      ]
    );
  }

  const parentName = state.parentSettings.name || "Parent";

  return (
    <ScreenContainer>
      <View style={styles.page}>
        {/* Icon */}
        <View style={styles.iconWrap}>
          <Text style={styles.iconEmoji}>📱</Text>
        </View>

        <Text style={[styles.title, { color: C.textPrimary }]}>Find a Phone</Text>
        <Text style={[styles.sub, { color: C.textSecondary }]}>
          Can't find {parentName}'s phone?{"\n"}Ring it and make it loud!
        </Text>

        {/* Big ring button */}
        <Animated.View style={[styles.bigBtnWrap, { transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity
            style={[styles.bigBtn, sent && styles.bigBtnSent]}
            onPress={triggerParentAlarm}
            activeOpacity={0.85}
          >
            <Text style={styles.bigBtnEmoji}>{sent ? "✅" : "📳"}</Text>
            <Text style={styles.bigBtnText}>
              {sent ? "Alarm Sent!" : `Ring ${parentName}'s Phone`}
            </Text>
            {sent && <Text style={styles.bigBtnSub}>The alarm is ringing on their phone!</Text>}
          </TouchableOpacity>
        </Animated.View>

        {/* Info */}
        <View style={[styles.howBox, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[styles.howTitle, { color: C.textPrimary }]}>What happens?</Text>
          <Text style={[styles.howItem, { color: C.textSecondary }]}>🔊  A LOUD alarm plays on their phone</Text>
          <Text style={[styles.howItem, { color: C.textSecondary }]}>📳  It vibrates really hard</Text>
          <Text style={[styles.howItem, { color: C.textSecondary }]}>📲  They must tap "Found It!" to stop it</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", paddingHorizontal: Spacing.md, paddingTop: Spacing.xl },
  iconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.primary + "18",
    alignItems: "center", justifyContent: "center", marginBottom: Spacing.md,
  },
  iconEmoji: { fontSize: 52 },
  title: { fontSize: FontSize.xxl, fontWeight: "800", textAlign: "center", marginBottom: 8 },
  sub: { fontSize: FontSize.sm, textAlign: "center", lineHeight: 22, marginBottom: Spacing.xl },
  bigBtnWrap: { width: "100%", marginBottom: Spacing.xl },
  bigBtn: {
    backgroundColor: Colors.error, borderRadius: Radius.xxl,
    paddingVertical: 28, alignItems: "center", gap: 6,
  },
  bigBtnSent: { backgroundColor: Colors.success },
  bigBtnEmoji: { fontSize: 48 },
  bigBtnText: { color: "#fff", fontSize: FontSize.xl, fontWeight: "800" },
  bigBtnSub: { color: "rgba(255,255,255,0.85)", fontSize: FontSize.sm },
  howBox: {
    width: "100%", borderRadius: Radius.xl, borderWidth: 1,
    padding: Spacing.md, gap: 8,
  },
  howTitle: { fontSize: FontSize.md, fontWeight: "800", marginBottom: 4 },
  howItem: { fontSize: FontSize.sm, lineHeight: 22 },
});
