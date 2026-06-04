/**
 * Android implementation — imports real native modules.
 * Metro automatically picks this file on Android instead of app-monitor-bridge.ts.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Android-only local module, no TS declarations needed
import { AppMonitor, addAppChangeListener, addSocialAlertListener, addBadWordListener } from "expo-app-monitor";
// @ts-ignore
import { DeviceLock } from "expo-device-lock";
// @ts-ignore
import { UsageStats } from "expo-usage-stats";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STATE_KEY = "@famkids/state/v1";
const BG_EVENTS_KEY = "@famkids/bg-events";
const OWN_PACKAGE = "com.famkids.app";

// True while the device is under a parent-triggered hard lock.
let kioskActive = false;

async function getState(): Promise<any | null> {
  try {
    const raw = await AsyncStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function pushEvent(ev: object) {
  try {
    const raw = await AsyncStorage.getItem(BG_EVENTS_KEY);
    const events = raw ? JSON.parse(raw) : [];
    events.push(ev);
    await AsyncStorage.setItem(BG_EVENTS_KEY, JSON.stringify(events.slice(-200)));
  } catch {}
}

const STRANGER_SEEN_KEY = "@famkids/stranger-seen"; // tracks already-reported (number+type) pairs

let subscription: { remove: () => void } | null = null;
let socialSubscription: { remove: () => void } | null = null;
let badWordSubscription: { remove: () => void } | null = null;
let usageInterval: ReturnType<typeof setInterval> | null = null;
let strangerInterval: ReturnType<typeof setInterval> | null = null;
let protectInterval: ReturnType<typeof setInterval> | null = null;

const PROTECT_SNAPSHOT_KEY = "@famkids/protect-snapshot";

/**
 * On a kid device, detect when a critical protection permission gets turned OFF
 * (tampering) and raise a synced TAMPER_ALERT so the parent is notified at once.
 * Compares the current grants to the last snapshot; only true→false transitions
 * alert. (Force-stop / uninstall can't be self-reported — that needs push.)
 */
async function checkProtection() {
  try {
    const st = await getState();
    const isKidDevice = st?.deviceRole === "kid" || (st?.deviceRole == null && (st?.kids?.length ?? 0) > 0);
    if (!isKidDevice) return;
    const kid = st?.kids?.[0];

    const safe = (f: () => boolean) => { try { return f(); } catch { return false; } };
    const current: Record<string, boolean> = {
      accessibility: safe(() => AppMonitor.isAccessibilityEnabled()),
      overlay:       safe(() => DeviceLock.hasOverlayPermission()),
      usage:         safe(() => UsageStats.hasUsagePermission()),
      notif_access:  safe(() => AppMonitor.isNotificationAccessEnabled()),
    };
    const LABELS: Record<string, string> = {
      accessibility: "Accessibility Service",
      overlay: "Display over other apps",
      usage: "Usage Access",
      notif_access: "Notification Access",
    };

    const raw = await AsyncStorage.getItem(PROTECT_SNAPSHOT_KEY);
    const prev: Record<string, boolean> | null = raw ? JSON.parse(raw) : null;
    await AsyncStorage.setItem(PROTECT_SNAPSHOT_KEY, JSON.stringify(current));
    if (!prev) return; // first run — establish baseline, don't alert

    const { uid } = await import("./utils");
    for (const key of Object.keys(current)) {
      if (prev[key] === true && current[key] === false) {
        await pushEvent({
          type: "TAMPER_ALERT_ADD",
          alert: {
            id: uid(),
            kidId: kid?.profile?.id ?? "",
            kidName: kid?.profile?.name ?? "your child",
            kind: key,
            label: LABELS[key] ?? key,
            detectedAt: new Date().toISOString(),
            acknowledged: false,
          },
        });
      }
    }
  } catch {}
}

