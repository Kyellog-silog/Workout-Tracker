// Node.js test file — run with: node src/lib/prCalc.test.js
// Functions inlined (no bundler required, consistent with scheduler/streakCalc tests)

// ─── inlined from prCalc.js ───────────────────────────────────────────────────
function getExerciseHistory(exerciseId, completedDays) {
  const result = [];
  for (const [date, day] of Object.entries(completedDays)) {
    const sets = day?.sets?.[exerciseId];
    if (Array.isArray(sets) && sets.length > 0) result.push({ date, sets });
  }
  result.sort((a, b) => (a.date < b.date ? 1 : -1));
  return result;
}

function epley1RM(weight, reps) {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

function computePRs(exerciseId, completedDays) {
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
      if (maxRepsAtWeight[w] === undefined || r > maxRepsAtWeight[w]) maxRepsAtWeight[w] = r;
      sessionVolume += w * r;
    }
    if (sessionVolume > maxSessionVolume) maxSessionVolume = sessionVolume;
  }
  return { maxWeight, estimated1RM, maxRepsAtWeight, maxSessionVolume };
}

function getTodayPRs(exerciseId, todaySets, completedDays) {
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
    if (prev.maxRepsAtWeight[w] === undefined || r > prev.maxRepsAtWeight[w]) beaten.add('maxRepsAtWeight');
    todayVolume += w * r;
  }
  if (todayVolume > prev.maxSessionVolume) beaten.add('maxSessionVolume');
  return Array.from(beaten);
}

function totalVolume(completedDays) {
  let total = 0;
  for (const day of Object.values(completedDays)) {
    if (!day?.sets) continue;
    for (const sets of Object.values(day.sets)) {
      if (!Array.isArray(sets)) continue;
      for (const { weight, reps } of sets) total += (Number(weight) || 0) * (Number(reps) || 0);
    }
  }
  return total;
}

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

