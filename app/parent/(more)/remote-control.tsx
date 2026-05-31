import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, PanResponder, Dimensions, Alert, TextInput,
  ActivityIndicator, Platform,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import {
  startViewerSession, stopViewerSession, sendCommand,
  getSessionInfo, onFrame, onSessionStateChanged, setFrameQuality,
  requestScreenCapturePermission,
} from "../../../modules/expo-remote-control/src/index";
import {
  generateSessionCode, makeSessionId, makeTouchCommand,
  makeScrollCommand, DEFAULT_FRAME_INFO, connectionQuality,
  QUALITY_COLOR, QUALITY_LABEL, LatencyTracker, LOCAL_PORT,
} from "../../../lib/remote-session";
import type { ConnectionState } from "../../../modules/expo-remote-control/src/types";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const MIRROR_W = SCREEN_W - Spacing.md * 2;
const MIRROR_H = MIRROR_W * (16 / 9); // assume portrait 9:16

const ACTIONS = [
  { id: "home",       emoji: "🏠", label: "Home" },
  { id: "back",       emoji: "◀",  label: "Back" },
  { id: "recents",    emoji: "⬜", label: "Recent" },
  { id: "volume_up",  emoji: "🔊", label: "Vol +" },
  { id: "volume_down",emoji: "🔉", label: "Vol −" },
  { id: "screenshot", emoji: "📸", label: "Screenshot" },
];

type Screen = "setup" | "connecting" | "connected";

