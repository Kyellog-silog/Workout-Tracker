/**
 * Streak calculation logic.
 *
 * Extracted from Stats.jsx so it can be independently unit-tested.
 *
 * Rules:
 * - Only days with allDone === true increment the streak counter.
 * - Rest days (session === 'rest' or null) are transparent — they pass through
 *   without counting or breaking the streak.
 * - Guard-marked days (session === 'missed') are also transparent — the smart
 *   guard already penalises the schedule; double-penalising via streak is harsh.
 * - Today (in-progress) never breaks the streak.
 * - A missed workout day breaks the streak UNLESS it appears in streakRestores
 *   for that calendar month (up to 5 restores per month).
 */
import { resolvedSession, todayStr, addDays, diffDays } from './scheduler';

/**
 * Calculate streak and the nearest break point.
 *
 * @param {Object}  completedDays   — { [dateStr]: { allDone, checked } }
 * @param {string|null} programStart — YYYY-MM-DD start date
 * @param {Object}  overrides       — scheduler overrides object
 * @param {Object}  streakRestores  — { [monthKey]: string[] } restored dates
 * @param {string}  [today]         — override "today" for testing (default: real today)
 * @param {string[]} [weeklySchedule] — custom weekly rotation (default: DEFAULT_SCHEDULE)
 * @returns {{ streak: number, breakDate: string|null }}
 */
export function calcStreakInfo(completedDays, programStart, overrides, streakRestores, today = todayStr(), weeklySchedule) {
  if (!programStart) return { streak: 0, breakDate: null };
  const daysSinceStart = diffDays(programStart, today);
  if (daysSinceStart < 0) return { streak: 0, breakDate: null };

  let streak = 0;

  for (let i = 0; i <= daysSinceStart; i++) {
    const date = addDays(today, -i);
    if (date < programStart) break;

    const s = resolvedSession(date, programStart, overrides, weeklySchedule);

    // Transparent days: rest and guard-marked days don't count or break
    if (!s || s === 'rest' || s === 'missed') continue;

    // Completed workout — count it
    if (completedDays[date]?.allDone) { streak++; continue; }

    // Today is still in progress — don't break yet
    if (date === today) continue;

    // Potential break point — check if this date has been restored
    const monthKey = date.slice(0, 7);
    const restored = Array.isArray(streakRestores?.[monthKey])
      ? streakRestores[monthKey]
      : [];
    if (restored.includes(date)) continue; // restored — skip

    return { streak, breakDate: date };
  }

  return { streak, breakDate: null };
}

/**
 * How many restores remain for the month containing breakDate.
 * Deduplicates the restore array so corrupted/duplicate entries can't produce
 * negative counts.
 *
 * @param {string}  breakDate      — YYYY-MM-DD date where streak broke
 * @param {Object}  streakRestores — { [monthKey]: string[] }
 * @returns {number} 0–5
 */
export function restoresLeft(breakDate, streakRestores) {
  if (!breakDate) return 0;
  const monthKey = breakDate.slice(0, 7);
  const arr = Array.isArray(streakRestores?.[monthKey]) ? streakRestores[monthKey] : [];
  return Math.max(0, 5 - new Set(arr).size);
}
