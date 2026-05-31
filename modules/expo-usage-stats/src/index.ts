import { NativeModule, requireNativeModule } from "expo";
import { Platform } from "react-native";

export interface AppUsageStat {
  packageName: string;
  appName: string;
  totalMinutes: number;
  lastUsedAt: number;
}

interface ExpoUsageStatsModule extends NativeModule {
  hasUsagePermission(): boolean;
  openUsageSettings(): void;
  getAppUsage(days: number): Promise<AppUsageStat[]>;
  getAppUsageToday(packageName: string): Promise<number>;
  getInstalledApps(): Promise<{ packageName: string; appName: string }[]>;
}

let mod: ExpoUsageStatsModule | null = null;

if (Platform.OS === "android") {
  try {
    mod = requireNativeModule<ExpoUsageStatsModule>("ExpoUsageStats");
  } catch {}
}

const stub = {
  hasUsagePermission: () => false,
  openUsageSettings: () => {},
  getAppUsage: async (_days: number) => [] as AppUsageStat[],
  getAppUsageToday: async (_pkg: string) => 0,
  getInstalledApps: async () => [] as { packageName: string; appName: string }[],
};

export const UsageStats = mod ?? stub;

export default UsageStats;
