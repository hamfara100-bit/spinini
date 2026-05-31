import React, { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import { ScreenContainer } from "../components/screen-container";
import { Colors, Spacing, Radius, FontSize, Shadow } from "../lib/theme";
import {
  signUp, signIn, signOut, getMembership, listMembers, createFamily, createPairing, redeemPairing,
  type Membership,
} from "../lib/family-account";

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

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    setScreen("loading");
    const m = await getMembership();
    if (!m) {
      // Signed in but no membership? Or signed out entirely. getMembership returns
      // null in both cases; decide by checking if there's any session-bound row.
      setMe(null);
      // If we just authed and have no family yet, the caller routes to "setup".
      setScreen(prev => (prev === "loading" ? "auth" : prev));
      // Distinguish: try listing — an authed user with no family still has a session.
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

  // ── Render ──────────────────────────────────────────────────────────────
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

      {screen === "joinFamily" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Join a family</Text>
          <TextInput style={[styles.input, styles.codeInput]} placeholder="INVITE CODE" autoCapitalize="characters" autoCorrect={false} value={joinCode} onChangeText={t => setJoinCode(t.toUpperCase())} placeholderTextColor={Colors.textMuted} />
          <TextInput style={styles.input} placeholder="Your name" value={displayName} onChangeText={setDisplayName} placeholderTextColor={Colors.textMuted} />
          <TextInput style={styles.input} placeholder="Age (optional)" keyboardType="number-pad" value={kidAge} onChangeText={setKidAge} placeholderTextColor={Colors.textMuted} />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleJoin} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Join family</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setError(""); setScreen("setup"); }}><Text style={styles.link}>← Back</Text></TouchableOpacity>
        </View>
      )}

      {screen === "family" && me && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>You're signed in as {me.displayName} ({me.role})</Text>

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
              <Text style={styles.sectionLabel}>Add a device</Text>
              {pairingCode ? (
                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>{pairingCode}</Text>
                  <Text style={styles.help}>On the child's device: open Family Account → "I have an invite code". Expires in 30 min.</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateCode} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Generate invite code</Text>}
                </TouchableOpacity>
              )}
            </>
          )}

          <TouchableOpacity style={styles.secondaryBtn} onPress={refresh}><Text style={styles.secondaryBtnText}>Refresh</Text></TouchableOpacity>
          <TouchableOpacity onPress={handleSignOut}><Text style={styles.link}>Sign out</Text></TouchableOpacity>
        </View>
      )}
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
  codeInput: { fontSize: FontSize.lg, fontWeight: "800", letterSpacing: 4, textAlign: "center" },
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
  codeBox: { backgroundColor: Colors.cardLight, borderRadius: Radius.md, padding: Spacing.md, gap: 8, alignItems: "center" },
  codeText: { fontSize: 34, fontWeight: "900", color: Colors.primary, letterSpacing: 6 },
});
