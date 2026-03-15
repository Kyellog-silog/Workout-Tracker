/**
 * DayActionSheet component.
 *
 * Bottom sheet modal for per-day schedule actions. Provides contextual
 * options based on whether the date is past, present, or future:
 * - Assign any plan to just this date, or to every occurrence of this weekday
 * - Swap a workout to a rest day (shifts schedule forward by 1)
 * - Mark a past session as missed
 * - Restore a date to its original base schedule
 */
import { useState } from 'react';
import { resolvedSession, swapToRest, markMissed, clearOverride, formatDate, todayStr, isBefore } from '../lib/scheduler';
import { SESSION_META } from '../data/workouts';
import { getPlanMeta } from '../lib/planUtils';
import { Icon } from './Icons';

const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function DayActionSheet({
  date, programStart, overrides, setOverrides, onClose,
  userPlans, weeklySchedule, setWeeklySchedule, completedDays,
}) {
  const [pickedPlan, setPickedPlan] = useState(null);

  if (!date || !programStart) return null;

  const today = todayStr();
  const isPast = isBefore(date, today);
  const isFuture = isBefore(today, date);
  const isToday = date === today;

  const session = resolvedSession(date, programStart, overrides, weeklySchedule);
  const override = overrides?.[date];
  const meta = getPlanMeta(session, userPlans);
  const sessionColor = meta?.color || 'var(--muted-foreground)';
  const isWorkout = session && session !== 'rest' && session !== 'missed';
  const isMissed = session === 'missed' || override === 'missed';
  const hasOverride = override !== undefined;
  const dateLabel = formatDate(date);

  // Rotation index for "all weekdays" change: which slot in weeklySchedule?
  const dateObj = new Date(date + 'T12:00:00');
  const startObj = new Date(programStart + 'T12:00:00');
  const dateDow = dateObj.getDay();
  const startDow = startObj.getDay();
  const rotationIndex = ((dateDow - startDow) + 7) % 7;
  const dayName = DOW_FULL[dateDow];

  const handle = (fn) => { setOverrides(fn); onClose(); };

  // Assign a plan to just this date via override
  const assignJustToday = (planKey) => {
    setOverrides(prev => ({ ...(prev || {}), [date]: planKey }));
    onClose();
  };

  // Assign a plan to every occurrence of this weekday (rotation slot)
  const assignAllWeekdays = (planKey) => {
    if (setWeeklySchedule && weeklySchedule) {
      setWeeklySchedule(prev => {
        const n = [...prev];
        n[rotationIndex] = planKey;
        return n;
      });
      // Remove any override for this specific date since the rotation now covers it
      setOverrides(prev => {
        if (!prev || prev[date] === undefined) return prev;
        const next = { ...prev };
        delete next[date];
        return next;
      });
    }
    onClose();
  };

  // All plan options: custom plans + rest + cardio
  const planOptions = [
    ...(userPlans ? Object.entries(userPlans).map(([key, v]) => ({
      key, label: v.label || key.toUpperCase(), color: v.color || '#9e9e9e',
    })) : []),
    { key: 'rest', label: SESSION_META.rest?.label || 'Rest', color: SESSION_META.rest?.color || '#9e9e9e' },
    { key: 'cardio', label: SESSION_META.cardio?.label || 'Cardio', color: SESSION_META.cardio?.color || '#4a7c59' },
  ];

  const ActionBtn = ({ iconName, label, sub, color, onClick, danger }) => (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: '13px 16px', borderRadius: 4,
        background: danger ? 'rgba(181,74,53,0.06)' : 'var(--muted)',
        border: `1px solid ${danger ? 'rgba(181,74,53,0.25)' : 'var(--border)'}`,
        color: color || 'var(--foreground)',
        cursor: 'pointer', fontFamily: 'var(--font-body)',
        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
        transition: 'all 0.12s',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: `${color || 'var(--primary)'}15`,
        border: `1px solid ${color || 'var(--primary)'}25`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={iconName} size={14} color={color || 'var(--primary)'} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
      </div>
    </button>
  );

  // â”€â”€ Two-step: plan picked â€” show scope choice â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (pickedPlan) {
    const pm = getPlanMeta(pickedPlan.key, userPlans);
    return (
      <>
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(50,35,20,0.4)', backdropFilter: 'blur(3px)' }} />
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301,
          background: 'var(--card)', borderTop: '1px solid var(--border)',
          borderRadius: '12px 12px 0 0', padding: '10px 20px 40px',
          maxWidth: 600, margin: '0 auto',
          animation: 'slideUp 0.22s ease',
          boxShadow: '0 -4px 20px rgba(50,35,20,0.12)',
        }}>
          <div style={{ width: 32, height: 3, borderRadius: 2, background: 'var(--border)', margin: '0 auto 20px' }} />
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, marginBottom: 6, fontFamily: 'var(--font-mono)' }}>SET PLAN &middot; {dateLabel.toUpperCase()}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: pm.color }} />
              <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 20, color: pm.color }}>{pm.label}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4 }}>Apply this change to&hellip;</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ActionBtn
              iconName="calendar"
              label={`Just ${isToday ? 'today' : dateLabel}`}
              sub="Set this plan for this one day only."
              color={pm.color}
              onClick={() => assignJustToday(pickedPlan.key)}
            />
            {setWeeklySchedule && weeklySchedule && (
              <ActionBtn
                iconName="swap"
                label={`Every ${dayName}`}
                sub={`Change the weekly rotation so every ${dayName} is ${pm.label}.`}
                color={pm.color}
                onClick={() => assignAllWeekdays(pickedPlan.key)}
              />
            )}
            <button onClick={() => setPickedPlan(null)} style={{
              width: '100%', padding: '13px', borderRadius: 4,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--muted-foreground)', cursor: 'pointer',
              fontSize: 11, letterSpacing: 2, fontFamily: 'var(--font-mono)', marginTop: 4,
            }}>&larr; BACK</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(50,35,20,0.4)', backdropFilter: 'blur(3px)',
      }} />

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301,
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        borderRadius: '12px 12px 0 0',
        padding: '10px 20px 40px',
        maxWidth: 600, margin: '0 auto',
        animation: 'slideUp 0.22s ease',
        boxShadow: '0 -4px 20px rgba(50,35,20,0.12)',
        maxHeight: '80vh', overflowY: 'auto',
      }}>
        {/* Handle */}
        <div style={{ width: 32, height: 3, borderRadius: 2, background: 'var(--border)', margin: '0 auto 20px' }} />

        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
            {isPast ? 'PAST' : isToday ? 'TODAY' : 'UPCOMING'} Â· {dateLabel.toUpperCase()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: isMissed ? 'var(--destructive)' : sessionColor }} />
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 22, color: isMissed ? 'var(--destructive)' : sessionColor }}>
              {isMissed ? 'Missed' : meta?.label || (session ? (session.charAt(0).toUpperCase() + session.slice(1)) : 'No Session')}
            </div>
          </div>
          {hasOverride && !isMissed && (
            <div style={{ fontSize: 10, color: 'var(--chart-1)', marginTop: 4, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name="info" size={10} color="var(--chart-1)" />
              Schedule adjusted from original plan
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* â”€â”€ Plan picker (non-completed days) â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {!isMissed && (isFuture || isToday || (isPast && !overrides?.[date])) && (
            <div>
              <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 2, marginBottom: 8, fontFamily: 'var(--font-mono)' }}>SET PLAN</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {planOptions.map(opt => {
                  const isActive = opt.key === session;
                  return (
                    <button key={opt.key} onClick={() => setPickedPlan(opt)} style={{
                      flex: '1 1 80px', minWidth: 70, padding: '8px 6px',
                      borderRadius: 4, cursor: 'pointer',
                      border: isActive ? `2px solid ${opt.color}` : '2px solid var(--border)',
                      background: isActive ? `${opt.color}15` : 'var(--muted)',
                      color: isActive ? opt.color : 'var(--muted-foreground)',
                      fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
                      letterSpacing: 0.5, transition: 'all 0.12s',
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: opt.color, margin: '0 auto 4px' }} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(isFuture || isToday) && isWorkout && (
            <ActionBtn
              iconName="swap"
              label="Swap to rest day"
              sub="This session shifts to tomorrow. Everything after moves forward by 1 day."
              color="var(--chart-1)"
              onClick={() => handle(prev => swapToRest(date, prev || {}))}
            />
          )}

          {isPast && isWorkout && !isMissed && (
            <ActionBtn
              iconName="x"
              label="Mark as missed"
              sub="Logs this day as skipped. Schedule continues from today."
              color="var(--destructive)"
              danger
              onClick={() => handle(prev => markMissed(date, prev || {}))}
            />
          )}

          {isPast && isWorkout && !isMissed && (
            <ActionBtn
              iconName="edit"
              label="View & log workout"
              sub="Open this day's session to check off exercises."
              color="var(--chart-2)"
              onClick={onClose}
            />
          )}

          {hasOverride && (
            <ActionBtn
              iconName="undo"
              label="Restore original schedule"
              sub="Remove manual override and revert to base programme."
              color="var(--muted-foreground)"
              onClick={() => handle(prev => clearOverride(date, prev || {}))}
            />
          )}

          {session === 'rest' && !isWorkout && !isMissed && !isFuture && !isToday && (
            <div style={{
              padding: '14px 16px', borderRadius: 4,
              background: 'var(--muted)', border: '1px solid var(--border)',
              fontSize: 13, color: 'var(--muted-foreground)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Icon name="moon" size={16} color="var(--muted-foreground)" />
              Scheduled rest day. Recovery is part of the programme.
            </div>
          )}

          {isMissed && (
            <div style={{
              padding: '14px 16px', borderRadius: 4,
              background: 'rgba(181,74,53,0.05)', border: '1px solid rgba(181,74,53,0.2)',
              fontSize: 12, color: 'var(--destructive)', lineHeight: 1.6,
            }}>
              Marked as missed. Your schedule continues from where you left off.
              {hasOverride && (
                <button
                  onClick={() => handle(prev => clearOverride(date, prev || {}))}
                  style={{
                    display: 'block', marginTop: 10, fontSize: 10,
                    color: 'var(--destructive)', background: 'none',
                    border: '1px solid rgba(181,74,53,0.35)', borderRadius: 4,
                    padding: '5px 10px', cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: 1,
                  }}
                >UNDO â€” RESTORE THIS DAY</button>
              )}
            </div>
          )}

          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '13px', borderRadius: 4,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--muted-foreground)', cursor: 'pointer',
              fontSize: 11, letterSpacing: 2, fontFamily: 'var(--font-mono)',
              marginTop: 4,
            }}
          >CANCEL</button>
        </div>
      </div>
    </>
  );
}
