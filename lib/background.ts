/**
 * Background task infrastructure for Spinini.
 *
 * TaskManager.defineTask calls MUST be at module scope — they register handlers
 * before any React rendering happens. This file is imported once from _layout.tsx
 * which triggers registration automatically.
 */
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// ─── Constants ───────────────────────────────────────────────────────────────
export const LOCATION_TASK  = "famkids-location";
export const FETCH_TASK     = "famkids-fetch";
const STATE_KEY   = "@famkids/state/v1";
export const BG_EVENTS_KEY  = "@famkids/bg-events";

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function readState(): Promise<any | null> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function readBgEvents(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(BG_EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function clearBgEvents(): Promise<void> {
  await AsyncStorage.removeItem(BG_EVENTS_KEY);
}

async function pushEvent(event: object) {
  try {
    const events = await readBgEvents();
    events.push(event);
    await AsyncStorage.setItem(BG_EVENTS_KEY, JSON.stringify(events.slice(-200)));
  } catch {}
}

async function notify(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch {}
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isInDowntime(windows: any[]): boolean {
  const hhmm = nowHHMM();
  const day  = new Date().getDay();
  for (const w of windows ?? []) {
    if (!w.enabled || !w.days?.includes(day)) continue;
    if (w.startTime <= w.endTime) {
      if (hhmm >= w.startTime && hhmm < w.endTime) return true;
    } else {
      if (hhmm >= w.startTime || hhmm < w.endTime) return true;
    }
  }
  return false;
}

function todayMinutes(usage: any[]): number {
  const today = new Date().toISOString().split("T")[0];
  return (usage ?? []).find((u: any) => u.date === today)?.totalMinutes ?? 0;
}

// ─── Location task ────────────────────────────────────────────────────────────
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
  if (error || !data?.locations?.length) return;

  const state = await readState();
  if (!state) return;

  const kids: any[] = Array.isArray(state.kids) ? state.kids : [];

  for (const loc of data.locations) {
    // Guard: ensure we have valid coordinates
    if (typeof loc.coords?.latitude !== "number" || typeof loc.coords?.longitude !== "number") continue;

    const snap = {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? undefined,
      timestamp: new Date(loc.timestamp).toISOString(),
    };

    for (const kid of kids) {
      // Guard: skip malformed or deleted kid entries
      if (!kid?.profile?.id || typeof kid.profile.id !== "string") continue;

      // Push location update so the store can record it
      await pushEvent({ type: "LOCATION_UPDATE", kidId: kid.profile.id, location: snap });

      if (kid.rules?.freeMode) continue;

      // Safe-zone alerts
      for (const zone of kid.safeZones ?? []) {
        if (!zone?.id || typeof zone.lat !== "number" || typeof zone.lng !== "number") continue;
        const dist = haversineM(snap.lat, snap.lng, zone.lat, zone.lng);
        if (dist > zone.radiusMeters) {
          await notify(
            `📍 ${kid.profile.name} left ${zone.emoji ?? ""}${zone.name}`,
            `${kid.profile.name} is ~${Math.round(dist)}m away from ${zone.name}.`
          );
        }
      }
    }
  }
});

// ─── Smart Screen Time helpers ────────────────────────────────────────────────
function isTriggerActive(trigger: string, day: number, hhmm: string): boolean {
  switch (trigger) {
    case "always":               return true;
    case "weekend":              return day === 0 || day === 6;
    case "after_9pm_schoolnight": return (day >= 1 && day <= 4) && hhmm >= "21:00";
    case "holiday":              return false; // would need live holiday API
    case "exam_week":            return false; // no exam dates stored yet
    default:                     return false;
  }
}

// ─── Background fetch task ────────────────────────────────────────────────────
TaskManager.defineTask(FETCH_TASK, async () => {
  try {
    const state = await readState();
    if (!state?.kids?.length) return BackgroundFetch.BackgroundFetchResult.NoData;

    let acted = false;
    const hhmm = nowHHMM();
    const day  = new Date().getDay();
    const today = new Date().toISOString().split("T")[0];

    for (const kid of state.kids) {
      if (!kid?.profile?.id || kid.rules?.freeMode) continue;

      const used  = todayMinutes(kid.usage);
      // Effective limit = base limit + smart daily delta (extend/reduce rules)
      const limit = (kid.rules?.dailyLimitMinutes ?? 120)
                  + (kid.rules?.smartDeltaDate === today ? (kid.rules?.smartDeltaMinutes ?? 0) : 0);

      // ── Screen time limit hit ──────────────────────────────────────────────
      if (used >= limit && !kid.rules?.instantLocked) {
        await pushEvent({ type: "SET_INSTANT_LOCK", kidId: kid.profile.id, locked: true, message: "⏰ Screen time limit reached." });
        await notify(
          `⏰ ${kid.profile.name}'s screen time is up`,
          `Used ${used} min (limit: ${limit} min). Device is now locked.`
        );
        acted = true;
      }

      // ── Downtime window ────────────────────────────────────────────────────
      if (!kid.rules?.instantLocked && isInDowntime(kid.rules?.downtimeWindows)) {
        await pushEvent({ type: "SET_INSTANT_LOCK", kidId: kid.profile.id, locked: true, message: "🌙 Downtime — device locked." });
        await notify(
          `🌙 Downtime for ${kid.profile.name}`,
          "Device is locked during scheduled downtime."
        );
        acted = true;
      }

      // ── FunLock scheduled time ─────────────────────────────────────────────
      const fl = kid.rules?.funLock;
      if (fl?.enabled && fl?.scheduledTime && fl?.scheduledDays?.includes(day) && hhmm === fl.scheduledTime) {
        await pushEvent({ type: "SET_INSTANT_LOCK", kidId: kid.profile.id, locked: true, message: fl.message ?? "🔒 Locked by parent." });
        acted = true;
      }

      // ── Bedtime soft-lock notification ─────────────────────────────────────
      const bl = kid.rules?.bedtimeSoftLock;
      if (bl?.enabled && bl?.days?.includes(day) && hhmm === bl.start) {
        await notify(
          `🌙 Bedtime for ${kid.profile.name}`,
          bl.message ?? "Time to wind down and get ready for sleep!"
        );
        acted = true;
      }

      // ── Smart Screen Time rules ────────────────────────────────────────────
      const smartRules: any[] = (state.smartScreenTimeRules ?? []).filter(
        (r: any) => r.kidId === kid.profile.id && r.enabled
      );

      if (smartRules.length > 0) {
        let netDelta = 0;
        let hasLockNonEdu = false;
        const labels: string[] = [];

        for (const rule of smartRules) {
          if (!isTriggerActive(rule.trigger, day, hhmm)) continue;
          if (rule.action === "extend")            { netDelta += rule.minutesDelta; labels.push(rule.label); }
          else if (rule.action === "reduce")       { netDelta -= rule.minutesDelta; labels.push(rule.label); }
          else if (rule.action === "lock_non_edu") { hasLockNonEdu = true;          labels.push(rule.label); }
        }

        // Apply extend/reduce delta once per day (idempotent)
        const storedDate  = kid.rules?.smartDeltaDate  ?? "";
        const storedDelta = kid.rules?.smartDeltaMinutes ?? 0;
        if (storedDate !== today || storedDelta !== netDelta) {
          await pushEvent({
            type: "UPDATE_RULES",
            kidId: kid.profile.id,
            payload: { smartDeltaMinutes: netDelta, smartDeltaDate: today },
          });
          if (netDelta > 0) {
            await notify(
              `🧠 Smart Screen Time — ${kid.profile.name}`,
              `Today's limit extended by ${netDelta} min (${labels.join(", ")}).`
            );
            acted = true;
          } else if (netDelta < 0) {
            await notify(
              `🧠 Smart Screen Time — ${kid.profile.name}`,
              `Today's limit reduced by ${Math.abs(netDelta)} min (${labels.join(", ")}).`
            );
            acted = true;
          }
        }

        // lock_non_edu: lock the device at exactly 9pm on school nights
        if (hasLockNonEdu && !kid.rules?.instantLocked && hhmm === "21:00") {
          await pushEvent({
            type: "SET_INSTANT_LOCK",
            kidId: kid.profile.id,
            locked: true,
            message: `🌙 School night — ${labels.join(", ")} is active.`,
          });
          await notify(
            `🌙 School Night Lock — ${kid.profile.name}`,
            `It's 9pm on a school night. Non-educational apps are now locked.`
          );
          acted = true;
        }
      }
    }

    // ── Mood streak alerts ─────────────────────────────────────────────────────
    for (const kid of state.kids) {
      if (!kid?.profile?.id) continue;
      const entries: any[] = kid.moodEntries ?? [];
      if (entries.length < 4) continue;

      // Already alerted today?
      if ((kid.rules?.lastMoodAlertDate ?? "") === today) continue;

      // Sort descending by date
      const sorted = [...entries].sort((a: any, b: any) => b.date.localeCompare(a.date));

      // Count consecutive days with mood ≤ 2 starting from the most recent entry
      let streak = 0;
      for (const e of sorted) {
        if (e.mood <= 2) streak++;
        else break;
      }

      if (streak >= 4) {
        await pushEvent({
          type: "UPDATE_RULES",
          kidId: kid.profile.id,
          payload: { lastMoodAlertDate: today },
        });
        await notify(
          `💡 Check in with ${kid.profile.name}`,
          `${kid.profile.name} has logged low mood ${streak} days in a row. Open Mood Insights for conversation tips.`
        );
        acted = true;
      }
    }

    return acted
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ─── Start / stop ─────────────────────────────────────────────────────────────
export async function startBackgroundTasks(): Promise<void> {
  // Location task — requires background location permission
  try {
    const { status } = await Location.getBackgroundPermissionsAsync();
    if (status === "granted") {
      const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
      if (!running) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 60_000,       // poll every 60 s at most
          distanceInterval: 50,       // or every 50 m moved
          showsBackgroundLocationIndicator: true,
          pausesUpdatesAutomatically: false,
          ...(Platform.OS === "android" && {
            foregroundService: {
              notificationTitle: "Spinini Active",
              notificationBody: "Monitoring location and screen time.",
              notificationColor: "#7C5CFF",
            },
          }),
        });
      }
    }
  } catch {}

  // Background fetch task — iOS: system-driven (~15 min); Android: periodic job
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(FETCH_TASK);
    if (!registered) {
      await BackgroundFetch.registerTaskAsync(FETCH_TASK, {
        minimumInterval: 15 * 60,   // 15-minute minimum
        stopOnTerminate: false,     // keep running after app is swiped away
        startOnBoot: true,          // restart after device reboot
      });
    }
  } catch {}
}

export async function stopBackgroundTasks(): Promise<void> {
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
    if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  } catch {}
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(FETCH_TASK);
    if (registered) await BackgroundFetch.unregisterTaskAsync(FETCH_TASK);
  } catch {}
}
