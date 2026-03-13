/**
 * SECURITY GUARDS TEST SUITE
 * Run with: node src/lib/securityGuards.test.js
 *
 * Groups:
 *   A — sanitizeKeys
 *   B — validateLoadedData
 *   C — clampNumber
 *   D — hash format (SHA-256 via Node.js built-in)
 */

// ── Inline implementations (mirrors src/lib/securityGuards.js) ──────────────

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function sanitizeKeys(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return obj;
  const result = {};
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    result[key] = sanitizeKeys(obj[key]);
  }
  return result;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateLoadedData(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const out = {};
  if (raw.programStart === null || raw.programStart === undefined) {
    out.programStart = null;
  } else if (typeof raw.programStart === 'string' && DATE_RE.test(raw.programStart)) {
    out.programStart = raw.programStart;
  } else {
    out.programStart = null;
  }
  if (typeof raw.selectedDate === 'string' && DATE_RE.test(raw.selectedDate)) {
    out.selectedDate = raw.selectedDate;
  } else {
    out.selectedDate = null;
  }
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
  if (typeof raw.overrides === 'object' && raw.overrides !== null && !Array.isArray(raw.overrides)) {
    out.overrides = raw.overrides;
  } else {
    out.overrides = {};
  }
  if (typeof raw.streakRestores === 'object' && raw.streakRestores !== null && !Array.isArray(raw.streakRestores)) {
    const sr = {};
    for (const [k, v] of Object.entries(raw.streakRestores)) {
      if (Array.isArray(v)) sr[k] = v.filter(item => typeof item === 'string');
    }
    out.streakRestores = sr;
  } else {
    out.streakRestores = {};
  }
  for (const key of Object.keys(raw)) {
    if (!(key in out)) out[key] = raw[key];
  }
  return out;
}

function clampNumber(value, min, max) {
  if (value === '' || value === null || value === undefined) return value;
  const n = Number(value);
  if (!Number.isFinite(n)) return n > 0 ? max : min;
  return Math.min(Math.max(n, min), max);
}

// ── Mini test runner ─────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(description, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✓  ${description}`);
    passed++;
  } else {
    console.error(`  ✗  ${description}`);
    console.error(`       expected: ${JSON.stringify(expected)}`);
    console.error(`       received: ${JSON.stringify(got)}`);
    failed++;
  }
}

function group(label, fn) {
  console.log(`\n${label}`);
  fn();
}

// ── Group A: sanitizeKeys ────────────────────────────────────────────────────

group('A — sanitizeKeys', () => {
  assert('strips __proto__',
    Object.keys(sanitizeKeys({ __proto__: { evil: true }, normal: 1 })),
    ['normal']
  );
  assert('strips constructor',
    Object.keys(sanitizeKeys({ constructor: 'bad', ok: 2 })),
    ['ok']
  );
  assert('strips prototype',
    Object.keys(sanitizeKeys({ prototype: {}, keep: 3 })),
    ['keep']
  );
  assert('preserves normal keys',
    sanitizeKeys({ a: 1, b: 'hello' }),
    { a: 1, b: 'hello' }
  );
  assert('sanitizes nested objects',
    sanitizeKeys({ outer: { __proto__: { x: 1 }, inner: 42 } }),
    { outer: { inner: 42 } }
  );
  assert('passes through non-object (string)',
    sanitizeKeys('hello'),
    'hello'
  );
  assert('passes through non-object (number)',
    sanitizeKeys(99),
    99
  );
  assert('passes through array as-is',
    sanitizeKeys([1, 2, 3]),
    [1, 2, 3]
  );
});

// ── Group B: validateLoadedData ──────────────────────────────────────────────

