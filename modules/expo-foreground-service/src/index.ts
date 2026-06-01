import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

// Gracefully degrade on iOS / dev builds where the native module isn't present.
let Native: {
  start: () => boolean;
  stop: () => boolean;
  isRunning: () => boolean;
  isBatteryExempt: () => boolean;
  requestBatteryExemption: () => boolean;
} | null = null;

try {
  if (Platform.OS === "android") {
    Native = requireNativeModule("ExpoForegroundService");
  }
} catch {}

/**
 * Start the persistent Android foreground service that keeps the app process —
 * and therefore the Supabase sync poll — alive while the screen is off, so
 * family alerts/calls/messages still ring and notify.
 */
export function startForegroundService(): void {
  try { Native?.start(); } catch {}
}

/** Stop the keep-alive foreground service. */
export function stopForegroundService(): void {
  try { Native?.stop(); } catch {}
}

/** Whether the keep-alive service is currently running. */
export function isForegroundServiceRunning(): boolean {
  try { return Native?.isRunning() ?? false; } catch { return false; }
}

/** Whether the app is already exempt from battery optimization (Doze). */
export function isBatteryExempt(): boolean {
  try { return Native?.isBatteryExempt() ?? false; } catch { return false; }
}

/** Prompt the user to exempt the app from battery optimization (system dialog). */
export function requestBatteryExemption(): void {
  try { Native?.requestBatteryExemption(); } catch {}
}
