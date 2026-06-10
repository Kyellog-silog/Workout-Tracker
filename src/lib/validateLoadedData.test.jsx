import { describe, it, expect } from 'vitest';
import { validateLoadedData, sanitizeKeys, clampNumber } from './securityGuards';

describe('validateLoadedData', () => {
  it('rejects non-object roots', () => {
    expect(validateLoadedData(null)).toBeNull();
    expect(validateLoadedData([1, 2])).toBeNull();
    expect(validateLoadedData('x')).toBeNull();
  });

  it('keeps valid programStart, nulls invalid', () => {
    expect(validateLoadedData({ programStart: '2026-01-06' }).programStart).toBe('2026-01-06');
    expect(validateLoadedData({ programStart: 'nope' }).programStart).toBeNull();
  });

  it('drops non-date keys from completedDays', () => {
    const out = validateLoadedData({ completedDays: { '2026-01-06': { allDone: true }, junk: { allDone: true } } });
    expect(out.completedDays['2026-01-06']).toBeTruthy();
    expect(out.completedDays.junk).toBeUndefined();
  });

  it('validates bodyMetrics: date keys, finite numbers, string notes', () => {
    const out = validateLoadedData({
      bodyMetrics: {
        '2026-06-01': { weight: 80.5, waist: '85', bad: 'x', empty: '', notes: 'felt good' },
        'not-a-date': { weight: 99 },
      },
    });
    expect(out.bodyMetrics['2026-06-01']).toEqual({ weight: 80.5, waist: 85, notes: 'felt good' });
    expect(out.bodyMetrics['not-a-date']).toBeUndefined();
  });

  it('strips prototype-pollution keys via sanitizeKeys (wired into the load path)', () => {
    const malicious = JSON.parse('{"overrides":{"__proto__":{"polluted":true}}}');
    const out = validateLoadedData(malicious);
    expect(({}).polluted).toBeUndefined();
    expect(Object.prototype.polluted).toBeUndefined();
    expect(out.overrides.__proto__ && out.overrides.__proto__.polluted).toBeFalsy();
  });

  it('preserves unknown forward-compat keys (e.g. _savedAt)', () => {
    expect(validateLoadedData({ _savedAt: 123 })._savedAt).toBe(123);
  });
});

describe('sanitizeKeys', () => {
  it('removes __proto__ / constructor / prototype recursively', () => {
    const cleaned = sanitizeKeys(JSON.parse('{"a":{"__proto__":1,"constructor":2,"prototype":3,"ok":4}}'));
    expect(cleaned.a).toEqual({ ok: 4 });
  });
});

describe('clampNumber', () => {
  it('clamps to range and passes through empty/null', () => {
    expect(clampNumber(150, 0, 100)).toBe(100);
    expect(clampNumber(-5, 0, 100)).toBe(0);
    expect(clampNumber('', 0, 100)).toBe('');
    expect(clampNumber(null, 0, 100)).toBeNull();
  });
});
