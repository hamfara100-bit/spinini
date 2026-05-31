import { Alert } from "react-native";
import { Camera } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as Contacts from "expo-contacts";
import { AudioModule } from "expo-audio";

export type PermissionKey =
  | "camera"
  | "microphone"
  | "photoLibrary"
  | "location"
  | "locationBackground"
  | "notifications"
  | "contacts";

export async function requestPermission(key: PermissionKey): Promise<boolean> {
  switch (key) {
    case "camera": {
      const { status } = await Camera.requestCameraPermissionsAsync();
      return status === "granted";
    }
    case "microphone": {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      return status.granted;
    }
    case "photoLibrary": {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      return status === "granted";
    }
    case "location": {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === "granted";
    }
    case "locationBackground": {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== "granted") return false;
      const { status } = await Location.requestBackgroundPermissionsAsync();
      return status === "granted";
    }
    case "notifications": {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === "granted";
    }
    case "contacts": {
      const { status } = await Contacts.requestPermissionsAsync();
      return status === "granted";
    }
    default:
      return false;
  }
}

export async function checkPermission(key: PermissionKey): Promise<boolean> {
  switch (key) {
    case "camera": {
      const { status } = await Camera.getCameraPermissionsAsync();
      return status === "granted";
    }
    case "microphone": {
      const status = await AudioModule.getRecordingPermissionsAsync();
      return status.granted;
    }
    case "photoLibrary": {
      const { status } = await MediaLibrary.getPermissionsAsync();
      return status === "granted";
    }
    case "location": {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === "granted";
    }
    case "locationBackground": {
      const { status } = await Location.getBackgroundPermissionsAsync();
      return status === "granted";
    }
    case "notifications": {
      const { status } = await Notifications.getPermissionsAsync();
      return status === "granted";
    }
    case "contacts": {
      const { status } = await Contacts.getPermissionsAsync();
      return status === "granted";
    }
    default:
      return false;
  }
}

export function promptPermissionDenied(name: string) {
  Alert.alert(
    `${name} Permission Required`,
    `Please enable ${name} permission in your device settings to use this feature.`,
    [{ text: "OK" }]
  );
}
