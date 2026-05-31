import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  Modal, Dimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import QRCode from "react-native-qrcode-svg";
import { ScreenContainer } from "../components/screen-container";
import { Colors, Spacing, Radius, FontSize, Shadow } from "../lib/theme";
import {
  signUp, signIn, signOut, getMembership, listMembers, createFamily, createPairing, redeemPairing,
  type Membership,
} from "../lib/family-account";

const QR_SIZE = Math.min(Dimensions.get("window").width - 96, 220);

/** The deep-link scheme embedded in the QR — scanning extracts the 6-char code. */
const QR_SCHEME = "spinini://join/";

type Screen = "loading" | "auth" | "setup" | "createFamily" | "joinFamily" | "family";

export default function AccountScreen() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // auth form
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // setup forms
  const [familyName, setFamilyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [kidAge, setKidAge] = useState("");

  // family view
  const [me, setMe] = useState<Membership | null>(null);
  const [members, setMembers] = useState<Membership[]>([]);
  const [pairingCode, setPairingCode] = useState("");

  // QR scanner
  const [showScanner, setShowScanner] = useState(false);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const scannedRef = useRef(false); // prevent double-fire

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    setScreen("loading");
    const m = await getMembership();
    if (!m) {
      setMe(null);
      setScreen(prev => (prev === "loading" ? "auth" : prev));
      return;
    }
    setMe(m);
    setMembers(await listMembers());
    setScreen("family");
  }

  function fail(e: unknown) {
    setError(e instanceof Error ? e.message : String(e));
  }

  async function handleAuth() {
    if (!username.trim() || password.length < 6) {
      setError("Enter a username and a password of at least 6 characters.");
      return;
    }
    setBusy(true); setError("");
    try {
      if (authMode === "signup") await signUp(username, password);
      else await signIn(username, password);
      const m = await getMembership();
      if (m) { setMe(m); setMembers(await listMembers()); setScreen("family"); }
      else { setScreen("setup"); }
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function handleCreateFamily() {
    if (!familyName.trim() || !displayName.trim()) { setError("Family name and your name are required."); return; }
    setBusy(true); setError("");
    try {
      await createFamily(familyName.trim(), displayName.trim());
      await refresh();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function handleJoin() {
    if (!joinCode.trim() || !displayName.trim()) { setError("Invite code and your name are required."); return; }
    setBusy(true); setError("");
    try {
      const age = kidAge.trim() ? parseInt(kidAge.trim(), 10) : undefined;
      await redeemPairing(joinCode.trim(), displayName.trim(), Number.isNaN(age as any) ? undefined : age);
      await refresh();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function handleCreateCode() {
    setBusy(true); setError("");
    try { setPairingCode(await createPairing("kid", 30)); }
    catch (e) { fail(e); } finally { setBusy(false); }
  }

  async function handleSignOut() {
    await signOut();
    setMe(null); setMembers([]); setPairingCode("");
    setUsername(""); setPassword("");
    setScreen("auth");
  }

  // ── QR scanner ──────────────────────────────────────────────────────────────
  async function openScanner() {
    if (!camPerm?.granted) {
      const res = await requestCamPerm();
      if (!res.granted) { setError("Camera permission is needed to scan the QR code."); return; }
    }
    scannedRef.current = false;
    setShowScanner(true);
  }

  function onBarcodeScanned({ data }: { data: string }) {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setShowScanner(false);
    // Extract the 6-char code whether it's a raw code or a spinini://join/<CODE> URI.
    const code = data.startsWith(QR_SCHEME)
      ? data.slice(QR_SCHEME.length).trim().toUpperCase()
      : data.trim().toUpperCase();
    setJoinCode(code);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (screen === "loading") {
    return (
      <ScreenContainer>
        <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>Family Account</Text>
      {!!error && <Text style={styles.error}>{error}</Text>}

      {/* ── Auth ── */}
      {screen === "auth" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{authMode === "signup" ? "Create your account" : "Log in"}</Text>
          <Text style={styles.help}>This connects your devices. A parent makes the account; each child gets their own.</Text>
          <TextInput
            style={styles.input} placeholder="Username" autoCapitalize="none" autoCorrect={false}
            value={username} onChangeText={setUsername} placeholderTextColor={Colors.textMuted}
          />
          <TextInput
            style={styles.input} placeholder="Password (min 6 chars)" secureTextEntry
            value={password} onChangeText={setPassword} placeholderTextColor={Colors.textMuted}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAuth} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{authMode === "signup" ? "Sign up" : "Log in"}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setAuthMode(m => m === "signup" ? "login" : "signup"); setError(""); }}>
            <Text style={styles.link}>{authMode === "signup" ? "Already have an account? Log in" : "Need an account? Sign up"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Setup choice ── */}
      {screen === "setup" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Set up your family</Text>
          <Text style={styles.help}>Are you the parent setting things up, or a child joining with a code?</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => { setError(""); setScreen("createFamily"); }}>
            <Text style={styles.primaryBtnText}>I'm a parent — create a family</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setError(""); setScreen("joinFamily"); }}>
            <Text style={styles.secondaryBtnText}>I have an invite code — join</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSignOut}><Text style={styles.link}>Sign out</Text></TouchableOpacity>
        </View>
      )}

      {/* ── Create family ── */}
      {screen === "createFamily" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create your family</Text>
          <TextInput style={styles.input} placeholder="Family name (e.g. The Smiths)" value={familyName} onChangeText={setFamilyName} placeholderTextColor={Colors.textMuted} />
          <TextInput style={styles.input} placeholder="Your name (e.g. Mom)" value={displayName} onChangeText={setDisplayName} placeholderTextColor={Colors.textMuted} />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateFamily} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create family</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setError(""); setScreen("setup"); }}><Text style={styles.link}>← Back</Text></TouchableOpacity>
        </View>
      )}

      {/* ── Join family (kid side) ── */}
      {screen === "joinFamily" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Join a family</Text>
          <Text style={styles.help}>Scan the QR code on the parent's screen, or type the 6-letter code manually.</Text>

          {/* QR scanner button */}
          <TouchableOpacity style={styles.scanBtn} onPress={openScanner} activeOpacity={0.85}>
            <Text style={styles.scanIcon}>📷</Text>
            <Text style={styles.scanTxt}>Scan QR Code</Text>
          </TouchableOpacity>

          <View style={styles.divider}><View style={styles.divLine} /><Text style={styles.divTxt}>or type the code</Text><View style={styles.divLine} /></View>

          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="ABCD12"
            autoCapitalize="characters"
            autoCorrect={false}
            value={joinCode}
            onChangeText={t => setJoinCode(t.toUpperCase())}
            placeholderTextColor={Colors.textMuted}
            maxLength={6}
          />
          <TextInput style={styles.input} placeholder="Your name" value={displayName} onChangeText={setDisplayName} placeholderTextColor={Colors.textMuted} />
          <TextInput style={styles.input} placeholder="Age (optional)" keyboardType="number-pad" value={kidAge} onChangeText={setKidAge} placeholderTextColor={Colors.textMuted} />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleJoin} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Join family</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setError(""); setScreen("setup"); }}><Text style={styles.link}>← Back</Text></TouchableOpacity>
        </View>
      )}

      {/* ── Family view (parent side — shows QR) ── */}
      {screen === "family" && me && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {me.role === "parent" ? "👤" : "🧒"} {me.displayName}
          </Text>

          <Text style={styles.sectionLabel}>Family members</Text>
          {members.map(m => (
            <View key={m.userId} style={styles.memberRow}>
              <Text style={styles.memberEmoji}>{m.role === "parent" ? "👤" : "🧒"}</Text>
              <Text style={styles.memberName}>{m.displayName}</Text>
              <Text style={styles.memberMeta}>{m.role === "kid" && m.age != null ? `Age ${m.age}` : m.role}</Text>
            </View>
          ))}

          {me.role === "parent" && (
            <>
              <Text style={styles.sectionLabel}>Add a child's device</Text>
              {pairingCode ? (
                <View style={styles.qrBox}>
                  {/* QR code — encodes spinini://join/<CODE> */}
                  <View style={styles.qrWrap}>
                    <QRCode
                      value={QR_SCHEME + pairingCode}
                      size={QR_SIZE}
                      color={Colors.primary}
                      backgroundColor="#fff"
                    />
                  </View>
                  <Text style={styles.codeText}>{pairingCode}</Text>
                  <Text style={styles.help}>
                    On the child's device: open Family Account → "I have an invite code" → tap 📷 Scan QR Code.{"\n"}
                    Or type the code above manually. Expires in 30 min.
                  </Text>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={() => { setPairingCode(""); setBusy(false); }}>
                    <Text style={styles.secondaryBtnText}>Generate new code</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateCode} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>📲 Generate invite QR code</Text>}
                </TouchableOpacity>
              )}
            </>
          )}

          <TouchableOpacity style={styles.secondaryBtn} onPress={refresh}><Text style={styles.secondaryBtnText}>Refresh</Text></TouchableOpacity>
          <TouchableOpacity onPress={handleSignOut}><Text style={styles.link}>Sign out</Text></TouchableOpacity>
        </View>
      )}

      {/* ── QR Scanner modal ── */}
      <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
        <View style={styles.scanModal}>
          <Text style={styles.scanModalTitle}>Scan the parent's QR code</Text>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={onBarcodeScanned}
          />
          <View style={styles.scanOverlay}>
            <View style={styles.scanFrame} />
          </View>
          <Text style={styles.scanHint}>Point the camera at the QR code on the parent's phone</Text>
          <TouchableOpacity style={[styles.primaryBtn, { margin: Spacing.lg }]} onPress={() => setShowScanner(false)}>
            <Text style={styles.primaryBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: Spacing.md, marginTop: Spacing.sm },
  error: { color: Colors.error, fontWeight: "600", marginBottom: Spacing.sm },
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.lg, gap: 12, ...Shadow.md },
  cardTitle: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },
  help: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: FontSize.base, color: Colors.textPrimary,
    backgroundColor: "#fff",
  },
  codeInput: { fontSize: FontSize.xl, fontWeight: "900", letterSpacing: 8, textAlign: "center" },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  secondaryBtn: { backgroundColor: Colors.primary + "18", borderRadius: Radius.md, paddingVertical: 14, alignItems: "center" },
  secondaryBtnText: { color: Colors.primary, fontWeight: "800", fontSize: FontSize.base },
  link: { color: Colors.primary, fontWeight: "600", textAlign: "center", paddingVertical: 6 },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  memberEmoji: { fontSize: 22 },
  memberName: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary, flex: 1 },
  memberMeta: { fontSize: FontSize.sm, color: Colors.textSecondary },

  // QR code display (parent side)
  qrBox: { gap: 12, alignItems: "center", backgroundColor: Colors.cardLight, borderRadius: Radius.xl, padding: Spacing.lg },
  qrWrap: { padding: 12, backgroundColor: "#fff", borderRadius: Radius.lg, ...Shadow.sm },
  codeText: { fontSize: 36, fontWeight: "900", color: Colors.primary, letterSpacing: 8 },

  // Scan button (kid side)
  scanBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 16,
  },
  scanIcon: { fontSize: 22 },
  scanTxt: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },

  // Divider
  divider: { flexDirection: "row", alignItems: "center", gap: 10 },
  divLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  divTxt: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: "600" },

  // Scanner modal
  scanModal: { flex: 1, backgroundColor: "#000" },
  scanModalTitle: { color: "#fff", fontWeight: "800", fontSize: FontSize.md, textAlign: "center", paddingTop: 56, paddingBottom: 16 },
  camera: { flex: 1 },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", pointerEvents: "none" },
  scanFrame: {
    width: 220, height: 220, borderRadius: 16,
    borderWidth: 3, borderColor: Colors.primary,
    shadowColor: Colors.primary, shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  scanHint: { color: "#ccc", textAlign: "center", fontSize: FontSize.sm, padding: Spacing.md },
});
