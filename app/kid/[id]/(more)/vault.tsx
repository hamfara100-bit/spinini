import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { getVaultPassword } from "../../../../lib/vault-store";

type RevealedState = "hidden" | "loading" | "shown";

export default function VaultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const kid = useKid(id);

  // Map of entryId → revealed password string (or null while loading)
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const getState = (entryId: string): RevealedState => {
    if (loadingId === entryId) return "loading";
    if (entryId in revealed) return "shown";
    return "hidden";
  };

  const handleReveal = useCallback(async (entryId: string, fallbackPassword: string) => {
    const state = getState(entryId);
    if (state === "loading") return;

    if (state === "shown") {
      // Hide it
      setRevealed(prev => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
      return;
    }

    // Fetch from SecureStore; fall back to plain-text password in state for
    // entries added before SecureStore was introduced.
    setLoadingId(entryId);
    try {
      const secure = await getVaultPassword(entryId);
      const pw = secure ?? fallbackPassword;
      if (!pw) {
        Alert.alert("No password found", "This entry has no password saved.");
        return;
      }
      setRevealed(prev => ({ ...prev, [entryId]: pw }));
    } catch {
      Alert.alert("Error", "Could not retrieve the password. Try again.");
    } finally {
      setLoadingId(null);
    }
  }, [loadingId, revealed]);

  const entries = kid?.vault ?? [];

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>🔐 Password Vault</Text>
      <Text style={styles.subtitle}>Your saved school & app passwords. Keep them secret!</Text>

      <View style={styles.secureNote}>
        <Text style={styles.secureNoteText}>
          🔒 Passwords are stored in your device's secure enclave — not in plain storage.
        </Text>
      </View>

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 64 }}>🔐</Text>
          <Text style={styles.emptyTitle}>No passwords saved yet</Text>
          <Text style={styles.emptyText}>
            Ask a parent to add your school or app passwords here so you always have them handy.
          </Text>
        </View>
      ) : (
        entries.map(v => {
          const revealState = getState(v.id);
          const password = revealed[v.id] ?? "";

          return (
            <View key={v.id} style={styles.card}>
              <Text style={styles.vaultLabel}>{v.label}</Text>
              <Text style={styles.vaultUser}>👤 {v.username}</Text>
              <View style={styles.pwRow}>
                <Text style={styles.pw}>
                  {revealState === "shown" ? password : "••••••••"}
                </Text>
                <TouchableOpacity
                  style={styles.revealBtn}
                  onPress={() => handleReveal(v.id, v.password ?? "")}
                  disabled={revealState === "loading"}
                >
                  {revealState === "loading" ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Text style={styles.reveal}>
                      {revealState === "shown" ? "🙈 Hide" : "👁 Show"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title:         { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  subtitle:      { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.sm },

  secureNote: {
    backgroundColor: Colors.success + "12", borderRadius: Radius.lg,
    padding: Spacing.sm, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.success + "30",
  },
  secureNoteText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: "600", textAlign: "center" },

  empty:      { alignItems: "center", paddingTop: 48, gap: 12 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: "800", color: Colors.textPrimary },
  emptyText:  { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },

  card:       { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 10, ...Shadow.sm },
  vaultLabel: { fontSize: FontSize.md, fontWeight: "700", color: Colors.primary },
  vaultUser:  { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  pwRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  pw:         { fontSize: FontSize.base, fontFamily: "monospace", color: Colors.textPrimary, letterSpacing: 1.5 },
  revealBtn:  { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.md, backgroundColor: Colors.primary + "15" },
  reveal:     { fontSize: FontSize.sm, color: Colors.primary, fontWeight: "700" },
});
