import { describe, it, expect } from 'vitest';
import {
  exerciseProgressSeries,
  isBodyweightSeries,
  weeklyVolumeSeries,
  weekStart,
  loggedExerciseIds,
  bodyweightOn,
  bodyweightSeries,
} from './chartData';

const days = {
  '2026-06-01': { sets: { p2: [{ weight: 20, reps: 10 }, { weight: 22, reps: 8 }], p1: [{ weight: 0, reps: 12 }] } },
  '2026-06-03': { sets: { p2: [{ weight: 25, reps: 8 }] } },
  '2026-06-10': { sets: { p2: [{ weight: 30, reps: 5 }], p1: [{ weight: 0, reps: 15 }] } },
  '2026-06-08': { sets: { p2: [{ weight: 0, reps: 0 }] } }, // no completed reps
  'garbage':     { sets: { p2: [{ weight: 99, reps: 9 }] } }, // invalid date key
};

describe('exerciseProgressSeries', () => {
  it('returns sessions oldest → newest with top weight / e1rm / volume', () => {
    const s = exerciseProgressSeries('p2', days);
    expect(s.map(p => p.date)).toEqual(['2026-06-01', '2026-06-03', '2026-06-10']);
    expect(s[0].topWeight).toBe(22);
    expect(s[2].topWeight).toBe(30);
    expect(s[0].volume).toBe(20 * 10 + 22 * 8);
  });
  it('skips sessions with no completed reps and invalid date keys', () => {
    const s = exerciseProgressSeries('p2', days);
    expect(s.find(p => p.date === '2026-06-08')).toBeUndefined();
    expect(s.find(p => p.date === 'garbage')).toBeUndefined();
  });
});

describe('isBodyweightSeries', () => {
  it('true when every session has zero top weight', () => {
    expect(isBodyweightSeries(exerciseProgressSeries('p1', days))).toBe(true);
    expect(isBodyweightSeries(exerciseProgressSeries('p2', days))).toBe(false);
  });
});

describe('weekStart', () => {
  it('anchors to the Monday of the week', () => {
    // 2026-06-10 is a Wednesday → Monday is 2026-06-08
    expect(weekStart('2026-06-10')).toBe('2026-06-08');
  });
});

describe('weeklyVolumeSeries', () => {
  it('buckets tonnage by week, oldest → newest', () => {
    const w = weeklyVolumeSeries(days);
    expect(w.length).toBeGreaterThanOrEqual(2);
    expect(w[0].weekStart < w[w.length - 1].weekStart).toBe(true);
    const total = w.reduce((a, b) => a + b.volume, 0);
    expect(total).toBeGreaterThan(0);
  });
});

describe('loggedExerciseIds', () => {
  it('lists exercises with completed sets, most-logged first', () => {
    const ids = loggedExerciseIds(days);
    expect(ids).toContain('p2');
    expect(ids).toContain('p1');
    expect(ids[0]).toBe('p2'); // logged in more sessions
  });
});

const bm = {
  '2026-06-01': { weight: 80 },
  '2026-06-09': { weight: 78 },
  'bad-date': { weight: 200 },
};

describe('bodyweightOn', () => {
  it('uses the nearest entry on or before the date', () => {
    expect(bodyweightOn('2026-06-05', bm)).toBe(80);
    expect(bodyweightOn('2026-06-10', bm)).toBe(78);
  });
  it('falls forward when nothing precedes the date', () => {
    expect(bodyweightOn('2026-05-01', bm)).toBe(80);
  });
  it('returns 0 with no bodyweight logged', () => {
    expect(bodyweightOn('2026-06-05', {})).toBe(0);
  });
});

describe('bodyweightSeries', () => {
  it('returns sorted, valid weight points only', () => {
    const s = bodyweightSeries(bm);
    expect(s.map(p => p.date)).toEqual(['2026-06-01', '2026-06-09']);
    expect(s[0].weight).toBe(80);
  });
});

describe('exerciseProgressSeries — bodyweight-adjusted', () => {
  it('folds bodyweight into the load when addBodyweight is set', () => {
    const plain = exerciseProgressSeries('p1', days);            // bodyweight pull-ups, weight 0
    const adj = exerciseProgressSeries('p1', days, { addBodyweight: true, bodyMetrics: bm });
    expect(isBodyweightSeries(plain)).toBe(true);                // all topWeight 0
    expect(isBodyweightSeries(adj)).toBe(false);                 // bodyweight added → non-zero
    expect(adj[0].topWeight).toBe(80);                           // 0 added + 80 bw on 2026-06-01
  });
});
