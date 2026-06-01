/**
 * Parent onboarding — runs after the parent taps "I'm a Parent" on the role
 * chooser, and again on every app start if no kids are linked yet.
 *
 * Steps:
 *   1. Sign up (email + password) or log in if they already have an account
 *   2. Create a family (display name)
 *   3. Show a QR code so children can scan it to join — stays up until at
 *      least one kid links
 */
import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Dimensions, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { useData } from "../../lib/data/store";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../lib/theme";
import {
  signUp, signIn, signOut, getMembership, listMembers,
  createFamily, createPairing, type Membership,
} from "../../lib/family-account";

const QR_SIZE = Math.min(Dimensions.get("window").width - 96, 220);
const QR_SCHEME = "spinini://join/";

type Step = "auth" | "createFamily" | "qr";

export default function ParentOnboarding() {
  const { state, dispatch } = useData();
  const router = useRouter();

  const [step, setStep]         = useState<Step>("auth");
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [familyName, setFamilyName]   = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const [membership, setMembership] = useState<Membership | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // On mount: check if already signed in and resume from the right step.
  useEffect(() => {
    (async () => {
      setBusy(true);
      try {
        const m = await getMembership();
        if (!m) { setStep("auth"); return; }
        setMembership(m);
        // Has family but no kids yet → go straight to QR step
        const members = await listMembers();
        const hasKids = members.some(m => m.role === "kid");
        if (hasKids) { router.replace("/parent/dashboard"); return; }
        const code = await createPairing("kid", 30);
        setPairingCode(code);
        setStep("qr");
      } catch {
        setStep("auth");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  // Poll Supabase every 5 s while on the QR step waiting for a kid to link.
  useEffect(() => {
    if (step !== "qr") return;
    pollRef.current = setInterval(async () => {
      try {
        const members = await listMembers();
        const hasKids = members.some(m => m.role === "kid");
        if (hasKids) {
          clearInterval(pollRef.current!);
          // Also mark setupDone so the app knows we're ready
          dispatch({ type: "SETUP_COMPLETE" });
          router.replace("/parent/dashboard");
        }
      } catch {}
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step]);

  async function handleAuth() {
    if (!email.trim() || password.length < 6) {
      setError("Enter your email and a password of at least 6 characters.");
      return;
    }
    setBusy(true); setError("");
    try {
      if (authMode === "signup") await signUp(email.trim(), password);
      else await signIn(email.trim(), password);
      const m = await getMembership();
      if (m) {
        setMembership(m);
        const members = await listMembers();
        if (members.some(mx => mx.role === "kid")) {
          dispatch({ type: "SETUP_COMPLETE" });
          router.replace("/parent/dashboard");
        } else {
          const code = await createPairing("kid", 30);
          setPairingCode(code);
          setStep("qr");
        }
      } else {
        setStep("createFamily");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateFamily() {
    if (!displayName.trim()) { setError("Enter your name."); return; }
    setBusy(true); setError("");
    try {
      await createFamily(familyName.trim() || `${displayName.trim()}'s Family`, displayName.trim());
      const code = await createPairing("kid", 30);
      setPairingCode(code);
      setStep("qr");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function refreshCode() {
    setBusy(true);
    try { setPairingCode(await createPairing("kid", 30)); }
    catch { /* keep old code */ } finally { setBusy(false); }
  }

  if (busy && step === "auth") {
    return (
      <View style={s.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  // ── Step: Auth ──────────────────────────────────────────────────────────────
  if (step === "auth") {
    return (
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.logo}>🌀 Spinini</Text>
        <Text style={s.heading}>Parent Account</Text>
        <Text style={s.sub}>Create an account to control and protect your children's devices.</Text>

        {!!error && <Text style={s.error}>{error}</Text>}

        <TextInput
          style={s.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address"
          value={email} onChangeText={setEmail} placeholderTextColor={Colors.textMuted}
        />
        <TextInput
          style={s.input} placeholder="Password (min 6 chars)" secureTextEntry
          value={password} onChangeText={setPassword} placeholderTextColor={Colors.textMuted}
        />

        <TouchableOpacity style={s.primaryBtn} onPress={handleAuth} disabled={busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>{authMode === "signup" ? "Create Parent Account" : "Log In"}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setAuthMode(m => m === "signup" ? "login" : "signup"); setError(""); }}>
          <Text style={s.link}>{authMode === "signup" ? "Already have an account? Log in" : "Need an account? Sign up"}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Step: Create family ─────────────────────────────────────────────────────
  if (step === "createFamily") {
    return (
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.logo}>🌀 Spinini</Text>
        <Text style={s.heading}>Set up your family</Text>
        <Text style={s.sub}>Just your name — your children join via QR code.</Text>

        {!!error && <Text style={s.error}>{error}</Text>}

        <TextInput style={s.input} placeholder="Your name (e.g. Mum)" value={displayName} onChangeText={setDisplayName} placeholderTextColor={Colors.textMuted} autoFocus />
        <TextInput style={s.input} placeholder="Family name (optional — e.g. The Smiths)" value={familyName} onChangeText={setFamilyName} placeholderTextColor={Colors.textMuted} />

        <TouchableOpacity style={s.primaryBtn} onPress={handleCreateFamily} disabled={busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Continue →</Text>}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Step: QR code ───────────────────────────────────────────────────────────
  return (
    <ScrollView contentContainerStyle={[s.scroll, { alignItems: "center" }]}>
      <Text style={s.logo}>🌀 Spinini</Text>
      <Text style={s.heading}>Waiting for a child to join</Text>
      <Text style={s.sub}>
        On your child's phone:{"\n"}
        1. Download Spinini{"\n"}
        2. Choose "I'm a Child"{"\n"}
        3. Scan this QR code
      </Text>

      <View style={s.qrBox}>
        {pairingCode ? (
          <>
            <View style={s.qrWrap}>
              <QRCode value={QR_SCHEME + pairingCode} size={QR_SIZE} color={Colors.primary} backgroundColor="#fff" />
            </View>
            <Text style={s.qrCode}>{pairingCode}</Text>
            <Text style={s.qrHint}>Or they can type the code above manually. Expires in 30 min.</Text>
            <TouchableOpacity style={s.secondaryBtn} onPress={refreshCode} disabled={busy}>
              <Text style={s.secondaryBtnText}>{busy ? "Refreshing…" : "🔄 New code"}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator color={Colors.primary} size="large" />
        )}
      </View>

      <View style={s.waitRow}>
        <ActivityIndicator color={Colors.primary} size="small" />
        <Text style={s.waitText}>Waiting for a child to scan…</Text>
      </View>

      <TouchableOpacity onPress={async () => { await signOut(); setStep("auth"); setPairingCode(""); }}>
        <Text style={s.link}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center:  { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bgLight },
  scroll:  { flexGrow: 1, backgroundColor: Colors.bgLight, padding: Spacing.lg, gap: 14 },
  logo:    { fontSize: FontSize.xxl, fontWeight: "900", color: Colors.primary, textAlign: "center", marginBottom: 4 },
  heading: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  sub:     { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 8 },
  error:   { color: Colors.error, fontWeight: "600", textAlign: "center" },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: FontSize.base,
    color: Colors.textPrimary, backgroundColor: "#fff",
  },
  primaryBtn:     { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  secondaryBtn:   { backgroundColor: Colors.primary + "18", borderRadius: Radius.md, paddingVertical: 12, alignItems: "center", width: "100%" },
  secondaryBtnText: { color: Colors.primary, fontWeight: "700", fontSize: FontSize.sm },
  link: { color: Colors.primary, fontWeight: "600", textAlign: "center", paddingVertical: 6 },
  qrBox: { backgroundColor: Colors.cardLight, borderRadius: Radius.xl, padding: Spacing.lg, alignItems: "center", gap: 12, width: "100%", ...Shadow.md },
  qrWrap: { padding: 12, backgroundColor: "#fff", borderRadius: Radius.lg, ...Shadow.sm },
  qrCode: { fontSize: 34, fontWeight: "900", color: Colors.primary, letterSpacing: 8 },
  qrHint: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: "center" },
  waitRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  waitText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: "italic" },
});
