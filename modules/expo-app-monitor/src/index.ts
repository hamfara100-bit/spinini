import { NativeModule, requireNativeModule } from "expo";
import { Platform } from "react-native";

export interface AppChangeEvent {
  packageName: string;
  isBlocked: boolean;
}

export interface SocialAlertEvent {
  kidId: string;
  appPackage: string;
  appName: string;
  keyword: string;
  severity: string;
  context: string;
}

export interface BadWordEvent {
  packageName: string;
  appName: string;
  title: string;
  text: string;
  word: string;
}

export interface UnknownContactEvent {
  type: "call" | "text";
  number: string;
  maskedNumber: string;
  timestamp: number;
  note: string;
}

interface ExpoAppMonitorModule extends NativeModule {
  isAccessibilityEnabled(): boolean;
  openAccessibilitySettings(): void;
  setBlockedPackages(packages: string[]): void;
  setStudyModePackages(packages: string[]): void;
  setStudyModeActive(active: boolean): void;
  setLockMode(active: boolean): void;
  setSocialMonitoring(enabled: boolean, kidId: string): void;
  setNotificationScan(enabled: boolean): void;
  isNotificationAccessEnabled(): boolean;
  openNotificationAccessSettings(): void;
  getCurrentPackage(): string;
  startMonitoring(): void;
  stopMonitoring(): void;
  getUnknownContacts(allowedNumbers: string[], sinceMs: number): UnknownContactEvent[];
}

let mod: ExpoAppMonitorModule | null = null;

if (Platform.OS === "android") {
  try {
    mod = requireNativeModule<ExpoAppMonitorModule>("ExpoAppMonitor");
  } catch {}
}

const stub = {
  isAccessibilityEnabled: () => false,
  openAccessibilitySettings: () => {},
  setBlockedPackages: () => {},
  setStudyModePackages: () => {},
  setStudyModeActive: () => {},
  setLockMode: () => {},
  setSocialMonitoring: () => {},
  setNotificationScan: () => {},
  isNotificationAccessEnabled: () => false,
  openNotificationAccessSettings: () => {},
  getCurrentPackage: () => "",
  startMonitoring: () => {},
  stopMonitoring: () => {},
  getUnknownContacts: (_: string[], __: number): UnknownContactEvent[] => [],
};

export const AppMonitor = (mod ?? stub) as unknown as ExpoAppMonitorModule;

export function addAppChangeListener(cb: (e: AppChangeEvent) => void) {
  if (!mod) return { remove: () => {} };
  // @ts-ignore — NativeModule event subscription, typed at runtime
  return (mod as any).addListener?.("onAppChange", cb) ?? { remove: () => {} };
}

export function addSocialAlertListener(cb: (e: SocialAlertEvent) => void) {
  if (!mod) return { remove: () => {} };
  // @ts-ignore
  return (mod as any).addListener?.("onSocialAlert", cb) ?? { remove: () => {} };
}

export function addBadWordListener(cb: (e: BadWordEvent) => void) {
  if (!mod) return { remove: () => {} };
  // @ts-ignore
  return (mod as any).addListener?.("onBadWord", cb) ?? { remove: () => {} };
}

export default AppMonitor;
