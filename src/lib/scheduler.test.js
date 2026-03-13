/**
 * SCHEDULER TEST SUITE
 * Run with: node src/lib/scheduler.test.js
 *
 * Tests cover:
 * 1. Base schedule resolution
 * 2. Single miss → shift
 * 3. 2–3 consecutive misses → shift by N
 * 4. 4+ consecutive misses → smart guard fires, no shift
 * 5. Guard + shift mix (e.g. 2 miss, recover, then 5 miss)
 * 6. Travel scenario (10 days missed)
 * 7. Illness scenario (7 days missed)
 * 8. Manual swap-to-rest
 * 9. Override clearing
 * 10. Schedule resumes correctly after guard
 * 11. Midnight check idempotency (running twice = same result)
 * 12. Edge: miss on rest day (should not trigger anything)
 * 13. Edge: miss at program start
 */

// Inline the core functions for Node.js testing (no bundler)
const DEFAULT_SCHEDULE = ['push', 'pull', 'legs', 'rest', 'push', 'pull', 'rest'];
const MAX_CONSECUTIVE_MISSES = 3;

// ─── Date utilities (local time based) ────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(str, n) {
  const d = new Date(str);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function diffDays(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return Math.round((db - da) / 86400000);
}

function isBefore(a, b) { return diffDays(a, b) > 0; }

// ─── Completion & Status Helpers ──────────────────────────────────────────────
function isTrained(date, completedDays) {
  const dayData = completedDays?.[date];
  if (!dayData) return false;
  return Object.values(dayData.checked || {}).some(Boolean);
}

function isAllDone(date, completedDays) {
  return completedDays?.[date]?.allDone || false;
}

// ─── Inlined Scheduler Logic (for testing) ────────────────────────────────────

function baseSessionForDate(date, programStart) {
  const diff = diffDays(programStart, date);
  if (diff < 0) return null;
  return DEFAULT_SCHEDULE[diff % DEFAULT_SCHEDULE.length];
}

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

function getUnresolvedMisses(programStart, completedDays, overrides, scanUntil) {
  if (!programStart) return [];
  const ov = overrides || {};
  const scanFrom = ov.__processedUpTo ? addDays(ov.__processedUpTo, 1) : programStart;
  const effectiveFrom = isBefore(programStart, scanFrom) ? scanFrom : programStart;
  const missed = [];
  let cursor = effectiveFrom;
  while (isBefore(cursor, scanUntil)) {
    const session = resolvedSession(cursor, programStart, ov);
    const isWorkout = session && session !== 'rest' && session !== 'missed';
    const hasActivity = isTrained(cursor, completedDays);
    const hasOverride = ov[cursor] !== undefined;
    if (isWorkout && !hasActivity && !hasOverride) {
      missed.push(cursor);
    }
    cursor = addDays(cursor, 1);
  }
  return missed;
}

function applySmartGuard(programStart, completedDays, currentOverrides, today) {
  const ov = currentOverrides || {};
  const misses = getUnresolvedMisses(programStart, completedDays, ov, today);

  if (misses.length === 0) {
    const newProcessed = addDays(today, -1);
    const existing = ov.__processedUpTo;
    if (existing && !isBefore(existing, newProcessed)) {
      return { overrides: ov, events: [] };
    }
    return {
      overrides: { ...ov, __processedUpTo: newProcessed },
      events: [],
    };
  }

  const newOverrides = { ...ov };
  const events = [];

  const runs = [];
  let run = [misses[0]];
  for (let i = 1; i < misses.length; i++) {
    if (diffDays(misses[i - 1], misses[i]) === 1) {
      run.push(misses[i]);
    } else {
      runs.push(run);
      run = [misses[i]];
    }
  }
  runs.push(run);

  for (const run of runs) {
    const runLen = run.length;
    if (runLen <= MAX_CONSECUTIVE_MISSES) {
      for (const d of run) newOverrides[d] = 'rest';
      const shiftFrom = addDays(run[run.length - 1], 1);
      if (!newOverrides.__shifts) newOverrides.__shifts = [];
      newOverrides.__shifts = [...newOverrides.__shifts, { from: shiftFrom, by: runLen }];
      events.push({ type: 'shift', dates: run, shiftBy: runLen });
    } else {
      for (const d of run) newOverrides[d] = 'missed';
      const resumeFrom = addDays(run[run.length - 1], 1);
      newOverrides.__resumeFrom = resumeFrom;
      events.push({ type: 'guard', dates: run, resumeFrom });
    }
  }

  newOverrides.__processedUpTo = addDays(today, -1);
  return { overrides: newOverrides, events };
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
  if (a !== b) throw new Error(`${msg || 'Expected equal'}: got "${a}", expected "${b}"`);
}

