/**
 * Remote session manager — handles pairing, signaling, and command routing
 * between parent (viewer) and kid (host) devices.
 *
 * Pairing flow:
 *  1. Parent generates a 6-digit session code and displays it.
 *  2. Kid enters the code on their device.
 *  3. Both devices connect to the signaling relay (or same-LAN WebSocket).
 *  4. Host starts screen capture and streams frames.
 *  5. Viewer renders frames and sends RemoteCommands back.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RemoteSession, RemoteCommand, FrameInfo, ConnectionState } from "../modules/expo-remote-control/src/types";

// ─── Config ──────────────────────────────────────────────────────────────────

// Self-hosted relay WS — replace with your actual server URL.
// When parent and kid are on the same WiFi, set useLocalMode=true to skip relay.
export const RELAY_URL = "wss://relay.famkids.app/signal";
export const LOCAL_PORT = 9876;

export const DEFAULT_FRAME_INFO: FrameInfo = {
  width: 1080,
  height: 1920,
  fps: 10,
  quality: 60,
  bitrateKbps: 800,
};

// ─── Session code helpers ─────────────────────────────────────────────────────

export function generateSessionCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function makeSessionId(code: string, kidId: string): string {
  return `${kidId}-${code}`;
}

// ─── Persistent session storage ──────────────────────────────────────────────

const SESSION_KEY = "@famkids/remote-session";

export async function saveSession(session: RemoteSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<RemoteSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

// ─── Command helpers ──────────────────────────────────────────────────────────

export function makeTouchCommand(
  type: "down" | "move" | "up",
  normX: number,
  normY: number
): RemoteCommand {
  return { type: "touch", touch: { type, x: normX, y: normY } };
}

export function makeKeyCommand(keyCode: number): RemoteCommand {
  return { type: "key", keyCode };
}

export function makeScrollCommand(dx: number, dy: number): RemoteCommand {
  return { type: "scroll", scrollDeltaX: dx, scrollDeltaY: dy };
}

// ─── Latency tracker ─────────────────────────────────────────────────────────

export class LatencyTracker {
  private samples: number[] = [];

  record(ms: number) {
    this.samples.push(ms);
    if (this.samples.length > 20) this.samples.shift();
  }

  get avg(): number {
    if (this.samples.length === 0) return 0;
    return Math.round(this.samples.reduce((a, b) => a + b, 0) / this.samples.length);
  }

  get last(): number {
    return this.samples.at(-1) ?? 0;
  }
}

// ─── Connection quality ───────────────────────────────────────────────────────

export type Quality = "excellent" | "good" | "fair" | "poor";

export function connectionQuality(latencyMs: number): Quality {
  if (latencyMs < 80)  return "excellent";
  if (latencyMs < 200) return "good";
  if (latencyMs < 500) return "fair";
  return "poor";
}

export const QUALITY_COLOR: Record<Quality, string> = {
  excellent: "#34D399",
  good:      "#60A5FA",
  fair:      "#F59E0B",
  poor:      "#EF4444",
};

export const QUALITY_LABEL: Record<Quality, string> = {
  excellent: "Excellent",
  good:      "Good",
  fair:      "Fair",
  poor:      "Poor",
};
