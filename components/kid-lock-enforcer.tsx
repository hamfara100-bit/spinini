/**
 * KidLockEnforcer — makes a remote "instant lock" actually take over the device.
 *
 * Mounted once in the kid tab layout (so it runs no matter which tab the child
 * is on). When the parent locks the device:
 *   1) it pops the app to the FRONT (native full-screen intent) even if the
 *      child is in another app or the screen is off, and
 *   2) routes to the un-leaveable /lock screen, and
 *   3) if the child tries to leave (Home / app switch) while still locked, it
 *      pulls the app straight back to the front.
 */
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useRouter } from "expo-router";
import { useData } from "../lib/data/store";
import { isLocked } from "../lib/data/logic";
import { bringToFront } from "expo-loud-alarm";

export function KidLockEnforcer({ kidId }: { kidId: string }) {
  const { state } = useData();
  const router = useRouter();
  const kid = state.kids.find(k => k.profile.id === kidId);
  const locked = !!kid && isLocked(kid) && !kid.rules.freeMode;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const lastFrontRef = useRef(0);

  const lockMsg = kid?.rules.lockMessage || "Your device is locked 🔒";

  // On the transition into a locked state, surface the app + lock screen.
  const wasLocked = useRef(false);
  useEffect(() => {
    if (locked && !wasLocked.current) {
      try { bringToFront("🔒 Device Locked", lockMsg); } catch {}
      router.replace(`/lock?id=${kidId}` as any);
    }
    wasLocked.current = locked;
  }, [locked, kidId]);

  // If the child switches away while locked, pull the app back to the front.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (!lockedRef.current) return;
      if (next === "background" || next === "inactive") {
        const now = Date.now();
        if (now - lastFrontRef.current < 1500) return; // debounce re-launch storms
        lastFrontRef.current = now;
        try { bringToFront("🔒 Device Locked", lockMsg); } catch {}
      }
    });
    return () => sub.remove();
  }, [lockMsg]);

  return null;
}
