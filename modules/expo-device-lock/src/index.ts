import { NativeModule, requireNativeModule } from "expo";
import { Platform } from "react-native";

interface ExpoDeviceLockModule extends NativeModule {
  hasOverlayPermission(): boolean;
  openOverlaySettings(): void;
  showLock(message: string, imageUri?: string): void;
  hideLock(): void;
  isLocked(): boolean;
}

let mod: ExpoDeviceLockModule | null = null;

if (Platform.OS === "android") {
  try {
    mod = requireNativeModule<ExpoDeviceLockModule>("ExpoDeviceLock");
  } catch {}
}

const stub = {
  hasOverlayPermission: () => false,
  openOverlaySettings: () => {},
  showLock: (_message: string, _imageUri?: string) => {},
  hideLock: () => {},
  isLocked: () => false,
};

export const DeviceLock = (mod ?? stub) as unknown as ExpoDeviceLockModule;
export default DeviceLock;
