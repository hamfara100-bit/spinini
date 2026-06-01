/**
 * Kid onboarding — shown after the child taps "I'm a Child" on the role
 * chooser, and again on every app start if not yet linked to a family.
 *
 * Steps:
 *   1. Sign up (email + password)
 *   2. Scan the parent's QR code (or type the 6-char code manually)
 *   3. Enter name + age → joined → kid home
 */
import React, { useRef, useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, Dimensions, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as Contacts from "expo-contacts";
import { AudioModule } from "expo-audio";
import { useData } from "../../lib/data/store";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../lib/theme";
import { uid, nowIso } from "../../lib/utils";
import {
  signUp, signIn, signOut, getMembership, redeemPairing,
} from "../../lib/family-account";

/**
 * Request every permission the kid device needs up front, so monitoring &
 * communication features work without prompting later. Each is wrapped so one
 * denied/unavailable permission never blocks the rest. Notifications + location
 * are the important ones; camera/mic/photos/contacts are requested too.
 */
async function requestAllKidPermissions(): Promise<void> {
  try { await Notifications.requestPermissionsAsync(); } catch {}
  try { await ImagePicker.requestCameraPermissionsAsync(); } catch {}
  try { await AudioModule.requestRecordingPermissionsAsync(); } catch {}
  try { await Location.requestForegroundPermissionsAsync(); } catch {}
  try { await Location.requestBackgroundPermissionsAsync(); } catch {}
  try { await ImagePicker.requestMediaLibraryPermissionsAsync(); } catch {}
  try { await Contacts.requestPermissionsAsync(); } catch {}
}

const QR_SCHEME = "spinini://join/";

type Step = "auth" | "scan" | "profile";

export default function KidOnboarding() {
  const { dispatch } = useData();
  const router = useRouter();

  const [step, setStep]         = useState<Step>("auth");
  const [authMode, setAuthMode]               = useState<"signup" | "login">("signup");
  const [email, setEmail]                     = useState("");
  const [emailConfirm, setEmailConfirm]       = useState("");
  const [password, setPassword]               = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [kidAge, setKidAge]     = useState("");
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const scannedRef = useRef(false);

  // On mount: check if already signed in and linked — skip straight to kid home.
  useEffect(() => {
    (async () => {
      setBusy(true);
      try {
        const m = await getMembership();
        if (m?.familyId) {
          routeToKidHome();
        } else if (m) {
          setStep("scan");
        }
      } catch {} finally { setBusy(false); }
    })();
  }, []);

  function routeToKidHome() {
    dispatch({ type: "SETUP_COMPLETE" });
    router.replace("/");
  }

  async function handleAuth() {
    if (!email.trim() || password.length < 6) {
      setError("Enter your email and a password of at least 6 characters."); return;
    }
    if (authMode === "signup") {
      if (email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase()) {
        setError("Email addresses don't match."); return;
      }
      if (password !== passwordConfirm) {
        setError("Passwords don't match."); return;
      }
    }
    setBusy(true); setError("");
    try {
      if (authMode === "signup") await signUp(email.trim(), password);
      else await signIn(email.trim(), password);
      const m = await getMembership();
      if (m?.familyId) { routeToKidHome(); return; }
      setStep("scan");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function openScanner() {
    if (!camPerm?.granted) {
      const res = await requestCamPerm();
      if (!res.granted) { setError("Camera permission needed to scan the QR code."); return; }
    }
    scannedRef.current = false;
    setShowScanner(true);
  }

  function onBarcodeScanned({ data }: { data: string }) {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setShowScanner(false);
    // QR encodes the plain 6-char code. Strip any accidental scheme prefix
    // (e.g. from the old account.tsx flow) just in case.
    const raw = data.startsWith("spinini://join/") ? data.slice(15) : data;
    setJoinCode(raw.trim().toUpperCase().slice(0, 6));
  }

  async function handleJoin() {
    if (!joinCode.trim() || joinCode.trim().length !== 6) {
      setError("Enter the 6-letter code from your parent's phone."); return;
    }
    if (!displayName.trim()) { setError("Enter your name."); return; }
    setBusy(true); setError("");
    try {
      const age = kidAge.trim() ? parseInt(kidAge.trim(), 10) : undefined;
      await redeemPairing(joinCode.trim(), displayName.trim(), Number.isNaN(age as any) ? undefined : age);

      // Use the Supabase userId as the kid profile ID so it matches exactly
      // what the parent device creates via syncKidsFromSupabase. Without this,
      // both devices generate independent random IDs and alarms / chat /
      // remote-lock never target the right kid.
      const membership = await getMembership();
      const kidId = membership?.userId ?? uid();

      dispatch({
        type: "ADD_KID",
        payload: {
          id: kidId,
          name: displayName.trim(),
          age: age ?? 10,
          mascot: "fox",
          color: "blue",
          createdAt: nowIso(),
        },
      });

      // Ask for all the permissions the kid device needs (notifications,
      // location, camera, mic, photos, contacts) before entering the home.
      await requestAllKidPermissions();

      routeToKidHome();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  if (busy && step === "auth") {
    return <View style={s.center}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  // ── Step: Auth ──────────────────────────────────────────────────────────────
  if (step === "auth") {
    return (
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.logo}>🌀 Spinini</Text>
        <Text style={s.heading}>Create your account</Text>
        <Text style={s.sub}>You'll use this to connect to your parent's phone.</Text>

        {!!error && <Text style={s.error}>{error}</Text>}

        <TextInput
          style={s.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address"
          value={email} onChangeText={setEmail} placeholderTextColor={Colors.textMuted}
        />
        {authMode === "signup" && (
          <TextInput
            style={s.input} placeholder="Confirm email" autoCapitalize="none" keyboardType="email-address"
            value={emailConfirm} onChangeText={setEmailConfirm} placeholderTextColor={Colors.textMuted}
          />
        )}
        <TextInput
          style={s.input} placeholder="Password (min 6 chars)" secureTextEntry
          value={password} onChangeText={setPassword} placeholderTextColor={Colors.textMuted}
        />
        {authMode === "signup" && (
          <TextInput
            style={s.input} placeholder="Confirm password" secureTextEntry
            value={passwordConfirm} onChangeText={setPasswordConfirm} placeholderTextColor={Colors.textMuted}
          />
        )}

        <TouchableOpacity style={s.primaryBtn} onPress={handleAuth} disabled={busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>{authMode === "signup" ? "Create My Account" : "Log In"}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => {
          setAuthMode(m => m === "signup" ? "login" : "signup");
          setEmailConfirm(""); setPasswordConfirm(""); setError("");
        }}>
          <Text style={s.link}>{authMode === "signup" ? "Already have an account? Log in" : "Need an account? Sign up"}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Step: Scan / enter code + profile ───────────────────────────────────────
  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <Text style={s.logo}>🌀 Spinini</Text>
      <Text style={s.heading}>Connect to your parent</Text>
      <Text style={s.sub}>Ask your parent to open Spinini and show you their QR code, then scan it here.</Text>

      {!!error && <Text style={s.error}>{error}</Text>}

      {/* QR scanner button */}
      <TouchableOpacity style={s.scanBtn} onPress={openScanner} activeOpacity={0.85}>
        <Text style={s.scanIcon}>📷</Text>
        <Text style={s.scanTxt}>Scan Parent's QR Code</Text>
      </TouchableOpacity>

      <View style={s.dividerRow}>
        <View style={s.divLine} /><Text style={s.divTxt}>or type the code</Text><View style={s.divLine} />
      </View>

      <TextInput
        style={[s.input, s.codeInput]}
        placeholder="ABCD12"
        autoCapitalize="characters"
        autoCorrect={false}
        value={joinCode}
        onChangeText={t => setJoinCode(t.toUpperCase())}
        placeholderTextColor={Colors.textMuted}
        maxLength={6}
      />

      <Text style={s.sectionLabel}>YOUR DETAILS</Text>
      <TextInput style={s.input} placeholder="Your first name" value={displayName} onChangeText={setDisplayName} placeholderTextColor={Colors.textMuted} />
      <TextInput style={s.input} placeholder="Your age" keyboardType="number-pad" value={kidAge} onChangeText={setKidAge} placeholderTextColor={Colors.textMuted} maxLength={2} />

      <TouchableOpacity style={s.primaryBtn} onPress={handleJoin} disabled={busy} activeOpacity={0.85}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Join Family →</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={async () => { await signOut(); setStep("auth"); }}>
        <Text style={s.link}>Sign out</Text>
      </TouchableOpacity>

      {/* QR scanner modal */}
      <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
        <View style={s.scanModal}>
          <Text style={s.scanModalTitle}>Scan Parent's QR Code</Text>
          <CameraView
            style={s.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={onBarcodeScanned}
          />
          <View style={s.scanOverlay}>
            <View style={s.scanFrame} />
          </View>
          <Text style={s.scanHint}>Point at the QR code on your parent's phone</Text>
          <TouchableOpacity style={[s.primaryBtn, { margin: Spacing.lg }]} onPress={() => setShowScanner(false)}>
            <Text style={s.primaryBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center:  { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bgLight },
  scroll:  { flexGrow: 1, backgroundColor: Colors.bgLight, padding: Spacing.lg, gap: 14 },
  logo:    { fontSize: FontSize.xxl, fontWeight: "900", color: Colors.primary, textAlign: "center", marginBottom: 4 },
  heading: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  sub:     { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 4 },
  error:   { color: Colors.error, fontWeight: "600", textAlign: "center" },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: FontSize.base,
    color: Colors.textPrimary, backgroundColor: "#fff",
  },
  codeInput: { fontSize: FontSize.xl, fontWeight: "900", letterSpacing: 8, textAlign: "center" },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 6 },
  primaryBtn:     { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  link:    { color: Colors.primary, fontWeight: "600", textAlign: "center", paddingVertical: 6 },
  scanBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 16 },
  scanIcon: { fontSize: 22 },
  scanTxt:  { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  divLine:    { flex: 1, height: 1, backgroundColor: Colors.border },
  divTxt:     { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: "600" },
  // Scanner modal
  scanModal:      { flex: 1, backgroundColor: "#000" },
  scanModalTitle: { color: "#fff", fontWeight: "800", fontSize: FontSize.md, textAlign: "center", paddingTop: 56, paddingBottom: 16 },
  camera:         { flex: 1 },
  scanOverlay:    { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", pointerEvents: "none" },
  scanFrame:      { width: 220, height: 220, borderRadius: 16, borderWidth: 3, borderColor: Colors.primary, shadowColor: Colors.primary, shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  scanHint:       { color: "#ccc", textAlign: "center", fontSize: FontSize.sm, padding: Spacing.md },
});
