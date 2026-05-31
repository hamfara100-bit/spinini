import { nowIso } from "./utils";

export interface StreakState {
  current: number;
  best: number;
  lastDate: string | null;
}

export function updateStreak(streak: StreakState): StreakState {
  const today = nowIso().slice(0, 10);
  if (!streak.lastDate) {
    const next = { current: 1, best: Math.max(1, streak.best), lastDate: today };
    return next;
  }

  const last = streak.lastDate.slice(0, 10);
  if (last === today) return streak;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);

  const next = last === yStr
    ? { current: streak.current + 1, best: Math.max(streak.best, streak.current + 1), lastDate: today }
    : { current: 1, best: streak.best, lastDate: today };

  return next;
}

export function streakLabel(streak: StreakState): string {
  if (!streak.current) return "Start your streak!";
  if (streak.current === 1) return "1 day streak 🔥";
  return `${streak.current} day streak 🔥`;
}

export function isStreakAlive(streak: StreakState): boolean {
  if (!streak.lastDate) return false;
  const today = nowIso().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);
  const last = streak.lastDate.slice(0, 10);
  return last === today || last === yStr;
}
