import { describe, it, expect } from 'vitest';
import {
  exerciseProgressSeries,
  isBodyweightSeries,
  weeklyVolumeSeries,
  weekStart,
  loggedExerciseIds,
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
