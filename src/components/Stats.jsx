/**
 * Stats component.
 *
 * Computes and displays workout statistics:
 * - Total completed workouts
 * - Current streak (consecutive workout days completed, counting through rest days)
 * - Current programme week number
 * - Per-session-type breakdown (Push/Pull/Legs) with proportional progress bars
 */
import { SESSION_META as SESSIONS } from '../data/workouts';
import { resolvedSession, todayStr, diffDays } from '../lib/scheduler';
import { calcStreakInfo, restoresLeft } from '../lib/streakCalc';
import { totalVolume } from '../lib/prCalc';
import { Icon } from './Icons';

export default function Stats({ completedDays, programStart, overrides, streakRestores, onRestoreDay }) {
  const today = todayStr();

  // Calculate stats
  const allDates = Object.keys(completedDays);
  // E5: exclude future dates — someone editing storage shouldn't inflate the count
  const workoutDates = allDates.filter(d => {
    if (d > today) return false;
    const s = resolvedSession(d, programStart, overrides);
    return s && s !== 'rest' && s !== 'missed' && completedDays[d]?.allDone;
  });

  // Streak (day-based: consecutive completed workout days, rest days pass through)
  const { streak: dayStreak, breakDate } = calcStreakInfo(completedDays, programStart, overrides, streakRestores);
  const restoresRemaining = restoresLeft(breakDate, streakRestores);

  // Week since start
  let weekNum = 0;
  if (programStart) {
    const diff = diffDays(programStart, today);
    weekNum = Math.floor(diff / 7) + 1;
  }

  // Session counts
  const sessionCounts = { push: 0, pull: 0, legs: 0 };
  workoutDates.forEach(d => {
    const s = resolvedSession(d, programStart, overrides);
    if (s && sessionCounts[s] !== undefined) sessionCounts[s]++;
  });

  // Volume
  const volKg = totalVolume(completedDays);
  const volDisplay = volKg >= 1000
    ? `${(volKg / 1000).toFixed(1)}t`
    : `${Math.round(volKg)}kg`;

  const stats = [
    { label: 'WORKOUTS', value: workoutDates.length, color: '#2c6e7a' },
    { label: 'STREAK',   value: dayStreak, suffix: 'd', color: '#c48a2f', showFlame: dayStreak >= 3 },
    { label: 'WEEK',     value: weekNum || '—', color: '#6b4fa0' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Main stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {stats.map(({ label, value, suffix, color, showFlame }) => (
          <div key={label} style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '18px 12px', textAlign: 'center',
            boxShadow: '1px 2px 4px rgba(50,35,20,0.06)',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 32, color, lineHeight: 1 }}>{value}</div>
            {showFlame && <Icon name="flame" size={12} color={color} style={{ marginTop: 2 }} />}
            {suffix && <div style={{ fontSize: 9, color, opacity: 0.7, marginTop: 2, fontFamily: 'var(--font-mono)' }}>{suffix}</div>}
            <div style={{ fontSize: 8, color: 'var(--muted-foreground)', letterSpacing: 2, marginTop: 6, fontFamily: 'var(--font-mono)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Volume card */}
      {volKg > 0 && (
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 4, padding: '14px 20px',
          boxShadow: '1px 2px 4px rgba(50,35,20,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, fontFamily: 'var(--font-mono)' }}>TOTAL VOLUME LIFTED</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 22, color: '#4a7c59' }}>{volDisplay}</div>
        </div>
      )}

      {/* Streak restore banner */}
      {breakDate && (
        <div style={{
          background: 'var(--card)', border: `1px solid ${restoresLeft > 0 ? '#c48a2f' : 'var(--border)'}`,
          borderRadius: 4, padding: '14px 18px', boxShadow: '1px 2px 4px rgba(50,35,20,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 10, color: '#c48a2f', letterSpacing: 2, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>STREAK BROKEN</div>
            <div style={{ fontSize: 9, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>
              {new Date(breakDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              &nbsp;&middot;&nbsp;
              {restoresRemaining}/5 restores left
            </div>
          </div>
          <button
            onClick={() => onRestoreDay(breakDate)}
            disabled={restoresRemaining === 0}
            style={{
              fontSize: 9, letterSpacing: 2, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '6px 12px', borderRadius: 20, cursor: restoresRemaining > 0 ? 'pointer' : 'not-allowed',
              background: restoresRemaining > 0 ? 'transparent' : 'transparent',
              border: `1px solid ${restoresRemaining > 0 ? '#c48a2f' : 'var(--border)'}`,
              color: restoresRemaining > 0 ? '#c48a2f' : 'var(--muted-foreground)',
              opacity: restoresRemaining === 0 ? 0.5 : 1,
              transition: 'all 0.15s',
            }}
          >
            {restoresRemaining > 0 ? 'RESTORE' : 'NO RESTORES'}
          </button>
        </div>
      )}

      {/* Session breakdown */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '18px 22px', boxShadow: '1px 2px 4px rgba(50,35,20,0.06)' }}>
        <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, marginBottom: 16, fontFamily: 'var(--font-mono)' }}>SESSION BREAKDOWN</div>
        {Object.entries(sessionCounts).map(([key, count]) => {
          const s = SESSIONS[key];
          const maxCount = Math.max(...Object.values(sessionCounts), 1);
          return (
            <div key={key} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: s.color, letterSpacing: 1, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{s.label}</span>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>{count}×</span>
              </div>
              <div style={{ height: 3, background: 'var(--muted)', borderRadius: 2 }}>
                <div style={{
                  height: '100%', borderRadius: 2, background: s.color,
                  width: `${maxCount > 0 ? (count / maxCount) * 100 : 0}%`,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
