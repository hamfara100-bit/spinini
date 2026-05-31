export interface UsageStats {
  appId: string;
  appName: string;
  totalMinutes: number;
  lastUsed: string; // ISO timestamp
}

export interface BlockedAttempt {
  appId: string;
  appName: string;
  blockedAt: string; // ISO timestamp
  reason: string;
}

export interface GuardianStatus {
  // Permissions
  usageStatsGranted: boolean;
  accessibilityEnabled: boolean;
  deviceAdminActive: boolean;
  vpnActive: boolean;
  // iOS
  screenTimeAuthorized: boolean;
  contentFilterEnabled: boolean;
  // Platform
  platform: "android" | "ios" | "unknown";
  kioskMode: boolean;
}

export interface VpnConfig {
  enabled: boolean;
  blocklistCategories: string[]; // "explicit", "violence", "gambling", "ads"
  customBlockedDomains: string[];
  customAllowedDomains: string[];
  dnsServer?: string; // custom DNS (e.g. "1.1.1.3" for Cloudflare family)
}

export interface AppBlockRule {
  packageName: string; // Android package / iOS bundleId
  appName: string;
  blocked: boolean;
  limitMinutes?: number;
  allowedHours?: { start: string; end: string }; // "HH:MM"
}
