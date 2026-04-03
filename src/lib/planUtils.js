/**
 * Clears all custom workout changes in userPlans by setting exercises to null for each plan.
 * Returns a new userPlans object.
 */
export function clearAllCustomWorkouts(userPlans) {
  if (!userPlans) return {};
  const cleared = {};
  for (const key of Object.keys(userPlans)) {
    cleared[key] = { ...userPlans[key], exercises: null };
  }
  return cleared;
}
/**
 * planUtils.js
 * ===========
 * Utilities for the custom-plan system.
 *
 * userPlans shape:
 * {
 *   [planKey: string]: {
 *     label:      string,          // Display name, e.g. "CHEST"
 *     color:      string,          // Hex colour
 *     focus:      string,          // Subtitle, e.g. "Chest · Shoulders"
 *     exercises:  Exercise[]|null, // null = use DEFAULT_EXERCISES[defaultKey]
 *     defaultKey: string|null,     // Original PPL key ("push"|"pull"|"legs"), if any
 *   }
 * }
 *
 * weeklySchedule: string[] — exactly 7 plan keys (or "rest"/"cardio")
 */

import { SESSION_META, DEFAULT_EXERCISES, DEFAULT_SCHEDULE } from '../data/workouts';
import { resolvedSession, todayStr } from './scheduler';

// ─── Meta lookup ─────────────────────────────────────────────────────────────

/**
 * Returns display metadata for a plan key.
 * Priority: userPlans entry → SESSION_META fallback → neutral fallback for
 * deleted/unknown keys (never crashes).
 */
export function getPlanMeta(planKey, userPlans) {
  if (!planKey) return _neutral('?');

  const up = userPlans?.[planKey];
  if (up) {
    const base = SESSION_META[up.defaultKey || planKey] || {};
    const color = up.color || base.color || '#9e9e9e';
    return {
      label:          up.label || planKey.toUpperCase(),
      color,
      dimColor:       `${color}1A`,
      borderColor:    `${color}47`,
      focus:          up.focus || base.focus || '',
      warmup:         base.warmup  || [],
      cooldown:       base.cooldown || [],
      restActivities: base.restActivities || [],
    };
  }

  if (SESSION_META[planKey]) return SESSION_META[planKey];

  // Deleted / unknown plan key — neutral fallback
  return _neutral(planKey);
}

function _neutral(planKey) {
  return {
    label:          planKey.toUpperCase(),
    color:          '#9e9e9e',
    dimColor:       'rgba(158,158,158,0.10)',
    borderColor:    'rgba(158,158,158,0.28)',
    focus:          'Removed plan',
    warmup:         [],
    cooldown:       [],
    restActivities: [],
  };
}

/**
 * Returns the exercise list for a plan.
 * Prefers userPlans exercises (when not null), then DEFAULT_EXERCISES.
 */
export function getPlanExercises(planKey, userPlans) {
  const up = userPlans?.[planKey];
  if (up) {
    if (up.exercises !== null && up.exercises !== undefined) return up.exercises;
    const fallbackKey = up.defaultKey || planKey;
    return DEFAULT_EXERCISES[fallbackKey] || [];
  }
  return DEFAULT_EXERCISES[planKey] || [];
}

/**
 * Returns true if the plan is using custom exercises (not the default).
 */
export function isPlanCustomised(planKey, userPlans) {
  const up = userPlans?.[planKey];
  return !!(up && up.exercises !== null && up.exercises !== undefined);
}

// ─── Key generation ──────────────────────────────────────────────────────────

export function slugify(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 24);
}

