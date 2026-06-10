import { describe, it, expect } from 'vitest';
import {
  mergeAppData,
  mergeCompletedDays,
  mergeStreakRestores,
  resolveSavedAt,
  stampSavedAt,
} from './syncMerge';

describe('resolveSavedAt', () => {
  it('reads a numeric stamp', () => {
    expect(resolveSavedAt({ _savedAt: 1234 })).toBe(1234);
  });
  it('treats missing/garbage as 0 (oldest)', () => {
    expect(resolveSavedAt({})).toBe(0);
    expect(resolveSavedAt(null)).toBe(0);
    expect(resolveSavedAt({ _savedAt: 'nope' })).toBe(0);
    expect(resolveSavedAt({ _savedAt: Infinity })).toBe(0);
  });
});

describe('stampSavedAt', () => {
  it('adds a stamp without mutating the input', () => {
    const src = { a: 1 };
    const out = stampSavedAt(src, 999);
    expect(out).toEqual({ a: 1, _savedAt: 999 });
    expect(src._savedAt).toBeUndefined();
  });
});

describe('mergeAppData — the reported bug', () => {
  it('a NEWER remote (phone 7/7) beats a STALE local (web 3/7)', () => {
    const remote = stampSavedAt({
      completedDays: { '2026-06-10': { checked: { p1: true, p2: true, p3: true, p4: true, p5: true, p6: true, p7: true }, allDone: true } },
    }, 2000);
    const local = stampSavedAt({
      completedDays: { '2026-06-10': { checked: { p1: true, p2: true, p3: true } } },
      selectedDate: '2026-06-10',
    }, 1000);

    const merged = mergeAppData(remote, local);
    const day = merged.completedDays['2026-06-10'];
    expect(Object.values(day.checked).filter(Boolean).length).toBe(7);
    expect(day.allDone).toBe(true);
  });

  it('a STALE local cannot erase completions even if it were primary', () => {
    // local is newer here, but it must NOT drop the checks remote already had
    const remote = stampSavedAt({
      completedDays: { '2026-06-10': { checked: { p1: true, p2: true, p3: true, p4: true } } },
    }, 1000);
    const local = stampSavedAt({
      completedDays: { '2026-06-10': { checked: { p5: true } } },
    }, 2000);

    const merged = mergeAppData(remote, local);
    const checked = merged.completedDays['2026-06-10'].checked;
    expect(checked).toMatchObject({ p1: true, p2: true, p3: true, p4: true, p5: true });
  });

  it('ties go to remote (the server is the shared source of truth)', () => {
    const remote = stampSavedAt({ programStart: '2026-01-01' }, 5000);
    const local = stampSavedAt({ programStart: '2025-12-01' }, 5000);
    expect(mergeAppData(remote, local).programStart).toBe('2026-01-01');
  });

  it('always keeps the local selectedDate (view never yanked)', () => {
    const remote = stampSavedAt({ selectedDate: '2020-01-01' }, 2000);
    const local = stampSavedAt({ selectedDate: '2026-06-10' }, 1000);
    expect(mergeAppData(remote, local).selectedDate).toBe('2026-06-10');
  });
});

describe('mergeCompletedDays', () => {
  it('passes through dates present on only one side', () => {
    const out = mergeCompletedDays(
      { a: { checked: { p1: true } } },
      { b: { checked: { p2: true } } },
    );
    expect(Object.keys(out).sort()).toEqual(['a', 'b']);
  });

  it('keeps the fuller set log per exercise', () => {
    const primary = { d: { sets: { p1: [{ weight: 20, reps: 5 }] } } };
    const secondary = { d: { sets: { p1: [{ weight: 20, reps: 5 }, { weight: 22, reps: 5 }] } } };
    expect(mergeCompletedDays(primary, secondary).d.sets.p1).toHaveLength(2);
  });

  it('OR-s allDone and cardio done (sticky completion)', () => {
    const primary = { d: { allDone: false, cardioLog: { done: false } } };
    const secondary = { d: { allDone: true, cardioLog: { done: true } } };
    const day = mergeCompletedDays(primary, secondary).d;
    expect(day.allDone).toBe(true);
    expect(day.cardioLog.done).toBe(true);
  });

  it('primary wins for notes but fills gaps from secondary', () => {
    const primary = { d: { notes: { p1: 'new' } } };
    const secondary = { d: { notes: { p1: 'old', p2: 'keep' } } };
    expect(mergeCompletedDays(primary, secondary).d.notes).toEqual({ p1: 'new', p2: 'keep' });
  });
});

describe('mergeStreakRestores', () => {
  it('unions per-month arrays without duplicates', () => {
    const out = mergeStreakRestores(
      { '2026-06': ['2026-06-03', '2026-06-10'] },
      { '2026-06': ['2026-06-03'], '2026-05': ['2026-05-01'] },
    );
    expect(out['2026-06'].sort()).toEqual(['2026-06-03', '2026-06-10']);
    expect(out['2026-05']).toEqual(['2026-05-01']);
  });
});
