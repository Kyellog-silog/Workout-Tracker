/**
 * Progression component.
 *
 * Displays the four training phases (Foundation, Build, Overload, Progress)
 * as a vertical timeline. The current phase is highlighted based on the
 * number of weeks since the programme start date. Also includes the
 * "2.5kg rule" reference for weight progression guidelines, and personal
 * exercise records derived from logged sets.
 */
import { PROGRESSION_PHASES, DEFAULT_EXERCISES, SESSION_META } from '../data/workouts';
import { computePRs, getExerciseHistory } from '../lib/prCalc';
import { getPlanMeta, getPlanExercises } from '../lib/planUtils';

export default function Progression({ programStart, completedDays = {}, overrides = {}, userPlans }) {
  const today = new Date();
  let currentPhase = 0;
  if (programStart) {
    const weeks = Math.floor((today - new Date(programStart)) / (7 * 86400000));
    if (weeks >= 12) currentPhase = 3;
    else if (weeks >= 8) currentPhase = 2;
    else if (weeks >= 4) currentPhase = 1;
    else currentPhase = 0;
  }

  // Build exercise records grouped by plan — uses userPlans when available,
  // falls back to the original push/pull/legs defaults.
  const planEntries = userPlans
    ? Object.entries(userPlans)
    : ['push', 'pull', 'legs'].map(k => [k, null]);

  const recordSections = planEntries.map(([key, _planData]) => {
    const meta = getPlanMeta(key, userPlans);
    const exercises = getPlanExercises(key, userPlans);
    const records = exercises
      .map(ex => {
        const prs = computePRs(ex.id, completedDays);
        const history = getExerciseHistory(ex.id, completedDays);
        if (history.length === 0) return null;
        return { ex, prs, history };
      })
      .filter(Boolean);
    return { key, meta, records };
  }).filter(s => s.records.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '22px 24px', boxShadow: '1px 2px 4px rgba(50,35,20,0.06)' }}>
        <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, marginBottom: 18, fontFamily: 'var(--font-mono)' }}>DUMBBELL PROGRESSION</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PROGRESSION_PHASES.map((phase, i) => (
            <div key={i} style={{
              borderLeft: `3px solid ${i === currentPhase ? phase.color : 'var(--border)'}`,
              padding: '12px 16px',
              borderRadius: '0 4px 4px 0',
              background: i === currentPhase ? `${phase.color}08` : 'var(--muted)',
              transition: 'all 0.3s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {i === currentPhase && (
                    <span style={{
                      fontSize: 8, background: 'var(--primary)', color: '#fff',
                      padding: '2px 8px', borderRadius: 3, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: 1,
                    }}>CURRENT</span>
                  )}
                  <span style={{ fontSize: 9, color: i === currentPhase ? phase.color : 'var(--muted-foreground)', letterSpacing: 2, fontFamily: 'var(--font-mono)' }}>WKS {phase.weeks}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: i === currentPhase ? 'var(--foreground)' : 'var(--muted-foreground)', fontFamily: 'var(--font-serif)' }}>{phase.title}</span>
                </div>
                <span style={{
                  fontSize: 10, padding: '3px 10px', borderRadius: 3,
                  background: `${phase.color}15`, color: phase.color, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  border: `1px solid ${phase.color}25`,
                }}>{phase.range}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>{phase.desc}</div>
            </div>
          ))}
        </div>

        {/* 2.5kg rule */}
        <div style={{ marginTop: 20, padding: '16px 18px', background: 'var(--muted)', borderRadius: 4, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, marginBottom: 14, fontFamily: 'var(--font-mono)' }}>THE 2.5KG RULE</div>
          {[
            ['Compound lifts', 'Add +2.5kg when you hit the top of the rep range for 2 consecutive sessions with perfect form'],
            ['Isolation exercises', 'Add +1.25kg — these are more technique-sensitive'],
            ['Pull-ups', 'Once you hit 10+ clean reps, add weight via backpack. Below 6 reps, do slow negatives (5s down)'],
            ['Deload week', 'Every 4th week: drop to 60% of all weights. This prevents plateaus and injury'],
          ].map(([title, desc], i, arr) => (
            <div key={i} style={{ marginBottom: i < arr.length - 1 ? 12 : 0, paddingBottom: i < arr.length - 1 ? 12 : 0, borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', marginBottom: 3, fontFamily: 'var(--font-serif)' }}>{title}</div>
              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Exercise Records */}
      {recordSections.length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '22px 24px', boxShadow: '1px 2px 4px rgba(50,35,20,0.06)' }}>
          <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, marginBottom: 18, fontFamily: 'var(--font-mono)' }}>EXERCISE RECORDS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {recordSections.map(({ key, meta, records }) => (
              <div key={key}>
                <div style={{ fontSize: 9, color: meta.color, letterSpacing: 2, fontFamily: 'var(--font-mono)', marginBottom: 10, fontWeight: 700 }}>
                  {meta.label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {records.map(({ ex, prs, history }) => {
                    const lastFive = history.slice(0, 5).map(h => h.date);
                    const isBodyweight = ex.type === 'bodyweight' || ex.type === 'pullup';
                    return (
                      <div key={ex.id} style={{
                        padding: '12px 14px', borderRadius: 4, background: 'var(--muted)', border: '1px solid var(--border)',
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', marginBottom: 6, fontFamily: 'var(--font-serif)' }}>
                          {ex.name}
                        </div>
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
                          {!isBodyweight && prs.maxWeight > 0 && (
                            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted-foreground)' }}>
                              <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{prs.maxWeight}kg</span>
                              {' '}max weight
                            </div>
                          )}
                          {prs.estimated1RM > 0 && (
                            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted-foreground)' }}>
                              <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{prs.estimated1RM.toFixed(1)}kg</span>
                              {' '}est. 1RM
                            </div>
                          )}
                          {prs.maxSessionVolume > 0 && (
                            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted-foreground)' }}>
                              <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{Math.round(prs.maxSessionVolume)}kg</span>
                              {' '}best session vol.
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {lastFive.map(d => (
                            <span key={d} style={{
                              fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: 3,
                              background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}25`,
                            }}>
                              {new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
