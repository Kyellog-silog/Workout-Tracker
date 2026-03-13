/**
 * Security guards for data sanitization and validation.
 *
 * sanitizeKeys    – strips __proto__ / constructor / prototype from objects (recursively)
 * validateLoadedData – validates the shape of data loaded from localStorage / Supabase
 * clampNumber     – clamps a numeric value to [min, max], passes through empty/null/undefined
 */

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively strips prototype-pollution-prone keys from an object.
 * Non-object values are returned unchanged.
 */
export function sanitizeKeys(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return obj;
  const result = {};
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    result[key] = sanitizeKeys(obj[key]);
  }
  return result;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates the shape of app data loaded from localStorage or Supabase.
 * Returns null if the root is not a plain object.
 * Invalid sub-structures are replaced with safe defaults; unknown extra
 * keys are preserved so future schema additions don't break old clients.
 */
export function validateLoadedData(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;

  const out = {};

  // programStart — null or YYYY-MM-DD
  if (raw.programStart === null || raw.programStart === undefined) {
    out.programStart = null;
  } else if (typeof raw.programStart === 'string' && DATE_RE.test(raw.programStart)) {
    out.programStart = raw.programStart;
  } else {
    out.programStart = null;
  }

  // selectedDate — YYYY-MM-DD or null
  if (typeof raw.selectedDate === 'string' && DATE_RE.test(raw.selectedDate)) {
    out.selectedDate = raw.selectedDate;
  } else {
    out.selectedDate = null;
  }

  // completedDays — plain object, keys must be YYYY-MM-DD
  if (typeof raw.completedDays === 'object' && raw.completedDays !== null && !Array.isArray(raw.completedDays)) {
    const cd = {};
    for (const [dateKey, sessions] of Object.entries(raw.completedDays)) {
      if (!DATE_RE.test(dateKey)) continue;
      if (typeof sessions !== 'object' || sessions === null || Array.isArray(sessions)) continue;
      const cleanSession = {};
      for (const [sessKey, sessData] of Object.entries(sessions)) {
        if (typeof sessData !== 'object' || sessData === null || Array.isArray(sessData)) {
          cleanSession[sessKey] = sessData;
          continue;
        }
        const cleanSessData = { ...sessData };
        // Strip sets with non-finite numbers
        if (Array.isArray(sessData.sets)) {
          cleanSessData.sets = sessData.sets.filter(s =>
            typeof s === 'object' && s !== null &&
            (s.weight === '' || Number.isFinite(Number(s.weight))) &&
            (s.reps === '' || Number.isFinite(Number(s.reps)))
          );
        }
        cleanSession[sessKey] = cleanSessData;
      }
      cd[dateKey] = cleanSession;
    }
    out.completedDays = cd;
  } else {
    out.completedDays = {};
  }

  // overrides — plain object
  if (typeof raw.overrides === 'object' && raw.overrides !== null && !Array.isArray(raw.overrides)) {
    out.overrides = raw.overrides;
  } else {
    out.overrides = {};
  }

  // streakRestores — plain object of string arrays
  if (typeof raw.streakRestores === 'object' && raw.streakRestores !== null && !Array.isArray(raw.streakRestores)) {
    const sr = {};
    for (const [k, v] of Object.entries(raw.streakRestores)) {
      if (Array.isArray(v)) {
        sr[k] = v.filter(item => typeof item === 'string');
      }
    }
    out.streakRestores = sr;
  } else {
    out.streakRestores = {};
  }

  // Preserve unknown extra keys (forward-compatibility)
  for (const key of Object.keys(raw)) {
    if (!(key in out)) out[key] = raw[key];
  }

  return out;
}

/**
 * Clamps a numeric value to [min, max].
 * Empty string, null, and undefined pass through unchanged (preserves
 * in-flight text input state while the user is typing).
 * NaN / -Infinity → min; Infinity → max.
 */
export function clampNumber(value, min, max) {
  if (value === '' || value === null || value === undefined) return value;
  const n = Number(value);
  if (!Number.isFinite(n)) return n > 0 ? max : min;
  return Math.min(Math.max(n, min), max);
}