export default function RemoteControlScreen() {
  const { state } = useData();
  const [screen, setScreen] = useState<Screen>("setup");
  const [selectedKidId, setSelectedKidId] = useState(state.kids[0]?.profile.id ?? "");
  const [sessionCode, setSessionCode] = useState(generateSessionCode());
  const [manualIp, setManualIp] = useState("");
  const [useLocalMode, setUseLocalMode] = useState(true);
  const [connState, setConnState] = useState<ConnectionState>("idle");
  const [frameUri, setFrameUri] = useState<string | null>(null);
  const [latency, setLatency] = useState(0);
  const [fps, setFps] = useState(0);
  const [quality, setQuality] = useState(DEFAULT_FRAME_INFO.quality);
  const [showControls, setShowControls] = useState(true);
  const [isPinching, setIsPinching] = useState(false);

  const latTracker = useRef(new LatencyTracker());
  const frameCount = useRef(0);
  const fpsTimer = useRef<any>(null);
  const frameReceivedAt = useRef(0);
  const unsubs = useRef<Array<() => void>>([]);

  const kid = state.kids.find(k => k.profile.id === selectedKidId);

  // Subscribe to native events
  useEffect(() => {
    const u1 = onFrame(b64 => {
      const now = Date.now();
      if (frameReceivedAt.current) {
        latTracker.current.record(now - frameReceivedAt.current);
        setLatency(latTracker.current.avg);
      }
      frameReceivedAt.current = now;
      frameCount.current++;
      setFrameUri(`data:image/jpeg;base64,${b64}`);
    });

    const u2 = onSessionStateChanged(s => {
      setConnState(s);
      if (s === "connected") setScreen("connected");
      if (s === "disconnected" || s === "error") {
        setScreen("setup");
        setFrameUri(null);
      }
    });

    unsubs.current = [u1, u2];

    // FPS counter
    fpsTimer.current = setInterval(() => {
      setFps(frameCount.current);
      frameCount.current = 0;
    }, 1000);

    return () => {
      unsubs.current.forEach(f => f());
      clearInterval(fpsTimer.current);
      stopViewerSession().catch(() => {});
    };
  }, []);

  async function connect() {
    const sessionId = makeSessionId(sessionCode, selectedKidId);
    const serverUrl = useLocalMode
      ? (manualIp || "192.168.1.100")
      : "relay.famkids.app";
    setScreen("connecting");
    setConnState("connecting");
    const ok = await startViewerSession(sessionId, serverUrl);
    if (!ok) {
      setScreen("setup");
      setConnState("idle");
      Alert.alert(
        "Connection Failed",
        "Could not connect to the kid's device. Make sure:\n• Both devices are on the same WiFi\n• The kid's device has the session running\n• The IP address is correct"
      );
    }
  }

  async function disconnect() {
    await stopViewerSession();
    setScreen("setup");
    setFrameUri(null);
    setConnState("idle");
  }

  async function sendAction(actionId: string) {
    await sendCommand({ type: actionId as any });
  }

  async function changeQuality(q: number) {
    setQuality(q);
    await setFrameQuality(q, DEFAULT_FRAME_INFO.fps);
  }

  // Touch → remote command via PanResponder
  const mirrorRef = useRef<View>(null);
  const [mirrorLayout, setMirrorLayout] = useState({ x: 0, y: 0, width: MIRROR_W, height: MIRROR_H });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: e => {
        const { locationX, locationY } = e.nativeEvent;
        const nx = Math.max(0, Math.min(1, locationX / mirrorLayout.width));
        const ny = Math.max(0, Math.min(1, locationY / mirrorLayout.height));
        sendCommand(makeTouchCommand("down", nx, ny));
      },
      onPanResponderMove: e => {
        const { locationX, locationY } = e.nativeEvent;
        const nx = Math.max(0, Math.min(1, locationX / mirrorLayout.width));
        const ny = Math.max(0, Math.min(1, locationY / mirrorLayout.height));
        sendCommand(makeTouchCommand("move", nx, ny));
      },
      onPanResponderRelease: e => {
        const { locationX, locationY } = e.nativeEvent;
        const nx = Math.max(0, Math.min(1, locationX / mirrorLayout.width));
        const ny = Math.max(0, Math.min(1, locationY / mirrorLayout.height));
        sendCommand(makeTouchCommand("up", nx, ny));
      },
    })
  ).current;

  const qual = connectionQuality(latency);

  // ─── SETUP SCREEN ────────────────────────────────────────────────────────────
  if (screen === "setup") {
    return (
      <ScreenContainer scroll>
        <Text style={styles.title}>📱 Remote Control</Text>
        <Text style={styles.sub}>Mirror and control your child's device in real time</Text>

        {/* Kid selector */}
        <Text style={styles.sectionLabel}>Select Child's Device</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, flexGrow: 0 }} contentContainerStyle={{ alignItems: "center", paddingVertical: 4 }}>
          {state.kids.map(k => (
            <TouchableOpacity
              key={k.profile.id}
              style={[styles.kidTab, selectedKidId === k.profile.id && styles.kidTabActive]}
              onPress={() => setSelectedKidId(k.profile.id)}
            >
              <Text style={[styles.kidTabText, selectedKidId === k.profile.id && styles.kidTabTextActive]}>
                {k.profile.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* How it works */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📋 How to connect</Text>
          <Step n={1} text="Share the session code below with your child's device" />
          <Step n={2} text="On the child's device: open Spinini → Remote Session → enter the code" />
          <Step n={3} text="Enter the child's device IP address (shown on kid's screen), then tap Connect" />
          <Step n={4} text="The child's screen will appear here and you can control it fully" />
        </View>

        {/* Session code */}
        <Text style={styles.sectionLabel}>Session Code</Text>
        <View style={styles.codeCard}>
          <Text style={styles.codeText}>{sessionCode}</Text>
          <TouchableOpacity onPress={() => setSessionCode(generateSessionCode())} style={styles.refreshBtn}>
            <Text style={styles.refreshBtnText}>🔄 New code</Text>
          </TouchableOpacity>
        </View>

        {/* Connection mode */}
        <Text style={styles.sectionLabel}>Connection Mode</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, useLocalMode && styles.modeBtnActive]}
            onPress={() => setUseLocalMode(true)}
          >
            <Text style={{ fontSize: 24 }}>📶</Text>
            <Text style={[styles.modeBtnLabel, useLocalMode && { color: "#fff" }]}>Same WiFi</Text>
            <Text style={[styles.modeBtnSub, useLocalMode && { color: "#ffffffaa" }]}>Low latency, direct</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, !useLocalMode && styles.modeBtnActive]}
            onPress={() => setUseLocalMode(false)}
          >
            <Text style={{ fontSize: 24 }}>🌐</Text>
            <Text style={[styles.modeBtnLabel, !useLocalMode && { color: "#fff" }]}>Remote (Cloud)</Text>
            <Text style={[styles.modeBtnSub, !useLocalMode && { color: "#ffffffaa" }]}>Works over internet</Text>
          </TouchableOpacity>
        </View>

        {useLocalMode && (
          <View style={styles.ipCard}>
            <Text style={styles.ipLabel}>Child's device IP address</Text>
            <Text style={styles.ipHint}>Find it on kid's Remote Session screen</Text>
            <TextInput
              style={styles.ipInput}
              placeholder="192.168.1.xxx"
              value={manualIp}
              onChangeText={setManualIp}
              keyboardType="numbers-and-punctuation"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.connectBtn, !kid && styles.connectBtnDisabled]}
          onPress={connect}
          disabled={!kid}
        >
          <Text style={styles.connectBtnText}>Connect →</Text>
        </TouchableOpacity>

        {/* Platform note */}
        {Platform.OS === "ios" && (
          <View style={styles.warnCard}>
            <Text style={styles.warnText}>
              ⚠️ On iOS, viewing the child's screen requires them to start a Screen Recording session. Touch injection is not supported on iOS due to system restrictions — you can view but not control the device.
            </Text>
          </View>
        )}
      </ScreenContainer>
    );
  }

  // ─── CONNECTING SCREEN ────────────────────────────────────────────────────────
  if (screen === "connecting") {
    return (
      <ScreenContainer>
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.connectingText}>Connecting to {kid?.profile.name}'s device…</Text>
          <Text style={styles.connectingSub}>Session code: {sessionCode}</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={disconnect}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // ─── CONNECTED / MIRROR SCREEN ────────────────────────────────────────────────
  return (
    <View style={styles.mirrorRoot}>

      {/* Status bar */}
      <View style={styles.statusBar}>
        <View style={[styles.qualDot, { backgroundColor: QUALITY_COLOR[qual] }]} />
        <Text style={styles.statusText}>{QUALITY_LABEL[qual]} · {latency}ms · {fps}fps</Text>
        <TouchableOpacity onPress={() => setShowControls(v => !v)} style={styles.toggleBtn}>
          <Text style={styles.toggleBtnText}>{showControls ? "Hide ▲" : "Controls ▼"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={disconnect} style={styles.disconnectBtn}>
          <Text style={styles.disconnectBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Mirror view */}
      <View
        style={[styles.mirrorFrame, { width: MIRROR_W, height: MIRROR_H }]}
        onLayout={e => setMirrorLayout(e.nativeEvent.layout)}
        {...panResponder.panHandlers}
      >
        {frameUri ? (
          <Image
            source={{ uri: frameUri }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.noFramePlaceholder}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.noFrameText}>Waiting for screen stream…</Text>
          </View>
        )}

        {/* Double-tap hint overlay */}
        <View style={styles.tapHint} pointerEvents="none">
          <Text style={styles.tapHintText}>Tap to control • Swipe to scroll</Text>
        </View>
      </View>

      {/* Control panel */}
      {showControls && (
        <View style={styles.controlPanel}>
          {/* System actions */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.actionScroll}>
            {ACTIONS.map(a => (
              <TouchableOpacity key={a.id} style={styles.actionBtn} onPress={() => sendAction(a.id)}>
                <Text style={styles.actionEmoji}>{a.emoji}</Text>
                <Text style={styles.actionLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Quality slider (buttons) */}
          <View style={styles.qualityRow}>
            <Text style={styles.qualityLabel}>Quality</Text>
            {[30, 50, 70, 85].map(q => (
              <TouchableOpacity
                key={q}
                style={[styles.qualBtn, quality === q && styles.qualBtnActive]}
                onPress={() => changeQuality(q)}
              >
                <Text style={[styles.qualBtnText, quality === q && { color: "#fff" }]}>{q}%</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Platform note for iOS */}
          {Platform.OS === "ios" && (
            <Text style={styles.iosNote}>👁️ View only on iOS — touch control requires Android</Text>
          )}
        </View>
      )}
    </View>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  kidTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight, marginRight: 8 },
  kidTabActive: { backgroundColor: Colors.primary },
  kidTabText: { fontWeight: "600", color: Colors.textSecondary },
  kidTabTextActive: { color: "#fff" },
  infoCard: { backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 16, gap: 8 },
  infoTitle: { fontWeight: "700", color: Colors.textPrimary, fontSize: FontSize.base, marginBottom: 4 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  stepNumText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  stepText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  codeCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.lg, alignItems: "center", marginBottom: 16, ...Shadow.md, borderWidth: 2, borderColor: Colors.primary + "40" },
  codeText: { fontSize: 48, fontWeight: "900", letterSpacing: 12, color: Colors.primary },
  refreshBtn: { marginTop: 8 },
  refreshBtnText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  modeRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  modeBtn: { flex: 1, backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: Spacing.md, alignItems: "center", gap: 4 },
  modeBtnActive: { backgroundColor: Colors.primary },
  modeBtnLabel: { fontWeight: "700", color: Colors.textPrimary, fontSize: FontSize.sm },
  modeBtnSub: { fontSize: 11, color: Colors.textSecondary },
  ipCard: { backgroundColor: Colors.cardLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 16, gap: 4 },
  ipLabel: { fontWeight: "700", color: Colors.textPrimary },
  ipHint: { fontSize: FontSize.xs, color: Colors.textSecondary },
  ipInput: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.md, padding: 12, fontSize: FontSize.md, fontWeight: "700", color: Colors.primary, marginTop: 6, textAlign: "center", letterSpacing: 2 },
  connectBtn: { backgroundColor: Colors.primary, borderRadius: Radius.xl, padding: 16, alignItems: "center", marginBottom: 16, marginHorizontal: Spacing.sm },
  connectBtnDisabled: { opacity: 0.5 },
  connectBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.md },
  warnCard: { backgroundColor: Colors.warning + "15", borderRadius: Radius.lg, padding: Spacing.md },
  warnText: { fontSize: FontSize.sm, color: Colors.warning, lineHeight: 20 },
  // connecting
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  connectingText: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  connectingSub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  cancelBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: Radius.full, backgroundColor: Colors.cardLight, alignSelf: "center" },
  cancelBtnText: { color: Colors.error, fontWeight: "700" },
  // mirror
  mirrorRoot: { flex: 1, backgroundColor: "#0A0A0A" },
  statusBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#1A1A1A", gap: 8 },
  qualDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { flex: 1, fontSize: 12, color: "#ccc", fontWeight: "600" },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.md, backgroundColor: "#333" },
  toggleBtnText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  disconnectBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.error, alignItems: "center", justifyContent: "center" },
  disconnectBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  mirrorFrame: { backgroundColor: "#000", alignSelf: "center", marginVertical: 4, borderRadius: 8, overflow: "hidden" },
  noFramePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  noFrameText: { color: "#888", fontSize: 14 },
  tapHint: { position: "absolute", bottom: 8, left: 0, right: 0, alignItems: "center" },
  tapHintText: { color: "#ffffff60", fontSize: 11 },
  controlPanel: { backgroundColor: "#1A1A1A", paddingBottom: 16 },
  actionScroll: { paddingHorizontal: 12, paddingVertical: 8 },
  actionBtn: { alignItems: "center", marginRight: 16, gap: 4 },
  actionEmoji: { fontSize: 26 },
  actionLabel: { color: "#ccc", fontSize: 10, fontWeight: "600" },
  qualityRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 },
  qualityLabel: { color: "#888", fontSize: 12, fontWeight: "600" },
  qualBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.md, backgroundColor: "#333" },
  qualBtnActive: { backgroundColor: Colors.primary },
  qualBtnText: { color: "#ccc", fontSize: 12, fontWeight: "600" },
  iosNote: { color: "#888", fontSize: 11, textAlign: "center", paddingVertical: 6 },
});
