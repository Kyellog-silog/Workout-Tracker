/**
 * Vitest coverage for the REAL scheduler module (the sibling scheduler.test.js
 * is a standalone Node script that inlines copies; this imports the shipped code
 * so regressions are caught in `npm test`).
 */
import { describe, it, expect } from 'vitest';
import {
  resolvedSession,
  baseSessionForDate,
  swapToRest,
  markMissed,
  clearOverride,
  applySmartGuard,
  getUnresolvedMisses,
} from './scheduler';
import { DEFAULT_SCHEDULE } from '../data/workouts';

const START = '2026-03-02'; // a Monday; schedule = push,pull,legs,rest,push,pull,rest

describe('resolvedSession — base rotation', () => {
  it('walks the default 7-day schedule and wraps', () => {
    const seq = Array.from({ length: 8 }, (_, i) => {
      const d = new Date(START + 'T12:00:00'); d.setDate(d.getDate() + i);
      const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return resolvedSession(s, START, {}, DEFAULT_SCHEDULE);
    });
    expect(seq).toEqual(['push', 'pull', 'legs', 'rest', 'push', 'pull', 'rest', 'push']);
  });

  it('returns null before the programme start', () => {
    expect(resolvedSession('2026-03-01', START, {}, DEFAULT_SCHEDULE)).toBeNull();
    expect(baseSessionForDate('2026-03-01', START, DEFAULT_SCHEDULE)).toBeNull();
  });

  it('a direct override wins over the base schedule', () => {
    expect(resolvedSession('2026-03-03', START, { '2026-03-03': 'rest' }, DEFAULT_SCHEDULE)).toBe('rest');
  });
});

describe('manual override helpers', () => {
  it('swapToRest rests the day and shifts subsequent sessions forward', () => {
    const ov = swapToRest('2026-03-02', {});
    expect(resolvedSession('2026-03-02', START, ov, DEFAULT_SCHEDULE)).toBe('rest');
    // 2026-03-03 was pull; shifted back by 1 → push
    expect(resolvedSession('2026-03-03', START, ov, DEFAULT_SCHEDULE)).toBe('push');
  });

  it('markMissed / clearOverride set and remove a date override', () => {
    const ov = markMissed('2026-03-02', {});
    expect(ov['2026-03-02']).toBe('missed');
    expect(clearOverride('2026-03-02', ov)['2026-03-02']).toBeUndefined();
  });
});

describe('applySmartGuard — shift mode (≤3 consecutive misses)', () => {
  it('marks the missed days rest and records a shift', () => {
    const { overrides, events } = applySmartGuard(START, {}, {}, '2026-03-04', DEFAULT_SCHEDULE);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('shift');
    expect(events[0].shiftBy).toBe(2);
    expect(overrides['2026-03-02']).toBe('rest');
    expect(overrides['2026-03-03']).toBe('rest');
    expect(overrides.__shifts).toHaveLength(1);
  });
});

describe('applySmartGuard — guard mode (>3 consecutive misses)', () => {
  const ALL_PUSH = ['push', 'push', 'push', 'push', 'push', 'push', 'push'];
  it('marks the run missed and sets a clean resume point', () => {
    const { overrides, events } = applySmartGuard(START, {}, {}, '2026-03-08', ALL_PUSH);
    expect(events[0].type).toBe('guard');
    expect(overrides['2026-03-02']).toBe('missed');
    expect(overrides.__resumeFrom).toBe('2026-03-08');
  });
});

describe('idempotency', () => {
  it('a second run on the same day produces no new events', () => {
    const first = applySmartGuard(START, {}, {}, '2026-03-04', DEFAULT_SCHEDULE);
    const second = applySmartGuard(START, {}, first.overrides, '2026-03-04', DEFAULT_SCHEDULE);
    expect(second.events).toHaveLength(0);
  });

  it('getUnresolvedMisses ignores days that already have an override', () => {
    const misses = getUnresolvedMisses(START, {}, { '2026-03-02': 'rest', '2026-03-03': 'rest' }, '2026-03-04', DEFAULT_SCHEDULE);
    expect(misses).toEqual([]);
  });
});
