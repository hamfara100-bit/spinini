/**
 * usage-tracker.ts
 *
 * Lightweight hooks and helpers for tracking:
 *  - Feature button taps (TAP_FEATURE)
 *  - App session time (ADD_USAGE) — call start() when app opens, stop() when closed
 *  - Website visit time (ADD_VISIT) — call logVisit() after WebBrowser.openBrowserAsync returns
 */

import { useRef, useCallback } from "react";
import { useData } from "./data/store";

// ─── Feature Tap ─────────────────────────────────────────────────────────────
/**
 * Returns a tap() function. Call it whenever the kid presses a feature button.
 * De-dupes within 1 second to avoid double-counting rapid taps.
 */
export function useFeatureTap(
  kidId: string,
  featureId: string,
  featureName: string,
  featureEmoji: string,
) {
  const { dispatch } = useData();
  const lastTapRef = useRef<number>(0);

  const tap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 1000) return; // de-dupe
    lastTapRef.current = now;
    dispatch({ type: "TAP_FEATURE", kidId, featureId, featureName, featureEmoji });
  }, [kidId, featureId, featureName, featureEmoji, dispatch]);

  return tap;
}

// ─── App Session Timer ────────────────────────────────────────────────────────
/**
 * Returns { start, stop } for an in-app "app" session.
 * Typically used on the Apps screen when a kid opens a tracked app.
 */
export function useAppSession(
  kidId: string,
  appId: string,
  appName: string,
  appEmoji = "📱",
) {
  const { dispatch } = useData();
  const startRef = useRef<number | null>(null);

  const start = useCallback(() => {
    startRef.current = Date.now();
  }, []);

  const stop = useCallback(() => {
    if (!startRef.current) return;
    const ms = Date.now() - startRef.current;
    const minutes = Math.max(1, Math.round(ms / 60_000));
    startRef.current = null;
    dispatch({ type: "ADD_USAGE", kidId, appId, appName, appEmoji, minutes, sessions: 1 });
  }, [kidId, appId, appName, appEmoji, dispatch]);

  return { start, stop };
}

// ─── Website Visit Logger ─────────────────────────────────────────────────────
/**
 * Use after WebBrowser.openBrowserAsync() resolves.
 * openedAt: Date.now() before you called openBrowserAsync
 * url, title: the site that was visited
 */
export function useWebVisit(kidId: string) {
  const { dispatch } = useData();

  const logVisit = useCallback(
    (url: string, title: string, openedAt: number) => {
      const seconds = Math.max(5, Math.round((Date.now() - openedAt) / 1000));
      dispatch({ type: "ADD_VISIT", kidId, url, title, seconds });
    },
    [kidId, dispatch],
  );

  return logVisit;
}

// ─── Helpers (used by reports page) ──────────────────────────────────────────

/** Aggregate all usage days in a date range and return sorted app totals */
export function aggregateAppUsage(
  usage: { date: string; byApp: { appId: string; appName: string; appEmoji?: string; minutes: number; sessions?: number }[] }[],
  sinceDate: string, // "YYYY-MM-DD"
): { appId: string; appName: string; appEmoji?: string; minutes: number; sessions: number }[] {
  const map = new Map<string, { appId: string; appName: string; appEmoji?: string; minutes: number; sessions: number }>();
  for (const day of usage) {
    if (day.date < sinceDate) continue;
    for (const app of day.byApp) {
      const cur = map.get(app.appId);
      if (cur) {
        cur.minutes += app.minutes;
        cur.sessions += app.sessions ?? 1;
      } else {
        map.set(app.appId, { appId: app.appId, appName: app.appName, appEmoji: app.appEmoji, minutes: app.minutes, sessions: app.sessions ?? 1 });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.minutes - a.minutes);
}

/** Aggregate all UrlVisit entries in a date range, grouped by domain */
export function aggregateWebUsage(
  usage: { date: string; visitedUrls?: { url: string; title?: string; durationSeconds: number; visitedAt: string }[] }[],
  sinceDate: string,
): { domain: string; title: string; totalSeconds: number; visits: number }[] {
  const map = new Map<string, { domain: string; title: string; totalSeconds: number; visits: number }>();
  for (const day of usage) {
    if (day.date < sinceDate) continue;
    for (const v of day.visitedUrls ?? []) {
      let domain = v.url;
      try { domain = new URL(v.url).hostname.replace(/^www\./, ""); } catch {}
      const cur = map.get(domain);
      if (cur) {
        cur.totalSeconds += v.durationSeconds;
        cur.visits += 1;
      } else {
        map.set(domain, { domain, title: v.title ?? domain, totalSeconds: v.durationSeconds, visits: 1 });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
}

/** Aggregate feature taps across all usage days */
export function aggregateFeatureTaps(
  usage: { date: string; featureTaps?: { featureId: string; featureName: string; featureEmoji: string; count: number }[] }[],
  sinceDate: string,
): { featureId: string; featureName: string; featureEmoji: string; count: number }[] {
  const map = new Map<string, { featureId: string; featureName: string; featureEmoji: string; count: number }>();
  for (const day of usage) {
    if (day.date < sinceDate) continue;
    for (const t of day.featureTaps ?? []) {
      const cur = map.get(t.featureId);
      if (cur) {
        cur.count += t.count;
      } else {
        map.set(t.featureId, { ...t });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/**
 * Aggregate activity minutes by hour-of-day (0–23) across a date range.
 * Returns a 24-length array — index = hour, value = total minutes that hour.
 */
export function aggregateHourly(
  usage: { date: string; hourlyMinutes?: number[] }[],
  sinceDate: string,
): number[] {
  const buckets = new Array(24).fill(0);
  for (const day of usage) {
    if (day.date < sinceDate) continue;
    const h = day.hourlyMinutes;
    if (!h) continue;
    for (let i = 0; i < 24; i++) buckets[i] += h[i] ?? 0;
  }
  return buckets;
}

/** Returns "YYYY-MM-DD" for N days ago */
export function daysAgoDate(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

/** Format seconds → "2h 14m" or "35m" */
export function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}
