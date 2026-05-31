import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Platform, ScrollView,
} from "react-native";
import * as Network from "expo-network";
import { useLocalSearchParams } from "expo-router";
import { useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Spacing } from "../../../../lib/theme";
import {
  startHostSession, stopHostSession, onCommandReceived,
  onSessionStateChanged, requestScreenCapturePermission,
  isScreenCaptureAvailable,
} from "../../../../modules/expo-remote-control/src/index";
import {
  makeSessionId, DEFAULT_FRAME_INFO,
} from "../../../../lib/remote-session";
import type { ConnectionState, RemoteCommand } from "../../../../modules/expo-remote-control/src/types";

type Screen = "setup" | "permission" | "waiting" | "active" | "ended";

export default function RemoteSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const kid = useKid(id);

  const [screen, setScreen] = useState<Screen>("setup");
  const [sessionCode, setSessionCode] = useState("");
  const [connState, setConnState] = useState<ConnectionState>("idle");
  const [deviceIp, setDeviceIp] = useState<string | null>(null);
  const [captureAvailable, setCaptureAvailable] = useState<boolean | null>(null);
  const [commandLog, setCommandLog] = useState<string[]>([]);
  const [sessionDuration, setSessionDuration] = useState(0);

  const unsubs = useRef<Array<() => void>>([]);
  const timer = useRef<any>(null);
  const startTime = useRef<number>(0);

  useEffect(() => {
    // Get device IP for display
    Network.getIpAddressAsync().then(ip => setDeviceIp(ip)).catch(() => {});
    // Check if screen capture is possible
    isScreenCaptureAvailable().then(setCaptureAvailable);

    return () => {
      unsubs.current.forEach(f => f());
      clearInterval(timer.current);
      stopHostSession().catch(() => {});
    };
  }, []);

  function logCommand(cmd: RemoteCommand) {
    const desc = cmd.type === "touch"
      ? `Touch ${cmd.touch?.type} at (${((cmd.touch?.x ?? 0) * 100).toFixed(0)}%, ${((cmd.touch?.y ?? 0) * 100).toFixed(0)}%)`
      : cmd.type === "key" ? `Key ${cmd.keyCode}`
      : cmd.type === "scroll" ? `Scroll Δ(${cmd.scrollDeltaX?.toFixed(0)}, ${cmd.scrollDeltaY?.toFixed(0)})`
      : `Action: ${cmd.type}`;
    setCommandLog(log => [desc, ...log.slice(0, 19)]);
  }

  async function requestPermission() {
    setScreen("permission");
    if (Platform.OS === "android") {
      const granted = await requestScreenCapturePermission();
      if (granted) {
        setScreen("waiting");
      } else {
        setScreen("setup");
        Alert.alert("Permission Required", "Screen capture permission is needed to share your screen with a parent.");
      }
    } else {
      // iOS — permission is requested during startHostSession via ReplayKit
      setScreen("waiting");
    }
  }

  async function startSession() {
    if (!sessionCode.trim() || sessionCode.length !== 6) {
      Alert.alert("Enter the 6-digit session code shown on the parent's device.");
      return;
    }

    const sessionId = makeSessionId(sessionCode.trim(), id);
    const ok = await startHostSession(sessionId, DEFAULT_FRAME_INFO);
    if (!ok) {
      Alert.alert("Failed to start", "Could not start screen sharing. Make sure screen capture permission is granted.");
      setScreen("setup");
      return;
    }

    // Subscribe to events
    const u1 = onSessionStateChanged(s => {
      setConnState(s);
      if (s === "connected") {
        setScreen("active");
        startTime.current = Date.now();
        timer.current = setInterval(() => {
          setSessionDuration(Math.floor((Date.now() - startTime.current) / 1000));
        }, 1000);
      }
      if (s === "disconnected" || s === "error") {
        setScreen("ended");
        clearInterval(timer.current);
      }
    });

    const u2 = onCommandReceived(cmd => {
      logCommand(cmd);
    });

    unsubs.current = [u1, u2];
  }

  async function endSession() {
    Alert.alert(
      "End Remote Session",
      "Stop sharing your screen with the parent?",
      [
        { text: "Keep Sharing", style: "cancel" },
        {
          text: "End Session", style: "destructive",
          onPress: async () => {
            await stopHostSession();
            unsubs.current.forEach(f => f());
            unsubs.current = [];
            clearInterval(timer.current);
            setScreen("ended");
            setConnState("disconnected");
          },
        },
      ]
    );
  }

  function formatDuration(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  // ─── SETUP ────────────────────────────────────────────────────────────────────
  if (screen === "setup") {
    return (
      <ScreenContainer scroll>
        <View style={styles.hero}>
          <Text style={{ fontSize: 56 }}>📱</Text>
          <Text style={styles.heroTitle}>Remote Session</Text>
          <Text style={styles.heroSub}>Let a parent view and control this device</Text>
        </View>

        {captureAvailable === false && (
          <View style={styles.warnCard}>
            <Text style={styles.warnText}>
              ⚠️ Screen capture is not available on this device or OS version. Android 5.0+ or iOS 11+ required.
            </Text>
          </View>
        )}

        {/* IP address for parent */}
        {deviceIp && (
          <View style={styles.ipCard}>
            <Text style={styles.ipLabel}>This device's IP address</Text>
            <Text style={styles.ipValue}>{deviceIp}</Text>
            <Text style={styles.ipHint}>Give this to the parent so they can connect on the same WiFi</Text>
          </View>
        )}

        {/* Session code input */}
        <Text style={styles.sectionLabel}>Parent's Session Code</Text>
        <TextInput
          style={styles.codeInput}
          placeholder="Enter 6-digit code"
          value={sessionCode}
          onChangeText={t => setSessionCode(t.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          placeholderTextColor={Colors.textMuted}
          textAlign="center"
        />

        <TouchableOpacity
          style={[styles.startBtn, (!sessionCode || sessionCode.length < 6 || captureAvailable === false) && styles.startBtnDisabled]}
          onPress={requestPermission}
          disabled={!sessionCode || sessionCode.length < 6 || captureAvailable === false}
        >
          <Text style={styles.startBtnText}>Start Screen Sharing →</Text>
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What happens when you share?</Text>
          <Text style={styles.infoText}>• Your parent can see everything on your screen in real time</Text>
          <Text style={styles.infoText}>• They can tap and control the device remotely</Text>
          <Text style={styles.infoText}>• You will see a red banner at the top while sharing is active</Text>
          <Text style={styles.infoText}>• You can end the session at any time</Text>
        </View>
      </ScreenContainer>
    );
  }

  // ─── PERMISSION ───────────────────────────────────────────────────────────────
  if (screen === "permission") {
    return (
      <ScreenContainer>
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.permText}>Requesting screen capture permission…</Text>
          <Text style={styles.permSub}>A system dialog will appear. Tap "Start now" to allow.</Text>
        </View>
      </ScreenContainer>
    );
  }

  // ─── WAITING FOR PARENT ───────────────────────────────────────────────────────
  if (screen === "waiting") {
    return (
      <ScreenContainer>
        <View style={styles.centerFill}>
          <View style={styles.waitingPulse}>
            <Text style={{ fontSize: 48 }}>📡</Text>
          </View>
          <Text style={styles.waitingTitle}>Ready to share!</Text>
          <Text style={styles.waitingSub}>Waiting for {kid?.profile.name ? "parent" : "a parent"} to connect…</Text>

          <View style={styles.sessionInfoCard}>
            <Text style={styles.sessionInfoLabel}>Session code</Text>
            <Text style={styles.sessionInfoCode}>{sessionCode}</Text>
            {deviceIp && (
              <>
                <Text style={[styles.sessionInfoLabel, { marginTop: 8 }]}>Device IP</Text>
                <Text style={styles.sessionInfoCode}>{deviceIp}</Text>
              </>
            )}
          </View>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={async () => {
              await stopHostSession();
              setScreen("setup");
            }}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // ─── ACTIVE SESSION ───────────────────────────────────────────────────────────
  if (screen === "active") {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bgLight }}>
        {/* Red active banner */}
        <View style={styles.activeBanner}>
          <View style={styles.recordDot} />
          <Text style={styles.activeBannerText}>
            🔴 Parent is viewing your screen — {formatDuration(sessionDuration)}
          </Text>
          <TouchableOpacity onPress={endSession} style={styles.stopBtn}>
            <Text style={styles.stopBtnText}>Stop</Text>
          </TouchableOpacity>
        </View>

        {/* Command log */}
        <ScrollView style={styles.logArea} contentContainerStyle={{ padding: 12 }}>
          <Text style={styles.logTitle}>Recent parent actions:</Text>
          {commandLog.length === 0 ? (
            <Text style={styles.logEmpty}>No actions yet</Text>
          ) : (
            commandLog.map((entry, i) => (
              <Text key={i} style={styles.logEntry}>• {entry}</Text>
            ))
          )}
        </ScrollView>

        <View style={styles.sessionFooter}>
          <Text style={styles.footerText}>
            Session active · {formatDuration(sessionDuration)} elapsed
          </Text>
          <TouchableOpacity style={styles.endBtn} onPress={endSession}>
            <Text style={styles.endBtnText}>End Session</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── ENDED ────────────────────────────────────────────────────────────────────
  return (
    <ScreenContainer>
      <View style={styles.centerFill}>
        <Text style={{ fontSize: 56 }}>✅</Text>
        <Text style={styles.endedTitle}>Session Ended</Text>
        <Text style={styles.endedSub}>Screen sharing has stopped. Duration: {formatDuration(sessionDuration)}</Text>
        <TouchableOpacity
          style={styles.startBtn}
          onPress={() => { setScreen("setup"); setSessionCode(""); setCommandLog([]); setSessionDuration(0); }}
        >
          <Text style={styles.startBtnText}>New Session</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingVertical: Spacing.xl, gap: 8 },
  heroTitle: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  heroSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  warnCard: { backgroundColor: Colors.warning + "15", borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 14 },
  warnText: { fontSize: FontSize.sm, color: Colors.warning, lineHeight: 20 },
  ipCard: { backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: Spacing.md, alignItems: "center", marginBottom: 16, gap: 4 },
  ipLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: "600", textTransform: "uppercase" },
  ipValue: { fontSize: 28, fontWeight: "900", color: Colors.primary, letterSpacing: 2 },
  ipHint: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "center" },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  codeInput: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: 18, fontSize: 32, fontWeight: "900", color: Colors.primary, letterSpacing: 8, marginBottom: 16, borderWidth: 2, borderColor: Colors.primary + "40" },
  startBtn: { backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: 16, alignItems: "center", marginBottom: 16 },
  startBtnDisabled: { opacity: 0.5 },
  startBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },
  infoCard: { backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: Spacing.md, gap: 6 },
  infoTitle: { fontWeight: "700", color: Colors.textPrimary, marginBottom: 4 },
  infoText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: Spacing.xl },
  permText: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary, textAlign: "center" },
  permSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  waitingPulse: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.primary + "20", alignItems: "center", justifyContent: "center" },
  waitingTitle: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  waitingSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center" },
  sessionInfoCard: { backgroundColor: Colors.cardLight, borderRadius: Radius.xl, padding: Spacing.lg, alignItems: "center", width: "80%" },
  sessionInfoLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textTransform: "uppercase", fontWeight: "600" },
  sessionInfoCode: { fontSize: 32, fontWeight: "900", color: Colors.primary, letterSpacing: 4 },
  cancelBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: Radius.full, backgroundColor: Colors.cardLight },
  cancelBtnText: { color: Colors.error, fontWeight: "700" },
  activeBanner: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.error, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  recordDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#fff" },
  activeBannerText: { flex: 1, color: "#fff", fontWeight: "700", fontSize: 13 },
  stopBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.md, backgroundColor: "#ffffff30" },
  stopBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  logArea: { flex: 1 },
  logTitle: { fontWeight: "700", color: Colors.textPrimary, marginBottom: 8 },
  logEmpty: { color: Colors.textMuted, fontSize: FontSize.sm },
  logEntry: { fontSize: 12, color: Colors.textSecondary, lineHeight: 22 },
  sessionFooter: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, gap: 12 },
  footerText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },
  endBtn: { backgroundColor: Colors.error + "20", borderRadius: Radius.md, paddingHorizontal: 16, paddingVertical: 8 },
  endBtnText: { color: Colors.error, fontWeight: "700" },
  endedTitle: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  endedSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
});
