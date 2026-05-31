import { NativeModules, Platform } from "react-native";
import type {
  GuardianStatus,
  UsageStats,
  BlockedAttempt,
  AppBlockRule,
  VpnConfig,
} from "./types";

export type {
  GuardianStatus,
  UsageStats,
  BlockedAttempt,
  AppBlockRule,
  VpnConfig,
};

const { DeviceGuardianModule } = NativeModules;

function isAvailable(): boolean {
  return (
    (Platform.OS === "android" || Platform.OS === "ios") &&
    DeviceGuardianModule != null
  );
}

const fallbackStatus: GuardianStatus = {
  usageStatsGranted: false,
  accessibilityEnabled: false,
  deviceAdminActive: false,
  vpnActive: false,
  screenTimeAuthorized: false,
  contentFilterEnabled: false,
  platform: "unknown",
  kioskMode: false,
};

// ─── Status & Permissions ─────────────────────────────────────────────────────

export function getGuardianStatus(): Promise<GuardianStatus> {
  if (isAvailable()) return DeviceGuardianModule.getGuardianStatus();
  return Promise.resolve({ ...fallbackStatus, platform: (Platform.OS as any) ?? "unknown" });
}

export function requestUsageStatsPermission(): Promise<boolean> {
  if (isAvailable()) return DeviceGuardianModule.requestUsageStatsPermission();
  return Promise.resolve(false);
}

export function requestAccessibilityPermission(): Promise<void> {
  if (isAvailable()) return DeviceGuardianModule.requestAccessibilityPermission();
  return Promise.resolve();
}

export function requestDeviceAdminPermission(): Promise<boolean> {
  if (isAvailable()) return DeviceGuardianModule.requestDeviceAdminPermission();
  return Promise.resolve(false);
}

// ─── Usage & Blocked Attempts ─────────────────────────────────────────────────

export function getUsageStats(sinceMs: number): Promise<UsageStats[]> {
  if (isAvailable()) return DeviceGuardianModule.getUsageStats(sinceMs);
  return Promise.resolve([]);
}

export function getBlockedAttempts(): Promise<BlockedAttempt[]> {
  if (isAvailable()) return DeviceGuardianModule.getBlockedAttempts();
  return Promise.resolve([]);
}

export function getCurrentApp(): Promise<string> {
  if (isAvailable()) return DeviceGuardianModule.getCurrentApp();
  return Promise.resolve("");
}

// ─── App Blocking ─────────────────────────────────────────────────────────────

/** Android: set per-app block rules. iOS: use setScreenTimeApps instead. */
export function setAppBlockRules(rules: AppBlockRule[]): Promise<void> {
  if (isAvailable()) return DeviceGuardianModule.setAppBlockRules(JSON.stringify(rules));
  return Promise.resolve();
}

/**
 * iOS Screen Time API: block specific apps by bundle ID.
 * Requires com.apple.developer.family-controls entitlement + iOS 16+.
 */
export function setScreenTimeApps(blockedBundleIds: string[]): Promise<void> {
  if (Platform.OS === "ios" && DeviceGuardianModule != null) {
    return DeviceGuardianModule.setScreenTimeApps(blockedBundleIds);
  }
  return Promise.resolve();
}

/**
 * iOS Screen Time API: block entire app categories.
 * Valid categories: "games" | "social" | "entertainment" | "education" | "utilities"
 */
export function setAppCategoryBlocks(categories: string[]): Promise<void> {
  if (Platform.OS === "ios" && DeviceGuardianModule != null) {
    return DeviceGuardianModule.setAppCategoryBlocks(categories);
  }
  return Promise.resolve();
}

// ─── Downtime Scheduling ──────────────────────────────────────────────────────

/**
 * iOS Screen Time API: schedule a daily downtime window.
 * During downtime all apps are shielded (blocked).
 * Requires FamilyControls authorization + iOS 16+.
 */
export function setDowntimeSchedule(
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
): Promise<void> {
  if (Platform.OS === "ios" && DeviceGuardianModule != null) {
    return DeviceGuardianModule.setDowntimeSchedule(startHour, startMinute, endHour, endMinute);
  }
  return Promise.resolve();
}

export function clearDowntimeSchedule(): Promise<void> {
  if (Platform.OS === "ios" && DeviceGuardianModule != null) {
    return DeviceGuardianModule.clearDowntimeSchedule();
  }
  return Promise.resolve();
}

// ─── App Time Limits ──────────────────────────────────────────────────────────

/**
 * iOS Screen Time API: set daily time limit for a specific app.
 * Enforcement requires a DeviceActivityMonitorExtension target (separate app extension).
 */
export function setDailyAppLimit(bundleId: string, limitMinutes: number): Promise<void> {
  if (Platform.OS === "ios" && DeviceGuardianModule != null) {
    return DeviceGuardianModule.setDailyAppLimit(bundleId, limitMinutes);
  }
  return Promise.resolve();
}

// ─── Web Content Filtering ────────────────────────────────────────────────────

/**
 * iOS Screen Time API: configure web content filter via ManagedSettings.
 * allowedDomains and blockedDomains are domain strings, e.g. "tiktok.com".
 */
export function setWebContentFilter(
  enabled: boolean,
  allowedDomains: string[],
  blockedDomains: string[],
): Promise<void> {
  if (Platform.OS === "ios" && DeviceGuardianModule != null) {
    return DeviceGuardianModule.setWebContentFilter(enabled, allowedDomains, blockedDomains);
  }
  return Promise.resolve();
}

// ─── Device Lock ──────────────────────────────────────────────────────────────

/** Lock the device. Android: overlay. iOS: ManagedSettings app shield. */
export function lockDevice(message: string): Promise<void> {
  if (isAvailable()) return DeviceGuardianModule.lockDevice(message);
  return Promise.resolve();
}

export function unlockDevice(): Promise<void> {
  if (isAvailable()) return DeviceGuardianModule.unlockDevice();
  return Promise.resolve();
}

// ─── VPN / Content Filter ─────────────────────────────────────────────────────

export function startVpn(config: VpnConfig): Promise<boolean> {
  if (isAvailable()) return DeviceGuardianModule.startVpn(JSON.stringify(config));
  return Promise.resolve(false);
}

export function stopVpn(): Promise<void> {
  if (isAvailable()) return DeviceGuardianModule.stopVpn();
  return Promise.resolve();
}

// ─── MDM ──────────────────────────────────────────────────────────────────────

export function openMdmEnrollment(serverUrl: string): Promise<void> {
  if (isAvailable()) return DeviceGuardianModule.openMdmEnrollment(serverUrl);
  return Promise.resolve();
}