export async function startAppMonitor() {
  // ── Real app usage sync — every 5 min ─────────────────────────────────────
  if (usageInterval) clearInterval(usageInterval);
  if (UsageStats.hasUsagePermission()) {
    usageInterval = setInterval(async () => {
      await syncRealUsage();
    }, 5 * 60 * 1000);
    await syncRealUsage();
  }

  // ── Stranger Alert — check call log + SMS every 5 min ─────────────────────
  if (strangerInterval) clearInterval(strangerInterval);
  strangerInterval = setInterval(checkStrangerAlerts, 5 * 60 * 1000);
  await checkStrangerAlerts();

  // ── Tamper detection — watch for protection permissions being turned off ──
  if (protectInterval) clearInterval(protectInterval);
  protectInterval = setInterval(checkProtection, 20 * 1000);
  await checkProtection();

  // ── Bad-word notification monitoring (independent of accessibility) ───────
  // Reads incoming notifications and, when one contains a bad word, queues a
  // synced BADWORD_ALERT so the PARENT device raises a loud alarm.
  try {
    const st0 = await getState();
    const isKidDevice = st0?.deviceRole === "kid" || (st0?.deviceRole == null && (st0?.kids?.length ?? 0) > 0);
    if (isKidDevice && AppMonitor.isNotificationAccessEnabled()) {
      AppMonitor.setNotificationScan(true);
      AppMonitor.startMonitoring(); // ensure broadcast receivers are live
      badWordSubscription?.remove();
      badWordSubscription = addBadWordListener(async (e: any) => {
        const st = await getState();
        const kid = st?.kids?.[0];
        const { uid } = await import("./utils");
        await pushEvent({
          type: "BADWORD_ALERT_ADD",
          alert: {
            id: uid(),
            kidId: kid?.profile?.id ?? "",
            kidName: kid?.profile?.name ?? "your child",
            appPackage: e.packageName ?? "",
            appName: e.appName ?? "an app",
            title: e.title ?? "",
            text: e.text ?? "",
            word: e.word ?? "",
            detectedAt: new Date().toISOString(),
            acknowledged: false,
          },
        });
        // (FCM push is fired centrally when the queued BADWORD_ALERT_ADD is
        // flushed through secureDispatch — see maybePushForAction.)
      });
    }
  } catch {}

  // ── App change monitoring via AccessibilityService ────────────────────────
  if (!AppMonitor.isAccessibilityEnabled()) return;

  const state = await getState();
  if (!state) return;

  const allBlocked = new Set<string>();
  const allStudyBlocked = new Set<string>();

  for (const kid of state.kids ?? []) {
    for (const pkg of kid.rules?.blockedPackages ?? []) allBlocked.add(pkg);
    for (const pkg of kid.rules?.studyBlockedPackages ?? []) allStudyBlocked.add(pkg);
  }

  AppMonitor.setBlockedPackages([...allBlocked]);
  AppMonitor.setStudyModePackages([...allStudyBlocked]);

  const studyActive = (state.kids ?? []).some((k: any) => k.rules?.studyMode);
  AppMonitor.setStudyModeActive(studyActive);

  // Enable social monitoring for kids who have it turned on
  const firstMonitoredKid = (state.kids ?? []).find((k: any) => k.rules?.webFilter?.enabled);
  if (firstMonitoredKid) {
    AppMonitor.setSocialMonitoring(true, firstMonitoredKid.profile.id);
  }

  AppMonitor.startMonitoring();

  // Social alert handler — stores alert in bg-events so it's dispatched when app opens
  socialSubscription?.remove();
  socialSubscription = addSocialAlertListener(async (alert: any) => {
    const { uid } = await import("./utils");
    await pushEvent({
      type: "SOCIAL_ALERT_ADD",
      alert: {
        id: uid(),
        kidId: alert.kidId,
        kidName: state.kids?.find((k: any) => k.profile.id === alert.kidId)?.profile?.name ?? "Unknown",
        appPackage: alert.appPackage,
        appName: alert.appName,
        matchedKeyword: alert.keyword,
        context: alert.context,
        severity: alert.severity,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      },
    });

    // Also push a parent notification
    Notifications.scheduleNotificationAsync({
      content: {
        title: `🔍 Social alert for ${state.kids?.find((k: any) => k.profile.id === alert.kidId)?.profile?.name ?? "your child"}`,
        body: `Keyword "${alert.keyword}" detected in ${alert.appName}`,
        sound: true,
      },
      trigger: null,
    }).catch(() => {});
  });

  subscription?.remove();
  subscription = addAppChangeListener(({ packageName, isBlocked }: { packageName: string; isBlocked: boolean }) => {
    // Returning to our own app → always drop the cover overlay.
    if (packageName === OWN_PACKAGE) {
      DeviceLock.hideLock();
      return;
    }
    if (isBlocked) {
      // Hard lock takes precedence — cover ANY other app instantly while the
      // native service yanks us back to the front.
      if (kioskActive) {
        DeviceLock.showLock("🔒 Locked by your parent");
        return;
      }
      const kidName = state.kids?.find((k: any) =>
        k.rules?.blockedPackages?.includes(packageName) ||
        (k.rules?.studyMode && k.rules?.studyBlockedPackages?.includes(packageName))
      )?.profile?.name ?? "your child";

      DeviceLock.showLock(`This app is blocked for ${kidName}`);

      Notifications.scheduleNotificationAsync({
        content: {
          title: "🚫 Blocked app opened",
          body: `${kidName} tried to open a blocked app (${packageName}).`,
        },
        trigger: null,
      }).catch(() => {});
    }
  });
}