function assertClose(a, b, label, tol = 0.01) {
  assert(Math.abs(a - b) < tol, `${label} (got ${a.toFixed(4)}, expected ${b.toFixed(4)})`);
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function makeDay(...setsForExercise) {
  // setsForExercise: [{id, sets}]
  const dayEntry = { sets: {} };
  for (const { id, sets } of setsForExercise) {
    dayEntry.sets[id] = sets;
  }
  return dayEntry;
}

// ─── Group A: epley1RM ────────────────────────────────────────────────────────
console.log('\nGroup A — epley1RM');
assertClose(epley1RM(100, 1), 100, '1 rep = weight');
assertClose(epley1RM(100, 10), 133.33, '100kg×10 ≈ 133.33');
assert(epley1RM(0, 10) === 0, 'zero weight = 0');
assert(epley1RM(50, 0) === 0, 'zero reps = 0');

// ─── Group B: getExerciseHistory ──────────────────────────────────────────────
console.log('\nGroup B — getExerciseHistory');

const cdHistory = {
  '2026-01-01': makeDay({ id: 'p1', sets: [{ weight: 20, reps: 10 }] }),
  '2026-01-03': makeDay({ id: 'p1', sets: [{ weight: 22.5, reps: 8 }] }),
  '2026-01-05': makeDay({ id: 'p1', sets: [{ weight: 20, reps: 10 }, { weight: 20, reps: 9 }] }),
  '2026-01-04': makeDay({ id: 'l1', sets: [{ weight: 60, reps: 5 }] }), // different exercise
};

const hist = getExerciseHistory('p1', cdHistory);
assert(hist.length === 3, 'returns 3 entries for p1');
assert(hist[0].date === '2026-01-05', 'newest first');
assert(hist[2].date === '2026-01-01', 'oldest last');

const histL1 = getExerciseHistory('l1', cdHistory);
assert(histL1.length === 1, 'l1 has 1 entry');

const histNone = getExerciseHistory('xx', cdHistory);
assert(histNone.length === 0, 'unknown id returns empty');

// ─── Group C: computePRs ──────────────────────────────────────────────────────
console.log('\nGroup C — computePRs');

const cdPRs = {
  '2026-01-01': makeDay({ id: 'p1', sets: [{ weight: 20, reps: 10 }, { weight: 20, reps: 9 }] }),
  '2026-01-05': makeDay({ id: 'p1', sets: [{ weight: 25, reps: 6 }] }),
};

const prs = computePRs('p1', cdPRs);
assert(prs.maxWeight === 25, 'maxWeight = 25');
assertClose(prs.estimated1RM, epley1RM(25, 6), 'estimated1RM comes from 25×6');
assert(prs.maxRepsAtWeight[20] === 10, 'maxRepsAtWeight[20] = 10');
assert(prs.maxRepsAtWeight[25] === 6, 'maxRepsAtWeight[25] = 6');
assert(prs.maxSessionVolume === 200 + 180, 'maxSessionVolume = day1 (200+180)');

// Empty exercise
const prsEmpty = computePRs('ghost', cdPRs);
assert(prsEmpty.maxWeight === 0, 'no history → maxWeight 0');
assert(prsEmpty.estimated1RM === 0, 'no history → estimated1RM 0');
assert(prsEmpty.maxSessionVolume === 0, 'no history → sessionVolume 0');

// Zero-rep sets ignored
const cdZeroRep = {
  '2026-01-01': makeDay({ id: 'p1', sets: [{ weight: 100, reps: 0 }] }),
};
const prsZero = computePRs('p1', cdZeroRep);
assert(prsZero.maxWeight === 0, 'zero-rep set ignored for maxWeight');

// ─── Group D: getTodayPRs ─────────────────────────────────────────────────────
console.log('\nGroup D — getTodayPRs');

const cdBase = {
  '2026-01-01': makeDay({ id: 'p1', sets: [{ weight: 20, reps: 10 }] }),
};

// No sets → no PRs
assert(getTodayPRs('p1', [], cdBase).length === 0, 'empty today sets → no PRs');

// New max weight
const newMaxW = getTodayPRs('p1', [{ weight: 25, reps: 5 }], cdBase);
assert(newMaxW.includes('maxWeight'), 'higher weight → maxWeight PR');

// New max reps at same weight
const newMaxR = getTodayPRs('p1', [{ weight: 20, reps: 12 }], cdBase);
assert(newMaxR.includes('maxRepsAtWeight'), 'more reps same weight → maxRepsAtWeight PR');

// Better 1RM estimate (same weight, more reps at same weight already beats → also 1RM)
const new1RM = getTodayPRs('p1', [{ weight: 20, reps: 15 }], cdBase);
assert(new1RM.includes('estimated1RM'), 'higher 1RM estimate → estimated1RM PR');

// Session volume: 20×10 = 200 is prev best; today 21×11 = 231 > 200
const newVol = getTodayPRs('p1', [{ weight: 21, reps: 11 }], cdBase);
assert(newVol.includes('maxSessionVolume'), 'higher session volume → maxSessionVolume PR');

// No PR (same as before)
const noPR = getTodayPRs('p1', [{ weight: 20, reps: 10 }], cdBase);
assert(noPR.length === 0, 'equal performance → no PRs');

// New exercise — any valid set is a PR
const brandNew = getTodayPRs('new', [{ weight: 10, reps: 5 }], cdBase);
assert(brandNew.includes('maxWeight'), 'first ever set → maxWeight PR');

// ─── Group E: totalVolume ────────────────────────────────────────────────────
console.log('\nGroup E — totalVolume');

const cdVol = {
  '2026-01-01': makeDay(
    { id: 'p1', sets: [{ weight: 20, reps: 10 }, { weight: 20, reps: 8 }] },
    { id: 'l1', sets: [{ weight: 60, reps: 5 }] }
  ),
  '2026-01-03': makeDay(
    { id: 'p1', sets: [{ weight: 22.5, reps: 6 }] }
  ),
};
// 20*10 + 20*8 + 60*5 + 22.5*6 = 200+160+300+135 = 795
assertClose(totalVolume(cdVol), 795, 'totalVolume = 795');

assert(totalVolume({}) === 0, 'empty completedDays → 0');

// Days with no sets key
const cdNoSets = { '2026-01-01': { completed: true } };
assert(totalVolume(cdNoSets) === 0, 'day without sets key → 0');

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
