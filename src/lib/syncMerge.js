/**
 * syncMerge — cross-device merge resolution for the app-data document.
 *
 * Extracted from useSyncedData so it can be unit-tested in isolation.
 *
 * Design (replaces the old "local always wins" merge that could silently lose
 * data when a stale device overwrote a fresher one):
 *
 *   1. RECENCY  — each saved document carries a `_savedAt` epoch-ms stamp. On
 *      load we compare remote vs local and the NEWER side becomes the "primary"
 *      (it wins free-form fields and structural state). Ties go to remote (the
 *      server copy is the shared source of truth).
 *
 *   2. COMPLETIONS ARE STICKY/UNIONED — for completedDays we never let one
 *      device erase another's progress: `checked` is a union of trues, `allDone`
 *      is OR'd, logged `sets` keep the fuller array, and `streakRestores` are
 *      unioned. The trade-off (deliberate for a workout log): *un*-checking an
 *      exercise does not propagate across devices — losing a real completion is
 *      far worse than a sticky checkmark.
 *
 *   3. VIEW STATE — selectedDate always follows the local device.
 */

/** Read the freshness stamp; missing/garbage → 0 (treated as oldest). */
export function resolveSavedAt(d) {
  const t = d && d._savedAt;
  return typeof t === 'number' && Number.isFinite(t) ? t : 0;
}

/** Return a copy stamped with the current (or given) save time. */
export function stampSavedAt(data, at = Date.now()) {
  return { ...data, _savedAt: at };
}

/**
 * Merge a single completedDays entry, preserving completions from both sides.
 * `primary` wins free-form fields (notes, arbitrary keys); completions union.
 */
function mergeDay(primary, secondary) {
  const checked = {};
  for (const k of new Set([...Object.keys(primary.checked || {}), ...Object.keys(secondary.checked || {})])) {
    checked[k] = !!(primary.checked?.[k] || secondary.checked?.[k]); // union of trues
  }

  const sets = {};
  for (const id of new Set([...Object.keys(primary.sets || {}), ...Object.keys(secondary.sets || {})])) {
    const ps = Array.isArray(primary.sets?.[id]) ? primary.sets[id] : [];
    const ss = Array.isArray(secondary.sets?.[id]) ? secondary.sets[id] : [];
    sets[id] = ss.length > ps.length ? ss : ps; // keep the fuller log; tie → primary
  }

  const notes = { ...(secondary.notes || {}), ...(primary.notes || {}) }; // primary wins, fill gaps

  const merged = { ...secondary, ...primary, checked, notes, sets };
  merged.allDone = !!(primary.allDone || secondary.allDone); // sticky completion

  if (primary.cardioLog || secondary.cardioLog) {
    merged.cardioLog = {
      ...(secondary.cardioLog || {}),
      ...(primary.cardioLog || {}),
      done: !!(primary.cardioLog?.done || secondary.cardioLog?.done), // sticky
    };
  }

  return merged;
}

/**
 * Merge two completedDays maps. Dates present on only one side pass through;
 * shared dates are reconciled by {@link mergeDay}.
 */
export function mergeCompletedDays(primary = {}, secondary = {}) {
  const result = {};
  for (const date of new Set([...Object.keys(primary), ...Object.keys(secondary)])) {
    const p = primary[date];
    const s = secondary[date];
    if (!p) { result[date] = s; continue; }
    if (!s) { result[date] = p; continue; }
    result[date] = mergeDay(p, s);
  }
  return result;
}

/** Union the per-month restore arrays so a restore is never lost. */
export function mergeStreakRestores(primary = {}, secondary = {}) {
  const out = {};
  for (const m of new Set([...Object.keys(primary || {}), ...Object.keys(secondary || {})])) {
    const a = Array.isArray(secondary?.[m]) ? secondary[m] : [];
    const b = Array.isArray(primary?.[m]) ? primary[m] : [];
    out[m] = Array.from(new Set([...a, ...b]));
  }
  return out;
}

/**
 * Reconcile a remote document with the local one. Both are expected to have
 * already passed through validateLoadedData.
 *
 * @param {object} remote - validated remote app data (may be {})
 * @param {object} local  - validated local app data  (may be {})
 * @returns {object} merged app data, stamped with the newer `_savedAt`
 */
export function mergeAppData(remote, local) {
  const r = remote || {};
  const l = local || {};
  const remoteIsNewer = resolveSavedAt(r) >= resolveSavedAt(l); // tie → server wins
  const primary = remoteIsNewer ? r : l;
  const secondary = remoteIsNewer ? l : r;

  // Shallow union keeps unknown/future keys; primary wins conflicts (incl.
  // userPlans / weeklySchedule structural state and the newer _savedAt).
  const merged = { ...secondary, ...primary };

  merged.selectedDate = l.selectedDate || r.selectedDate || null; // view follows local
  merged.programStart = primary.programStart || secondary.programStart || null;
  merged.overrides = { ...(secondary.overrides || {}), ...(primary.overrides || {}) };
  merged.completedDays = mergeCompletedDays(primary.completedDays || {}, secondary.completedDays || {});
  merged.streakRestores = mergeStreakRestores(primary.streakRestores, secondary.streakRestores);

  return merged;
}
