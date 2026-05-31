import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

// Gracefully handle missing native module on iOS / dev builds
let LoudAlarm: {
  forceMaxVolume: () => void;
  getDefaultAlarmUri: () => string | null;
  playSystemAlarm: () => void;
  stopSystemAlarm: () => void;
  hasDndAccess: () => boolean;
} | null = null;

try {
  if (Platform.OS === "android") {
    LoudAlarm = requireNativeModule("ExpoLoudAlarm");
  }
} catch {}

/** Set Android device volume to maximum (STREAM_ALARM) and disable silent mode */
export function forceMaxVolume(): void {
  try { LoudAlarm?.forceMaxVolume(); } catch {}
}

/** Get the URI of the device's default alarm sound */
export function getDefaultAlarmUri(): string | null {
  try { return LoudAlarm?.getDefaultAlarmUri() ?? null; } catch { return null; }
}

/** Play system alarm ringtone immediately */
export function playSystemAlarm(): void {
  try { LoudAlarm?.playSystemAlarm(); } catch {}
}

/** Stop the system alarm ringtone */
export function stopSystemAlarm(): void {
  try { LoudAlarm?.stopSystemAlarm(); } catch {}
}

/** Whether the app has Do Not Disturb policy access */
export function hasDndAccess(): boolean {
  try { return LoudAlarm?.hasDndAccess() ?? false; } catch { return false; }
}
