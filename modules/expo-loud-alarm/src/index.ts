import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

// Gracefully handle missing native module on iOS / dev builds
let LoudAlarm: {
  forceMaxVolume: () => void;
  getDefaultAlarmUri: () => string | null;
  playSystemAlarm: () => void;
  stopSystemAlarm: () => void;
  fireFullScreenAlarm: (title: string, body: string) => void;
  cancelFullScreenAlarm: () => void;
  bringToFront: (title: string, body: string) => void;
  hasDndAccess: () => boolean;
  openDndSettings: () => void;
  canUseFullScreenIntent: () => boolean;
  openFullScreenIntentSettings: () => void;
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

/**
 * Bring the app to the FRONT (full-screen intent) and start the looping alarm,
 * even when the phone is on another app or the screen is off/locked.
 */
export function fireFullScreenAlarm(title: string, body: string): void {
  try { LoudAlarm?.fireFullScreenAlarm(title, body); } catch {}
}

/** Cancel the full-screen alarm notification and stop the looping alarm. */
export function cancelFullScreenAlarm(): void {
  try { LoudAlarm?.cancelFullScreenAlarm(); } catch {}
}

/**
 * Bring the app to the FRONT silently (no alarm) — used by remote instant lock
 * so the kid's device pops to the foreground / lock screen even from another app
 * or with the screen off.
 */
export function bringToFront(title: string, body: string): void {
  try { LoudAlarm?.bringToFront(title, body); } catch {}
}

/** Whether the app has Do Not Disturb policy access */
export function hasDndAccess(): boolean {
  try { return LoudAlarm?.hasDndAccess() ?? false; } catch { return false; }
}

/** Open the system "Do Not Disturb access" settings for this app. */
export function openDndSettings(): void {
  try { LoudAlarm?.openDndSettings(); } catch {}
}

/** Android 14+: whether we're allowed to launch full-screen intents (alarms). */
export function canUseFullScreenIntent(): boolean {
  try { return LoudAlarm?.canUseFullScreenIntent() ?? true; } catch { return true; }
}

/** Open the Android 14+ "full-screen notifications" setting for this app. */
export function openFullScreenIntentSettings(): void {
  try { LoudAlarm?.openFullScreenIntentSettings(); } catch {}
}
