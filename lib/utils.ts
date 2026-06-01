import { Alert, Platform } from "react-native";

/**
 * Cross-platform destructive confirm.
 * On web, Alert.alert is a no-op, so we fall back to window.confirm.
 * On iOS/Android the native Alert sheet is used as normal.
 */
export function confirmDestructive(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel = "Delete",
): void {
  if (Platform.OS === "web") {
    const ok = window.confirm(message ? `${title}\n${message}` : title);
    if (ok) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}

/** Cross-platform info/validation alert. On web falls back to window.alert. */
export function alertMessage(title: string, message?: string): void {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * RFC-4122 v4 UUID. Required wherever a value goes into a Postgres `uuid` column
 * (e.g. the Supabase sync_events.id). `uid()` produces short non-UUID strings
 * that Postgres rejects, so use this for those ids.
 */
export function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function today(): string {
  return new Date().toISOString().split("T")[0];
}

export function nowIso(): string {
  return new Date().toISOString();
}

export const POINT_VALUE = 0.50;
export function pointsToMoney(pts: number | string): string {
  const n = typeof pts === "string" ? (parseInt(pts) || 0) : pts;
  return "$" + (n * POINT_VALUE).toFixed(2);
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

export function dayLabel(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

import * as Crypto from "expo-crypto";

/** SHA-256 hash of the PIN with a fixed domain prefix. Async via expo-crypto. */
export async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    "famkids-pin-v1:" + pin,
  );
}
