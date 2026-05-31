import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Switch,
  Alert, ActivityIndicator, ScrollView,
} from "react-native";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { GoogleSignIn } from "../../../components/google-sign-in";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { GOOGLE_SCOPES, KID_SCOPES } from "../../../lib/google-auth";
import {
  backupAllToDrive, restoreAllFromDrive,
  getBackupManifest, backupKidToOwnDrive,
  type BackupManifest,
} from "../../../lib/google-backup";
import type { GoogleAccount } from "../../../lib/data/types";
import { getGoogleTokens } from "../../../lib/secure-tokens";

function fmtTime(iso?: string | null) {
  if (!iso) return "Never";
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return `Today ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function CloudBackupScreen() {
  const { state, dispatch } = useData();
  const [loading, setLoading] = useState(false);
  const [kidLoadingId, setKidLoadingId] = useState<string | null>(null);
  const [manifest, setManifest] = useState<BackupManifest | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const googleAccount = state.parentSettings.googleAccount;
  const backupEnabled = state.parentSettings.backupEnabled;

  // Load the access token from SecureStore whenever the linked account changes
  useEffect(() => {
    if (!googleAccount?.id) { setAccessToken(null); return; }
    getGoogleTokens(googleAccount.id).then(t => setAccessToken(t?.accessToken ?? null)).catch(() => {});
  }, [googleAccount?.id]);

  const loadManifest = useCallback(async () => {
    if (!accessToken) return;
    try {
      const m = await getBackupManifest(accessToken);
      setManifest(m);
    } catch {}
  }, [accessToken]);

  useEffect(() => { loadManifest(); }, [loadManifest]);

  function handleParentGoogleSuccess(account: GoogleAccount) {
    dispatch({ type: "SET_PARENT_GOOGLE", account });
  }

  async function runBackupAll() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const m = await backupAllToDrive(accessToken, state);
      dispatch({ type: "SET_LAST_BACKUP", timestamp: m.backedUpAt });
      setManifest(m);
      Alert.alert("✅ Backup Complete", `All ${m.kids.length} kid${m.kids.length !== 1 ? "s" : ""} backed up to Google Drive.\n\nFolder: Spinini/`);
    } catch (e: any) {
      Alert.alert("Backup Failed", e?.message ?? "Check your internet connection.");
    } finally {
      setLoading(false);
    }
  }

  async function runRestore() {
    if (!accessToken) return;
    Alert.alert(
      "Restore from Google Drive",
      "This will replace all current data with the backup. Cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore", style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const restored = await restoreAllFromDrive(accessToken, state);
              dispatch({ type: "SET_PARENT_SETTINGS", payload: restored.parentSettings });
              for (const kid of restored.kids) {
                const existing = state.kids.find(k => k.profile.name === kid.profile.name);
                if (existing) {
                  dispatch({ type: "UPDATE_KID", kidId: existing.profile.id, payload: kid.profile });
                } else {
                  dispatch({ type: "ADD_KID", payload: kid.profile });
                }
              }
              Alert.alert("✅ Restored", "Data restored from Google Drive. Restart the app to apply all changes.");
            } catch (e: any) {
              Alert.alert("Restore Failed", e?.message ?? "Could not restore from Drive.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  async function backupKidOwn(kid: typeof state.kids[0]) {
    const kidAccountId = kid.profile.googleAccount?.id;
    if (!kidAccountId) return;
    const kidTokens = await getGoogleTokens(kidAccountId);
    const token = kidTokens?.accessToken;
    if (!token) return;
    setKidLoadingId(kid.profile.id);
    try {
      await backupKidToOwnDrive(token, kid);
      Alert.alert("✅ Backed Up", `${kid.profile.name}'s data saved to their Google Drive.\n\nFolder: Spinini - ${kid.profile.name}/`);
    } catch (e: any) {
      Alert.alert("Backup Failed", e?.message ?? "Check internet connection.");
    } finally {
      setKidLoadingId(null);
    }
  }

  function handleKidGoogleSuccess(kidId: string, account: GoogleAccount) {
    dispatch({ type: "SET_KID_GOOGLE", kidId, account });
  }

  const lastBackup = state.parentSettings.lastBackupAt;

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>☁️ Google Drive Backup</Text>
      <Text style={styles.sub}>Data organized by child in your Google Drive</Text>

      {/* ── Parent Google Account ── */}
      <SectionHdr>Parent Google Account</SectionHdr>
      <GoogleSignIn
        scopes={GOOGLE_SCOPES}
        onSuccess={handleParentGoogleSuccess}
        label="Connect Google Account"
        existingAccount={googleAccount}
        onSignOut={() =>
          Alert.alert("Disconnect", "Remove Google account?", [
            { text: "Cancel", style: "cancel" },
            { text: "Disconnect", style: "destructive", onPress: () => dispatch({ type: "CLEAR_PARENT_GOOGLE" }) },
          ])
        }
      />

      {googleAccount ? (
        <>
          {/* ── Drive folder structure info ── */}
          <SectionHdr>Drive Folder Structure</SectionHdr>
          <Card>
            <Text style={styles.folderRoot}>📁 Spinini/</Text>
            <Text style={styles.folderSub}>  📁 _family/ (parent settings)</Text>
            {state.kids.map(k => (
              <Text key={k.profile.id} style={styles.folderSub}>  📁 {k.profile.name}/</Text>
            ))}
            <Text style={styles.folderNote}>Each child folder contains: profile, school, chores, rewards, journal, creativity, reading, wishes, money, contacts, fitness</Text>
          </Card>

          {/* ── Auto backup toggle ── */}
          <SectionHdr>Settings</SectionHdr>
          <Card>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Automatic Daily Backup</Text>
                <Text style={styles.cardSub}>Backs up all kids when app opens each day</Text>
              </View>
              <Switch
                value={backupEnabled}
                onValueChange={v => dispatch({ type: "SET_PARENT_SETTINGS", payload: { backupEnabled: v } })}
                trackColor={{ true: Colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </Card>

          {/* ── Backup status ── */}
          <SectionHdr>Backup Status</SectionHdr>
          <Card>
            <View style={styles.statusRow}>
              <View style={styles.statusItem}>
                <Text style={{ fontSize: 28 }}>📱</Text>
                <Text style={styles.statusLabel}>Last backed up</Text>
                <Text style={styles.statusValue}>{fmtTime(lastBackup)}</Text>
              </View>
              <View style={styles.statusDivider} />
              <View style={styles.statusItem}>
                <Text style={{ fontSize: 28 }}>☁️</Text>
                <Text style={styles.statusLabel}>On Drive</Text>
                <Text style={styles.statusValue}>{fmtTime(manifest?.backedUpAt)}</Text>
              </View>
            </View>
          </Card>

          {/* ── Per-kid backup cards ── */}
          <SectionHdr>Kids on Google Drive</SectionHdr>
          {state.kids.map(kid => {
            const kidEntry = manifest?.kids.find(k => k.id === kid.profile.id);
            return (
              <Card key={kid.profile.id}>
                <View style={styles.kidCardHeader}>
                  <View style={[styles.kidDot, { backgroundColor: kid.profile.color ?? Colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{kid.profile.name}</Text>
                    <Text style={styles.cardSub}>
                      {kidEntry ? `☁️ Backed up ${fmtTime(kidEntry.backedUpAt)}` : "☁️ Not yet backed up"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.folderPath}>Spinini / {kid.profile.name} /</Text>
                <View style={styles.categoryChips}>
                  {["profile","school","chores","rewards","journal","creativity","reading","wishes","money","contacts","fitness"].map(c => (
                    <View key={c} style={[styles.chip, kidEntry && styles.chipDone]}>
                      <Text style={[styles.chipText, kidEntry && styles.chipTextDone]}>{c}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            );
          })}

          {/* ── Actions ── */}
          <SectionHdr>Actions</SectionHdr>
          <Card>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.primary }]}
              onPress={runBackupAll}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.actionBtnText}>☁️  Back Up All Kids Now</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={runRestore}
              disabled={loading}
            >
              <Text style={[styles.actionBtnText, { color: Colors.warning }]}>↩  Restore from Drive</Text>
            </TouchableOpacity>
          </Card>

          {/* ── Kid Google Accounts ── */}
          <SectionHdr>Kids' Own Google Accounts</SectionHdr>
          <Text style={styles.kidAccountNote}>
            When a child's Google account is linked, they can back up their own data to their personal Drive under "Spinini - [Name]/"
          </Text>
          {state.kids.map(kid => (
            <Card key={kid.profile.id}>
              <View style={styles.kidCardHeader}>
                <View style={[styles.kidDot, { backgroundColor: kid.profile.color ?? Colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{kid.profile.name}</Text>
                  <Text style={styles.cardSub}>
                    {kid.profile.googleAccount
                      ? kid.profile.googleAccount.email
                      : "No Google account linked"}
                  </Text>
                </View>
              </View>

              {kid.profile.googleAccount ? (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { flex: 1, backgroundColor: Colors.primary, paddingVertical: 10 }]}
                    onPress={() => backupKidOwn(kid)}
                    disabled={kidLoadingId === kid.profile.id}
                  >
                    {kidLoadingId === kid.profile.id
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={[styles.actionBtnText, { fontSize: FontSize.sm }]}>☁️ Back Up Now</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { flex: 1, backgroundColor: Colors.cardLight, paddingVertical: 10 }]}
                    onPress={() =>
                      Alert.alert("Unlink", `Remove ${kid.profile.name}'s Google account?`, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Unlink", style: "destructive", onPress: () => dispatch({ type: "CLEAR_KID_GOOGLE", kidId: kid.profile.id }) },
                      ])
                    }
                  >
                    <Text style={[styles.actionBtnText, { color: Colors.error, fontSize: FontSize.sm }]}>Unlink</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ marginTop: 8 }}>
                  <GoogleSignIn
                    scopes={KID_SCOPES}
                    onSuccess={acct => handleKidGoogleSuccess(kid.profile.id, acct)}
                    label={`Link ${kid.profile.name}'s Google`}
                    compact
                  />
                </View>
              )}
            </Card>
          ))}
          {state.kids.length === 0 && (
            <Card><Text style={styles.cardSub}>No kids added yet.</Text></Card>
          )}
        </>
      ) : (
        <View style={styles.noAcctBox}>
          <Text style={{ fontSize: 48, textAlign: "center" }}>☁️</Text>
          <Text style={styles.noAcctTitle}>Connect Google Drive</Text>
          <Text style={styles.noAcctSub}>
            Connect a parent Google account to back up all family data organized by child name.
            {"\n\n"}If the device is lost or reset, everything can be fully restored on any device.
          </Text>
        </View>
      )}
    </ScreenContainer>
  );
}

