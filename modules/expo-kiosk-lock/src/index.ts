import { NativeModules, Platform } from "react-native";

const { ExpoKioskLock } = NativeModules;

export function startKioskMode(): void {
  if (Platform.OS === "android" && ExpoKioskLock) {
    ExpoKioskLock.startKioskMode();
  }
}

export function stopKioskMode(): void {
  if (Platform.OS === "android" && ExpoKioskLock) {
    ExpoKioskLock.stopKioskMode();
  }
}

export function isInKioskMode(): Promise<boolean> {
  if (Platform.OS === "android" && ExpoKioskLock) {
    return ExpoKioskLock.isInKioskMode();
  }
  return Promise.resolve(false);
}
