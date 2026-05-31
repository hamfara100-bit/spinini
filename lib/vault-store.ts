/**
 * Vault password storage using expo-secure-store.
 *
 * Vault entry metadata (label, username, id) lives in the main Redux store /
 * AsyncStorage, but passwords are stored separately in the device's secure
 * enclave (Keychain on iOS, Android Keystore on Android) so they aren't
 * readable from a plain AsyncStorage dump.
 *
 * Key format: vault_pwd_<entryId>
 */

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = (entryId: string) => `vault_pwd_${entryId}`;

/** Save (or overwrite) a vault password for the given entry ID. */
export async function saveVaultPassword(entryId: string, password: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY(entryId), password);
  } catch {
    // SecureStore unavailable (e.g. simulator without biometrics) — no-op
  }
}

/** Retrieve the vault password for an entry. Returns null if not found. */
export async function getVaultPassword(entryId: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY(entryId));
  } catch {
    return null;
  }
}

/** Delete the stored password when an entry is removed. */
export async function deleteVaultPassword(entryId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY(entryId));
  } catch {}
}

/** Whether SecureStore is usable on this device/platform. */
export function isSecureStoreAvailable(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}
