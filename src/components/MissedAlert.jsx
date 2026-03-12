/**
 * MissedAlert component.
 *
 * Full-screen modal displayed when the smart guard detects missed sessions
 * on app open or at midnight. Shows two types of events:
 * - Shift events: schedule pushed forward by N days
 * - Guard events: extended absence detected, schedule resumes fresh
 *
 * Includes a research note about the negligible impact of short breaks
 * on strength retention.
 */
import { formatDate } from '../lib/scheduler';
import { Icon } from './Icons';

export default function MissedAlert({ events, onDismiss }) {
  if (!events || events.length === 0) return null;

  const guards = events.filter(e => e.type === 'guard');
  const shifts = events.filter(e => e.type === 'shift');
  const totalMissed = events.reduce((s, e) => s + (e.dates?.length || 0), 0);
  const hasGuard = guards.length > 0;

  return (
    <>
      <div onClick={onDismiss} style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(50,35,20,0.45)', backdropFilter: 'blur(4px)',
      }} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 401, width: 'min(92vw, 420px)',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 6, padding: '28px 24px',
        animation: 'fadeInScale 0.2s ease',
        boxShadow: '2px 4px 20px rgba(50,35,20,0.15)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: hasGuard ? 'rgba(166,124,82,0.12)' : 'rgba(44,110,122,0.12)',
            border: `1px solid ${hasGuard ? 'rgba(166,124,82,0.3)' : 'rgba(44,110,122,0.3)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={hasGuard ? 'shield' : 'calendar'} size={18} color={hasGuard ? 'var(--primary)' : '#2c6e7a'} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 18, color: 'var(--foreground)', marginBottom: 3 }}>
              {hasGuard ? 'Smart Guard Active' : 'Schedule Adjusted'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              {totalMissed} missed session{totalMissed > 1 ? 's' : ''} detected since your last check-in
            </div>
          </div>
        </div>

        {/* Shift events */}
        {shifts.map((e, i) => (
          <div key={i} style={{
            background: 'rgba(44,110,122,0.06)', border: '1px solid rgba(44,110,122,0.2)',
            borderRadius: 4, padding: '12px 14px', marginBottom: 10,
          }}>
            <div style={{ fontSize: 9, color: '#2c6e7a', letterSpacing: 2, marginBottom: 4, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="arrowRight" size={10} color="#2c6e7a" />
              SHIFTED +{e.shiftBy} DAY{e.shiftBy > 1 ? 'S' : ''}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
              {e.dates.length} missed session{e.dates.length > 1 ? 's' : ''} ({e.dates.map(formatDate).join(', ')}).
              All future sessions pushed forward by {e.shiftBy} day{e.shiftBy > 1 ? 's' : ''} to preserve your weekly volume.
            </div>
          </div>
        ))}

        {/* Guard events */}
        {guards.map((e, i) => (
          <div key={i} style={{
            background: 'rgba(166,124,82,0.06)', border: '1px solid rgba(166,124,82,0.25)',
            borderRadius: 4, padding: '12px 14px', marginBottom: 10,
          }}>
            <div style={{ fontSize: 9, color: 'var(--primary)', letterSpacing: 2, marginBottom: 4, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="shield" size={10} color="var(--primary)" />
              SMART GUARD — {e.dates.length} DAYS PROTECTED
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
              You missed {e.dates.length} consecutive days ({formatDate(e.dates[0])} → {formatDate(e.dates[e.dates.length - 1])}).
              Rather than shifting your entire programme, the guard marked these as missed and your schedule
              resumes fresh from <strong style={{ color: 'var(--foreground)' }}>{formatDate(e.resumeFrom)}</strong> — no spiral.
            </div>
          </div>
        ))}

        {/* Research note */}
        <div style={{
          fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.7,
          padding: '10px 14px', borderRadius: 4,
          background: 'var(--muted)', marginBottom: 18,
          borderLeft: '2px solid var(--border)',
          fontStyle: 'italic',
        }}>
          Missing up to 7 days causes no appreciable strength loss. Consistency over months matters far more than any single session.
        </div>

        <button
          onClick={onDismiss}
          style={{
            width: '100%', padding: '13px', borderRadius: 4,
            background: 'var(--primary)', border: 'none',
            color: '#fff', fontSize: 11, fontWeight: 700,
            letterSpacing: 3, cursor: 'pointer', fontFamily: 'var(--font-mono)',
          }}
        >
          GOT IT — LET'S GO
        </button>
      </div>
    </>
  );
}