group('B — validateLoadedData', () => {
  assert('null input → null',
    validateLoadedData(null),
    null
  );
  assert('array input → null',
    validateLoadedData([]),
    null
  );
  assert('string input → null',
    validateLoadedData('bad'),
    null
  );

  // programStart
  assert('valid programStart preserved',
    validateLoadedData({ programStart: '2024-01-15', completedDays: {}, overrides: {}, streakRestores: {} }).programStart,
    '2024-01-15'
  );
  assert('invalid programStart (not date) → null',
    validateLoadedData({ programStart: 'yesterday', completedDays: {}, overrides: {}, streakRestores: {} }).programStart,
    null
  );
  assert('null programStart preserved as null',
    validateLoadedData({ programStart: null, completedDays: {}, overrides: {}, streakRestores: {} }).programStart,
    null
  );

  // completedDays
  assert('string completedDays → {}',
    validateLoadedData({ completedDays: 'bad' }).completedDays,
    {}
  );
  assert('non-date key in completedDays stripped',
    Object.keys(validateLoadedData({ completedDays: { 'not-a-date': {} } }).completedDays),
    []
  );
  assert('valid date key preserved',
    Object.keys(validateLoadedData({ completedDays: { '2024-03-10': {} } }).completedDays),
    ['2024-03-10']
  );

  // sets validation inside completedDays
  const withInfiniteSets = {
    completedDays: {
      '2024-03-10': {
        push: {
          sets: [
            { weight: 20, reps: 8 },
            { weight: Infinity, reps: 8 },
            { weight: 20, reps: NaN },
          ]
        }
      }
    }
  };
  assert('sets with Infinity weight stripped',
    validateLoadedData(withInfiniteSets).completedDays['2024-03-10'].push.sets.length,
    1
  );

  // overrides
  assert('array overrides → {}',
    validateLoadedData({ overrides: ['bad'] }).overrides,
    {}
  );
  assert('valid overrides preserved',
    validateLoadedData({ overrides: { '2024-03-10': 'pull' } }).overrides,
    { '2024-03-10': 'pull' }
  );

  // streakRestores
  assert('streakRestores non-string items filtered',
    validateLoadedData({ streakRestores: { push: ['2024-01-01', 99, '2024-02-01'] } }).streakRestores.push,
    ['2024-01-01', '2024-02-01']
  );

  // extra keys preserved
  assert('unknown extra keys preserved',
    validateLoadedData({ programStart: null, completedDays: {}, overrides: {}, streakRestores: {}, futureFeature: 'yes' }).futureFeature,
    'yes'
  );
});

// ── Group C: clampNumber ─────────────────────────────────────────────────────

group('C — clampNumber', () => {
  assert('clamps below min', clampNumber(-5, 0, 100), 0);
  assert('clamps above max', clampNumber(200, 0, 100), 100);
  assert('value in range unchanged', clampNumber(50, 0, 100), 50);
  assert('value at min edge', clampNumber(0, 0, 100), 0);
  assert('value at max edge', clampNumber(100, 0, 100), 100);
  assert('NaN → min', clampNumber(NaN, 0, 100), 0);
  assert('Infinity → max', clampNumber(Infinity, 0, 100), 100);
  assert('-Infinity → min', clampNumber(-Infinity, 0, 100), 0);
  assert('empty string passes through', clampNumber('', 0, 100), '');
  assert('null passes through', clampNumber(null, 0, 100), null);
  assert('undefined passes through', clampNumber(undefined, 0, 100), undefined);
  assert('string number clamped', clampNumber('150', 0, 100), 100);
});

// ── Group D: SHA-256 hash format ─────────────────────────────────────────────

group('D — hash format (Node.js crypto)', () => {
  const { createHash } = require('crypto');
  function nodeHash(phrase) {
    return createHash('sha256').update(phrase.trim().toLowerCase()).digest('hex');
  }

  const h = nodeHash('MyPassphrase');
  assert('hash is 64 hex chars', h.length, 64);
  assert('hash contains only hex chars', /^[0-9a-f]+$/.test(h), true);
  assert('hash is not the raw passphrase', h === 'mypassphrase', false);
  assert('hash is case-insensitive (normalised)', nodeHash('MyPassphrase'), nodeHash('mypassphrase'));
  assert('hash is trim-insensitive', nodeHash('  hello  '), nodeHash('hello'));
  assert('empty passphrase hashes to fixed value', nodeHash('').length, 64);
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`Security guards: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
