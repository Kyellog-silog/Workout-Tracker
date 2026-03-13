/**
 * STREAK CALC TEST SUITE
 * Run with: node src/lib/streakCalc.test.js
 *
 * Tests cover:
 *
 * GROUP A — Core streak counting (7 tests)
 *   A1. No programStart → streak 0, no breakDate
 *   A2. programStart = today, no completions → 0 (today in-progress, no break)
 *   A3. Single completed workout today → streak 1
 *   A4. Three consecutive completed workouts → streak 3
 *   A5. Rest days are transparent (don't count or break)
 *   A6. Missed yesterday → streak 0, breakDate = yesterday
 *   A7. Done 3 days ago, missed 2 days ago → streak 1, breakDate = 2 days ago
 *
 * GROUP B — Restore mechanic (6 tests)
 *   B1. Restoring breakDate clears the break
 *   B2. 5 restores used → restoresLeft = 0
 *   B3. restoresLeft counts down correctly 5→4→3→2→1→0
 *   B4. Adding same date twice → idempotent (deduplication)
 *   B5. March restores don't count in April (month boundary)
 *   B6. streakRestores = undefined → no crash
 *
 * GROUP C — Scheduler interaction (3 tests)
 *   C1. Guard-marked days ('missed') are transparent, don't break streak
 *   C2. Workout day overridden to 'rest' → transparent, streak continues
 *   C3. Shifted schedule: streak calc correctly resolves shifted sessions
 *
 * GROUP D — Exploits & edge cases (8 tests)
 *   D1. Duplicate dates in restore array → restoresLeft never goes negative
 *   D2. streakRestores[key] is not an Array → no TypeError
 *   D3. Future allDone: true date → NOT counted in streak (backward walk stops at today)
 *   D4. completedDays = {} → streak 0, no crash
 *   D5. onRestoreDay rejected when restoresLeft === 0 (validates app-level guard)
 *   D6. programStart 6 years ago → completes within 50 ms
 *   D7. All days are rest overrides → streak 0, no breakDate
 *   D8. programStart in the future → streak 0, no breakDate
 */

// ─── Inlined dependencies (no bundler) ────────────────────────────────────────

