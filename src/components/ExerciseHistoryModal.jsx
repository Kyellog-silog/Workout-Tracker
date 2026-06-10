/**
 * ExerciseHistoryModal — full logged history for a single exercise.
 *
 * Opened from an exercise card. Lists every session (newest first) with its
 * sets, session volume, and best estimated 1RM, highlighting all-time bests.
 */
import { useEffect } from 'react';
import { Icon } from './Icons';
import { getExerciseHistory, computePRs, epley1RM } from '../lib/prCalc';
import { fmtShort, fmtNum } from './MiniChart';

const num = (v) => Number(v) || 0;

export default function ExerciseHistoryModal({ exerciseId, exerciseName, sessionColor = 'var(--primary)', completedDays, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const history = getExerciseHistory(exerciseId, completedDays); // newest first
  const prs = computePRs(exerciseId, completedDays);

  const rows = history.map(({ date, sets }) => {
    let vol = 0, topW = 0, bestE = 0;
    const valid = [];
    for (const s of sets) {
      const w = num(s.weight), r = num(s.reps);
      if (r <= 0) continue;
      valid.push({ w, r });
      vol += w * r;
      if (w > topW) topW = w;
      const e = epley1RM(w, r);
      if (e > bestE) bestE = e;
    }
    return { date, sets: valid, vol, topW, bestE: Math.round(bestE * 10) / 10 };
  }).filter(r => r.sets.length > 0);

  const bestVol = Math.max(...rows.map(r => r.vol), 0);
  const e1rmRounded = Math.round(prs.estimated1RM * 10) / 10;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(40,30,18,0.45)', backdropFilter: 'blur(3px)' }} />
      <div
        role="dialog" aria-modal="true" aria-label={`${exerciseName} history`}
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          zIndex: 501, background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 10, width: 'min(440px, 94vw)', maxHeight: '82vh',
          display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)',
          animation: 'fadeInScale 0.16s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '18px 20px 12px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, fontFamily: 'var(--font-mono)', marginBottom: 3 }}>FULL HISTORY</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 18, color: 'var(--foreground)' }}>{exerciseName}</div>
          </div>
          <button onClick={onClose} aria-label="Close history" style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--muted-foreground)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="x" size={13} />
          </button>
        </div>

        {/* Summary */}
        <div style={{ display: 'flex', gap: 8, padding: '0 20px 12px', flexWrap: 'wrap' }}>
          {[
            { label: 'Sessions', value: rows.length },
            { label: 'Best 1RM', value: e1rmRounded > 0 ? `${e1rmRounded}kg` : '—' },
            { label: 'Top set', value: prs.maxWeight > 0 ? `${prs.maxWeight}kg` : '—' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, minWidth: 90, background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px' }}>
              <div style={{ fontSize: 8, color: 'var(--muted-foreground)', letterSpacing: 2, fontFamily: 'var(--font-mono)' }}>{s.label.toUpperCase()}</div>
              <div style={{ fontSize: 15, fontFamily: 'var(--font-mono)', color: 'var(--foreground)', marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Sessions list */}
        <div style={{ overflowY: 'auto', padding: '4px 20px 20px', borderTop: '1px solid var(--border)' }}>
          {rows.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13, fontStyle: 'italic' }}>
              No sets logged for this exercise yet.
            </div>
          ) : rows.map((r) => {
            const isVolPR = r.vol === bestVol && bestVol > 0;
            const is1rmPR = e1rmRounded > 0 && r.bestE === e1rmRounded;
            return (
              <div key={r.date} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }}>{fmtShort(r.date)}</span>
                    {(is1rmPR || isVolPR) && (
                      <span title={is1rmPR ? 'Best estimated 1RM' : 'Best session volume'} style={{ display: 'inline-flex' }}>
                        <Icon name="trophy" size={11} color="#b8960c" strokeWidth={2} />
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>{fmtNum(r.vol)} kg vol</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {r.sets.map((s, i) => (
                    <span key={i} style={{
                      fontSize: 11, fontFamily: 'var(--font-mono)', padding: '3px 8px', borderRadius: 4,
                      background: `${sessionColor}12`, border: `1px solid ${sessionColor}28`, color: 'var(--foreground)',
                    }}>
                      {s.w}<span style={{ color: 'var(--muted-foreground)' }}>×</span>{s.r}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