/**
 * Turn the device-wide hard lock (kiosk) on/off. While on, the AccessibilityService
 * bounces every other app back to ours and we keep a cover overlay over anything
 * that flashes up in between. Called from the kid lock screen / lock enforcer.
 */
export function setKioskLock(active: boolean, allowedPackages?: string[]): void {
  kioskActive = active;
  try {
    AppMonitor.setLockMode(active);
    AppMonitor.setLockAllowedPackages(active ? (allowedPackages ?? []) : []);
    if (active) {
      // Make sure the receivers are live so the cover overlay can be shown.
      try { AppMonitor.startMonitoring(); } catch {}
    } else {
      try { DeviceLock.hideLock(); } catch {}
    }
  } catch {}
}

export function stopAppMonitor() {
  subscription?.remove();
  subscription = null;
  socialSubscription?.remove();
  socialSubscription = null;
  badWordSubscription?.remove();
  badWordSubscription = null;
  if (usageInterval)   { clearInterval(usageInterval);   usageInterval   = null; }
  if (strangerInterval){ clearInterval(strangerInterval); strangerInterval = null; }
  if (protectInterval) { clearInterval(protectInterval);  protectInterval  = null; }
  try { AppMonitor.stopMonitoring(); } catch {}
}

async function checkStrangerAlerts() {
  try {
    const state = await getState();
    if (!state?.kids?.length) return;

    // Look back 6 hours so we don't miss anything but don't repeat old entries
    const sinceMs = Date.now() - 6 * 60 * 60 * 1000;

    // Load already-reported set
    const seenRaw = await AsyncStorage.getItem(STRANGER_SEEN_KEY);
    const seen: Set<string> = new Set(seenRaw ? JSON.parse(seenRaw) : []);

    for (const kid of state.kids) {
      if (!kid?.profile?.id) continue;

      // Build allowed numbers for this kid from their commGuard
      const allowedNumbers: string[] = [
        ...(kid.commGuard?.allowedNumbers ?? []),
        ...(kid.commGuard?.contacts ?? []).map((c: any) => c.number).filter(Boolean),
      ];

      let events: any[] = [];
      try {
        events = AppMonitor.getUnknownContacts(allowedNumbers, sinceMs);
      } catch { continue; }

      for (const ev of events) {
        const key = `${kid.profile.id}:${ev.type}:${ev.maskedNumber}:${Math.floor(ev.timestamp / 60000)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const { uid } = await import("./utils");
        await pushEvent({
          type: "STRANGER_ALERT_ADD",
          alert: {
            id: uid(),
            kidId: kid.profile.id,
            kidName: kid.profile.name ?? "your child",
            contactType: ev.type,
            numberMasked: ev.maskedNumber,
            detectedAt: new Date(ev.timestamp).toISOString(),
            acknowledged: false,
            note: ev.note || undefined,
          },
        });

        Notifications.scheduleNotificationAsync({
          content: {
            title: `🚨 Unknown ${ev.type === "call" ? "call" : "text"} to ${kid.profile.name}`,
            body: `${ev.maskedNumber} — open Stranger Alert to review.`,
            sound: true,
          },
          trigger: null,
        }).catch(() => {});
      }
    }

    // Persist seen set (cap at 500 entries to avoid unbounded growth)
    const arr = [...seen].slice(-500);
    await AsyncStorage.setItem(STRANGER_SEEN_KEY, JSON.stringify(arr));
  } catch {}
}

async function syncRealUsage() {
  try {
    if (!UsageStats.hasUsagePermission()) return;
    const stats = await UsageStats.getAppUsage(1);
    if (!stats.length) return;
    const state = await getState();
    if (!state?.kids?.length) return;

    for (const kid of state.kids) {
      for (const s of stats) {
        if (s.totalMinutes > 0) {
          await pushEvent({
            type: "ADD_USAGE",
            kidId: kid.profile.id,
            appId: s.packageName,
            appName: s.appName,
            minutes: s.totalMinutes,
          });
        }
      }
    }
  } catch {}
}