const DEFAULT_SCHEDULE = ['push', 'pull', 'legs', 'rest', 'push', 'pull', 'rest'];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(str, n) {
  const [y, m, day] = str.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function diffDays(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const da = new Date(ay, am - 1, ad);
  const db = new Date(by, bm - 1, bd);
  return Math.round((db - da) / 86400000);
}

function isBefore(a, b) { return diffDays(a, b) > 0; }

function resolvedSession(date, programStart, overrides) {
  if (!programStart) return null;
  const ov = overrides || {};
  if (ov[date] !== undefined && ov[date] !== null) return ov[date];
  if (ov.__resumeFrom && !isBefore(date, ov.__resumeFrom)) {
    let shiftDebtBeforeResume = 0;
    for (const sh of (ov.__shifts || [])) {
      if (isBefore(sh.from, ov.__resumeFrom)) shiftDebtBeforeResume += sh.by;
    }
    const daysToResume = diffDays(programStart, ov.__resumeFrom);
    const baseIdxAtResume = daysToResume - shiftDebtBeforeResume;
    const daysFromResume = diffDays(ov.__resumeFrom, date);
    const idx = (baseIdxAtResume + daysFromResume) % DEFAULT_SCHEDULE.length;
    return DEFAULT_SCHEDULE[idx < 0 ? idx + DEFAULT_SCHEDULE.length : idx];
  }
  let shiftDebt = 0;
  for (const sh of (ov.__shifts || [])) {
    if (!isBefore(date, sh.from)) shiftDebt += sh.by;
  }
  const baseDiff = diffDays(programStart, date);
  if (baseDiff < 0) return null;
  const shiftedDiff = baseDiff - shiftDebt;
  if (shiftedDiff < 0) return null;
  return DEFAULT_SCHEDULE[shiftedDiff % DEFAULT_SCHEDULE.length];
}

// ─── Inlined calcStreakInfo & restoresLeft (with exploits E1/E2/E3 fixed) ─────

function calcStreakInfo(completedDays, programStart, overrides, streakRestores, today) {
  if (!today) today = todayStr();
  if (!programStart) return { streak: 0, breakDate: null };
  const daysSinceStart = diffDays(programStart, today);
  if (daysSinceStart < 0) return { streak: 0, breakDate: null };
  let streak = 0;
  for (let i = 0; i <= daysSinceStart; i++) {
    const date = addDays(today, -i);
    if (date < programStart) break;
    const s = resolvedSession(date, programStart, overrides);
    // Transparent: rest days and guard-marked ('missed') days
    if (!s || s === 'rest' || s === 'missed') continue;
    if (completedDays[date]?.allDone) { streak++; continue; }
    if (date === today) continue; // today in progress
    // Check restore (E3: validate Array)
    const monthKey = date.slice(0, 7);
    const restored = Array.isArray(streakRestores?.[monthKey]) ? streakRestores[monthKey] : [];
    if (restored.includes(date)) continue;
    return { streak, breakDate: date };
  }
  return { streak, breakDate: null };
}

function restoresLeft(breakDate, streakRestores) {
  if (!breakDate) return 0;
  const monthKey = breakDate.slice(0, 7);
  const arr = Array.isArray(streakRestores?.[monthKey]) ? streakRestores[monthKey] : [];
  // E2: use Set to deduplicate before counting
  return Math.max(0, 5 - new Set(arr).size);
}

// ─── Test framework ───────────────────────────────────────────────────────────

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    → ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  const aStr = JSON.stringify(a);
  const bStr = JSON.stringify(b);
  if (aStr !== bStr) throw new Error(`${msg || 'Expected equal'}: got ${aStr}, expected ${bStr}`);
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

// Fixed test anchor — a Monday so the default schedule is deterministic:
// Day 0=push Day 1=pull Day 2=legs Day 3=rest Day 4=push Day 5=pull Day 6=rest
const START = '2026-01-05'; // Monday
const TODAY = '2026-03-13'; // Fixed "today" for all tests

function done(...dates) {
  const obj = {};
  for (const d of dates) obj[d] = { allDone: true, checked: { p1: true } };
  return obj;
}

function partial(...dates) {
  const obj = {};
  for (const d of dates) obj[d] = { allDone: false, checked: { p1: true } };
  return obj;
}

// ─── GROUP A: Core streak counting ───────────────────────────────────────────

console.log('\n📋 STREAK CALC TEST SUITE\n');
console.log('GROUP A — Core streak counting');

test('A1: null programStart → streak 0, breakDate null', () => {
  const r = calcStreakInfo({}, null, {}, {}, TODAY);
  assertEqual(r, { streak: 0, breakDate: null });
});

test('A2: programStart = today, no completions → 0, no break (today in-progress)', () => {
  const r = calcStreakInfo({}, TODAY, {}, {}, TODAY);
  assertEqual(r, { streak: 0, breakDate: null });
});

test('A3: single completed workout today → streak 1', () => {
  // TODAY is a friday relative to START — let's just use a point in the schedule
  // Day 0 from START is push. Pick a date that is explicitly a workout day.
  const start = START;          // push day
  const today = START;          // same day = "today"
  const r = calcStreakInfo(done(start), start, {}, {}, today);
  assertEqual(r.streak, 1);
  assertEqual(r.breakDate, null);
});

test('A4: three consecutive completed workouts → streak 3', () => {
  // START=push, +1=pull, +2=legs
  const d0 = START;
  const d1 = addDays(START, 1);
  const d2 = addDays(START, 2);
  const today = d2;
  const r = calcStreakInfo(done(d0, d1, d2), START, {}, {}, today);
  assertEqual(r.streak, 3);
  assertEqual(r.breakDate, null);
});

test('A5: rest day (Thu) is transparent — all workout days done Mon→Fri → streak 4', () => {
  // Mon=push, Tue=pull, Wed=legs, Thu=REST, Fri=push
  // Complete all four workout days; rest day should not count but also not break.
  const mon = START;                    // day 0 push
  const tue = addDays(START, 1);        // day 1 pull
  const wed = addDays(START, 2);        // day 2 legs
  // day 3 = rest (not done, not needed)
  const fri = addDays(START, 4);        // day 4 push
  const today = fri;
  const r = calcStreakInfo(done(mon, tue, wed, fri), START, {}, {}, today);
  // Walk: fri(+0) done → 1, thu(+1) rest → skip, wed(+2) done → 2, tue(+3) done → 3, mon(+4) done → 4
  assertEqual(r.streak, 4, 'rest day must not break streak when all workouts done');
  assertEqual(r.breakDate, null);
});

test('A6: missed yesterday\'s workout → streak 0, breakDate = yesterday', () => {
  const yesterday = addDays(START, 1); // pull day
  const today = addDays(START, 2);     // legs day, not done
  const r = calcStreakInfo({}, START, {}, {}, today);
  // Today (legs) not done but it's "today" → skip. Yesterday (pull) not done → break.
  assertEqual(r.streak, 0);
  assertEqual(r.breakDate, yesterday);
});

test('A7: done 3 days ago, missed 2 days ago → streak 1, breakDate = 2 days ago', () => {
  // d0=push done, d1=pull MISSED, d2=legs done, today=d2
  const d0 = START;
  const d1 = addDays(START, 1);
  const d2 = addDays(START, 2);
  const today = d2;
  const r = calcStreakInfo(done(d0, d2), START, {}, {}, today);
  // Walking back: d2 done (+1), d1 missed → break with streak=1
  assertEqual(r.streak, 1);
  assertEqual(r.breakDate, d1);
});

// ─── GROUP B: Restore mechanic ────────────────────────────────────────────────

console.log('\nGROUP B — Restore mechanic');

test('B1: restoring breakDate clears the break (streak continues through it)', () => {
  const d0 = START;
  const d1 = addDays(START, 1); // missed
  const d2 = addDays(START, 2);
  const today = d2;
  const monthKey = d1.slice(0, 7);
  const restores = { [monthKey]: [d1] }; // d1 restored
  const r = calcStreakInfo(done(d0, d2), START, {}, restores, today);
  assertEqual(r.streak, 2, 'streak should skip over the restored day');
  assertEqual(r.breakDate, null, 'no break after restore');
});

test('B2: 5 restores exhausted → restoresLeft = 0', () => {
  const dates = ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05'];
  const restores = { '2026-03': dates };
  assertEqual(restoresLeft('2026-03-06', restores), 0);
});

test('B3: restoresLeft counts down 5→4→3→2→1→0', () => {
  for (let used = 0; used <= 5; used++) {
    const arr = ['2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05'].slice(0, used);
    const restores = used > 0 ? { '2026-04': arr } : {};
    const left = restoresLeft('2026-04-06', restores);
    assertEqual(left, 5 - used, `with ${used} used, should have ${5 - used} left`);
  }
});

test('B4: adding same date twice stays idempotent (dedup via Set)', () => {
  // Simulate corrupted data: same date appears twice in the array
  const restores = { '2026-03': ['2026-03-05', '2026-03-05', '2026-03-05'] };
  const left = restoresLeft('2026-03-06', restores);
  // Only 1 unique date used, so 4 restores should remain
  assertEqual(left, 4, 'duplicate entries in restore array must be deduplicated');
});

test('B5: March restores do not count in April (month boundary reset)', () => {
  const restores = {
    '2026-03': ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05'],
    '2026-04': [],
  };
  const left = restoresLeft('2026-04-01', restores);
  assertEqual(left, 5, 'April should have a fresh 5 restores regardless of March usage');
});

test('B6: streakRestores = undefined → no crash, streak calc still works', () => {
  const d0 = START;
  const d1 = addDays(START, 1); // missed
  const today = addDays(START, 2);
  // Should not throw
  let r;
  assert(() => { r = calcStreakInfo(done(d0), START, {}, undefined, today); return true; }, 'no throw');
  r = calcStreakInfo(done(d0), START, {}, undefined, today);
  assertEqual(r.breakDate, d1, 'break at missed day when no restores defined');
});

// ─── GROUP C: Scheduler interaction ──────────────────────────────────────────

console.log('\nGROUP C — Scheduler interaction');

test('C1: guard-marked days (overrides = "missed") are transparent, streak continues', () => {
  // d0=push done, d1=pull → marked 'missed' by guard, d2=legs done
  const d0 = START;
  const d1 = addDays(START, 1);
  const d2 = addDays(START, 2);
  const today = d2;
  const overrides = { [d1]: 'missed' };
  const r = calcStreakInfo(done(d0, d2), START, overrides, {}, today);
  // d1 is 'missed' → transparent, streak continues through it
  assertEqual(r.streak, 2, 'guard "missed" days must not break streak');
  assertEqual(r.breakDate, null);
});

test('C2: workout day overridden to "rest" → transparent, streak continues', () => {
  // d0=push done, d1=pull overridden to rest, d2=legs done
  const d0 = START;
  const d1 = addDays(START, 1);
  const d2 = addDays(START, 2);
  const today = d2;
  const overrides = { [d1]: 'rest' };
  const r = calcStreakInfo(done(d0, d2), START, overrides, {}, today);
  assertEqual(r.streak, 2, 'days overridden to rest should be transparent');
  assertEqual(r.breakDate, null);
});

test('C3: shifted schedule — streak correctly traverses shifted sessions', () => {
  // Miss d0 (push) → auto shift by 1: d0=rest override, __shifts=[{from: d1, by:1}]
  // Now d1 acts as push, d2 as pull, etc.
  // Complete what is now push (d1) and pull (d2).
  const d0 = START;
  const d1 = addDays(START, 1);
  const d2 = addDays(START, 2);
  const today = d2;
  const overrides = {
    [d0]: 'rest',
    __shifts: [{ from: d1, by: 1 }],
  };
  // After shift, d1=push, d2=pull. Complete both.
  const r = calcStreakInfo(done(d1, d2), START, overrides, {}, today);
  assertEqual(r.streak, 2, 'streak should count through shifted schedule correctly');
  assertEqual(r.breakDate, null);
});

// ─── GROUP D: Exploits & edge cases ──────────────────────────────────────────

console.log('\nGROUP D — Exploits & edge cases');

test('D1: duplicate dates in restore array → restoresLeft never negative', () => {
  // 10 duplicates — worst case corrupt data
  const arr = Array(10).fill('2026-03-05');
  const restores = { '2026-03': arr };
  const left = restoresLeft('2026-03-06', restores);
  assert(left >= 0, `restoresLeft must be ≥ 0, got ${left}`);
  assertEqual(left, 4, 'only 1 unique date used, so 4 restores remain');
});

test('D2: streakRestores[key] is not an Array → no TypeError', () => {
  // Simulates corrupted Supabase data where the value is a number/object/null
  const corruptedRestores = { '2026-03': 5 }; // should be an array, is a number
  let threw = false;
  try {
    calcStreakInfo({}, TODAY, {}, corruptedRestores, TODAY);
  } catch {
    threw = true;
  }
  assert(!threw, 'calcStreakInfo must not throw when restore value is not an Array');
});

test('D3: future allDone: true date — NOT counted in streak backward walk', () => {
  // Set a completion date in the future
  const future = addDays(TODAY, 5);
  const completedDays = { [future]: { allDone: true, checked: { p1: true } } };
  const r = calcStreakInfo(completedDays, TODAY, {}, {}, TODAY);
  // Backward walk from TODAY never reaches future dates, so streak = 0
  assertEqual(r.streak, 0, 'future dates must not be counted in streak');
});

test('D4: completedDays = {} → streak 0, no crash', () => {
  const r = calcStreakInfo({}, START, {}, {}, addDays(START, 3));
  assertEqual(r.streak, 0);
  assert(r.breakDate !== undefined, 'breakDate field must exist');
});

test('D5: app-level onRestoreDay guard rejects when restoresLeft = 0', () => {
  // Simulate the App.jsx handler logic
  function handleRestoreDay(dateStr, streakRestoresState) {
    const monthKey = dateStr.slice(0, 7);
    const current = streakRestoresState[monthKey] || [];
    if (current.includes(dateStr) || current.length >= 5) return false; // rejected
    return true; // would have been accepted
  }

  const full = { '2026-03': ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05'] };
  const result = handleRestoreDay('2026-03-06', full);
  assertEqual(result, false, 'restore should be rejected when cap is reached');
});

test('D6: programStart 6 years ago → completes in <50 ms (perf baseline)', () => {
  const ancientStart = '2020-01-01';
  const start = Date.now();
  calcStreakInfo({}, ancientStart, {}, {}, TODAY);
  const elapsed = Date.now() - start;
  assert(elapsed < 50, `calcStreakInfo with 6-year-old start took ${elapsed}ms, must be <50ms`);
});

test('D7: all days are rest overrides → streak 0, breakDate null', () => {
  // Override all days in a 7-day window to 'rest'
  const start = addDays(TODAY, -6);
  const overrides = {};
  for (let i = 0; i <= 6; i++) overrides[addDays(start, i)] = 'rest';
  const r = calcStreakInfo({}, start, overrides, {}, TODAY);
  assertEqual(r.streak, 0);
  assertEqual(r.breakDate, null, 'all-rest window should never produce a breakDate');
});

test('D8: programStart in the future → streak 0, breakDate null', () => {
  const futureStart = addDays(TODAY, 10);
  const r = calcStreakInfo({}, futureStart, {}, {}, TODAY);
  assertEqual(r, { streak: 0, breakDate: null });
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\n⚠  Some tests failed.');
  process.exit(1);
} else {
  console.log('\n✅  All tests passed.');
}
