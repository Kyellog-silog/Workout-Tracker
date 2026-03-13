/**
 * PR calculation utilities.
 * Data shape:  completedDays[dateStr].sets = {
 *   [exerciseId]: [{ weight: number, reps: number }, ...]
 * }
 */

/**
 * Returns sorted history of sets for one exercise, newest first.
 * @param {string} exerciseId
 * @param {Record<string,any>} completedDays
 * @returns {{ date: string, sets: {weight:number,reps:number}[] }[]}
 */
export function getExerciseHistory(exerciseId, completedDays) {
  const result = [];
  for (const [date, day] of Object.entries(completedDays)) {
    const sets = day?.sets?.[exerciseId];
    if (Array.isArray(sets) && sets.length > 0) {
      result.push({ date, sets });
    }
  }
  result.sort((a, b) => (a.date < b.date ? 1 : -1));
  return result;
}

/**
 * Epley formula for estimated 1-rep max.
 * @param {number} weight
 * @param {number} reps
 * @returns {number}
 */
export function epley1RM(weight, reps) {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/**
 * Compute all-time PRs for one exercise across completed history.
 * Body-weight / pullup sets where weight === 0 still count for maxRepsAtWeight.
 * @param {string} exerciseId
 * @param {Record<string,any>} completedDays
 * @returns {{
 *   maxWeight: number,
 *   estimated1RM: number,
 *   maxRepsAtWeight: Record<number, number>,
 *   maxSessionVolume: number
 * }}
 */
export function computePRs(exerciseId, completedDays) {
  let maxWeight = 0;
  let estimated1RM = 0;
  const maxRepsAtWeight = {};
  let maxSessionVolume = 0;

  for (const { sets } of getExerciseHistory(exerciseId, completedDays)) {
    let sessionVolume = 0;
    for (const { weight, reps } of sets) {
      const w = Number(weight) || 0;
      const r = Number(reps) || 0;
      if (r <= 0) continue;

      if (w > maxWeight) maxWeight = w;

      const e1rm = epley1RM(w, r);
      if (e1rm > estimated1RM) estimated1RM = e1rm;

      if (maxRepsAtWeight[w] === undefined || r > maxRepsAtWeight[w]) {
        maxRepsAtWeight[w] = r;
      }

      sessionVolume += w * r;
    }
    if (sessionVolume > maxSessionVolume) maxSessionVolume = sessionVolume;
  }

  return { maxWeight, estimated1RM, maxRepsAtWeight, maxSessionVolume };
}

/**
 * Given the sets just logged today (not yet committed to completedDays),
 * returns an array of PR type strings that were beaten.
 * The comparison is against completedDays WITHOUT today's entry.
 * @param {string} exerciseId
 * @param {{weight:number,reps:number}[]} todaySets
 * @param {Record<string,any>} completedDays  — should NOT include today's sets yet
 * @returns {string[]}  e.g. ['maxWeight', 'estimated1RM']
 */
export function getTodayPRs(exerciseId, todaySets, completedDays) {
  if (!Array.isArray(todaySets) || todaySets.length === 0) return [];

  const prev = computePRs(exerciseId, completedDays);
  const beaten = new Set();

  let todayVolume = 0;
  for (const { weight, reps } of todaySets) {
    const w = Number(weight) || 0;
    const r = Number(reps) || 0;
    if (r <= 0) continue;

    if (w > prev.maxWeight) beaten.add('maxWeight');

    const e1rm = epley1RM(w, r);
    if (e1rm > prev.estimated1RM) beaten.add('estimated1RM');

    if ((prev.maxRepsAtWeight[w] === undefined || r > prev.maxRepsAtWeight[w])) {
      beaten.add('maxRepsAtWeight');
    }

    todayVolume += w * r;
  }

  if (todayVolume > prev.maxSessionVolume) beaten.add('maxSessionVolume');

  return Array.from(beaten);
}

/**
 * Total volume lifted across all sessions and exercises (kg × reps sum).
 * @param {Record<string,any>} completedDays
 * @returns {number}
 */
export function totalVolume(completedDays) {
  let total = 0;
  for (const day of Object.values(completedDays)) {
    if (!day?.sets) continue;
    for (const sets of Object.values(day.sets)) {
      if (!Array.isArray(sets)) continue;
      for (const { weight, reps } of sets) {
        total += (Number(weight) || 0) * (Number(reps) || 0);
      }
    }
  }
  return total;
}
