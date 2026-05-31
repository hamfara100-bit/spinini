/**
 * SecureStore helpers for sensitive tokens and codes.
 * The PIN recovery code lives here (device keychain/keystore) rather than in
 * plain AsyncStorage.
 */

import * as SecureStore from "expo-secure-store";

const RECOVERY_KEY = "pin_recovery_code";

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
