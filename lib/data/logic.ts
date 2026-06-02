import { KidState, UsageDay, BankEntry } from "./types";

export function getTodayUsage(kid: KidState): number {
  const today = new Date().toISOString().split("T")[0];
  return kid.usage.find(u => u.date === today)?.totalMinutes ?? 0;
}

export function getBankBalance(bank: BankEntry[]): number {
  return bank.reduce((sum, e) => sum + e.delta, 0);
}

export function getRemainingMinutes(kid: KidState): number {
  const used = getTodayUsage(kid);
  const banked = getBankBalance(kid.bank);
  const bonus = kid.rules.bonusScreenTimeMinutes ?? 0;
  return Math.max(0, kid.rules.dailyLimitMinutes + banked + bonus - used);
}

export function getUsagePct(kid: KidState): number {
  const used = getTodayUsage(kid);
  const bonus = kid.rules.bonusScreenTimeMinutes ?? 0;
  const total = kid.rules.dailyLimitMinutes + getBankBalance(kid.bank) + bonus;
  if (total <= 0) return 1;
  return Math.min(1, used / total);
}

export function isInDowntime(kid: KidState): boolean {
  const now = new Date();
  const day = now.getDay();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return kid.rules.downtimeWindows.some(w => {
    if (!w.enabled || !w.days.includes(day)) return false;
    if (w.startTime < w.endTime) return hhmm >= w.startTime && hhmm < w.endTime;
    return hhmm >= w.startTime || hhmm < w.endTime; // overnight
  });
}

export function isInBedtimeSoftLock(kid: KidState): boolean {
  const cfg = kid.rules?.bedtimeSoftLock;
  if (!cfg?.enabled) return false;
  const now = new Date();
  const day = now.getDay();
  if (!cfg.days.includes(day)) return false;
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (cfg.start < cfg.end) return hhmm >= cfg.start && hhmm < cfg.end;
  return hhmm >= cfg.start || hhmm < cfg.end; // overnight window e.g. 20:00–07:00
}

export function isLocked(kid: KidState): boolean {
  if (kid.rules.deadPhone) return true;
  if (kid.rules.instantLocked) return true;
  if (kid.rules.lockUntil && new Date() < new Date(kid.rules.lockUntil)) return true;
  if (isInDowntime(kid)) return true;
  if (getRemainingMinutes(kid) <= 0) return true;
  return false;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function getWeekUsage(kid: KidState): { date: string; minutes: number }[] {
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const day = kid.usage.find(u => u.date === dateStr);
    result.push({ date: dateStr, minutes: day?.totalMinutes ?? 0 });
  }
  return result;
}

export function getStreak(kid: KidState): number {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const day = kid.usage.find(u => u.date === dateStr);
    if (day && day.totalMinutes <= kid.rules.dailyLimitMinutes) streak++;
    else break;
  }
  return streak;
}

/**
 * Thriving Score (0–100) — a holistic wellbeing indicator per kid.
 * Combines behavior points, chore completion, school score, and streak.
 */
export function getThrivingScore(kid: KidState): number {
  // Start from a neutral-positive baseline: a kid with no data yet is assumed to
  // be doing fine — only ACTUAL negative signals (bad behavior, missed chores)
  // pull the score down, while positives push it up.
  let score = 75;

  // Behavior points: ±. +200 pts → +15; negative points pull down (to −30).
  const behaviorPts = kid.behavior?.totalPoints ?? 0;
  score += Math.max(-30, Math.min(15, (behaviorPts / 200) * 15));

  // Chore completion this week — only counts when chores were actually assigned.
  // 100% done → +10, 50% → 0, 0% → −10. No chores assigned = no effect (neutral).
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklyChores = kid.chores.filter(c => new Date(c.createdAt) >= weekAgo);
  if (weeklyChores.length > 0) {
    const rate = weeklyChores.filter(c => c.status === "approved").length / weeklyChores.length;
    score += (rate - 0.5) * 20;
  }

  // Streak bonus: up to +10 (7+ day streak).
  score += Math.min(10, getStreak(kid) * 1.5);

  return Math.min(100, Math.max(0, Math.round(score)));
}

export function getThrivingLabel(score: number): { label: string; color: string; emoji: string } {
  if (score >= 85) return { label: "Thriving",   color: "#10B981", emoji: "🌟" };
  if (score >= 65) return { label: "Doing Well", color: "#3B82F6", emoji: "😊" };
  if (score >= 45) return { label: "Growing",    color: "#F59E0B", emoji: "🌱" };
  return              { label: "Needs Support", color: "#EF4444", emoji: "💛" };
}

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}
