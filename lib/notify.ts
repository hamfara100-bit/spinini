/**
 * notify.ts — a single notification channel that ACTUALLY makes a sound.
 *
 * Why this exists: by default expo-notifications posts to a fallback channel
 * whose sound is the device's *system* notification sound — which is empty on
 * many devices/emulators, so you only get vibration. We create our own
 * high-importance channel pointing at a BUNDLED sound
 * (android/app/src/main/res/raw/spinini_notify.wav) and route alerts to it via a
 * channel-aware trigger, so they're audible everywhere.
 *
 * Android picks the sound from the CHANNEL (not the notification) on API 26+, so
 * the bundled sound on this channel is what plays.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

export const ALERT_CHANNEL = "spinini-alerts-v1";

/** Immediate-delivery trigger that routes to our audible channel on Android. */
export const ALERT_TRIGGER: any = Platform.OS === "android" ? { channelId: ALERT_CHANNEL } : null;

let ensured = false;

/** Create the audible alert channel (idempotent). Call once at app start. */
export async function ensureAlertChannel(): Promise<void> {
  if (Platform.OS !== "android" || ensured) return;
  ensured = true;
  try {
    await Notifications.setNotificationChannelAsync(ALERT_CHANNEL, {
      name: "Spinini Alerts",
      importance: Notifications.AndroidImportance.MAX,
      sound: "spinini_notify.wav",          // bundled — always audible
      vibrationPattern: [0, 350, 200, 350],
      enableVibrate: true,
      enableLights: true,
      lightColor: "#7C5CFF",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    });
  } catch {}
}

/** Post an immediate, audible alert notification. */
export function notify(title: string, body: string, data?: Record<string, any>): void {
  Notifications.scheduleNotificationAsync({
    content: { title, body, sound: "spinini_notify.wav", data: data ?? {} },
    trigger: ALERT_TRIGGER,
  }).catch(() => {});
}