export function generateUniqueKey(label, existingKeys) {
  const base = slugify(label) || 'plan';
  if (!existingKeys.includes(base)) return base;
  let i = 2;
  while (existingKeys.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

// ─── One-time migration ───────────────────────────────────────────────────────

/**
 * Migrates old `customPlans` + default SESSION_META into the new `userPlans`
 * structure. Safe to call even if customPlans is empty or missing.
 * Also seeds `weeklySchedule` if missing.
 */
export function initUserPlansFromLegacy(customPlans) {
  const plans = {};
  for (const key of ['push', 'pull', 'legs']) {
    plans[key] = {
      label:      SESSION_META[key].label,
      color:      SESSION_META[key].color,
      focus:      SESSION_META[key].focus,
      exercises:  customPlans?.[key] || null, // null = fall back to DEFAULT_EXERCISES
      defaultKey: key,
    };
  }
  return plans;
}

// ─── Rename ───────────────────────────────────────────────────────────────────

/**
 * Renames a plan: updates key, label, weeklySchedule references, and override
 * date values. Does NOT touch completedDays (exercise IDs are plan-agnostic).
 *
 * Pass newLabel separately from newKey — the label is what the user typed;
 * the key is the slugified version.
 */
export function renamePlanInData(data, oldKey, newKey, newLabel) {
  let newData = { ...data };
  const upperLabel = newLabel.toUpperCase();

  // 1. Update userPlans
  if (newData.userPlans) {
    const newUserPlans = { ...newData.userPlans };
    if (oldKey === newKey) {
      // Only label change — no key migration needed
      newUserPlans[oldKey] = { ...newUserPlans[oldKey], label: upperLabel };
      return { ...newData, userPlans: newUserPlans };
    }
    // Key change
    if (newUserPlans[oldKey]) {
      newUserPlans[newKey] = { ...newUserPlans[oldKey], label: upperLabel };
      delete newUserPlans[oldKey];
    }
    newData.userPlans = newUserPlans;
  }

  // 2. Update weeklySchedule
  if (newData.weeklySchedule) {
    newData.weeklySchedule = newData.weeklySchedule.map(k => k === oldKey ? newKey : k);
  }

  // 3. Update override date values (NOT the __ meta keys)
  if (newData.overrides) {
    const newOv = { ...newData.overrides };
    for (const [k, v] of Object.entries(newOv)) {
      if (!k.startsWith('__') && v === oldKey) newOv[k] = newKey;
    }
    newData.overrides = newOv;
  }

  // completedDays deliberately NOT touched — exercise IDs are plan-agnostic.
  return newData;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Deletes a plan from the data snapshot.
 *
 * Steps:
 * 1. Scan completedDays: pin completed session dates so they stay visible
 *    (past completed dates get a hard override equal to the old plan key).
 * 2. Replace planKey in weeklySchedule with "rest".
 * 3. Replace future-only overrides with "rest" (pins from step 1 are preserved).
 * 4. Remove planKey from userPlans.
 */
export function deletePlanFromData(data, planKey, programStart) {
  const today = todayStr();
  const newOv = { ...(data.overrides || {}) };

  // 1. Pin past completed sessions under this plan
  if (data.completedDays && programStart) {
    for (const [date, dayData] of Object.entries(data.completedDays)) {
      if (date > today) continue;
      const hasChecked = Object.values(dayData.checked || {}).some(Boolean);
      if (!hasChecked) continue;
      const resolved = resolvedSession(
        date, programStart, newOv,
        data.weeklySchedule || DEFAULT_SCHEDULE
      );
      if (resolved === planKey && !newOv[date]) {
        newOv[date] = planKey; // hard pin — survives plan deletion
      }
    }
  }

  // 2. Replace planKey in weeklySchedule with "rest"
  const newSchedule = (data.weeklySchedule || DEFAULT_SCHEDULE).map(k =>
    k === planKey ? 'rest' : k
  );

  // 3. Replace future-only overrides with "rest"
  for (const [k, v] of Object.entries(newOv)) {
    if (!k.startsWith('__') && v === planKey && k > today) {
      newOv[k] = 'rest';
    }
  }

  // 4. Remove from userPlans
  const newUserPlans = { ...(data.userPlans || {}) };
  delete newUserPlans[planKey];

  return {
    ...data,
    userPlans:      newUserPlans,
    weeklySchedule: newSchedule,
    overrides:      newOv,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Count completed sessions for a specific plan key (for delete warnings).
 */
export function countCompletedSessionsForPlan(planKey, completedDays, programStart, overrides, weeklySchedule) {
  if (!programStart || !completedDays) return 0;
  const today = todayStr();
  let count = 0;
  const schedule = weeklySchedule || DEFAULT_SCHEDULE;
  const ov = overrides || {};
  for (const [date, dayData] of Object.entries(completedDays)) {
    if (date > today) continue;
    const hasChecked = Object.values(dayData.checked || {}).some(Boolean);
    if (!hasChecked) continue;
    const resolved = resolvedSession(date, programStart, ov, schedule);
    if (resolved === planKey) count++;
  }
  return count;
}

/**
 * Returns a safe list of user plan keys for iteration (excludes built-ins
 * that are not in userPlans).
 */
export function getUserPlanKeys(userPlans) {
  return Object.keys(userPlans || {});
}