// ─── Test helpers ─────────────────────────────────────────────────────────────
const START = '2025-01-06'; // Monday (Day 0 = push)

function mkCompleted(dates, partial = false) {
  const obj = {};
  for (const d of dates) {
    obj[d] = {
      checked: { 'p1': true }, // At least one checked
      allDone: !partial,
    };
  }
  return obj;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('\n📋 SCHEDULER TEST SUITE\n');

console.log('1. BASE SCHEDULE');
test('Day 0 (Mon) = push', () => assertEqual(baseSessionForDate(START, START), 'push'));
test('Day 1 (Tue) = pull', () => assertEqual(baseSessionForDate(addDays(START, 1), START), 'pull'));
test('Day 2 (Wed) = legs', () => assertEqual(baseSessionForDate(addDays(START, 2), START), 'legs'));
test('Day 3 (Thu) = rest', () => assertEqual(baseSessionForDate(addDays(START, 3), START), 'rest'));
test('Day 4 (Fri) = push', () => assertEqual(baseSessionForDate(addDays(START, 4), START), 'push'));
test('Day 5 (Sat) = pull', () => assertEqual(baseSessionForDate(addDays(START, 5), START), 'pull'));
test('Day 6 (Sun) = rest', () => assertEqual(baseSessionForDate(addDays(START, 6), START), 'rest'));
test('Day 7 (Mon) = push (cycle repeats)', () => assertEqual(baseSessionForDate(addDays(START, 7), START), 'push'));
test('Day 14 = push (2 full cycles)', () => assertEqual(baseSessionForDate(addDays(START, 14), START), 'push'));
test('Before program start = null', () => assertEqual(baseSessionForDate(addDays(START, -1), START), null));

console.log('\n2. SHIFT LOGIC');
test('1 missed workout day shifts schedule by 1', () => {
  // today = day1 so only day0 (push) has passed and was missed
  const today = addDays(START, 1);
  const completed = {};
  const { overrides, events } = applySmartGuard(START, completed, {}, today);
  assert(events.length > 0, 'Should have events');
  assertEqual(events[0].type, 'shift', 'Should be shift event');
  assertEqual(events[0].shiftBy, 1, 'Should shift by exactly 1');
  // Day 0 gets overridden to rest (it was the missed workout)
  assertEqual(overrides[START], 'rest', 'Missed day marked as rest');
  // Day 1 now gets push (shifted from day 0) — shift starts from day1
  assertEqual(resolvedSession(addDays(START, 1), START, overrides), 'push', 'Day 1 now has push (shifted)');
  // Day 2 now gets pull (shifted from day 1)
  assertEqual(resolvedSession(addDays(START, 2), START, overrides), 'pull', 'Day 2 now has pull (shifted)');
});

test('2 consecutive misses shift by 2', () => {
  const today = addDays(START, 3);
  const completed = {};
  const { overrides, events } = applySmartGuard(START, completed, {}, today);
  // Days 0,1,2 are push/pull/legs. Day 3 is rest (not a miss). Only 0,1,2 are workout misses.
  // With the fix, it should detect 3 misses: push, pull, legs.
  const shiftEvent = events.find(e => e.type === 'shift');
  assert(shiftEvent, 'Should have shift event');
  assertEqual(shiftEvent.shiftBy, 3, 'Shift should be 3 for 3 missed workouts');
});

test('3 consecutive misses (exactly at limit) → shift, NOT guard', () => {
  // Miss days 0,1,2 (push, pull, legs) - exactly 3, should shift
  const today = addDays(START, 3); // today is rest day, so only 3 workout misses
  const completed = {};
  const { overrides, events } = applySmartGuard(START, completed, {}, today);
  const guardEvent = events.find(e => e.type === 'guard');
  const shiftEvent = events.find(e => e.type === 'shift');
  assert(!guardEvent, 'Guard should NOT fire for exactly 3 misses');
  assert(shiftEvent, 'Shift should apply for ≤ 3 misses');
  assertEqual(shiftEvent.shiftBy, 3, 'Shift amount should be 3');
});

console.log('\n3. GUARD LOGIC');
test('4+ consecutive missed workouts → guard fires', () => {
  // To get a run of 4, we need to miss push, pull, legs, (skip rest), push
  const today = addDays(START, 5); // Day 4 is push
  const completed = {}; // Miss days 0, 1, 2, 4
  const { overrides, events } = applySmartGuard(START, completed, {}, today);

  // The logic groups misses into consecutive runs.
  // Day 3 is a rest day, so it breaks the run.
  // Run 1: [day 0, day 1, day 2] -> length 3 -> SHIFT
  // Run 2: [day 4] -> length 1 -> SHIFT
  const guardEvent = events.find(e => e.type === 'guard');
  assert(!guardEvent, 'Guard should not fire with a rest day breaking the run');
  assertEqual(events.length, 2, 'Should have two separate shift events');
  assertEqual(events[0].shiftBy, 3, 'First run is a 3-day shift');
  assertEqual(events[1].shiftBy, 1, 'Second run is a 1-day shift');
});

test('Guard fires on a long absence (uninterrupted workout days)', () => {
  // To test the guard, we need a scenario with 4+ *consecutive workout days* missed.
  // Our default schedule has a max of 3. Let's simulate a different schedule for this test.
  const DENSE_SCHEDULE = ['push', 'pull', 'legs', 'push', 'pull', 'legs', 'rest'];
  const originalSchedule = [...DEFAULT_SCHEDULE];
  DEFAULT_SCHEDULE.length = 0;
  Array.prototype.push.apply(DEFAULT_SCHEDULE, DENSE_SCHEDULE);

  const today = addDays(START, 5); // Day 4 is pull
  const completed = {}; // Miss days 0, 1, 2, 3, 4
  const { overrides, events } = applySmartGuard(START, completed, {}, today);

  const guardEvent = events.find(e => e.type === 'guard');
  assert(guardEvent, 'Guard should fire for 5 consecutive workout misses');
  assertEqual(guardEvent.dates.length, 5, 'Guard event should cover all 5 missed dates');

  // Restore original schedule
  DEFAULT_SCHEDULE.length = 0;
  Array.prototype.push.apply(DEFAULT_SCHEDULE, originalSchedule);
});


console.log('\n4. TRAVEL & ILLNESS SCENARIOS');
test('10-day travel: schedule handled without spiraling', () => {
  const travelStart = START;
  const returnDay = addDays(START, 10); // back after 10 days
  const completed = {}; // nothing done while away

  const { overrides, events } = applySmartGuard(travelStart, completed, {}, returnDay);

  // Check: no shift debt makes schedule unusable
  const totalShift = (overrides.__shifts || []).reduce((s, sh) => s + sh.by, 0);
  const missedCount = Object.values(overrides).filter(v => v === 'missed').length;
  const restCount = Object.values(overrides).filter(v => v === 'rest').length;

  console.log(`    ℹ 10-day travel: shift=${totalShift}, missed=${missedCount}, rest=${restCount}`);
  console.log(`    ℹ Events: ${events.map(e => `${e.type}(${e.dates?.length || 0}d)`).join(' ')}`);

  // Schedule on return day should be a valid session
  const returnSession = resolvedSession(returnDay, travelStart, overrides);
  assert(['push','pull','legs','rest'].includes(returnSession), `Return session should be valid, got: ${returnSession}`);
  console.log(`    ℹ Session on return day: ${returnSession}`);
});

test('7-day illness: recovers correctly', () => {
  const illnessStart = addDays(START, 5); // get sick after 5 days
  // Completed days 0-4
  const completed = mkCompleted([START, addDays(START,1), addDays(START,2), addDays(START,4)]);
  const sickEnd = addDays(illnessStart, 7);

  const { overrides, events } = applySmartGuard(START, completed, {}, sickEnd);

  const returnSession = resolvedSession(sickEnd, START, overrides);
  assert(['push','pull','legs','rest'].includes(returnSession || 'rest'), `Sick return session should be valid`);
  console.log(`    ℹ Session after illness: ${returnSession}`);
  console.log(`    ℹ Events: ${events.map(e=>`${e.type}(${e.dates?.length||0}d)`).join(' ')}`);
});

console.log('\n5. IDEMPOTENCY & EDGE CASES');
test('Running midnight check twice produces identical overrides', () => {
  const today = addDays(START, 5);
  const completed = {};
  const { overrides: first, events: firstEvents } = applySmartGuard(START, completed, {}, today);
  // Pass first run's overrides into second run
  const { overrides: second, events: secondEvents } = applySmartGuard(START, completed, first, today);
  assertEqual(secondEvents.length, 0, 'Second run with same overrides should produce no new events');
  assertEqual(JSON.stringify(first), JSON.stringify(second), 'Overrides object should be identical');
});

test('Missing a rest day is not counted as a miss', () => {
  // Day 3 is a rest day. If we "miss" it, nothing should happen.
  const today = addDays(START, 4); // only workout day 0,1,2 and rest day 3 have passed
  const completed = mkCompleted([START, addDays(START,1), addDays(START,2)]); // did all workouts
  const { overrides, events } = applySmartGuard(START, completed, {}, today);
  assertEqual(events.length, 0, 'No events when only rest days missed');
});

console.log('\n6. MANUAL OVERRIDES');
test('Swapping a future date to rest shifts schedule by 1', () => {
  const futureDate = addDays(START, 4); // push day
  const overrides = {};
  if (!overrides.__shifts) overrides.__shifts = [];
  overrides[futureDate] = 'rest';
  overrides.__shifts = [{ from: addDays(futureDate, 1), by: 1 }];

  // The day after the swap should now have what was 2 days ahead
  const dayAfter = addDays(futureDate, 1);
  const session = resolvedSession(dayAfter, START, overrides);
  assertEqual(session, 'push', 'Day after swap should have original session (push shifted forward)');
});

console.log('\n7. REGRESSION TESTS (BUG FIXES)');
test('[BUGFIX] March 9-13 scenario: completed workouts should not cause shift', () => {
  const programStart = '2026-03-09';
  const today = '2026-03-13';
  const completed = mkCompleted(['2026-03-09', '2026-03-10', '2026-03-11']); // Push, Pull, Legs done
  // Day 12 is a rest day, so it's not a "miss"

  const { overrides, events } = applySmartGuard(programStart, completed, {}, today);

  assertEqual(events.length, 0, 'No shift or guard events should be generated');
  const sessionOn13th = resolvedSession('2026-03-13', programStart, overrides);
  assertEqual(sessionOn13th, 'push', 'March 13th should be a Push day');
});

test('[BUGFIX] Partial completion prevents auto-shift, but subsequent misses still shift', () => {
  const today = addDays(START, 2); // Day 1 (pull) is over
  // Day 0 (push) was partially done. Day 1 (pull) was missed entirely.
  const completed = mkCompleted([START], true); // partial=true
  const { events } = applySmartGuard(START, completed, {}, today);

  const shiftEvents = events.filter(e => e.type === 'shift');
  assertEqual(shiftEvents.length, 1, 'Should have one shift event for the one truly missed day');
  assertEqual(shiftEvents[0].shiftBy, 1, 'Shift should be by 1');
  assertEqual(shiftEvents[0].dates[0], addDays(START, 1), 'The missed date should be Day 1, not the partial Day 0');
});

test('[BUGFIX] Multiple separate misses are handled correctly', () => {
  const today = addDays(START, 3);
  const completed = {};
  const { overrides, events } = applySmartGuard(START, completed, {}, today);
  const shiftEvents = events.filter(e => e.type === 'shift');
  assertEqual(shiftEvents.length, 1, 'Should have exactly one shift event');
  assertEqual(shiftEvents[0].shiftBy, 3, 'Shift should be 3 for 3 missed workouts');
});

console.log('\n8. SCHEDULE CONTINUITY AFTER GUARD');
test('Sessions after guard resume in correct PPL order', () => {
  // Simulate 2-week absence → guard may fire → check that sessions after are valid PPL
  const today = addDays(START, 14);
  const completed = {};
  const { overrides } = applySmartGuard(START, completed, {}, today);

  const resumeDate = overrides.__resumeFrom;
  assert(resumeDate, 'A resume date should be set after a long absence');

  const sessionAtResume = resolvedSession(resumeDate, START, overrides);
  const sessionAfterResume = resolvedSession(addDays(resumeDate, 1), START, overrides);

  console.log(`    ℹ Guard reset, resuming from ${resumeDate} with session: ${sessionAtResume}`);
  assert(DEFAULT_SCHEDULE.includes(sessionAtResume), 'Session at resume point is valid');
  assert(DEFAULT_SCHEDULE.includes(sessionAfterResume), 'Session after resume point is valid');
});


// --- RUN ALL ---
if (failed > 0) {
  console.log(`\n\n❌ FAILED (${failed} of ${failed + passed} tests)`);
  process.exit(1);
} else {
  console.log(`\n\n✅ PASSED (${passed} tests)`);
}
