/**
 * App scheduler — evaluates each app's recurring schedules every minute and
 * dispatches SET_APP_RULE to set mode="allow" or mode="block" automatically.
 *
 * Call useAppScheduler() inside the root DataProvider or kid home screen.
 */

import { useEffect, useRef } from "react";
import { AppAction, KidState, AppRule, AppSchedule } from "./data/types";

function nowHHMM(): { h: number; m: number; day: number } {
  const now = new Date();
  return { h: now.getHours(), m: now.getMinutes(), day: now.getDay() };
}

function timeToMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Returns true if current time falls within the schedule window on the current day */
export function isScheduleActive(schedule: AppSchedule): boolean {
  if (!schedule.enabled) return false;
  const { h, m, day } = nowHHMM();
  if (!schedule.days.includes(day)) return false;

  const currentMins = h * 60 + m;
  const startMins   = timeToMins(schedule.startTime);
  const endMins     = timeToMins(schedule.endTime);

  // Handle overnight spans (e.g. 22:00 – 06:00)
  if (endMins <= startMins) {
    return currentMins >= startMins || currentMins < endMins;
  }
  return currentMins >= startMins && currentMins < endMins;
}

/** Given an app rule with schedules, compute what the mode SHOULD be right now */
export function computeScheduledMode(rule: AppRule): "allow" | "block" | null {
  if (!rule.scheduleEnabled || !rule.schedules?.length) return null;
  const anyActive = rule.schedules.some(isScheduleActive);
  return anyActive ? "allow" : "block";
}

/** Returns the next schedule window label for an app, e.g. "Opens at 15:00" */
export function nextWindowLabel(rule: AppRule): string | null {
  if (!rule.scheduleEnabled || !rule.schedules?.length) return null;
  const { h, m, day } = nowHHMM();
  const currentMins = h * 60 + m;

  let closest: number | null = null;
  let closestLabel = "";

  for (const sched of rule.schedules) {
    if (!sched.enabled) continue;
    // Check next occurrence across this week
    for (let d = 0; d < 7; d++) {
      const checkDay = (day + d) % 7;
      if (!sched.days.includes(checkDay)) continue;
      const startMins = timeToMins(sched.startTime) + d * 24 * 60;
      const delta = startMins - currentMins;
      if (delta > 0 && (closest === null || delta < closest)) {
        closest = delta;
        closestLabel = sched.startTime;
      }
    }
  }

  if (closest === null) return null;
  if (closest < 60) return `Opens in ${closest}m`;
  const hrs = Math.floor(closest / 60);
  return `Opens at ${closestLabel}`;
}

/** Hook: evaluates and applies schedules for all kids every 30 seconds */
export function useAppScheduler(
  kids: KidState[],
  dispatch: (action: AppAction) => void
) {
  const kidsRef = useRef(kids);
  kidsRef.current = kids;

  useEffect(() => {
    function tick() {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0]; // "YYYY-MM-DD"
      const currentMins = now.getHours() * 60 + now.getMinutes();
      const currentDay  = now.getDay(); // 0=Sun…6=Sat

      for (const kid of kidsRef.current) {
        // ── App schedule enforcement ──
        for (const rule of kid.rules.appRules) {
          const computed = computeScheduledMode(rule);
          if (computed !== null && computed !== rule.mode) {
            dispatch({
              type: "SET_APP_RULE",
              kidId: kid.profile.id,
              rule: { ...rule, mode: computed },
            });
          }
        }

        // ── Auto-chore deadline enforcement ──
        for (const chore of kid.chores) {
          if (!chore.autoChore || !chore.deadlineTime || !chore.penaltyPoints) continue;
          if (!chore.recurringDays?.includes(currentDay)) continue;

          const deadlineMins = timeToMins(chore.deadlineTime);
          if (currentMins < deadlineMins) continue; // deadline not yet passed

          // Skip if penalty already applied today
          if (chore.penaltyAppliedDates?.includes(todayStr)) continue;

          // Check if any assigned kid completed (submitted/approved) today
          const completedToday = chore.proofs.some(p =>
            p.kidId === kid.profile.id && p.submittedAt.startsWith(todayStr)
          );
          if (completedToday) continue;

          // Deadline passed, chore not done → apply penalty
          if (chore.assignedKids.includes(kid.profile.id)) {
            dispatch({
              type: "CHORE_APPLY_PENALTY",
              choreId: chore.id,
              kidId: kid.profile.id,
              date: todayStr,
              penaltyPoints: chore.penaltyPoints,
            });
          }
        }
      }
    }

    tick();
    const id = setInterval(tick, 30_000); // check every 30s
    return () => clearInterval(id);
  }, [dispatch]);
}
