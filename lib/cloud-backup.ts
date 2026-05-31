import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKUP_KEY = "app_backup_v1";

export interface BackupManifest {
  version: number;
  createdAt: string;
  size: number;
}

export async function exportBackup(stateJson: string): Promise<string> {
  const manifest: BackupManifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    size: stateJson.length,
  };
  const bundle = JSON.stringify({ manifest, data: stateJson });
  await AsyncStorage.setItem(BACKUP_KEY, bundle);
  return bundle;
}

export async function importBackup(bundle: string): Promise<string | null> {
  try {
    const { manifest, data } = JSON.parse(bundle);
    if (!manifest || !data) return null;
    await AsyncStorage.setItem(BACKUP_KEY, bundle);
    return data;
  } catch {
    return null;
  }
}

export async function getLastBackup(): Promise<BackupManifest | null> {
  try {
    const raw = await AsyncStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const { manifest } = JSON.parse(raw);
    return manifest ?? null;
  } catch {
    return null;
  }
}

export function formatBackupSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
