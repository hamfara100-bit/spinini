/**
 * SecureStore helpers for sensitive tokens and codes.
 * Google OAuth tokens and the PIN recovery code live here (device keychain/keystore)
 * rather than in plain AsyncStorage.
 */

import * as SecureStore from "expo-secure-store";

const GOOGLE_KEY = (accountId: string) => `google_tokens_${accountId}`;
const RECOVERY_KEY = "pin_recovery_code";

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export async function saveGoogleTokens(accountId: string, tokens: GoogleTokens): Promise<void> {
  try {
    await SecureStore.setItemAsync(GOOGLE_KEY(accountId), JSON.stringify(tokens));
  } catch {}
}

export async function getGoogleTokens(accountId: string): Promise<GoogleTokens | null> {
  try {
    const raw = await SecureStore.getItemAsync(GOOGLE_KEY(accountId));
    if (!raw) return null;
    return JSON.parse(raw) as GoogleTokens;
  } catch {
    return null;
  }
}

export async function deleteGoogleTokens(accountId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(GOOGLE_KEY(accountId));
  } catch {}
}

export async function saveRecoveryCode(code: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(RECOVERY_KEY, code);
  } catch {}
}

export async function getRecoveryCode(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(RECOVERY_KEY);
  } catch {
    return null;
  }
}

export async function deleteRecoveryCode(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(RECOVERY_KEY);
  } catch {}
}
