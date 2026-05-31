import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../lib/theme";
import { GOOGLE_DISCOVERY, getClientId, fetchGoogleUserInfo } from "../lib/google-auth";
import type { GoogleAccount } from "../lib/data/types";

WebBrowser.maybeCompleteAuthSession();

interface Props {
  scopes: string[];
  onSuccess: (account: GoogleAccount) => void;
  onError?: (err: string) => void;
  label?: string;
  compact?: boolean;
  existingAccount?: GoogleAccount;
  onSignOut?: () => void;
}

export function GoogleSignIn({
  scopes,
  onSuccess,
  onError,
  label = "Sign in with Google",
  compact = false,
  existingAccount,
  onSignOut,
}: Props) {
  const [loading, setLoading] = useState(false);

  const redirectUri = AuthSession.makeRedirectUri({ scheme: "famkids" });

  const [, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: getClientId(),
      scopes,
      redirectUri,
      responseType: AuthSession.ResponseType.Token,
      extraParams: { access_type: "offline" },
    },
    GOOGLE_DISCOVERY
  );

  async function handleSignIn() {
    setLoading(true);
    try {
      const result = await promptAsync();
      if (result.type !== "success") {
        onError?.(result.type === "cancel" ? "Cancelled" : "Sign-in failed");
        return;
      }
      const accessToken = result.params.access_token;
      const user = await fetchGoogleUserInfo(accessToken);
      const expiresIn = result.params.expires_in ? parseInt(result.params.expires_in) * 1000 : 3600000;
      onSuccess({ ...user, accessToken, expiresAt: Date.now() + expiresIn });
    } catch (e: any) {
      onError?.(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  // Already signed in — show account card
  if (existingAccount) {
    return (
      <View style={[styles.accountCard, compact && styles.accountCardCompact]}>
        {existingAccount.picture ? (
          <Image source={{ uri: existingAccount.picture }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>{existingAccount.name[0]}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.accountName}>{existingAccount.name}</Text>
          <Text style={styles.accountEmail}>{existingAccount.email}</Text>
        </View>
        {onSignOut && (
          <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.btn, compact && styles.btnCompact]}
      onPress={handleSignIn}
      disabled={loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <>
          <Text style={styles.gLogo}>G</Text>
          <Text style={[styles.btnText, compact && styles.btnTextCompact]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#4285F4", borderRadius: Radius.lg, paddingVertical: 14,
    paddingHorizontal: Spacing.lg, gap: 10, ...Shadow.sm,
  },
  btnCompact: { paddingVertical: 10, paddingHorizontal: Spacing.md },
  gLogo: { fontSize: 20, fontWeight: "900", color: "#fff", fontStyle: "italic" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.base },
  btnTextCompact: { fontSize: FontSize.sm },
  accountCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg,
    padding: Spacing.md, ...Shadow.sm,
  },
  accountCardCompact: { padding: Spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { backgroundColor: "#4285F4", alignItems: "center", justifyContent: "center" },
  avatarLetter: { color: "#fff", fontWeight: "800", fontSize: 20 },
  accountName: { fontWeight: "700", color: Colors.textPrimary, fontSize: FontSize.base },
  accountEmail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  signOutBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.md, backgroundColor: Colors.cardLight },
  signOutText: { fontSize: FontSize.sm, color: Colors.error, fontWeight: "600" },
});