function SectionHdr({ children }: { children: string }) {
  return <Text style={styles.sectionHdr}>{children}</Text>;
}
function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg },
  sectionHdr: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginTop: Spacing.md, marginBottom: 8 },
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 8, ...Shadow.sm },
  cardTitle: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusRow: { flexDirection: "row", alignItems: "center" },
  statusItem: { flex: 1, alignItems: "center", gap: 4 },
  statusDivider: { width: 1, height: 60, backgroundColor: Colors.border },
  statusLabel: { fontSize: 11, color: Colors.textSecondary, textAlign: "center" },
  statusValue: { fontSize: 11, fontWeight: "700", color: Colors.textPrimary, textAlign: "center" },
  folderRoot: { fontFamily: "monospace", fontSize: FontSize.sm, fontWeight: "700", color: Colors.primary, marginBottom: 2 },
  folderSub: { fontFamily: "monospace", fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 1 },
  folderNote: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 8, lineHeight: 16 },
  folderPath: { fontSize: FontSize.xs, color: Colors.textMuted, fontFamily: "monospace", marginTop: 6, marginBottom: 6 },
  kidCardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  kidDot: { width: 12, height: 12, borderRadius: 6 },
  categoryChips: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, backgroundColor: Colors.cardLight },
  chipDone: { backgroundColor: Colors.primary + "20" },
  chipText: { fontSize: 10, fontWeight: "600", color: Colors.textMuted },
  chipTextDone: { color: Colors.primary },
  kidAccountNote: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 8, lineHeight: 18 },
  actionBtn: { borderRadius: Radius.lg, padding: 14, alignItems: "center", marginTop: 8, marginHorizontal: Spacing.xs },
  actionBtnSecondary: { backgroundColor: Colors.warning + "20", borderWidth: 1, borderColor: Colors.warning + "40" },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  noAcctBox: { marginTop: Spacing.xl, alignItems: "center", gap: 12, padding: Spacing.xl, backgroundColor: Colors.cardLight, borderRadius: Radius.xl },
  noAcctTitle: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  noAcctSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
});
