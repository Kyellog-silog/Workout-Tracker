/**
 * chartData — pure series builders for the progress charts.
 *
 * All functions read the completedDays map (date → { sets: { exId: [{weight,reps}] } })
 * and return plain arrays ready to plot. Kept dependency-free and side-effect
 * free so they can be unit-tested in isolation.
 */
import { epley1RM } from './prCalc';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

/**
 * Per-session progression for one exercise, oldest → newest.
 * @returns {{date, topWeight, e1rm, volume, topReps}[]}
 */
export function exerciseProgressSeries(exerciseId, completedDays) {
  const out = [];
  for (const [date, day] of Object.entries(completedDays || {})) {
    if (!DATE_RE.test(date)) continue;
    const sets = day?.sets?.[exerciseId];
    if (!Array.isArray(sets) || sets.length === 0) continue;

    let topWeight = 0, e1rm = 0, volume = 0, topReps = 0;
    for (const s of sets) {
      const w = num(s.weight), r = num(s.reps);
      if (r <= 0) continue;
      if (w > topWeight) topWeight = w;
      if (r > topReps) topReps = r;
      const e = epley1RM(w, r);
      if (e > e1rm) e1rm = e;
      volume += w * r;
    }
    if (topReps === 0) continue; // no completed sets
    out.push({ date, topWeight, e1rm: Math.round(e1rm * 10) / 10, volume, topReps });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : 1));
  return out;
}

/** True if the exercise has never been logged with a real (non-zero) weight. */
export function isBodyweightSeries(series) {
  return series.length > 0 && series.every(p => p.topWeight === 0);
}

/** Monday-anchored week key (YYYY-MM-DD) for a date string. */
export function weekStart(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  d.setDate(d.getDate() - dow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Total tonnage (Σ weight×reps) bucketed by week, oldest → newest, last N weeks.
 * @returns {{weekStart, volume}[]}
 */
export function weeklyVolumeSeries(completedDays, weeks = 12) {
  const byWeek = new Map();
  for (const [date, day] of Object.entries(completedDays || {})) {
    if (!DATE_RE.test(date) || !day?.sets) continue;
    let v = 0;
    for (const sets of Object.values(day.sets)) {
      if (!Array.isArray(sets)) continue;
      for (const s of sets) v += num(s.weight) * num(s.reps);
    }
    if (v <= 0) continue;
    const wk = weekStart(date);
    byWeek.set(wk, (byWeek.get(wk) || 0) + v);
  }
  return Array.from(byWeek, ([weekStart, volume]) => ({ weekStart, volume }))
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1))
    .slice(-weeks);
}

/** Exercise IDs that have at least one completed set, by descending session count. */
export function loggedExerciseIds(completedDays) {
  const counts = new Map();
  for (const day of Object.values(completedDays || {})) {
    if (!day?.sets) continue;
    for (const [id, sets] of Object.entries(day.sets)) {
      if (Array.isArray(sets) && sets.some(s => num(s.reps) > 0)) {
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}
