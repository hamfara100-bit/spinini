import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

// Gracefully degrade on iOS / dev builds where the native module isn't present.
let Native: {
  start: () => boolean;
  stop: () => boolean;
  isRunning: () => boolean;
  isBatteryExempt: () => boolean;
  requestBatteryExemption: () => boolean;
  startTicker: (intervalMs: number) => boolean;
  stopTicker: () => boolean;
  addListener?: (name: string, cb: (e: any) => void) => { remove: () => void };
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

/**
 * Start a NATIVE heartbeat that fires `onTick` every `intervalMs` ms on its own
 * OS thread — unlike a JS setInterval, it keeps firing while the app is
 * backgrounded / screen off, so the caller can drive the sync poll in the
 * background. Returns true if the native ticker started.
 */
export function startNativeTicker(intervalMs: number): boolean {
  try { return Native?.startTicker(intervalMs) ?? false; } catch { return false; }
}

/** Stop the native heartbeat. */
export function stopNativeTicker(): void {
  try { Native?.stopTicker(); } catch {}
}

/** Subscribe to the native heartbeat. Returns an unsubscribe handle. */
export function addTickListener(cb: () => void): { remove: () => void } {
  try { return Native?.addListener?.("onTick", cb) ?? { remove: () => {} }; }
  catch { return { remove: () => {} }; }
}
