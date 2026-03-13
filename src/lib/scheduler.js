/**
 * SCHEDULING ENGINE v2
 * ====================
 * PPL smart schedule management with miss detection and shift/guard logic.
 *
 * KEY DESIGN:
 * - overrides: { [dateStr]: 'push'|'pull'|'legs'|'rest'|'missed' }
 * - __shifts: [{ from: dateStr, by: N }] — shift markers applied to future dates
 * - __processedUpTo: dateStr — watermark so midnight check is idempotent
 * - __resumeFrom: dateStr — set by guard; schedule resets cleanly from here
 *
 * SMART GUARD RULES:
 * - ≤ MAX_CONSECUTIVE_MISSES workout days missed in a row → SHIFT (push sessions forward)
 * - > MAX_CONSECUTIVE_MISSES → GUARD: mark all missed, do NOT shift, resume fresh
 *   This protects against travel/illness creating infinite schedule drift.
 *
 * IDEMPOTENCY:
 * - __processedUpTo watermark ensures running the midnight check multiple times
 *   (e.g. opening the app on the same day, or after a timezone change) is safe.
 */

import { DEFAULT_SCHEDULE } from '../data/workouts';

export const MAX_CONSECUTIVE_MISSES = 3;

// ─── Date utilities ───────────────────────────────────────────────────────────

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(str, n) {
  const d = new Date(str);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

export function diffDays(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return Math.round((db - da) / 86400000);
}

export function isBefore(a, b) { return diffDays(a, b) > 0; }

export function formatDate(str) {
  return new Date(str).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  });
}

// ─── Completion & Status Helpers ──────────────────────────────────────────────

/**
 * A day is considered "trained" for schedule-shifting purposes if ANY
 * exercise has been checked off. This prevents auto-shifts for partial workouts.
 */
function isTrained(date, completedDays) {
  const dayData = completedDays?.[date];
  if (!dayData) return false;
  return Object.values(dayData.checked || {}).some(Boolean);
}

/**
 * A day is "fully complete" for stats-counting purposes only if all
 * exercises for that session were checked off.
 */
export function isAllDone(date, completedDays) {
  return completedDays?.[date]?.allDone || false;
}


// ─── Base schedule (no overrides) ────────────────────────────────────────────

export function baseSessionForDate(date, programStart) {
  if (!programStart) return null;
  const diff = diffDays(programStart, date);
  if (diff < 0) return null;
  return DEFAULT_SCHEDULE[diff % DEFAULT_SCHEDULE.length];
}

// ─── Resolved session (full override + shift awareness) ───────────────────────

export function resolvedSession(date, programStart, overrides) {
  if (!programStart) return null;
  const ov = overrides || {};

  // 1. Direct override on this exact date
  if (ov[date] !== undefined && ov[date] !== null) return ov[date];

  // 2. After a guard reset: schedule resumes from __resumeFrom using adjusted index
  if (ov.__resumeFrom && !isBefore(date, ov.__resumeFrom)) {
    // Compute shift debt accumulated BEFORE resumeFrom
    let shiftDebtBeforeResume = 0;
    for (const sh of (ov.__shifts || [])) {
      if (isBefore(sh.from, ov.__resumeFrom)) shiftDebtBeforeResume += sh.by;
    }
    const daysToResume = diffDays(programStart, ov.__resumeFrom);
    const baseIdxAtResume = daysToResume - shiftDebtBeforeResume;
    const daysFromResume = diffDays(ov.__resumeFrom, date);
    const idx = (baseIdxAtResume + daysFromResume) % DEFAULT_SCHEDULE.length;
    return DEFAULT_SCHEDULE[idx < 0 ? idx + DEFAULT_SCHEDULE.length : idx];
  }

  // 3. Normal shift accumulation
  let shiftDebt = 0;
  for (const sh of (ov.__shifts || [])) {
    // Shift applies to dates AT or AFTER sh.from
    if (!isBefore(date, sh.from)) shiftDebt += sh.by;
  }
  const baseDiff = diffDays(programStart, date);
  if (baseDiff < 0) return null;
  const shiftedDiff = baseDiff - shiftDebt;
  if (shiftedDiff < 0) return null;
  return DEFAULT_SCHEDULE[shiftedDiff % DEFAULT_SCHEDULE.length];
}

// ─── Miss detection (idempotent via __processedUpTo) ─────────────────────────

