/**
 * ParentOfflineWatcher — detects when a child's device stops checking in
 * (off / force-stopped / uninstalled / no network) and notifies the parent.
 *
 * This is the no-Firebase substitute for "the app got killed": we can't WAKE a
 * dead phone, but we can tell you it went dark. Heartbeats (DEVICE_HEARTBEAT)
 * arrive every ~4 min while the kid device is alive; if one is >12 min old we
 * flag that child offline, and clear it when they check back in.
 *
 * Mounted once in the parent tab layout.
 */
import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { useData } from "../lib/data/store";

const OFFLINE_AFTER_MS = 12 * 60 * 1000; // 3 missed heartbeats

export function ParentOfflineWatcher() {
  const { state } = useData();
  const [now, setNow] = useState(Date.now());
  const offlineRef = useRef<Set<string>>(new Set());

  // Re-evaluate staleness every minute (offline is time-based, not event-based).
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (state.deviceRole === "kid") return; // only the parent watches
    for (const kid of state.kids) {
      const seen = kid.lastSeen ? new Date(kid.lastSeen).getTime() : null;
      if (seen == null) continue; // never reported — don't false-alarm
      const isOffline = now - seen > OFFLINE_AFTER_MS;
      const wasOffline = offlineRef.current.has(kid.profile.id);

      if (isOffline && !wasOffline) {
        offlineRef.current.add(kid.profile.id);
        const mins = Math.round((now - seen) / 60000);
        Notifications.scheduleNotificationAsync({
          content: {
            title: `📵 ${kid.profile.name}'s phone went offline`,
            body: `No check-in for ${mins} min — may be off, out of battery, or closed. Tap to check on them (Location / Find Phone / call).`,
            sound: true,
            data: { route: "location" },
          },
          trigger: null,
        }).catch(() => {});
      } else if (!isOffline && wasOffline) {
        offlineRef.current.delete(kid.profile.id); // back online → re-arm
      }
    }
  }, [now, state.kids, state.deviceRole]);

  return null;
}
