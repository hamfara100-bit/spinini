/**
 * AppBlockSync — keeps the native AccessibilityService's block list in sync with
 * the kid's App Rules in real time. Without this, the block list was only set on
 * app start, so a parent toggling "Blocked" had no effect until the kid app
 * restarted. Mounted in the kid layout (the device where blocking is enforced).
 */
import { useEffect } from "react";
import { useData } from "../lib/data/store";
import { syncBlockedApps } from "../lib/app-monitor-bridge";

export function AppBlockSync() {
  const { state } = useData();
  // A signature of everything that affects the block list, so the effect re-runs
  // only when rules actually change.
  const sig = JSON.stringify(
    (state.kids ?? []).map(k => ({
      b: (k.rules.appRules ?? []).filter(r => r.mode === "block").map(r => r.appId),
      bp: k.rules.blockedPackages ?? [],
      sb: k.rules.studyBlockedPackages ?? [],
      sm: !!k.rules.studyMode,
    })),
  );
  useEffect(() => {
    try { syncBlockedApps(state.kids ?? []); } catch {}
  }, [sig]);
  return null;
}