export function getUnresolvedMisses(programStart, completedDays, overrides, scanUntil) {
  if (!programStart) return [];
  const ov = overrides || {};
  const scanFrom = ov.__processedUpTo ? addDays(ov.__processedUpTo, 1) : programStart;
  const effectiveFrom = isBefore(programStart, scanFrom) ? scanFrom : programStart;

  const missed = [];
  let cursor = effectiveFrom;
  while (isBefore(cursor, scanUntil)) {
    const session = resolvedSession(cursor, programStart, ov);
    const isWorkout = session && session !== 'rest' && session !== 'missed';
    const hasActivity = isTrained(cursor, completedDays);
    const hasOverride = Object.prototype.hasOwnProperty.call(ov, cursor);

    if (isWorkout && !hasActivity && !hasOverride) {
      missed.push(cursor);
    }
    cursor = addDays(cursor, 1);
  }
  return missed;
}

// ─── Smart Guard ─────────────────────────────────────────────────────────────

export function applySmartGuard(programStart, completedDays, currentOverrides, today) {
  const ov = currentOverrides || {};
  const misses = getUnresolvedMisses(programStart, completedDays, ov, today);

  if (misses.length === 0) {
    // Still update processedUpTo watermark so future runs are fast
    const newProcessed = addDays(today, -1); // yesterday = last checked day
    const existing = ov.__processedUpTo;
    if (existing && !isBefore(existing, newProcessed)) {
      return { overrides: ov, events: [] }; // already up to date
    }
    return {
      overrides: { ...ov, __processedUpTo: newProcessed },
      events: [],
    };
  }

  const newOverrides = { ...ov };
  if (!newOverrides.__shifts) newOverrides.__shifts = [];
  const events = [];

  // Group consecutive missed days into "runs" only if there are misses.
  const runs = [];
  if (misses.length > 0) {
    let currentRun = [misses[0]];
    for (let i = 1; i < misses.length; i++) {
      if (diffDays(misses[i - 1], misses[i]) === 1) {
        currentRun.push(misses[i]);
      } else {
        runs.push(currentRun);
        currentRun = [misses[i]];
      }
    }
    runs.push(currentRun);
  }

  for (const run of runs) {
    const runLen = run.length;
    const lastDayOfRun = run[run.length - 1];

    if (runLen > MAX_CONSECUTIVE_MISSES) {
      // GUARD MODE: Too many misses, pause the schedule
      for (const d of run) newOverrides[d] = 'missed';
      const resumeFrom = addDays(lastDayOfRun, 1);
      // This is the fix: Only update resumeFrom if it's later than any existing one.
      if (!newOverrides.__resumeFrom || isBefore(newOverrides.__resumeFrom, resumeFrom)) {
        newOverrides.__resumeFrom = resumeFrom;
      }
      events.push({ type: 'guard', dates: run, resumeFrom });
    } else {
      // SHIFT MODE: 1-3 misses, shift the schedule
      for (const d of run) newOverrides[d] = 'rest';
      const shiftFrom = addDays(lastDayOfRun, 1);
      newOverrides.__shifts.push({ from: shiftFrom, by: runLen });
      events.push({ type: 'shift', dates: run, shiftBy: runLen });
    }
  }

  newOverrides.__processedUpTo = addDays(today, -1);
  return { overrides: newOverrides, events };
}

// ─── Manual override actions ──────────────────────────────────────────────────

/** Mark a specific date as missed (manual, no shift) */
export function markMissed(date, overrides) {
  return { ...overrides, [date]: 'missed' };
}

/** Swap a date to rest and shift everything after it by 1 day */
export function swapToRest(date, overrides) {
  const newOverrides = { ...overrides, [date]: 'rest' };
  if (!newOverrides.__shifts) newOverrides.__shifts = [];
  newOverrides.__shifts = [...newOverrides.__shifts, { from: addDays(date, 1), by: 1 }];
  return newOverrides;
}

/** Remove any override on a date (restore to base schedule) */
export function clearOverride(date, overrides) {
  const newOverrides = { ...overrides };
  delete newOverrides[date];
  return newOverrides;
}

/** Called on app open — runs the midnight check */
export function runMidnightCheck(programStart, completedDays, overrides) {
  if (!programStart) return { overrides: overrides || {}, events: [] };
  return applySmartGuard(programStart, completedDays, overrides || {}, todayStr());
}
