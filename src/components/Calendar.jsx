/**
 * Calendar component.
 *
 * Renders a month grid with colour-coded cells for each session type
 * (Push, Pull, Legs, Rest, Missed). Supports:
 * - Setting the programme start date by tapping a date
 * - Selecting a date to view its session
 * - Right-click / long-press to open the DayActionSheet for overrides
 * - Visual indicators for completion, partial completion, and overrides
 */
import { useState, useRef } from 'react';
import { SESSION_META } from '../data/workouts';
import { resolvedSession, todayStr, isBefore } from '../lib/scheduler';
import { getPlanMeta } from '../lib/planUtils';
import { Icon } from './Icons';
import DayActionSheet from './DayActionSheet';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function Calendar({
  programStart, setProgramStart, completedDays, onSelectDay, selectedDate,
  overrides, setOverrides, userPlans, weeklySchedule, setWeeklySchedule,
}) {
  const todayS = todayStr();
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [actionDate, setActionDate] = useState(null);
  const touchTimerRef = useRef(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <>
      <div style={{ background: 'var(--card)', borderRadius: 4, padding: '24px', border: '1px solid var(--border)', boxShadow: '1px 2px 4px rgba(50,35,20,0.06)' }}>

        {!programStart && (
          <div style={{
            background: 'rgba(166,124,82,0.08)', border: '1px solid rgba(166,124,82,0.25)',
            borderRadius: 4, padding: '14px 18px', marginBottom: 20, textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: 'var(--primary)', marginBottom: 4, letterSpacing: 2, fontFamily: 'var(--font-mono)' }}>SET PROGRAMME START DATE</div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Tap any date below to begin from that day</div>
          </div>
        )}

        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <button
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="icon-btn"
          >
            <Icon name="chevronLeft" size={16} />
          </button>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 22, color: 'var(--foreground)', letterSpacing: 0.5 }}>
            {MONTHS[month]} <span style={{ color: 'var(--muted-foreground)', fontWeight: 400, fontSize: 16 }}>{year}</span>
          </div>
          <button
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="icon-btn"
          >
            <Icon name="chevronRight" size={16} />
          </button>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 6 }}>
          {DAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 2, padding: '4px 0', fontFamily: 'var(--font-mono)' }}>
              {d.toUpperCase()}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === todayS;
            const isPast = isBefore(dateStr, todayS);
            const session = resolvedSession(dateStr, programStart, overrides, weeklySchedule);
            const s = session ? getPlanMeta(session, userPlans) : null;
            const isDone = completedDays[dateStr]?.allDone;
            const isPartial = completedDays[dateStr] && !isDone;
            const isSelected = selectedDate === dateStr;
            const isMissed = session === 'missed';
            const hasOverride = overrides?.[dateStr] !== undefined;
            const isStart = programStart && dateStr === programStart;

            let bg = 'transparent';
            if (isMissed) bg = 'rgba(181,74,53,0.08)';
            else if (isDone && s) bg = `${s.color}18`;
            else if (isPartial && s) bg = `${s.color}0D`;
            else if (s && s.label !== 'REST') bg = `${s.color}08`;

            let border = '1px solid transparent';
            if (isSelected) border = `2px solid ${s?.color || 'var(--primary)'}`;
            else if (isToday) border = '1.5px solid var(--border)';
            else if (isMissed) border = '1px solid rgba(181,74,53,0.3)';

            return (
              <button
                key={day}
                onClick={() => {
                  if (!programStart) { setProgramStart(dateStr); }
                  onSelectDay(dateStr);
                }}
                onContextMenu={e => { e.preventDefault(); if (programStart) setActionDate(dateStr); }}
                onTouchStart={() => {
                  if (!programStart) return;
                  touchTimerRef.current = setTimeout(() => setActionDate(dateStr), 450);
                }}
                onTouchEnd={() => clearTimeout(touchTimerRef.current)}
                onTouchMove={() => clearTimeout(touchTimerRef.current)}
                style={{
                  aspectRatio: '1', borderRadius: 3, position: 'relative',
                  border, background: bg, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 2, padding: 3,
                  transition: 'all 0.12s',
                  opacity: isPast && !session ? 0.3 : 1,
                }}
              >
                <span style={{
                  fontSize: 12, fontFamily: 'var(--font-mono)',
                  fontWeight: isToday ? 700 : 400,
                  color: isMissed ? 'var(--destructive)' :
                         isSelected ? (s?.color || 'var(--primary)') :
                         isToday ? 'var(--foreground)' : 'var(--foreground)',
                }}>{day}</span>

                {session && session !== 'rest' && session !== 'missed' && (
                  <span style={{
                    fontSize: 6, letterSpacing: 0.5, fontWeight: 700,
                    color: s?.color, opacity: isDone ? 1 : 0.5,
                    fontFamily: 'var(--font-mono)',
                  }}>{s?.label?.toUpperCase() || session.toUpperCase()}</span>
                )}
                {isMissed && (
                  <span style={{ fontSize: 6, color: 'var(--destructive)', opacity: 0.8, fontFamily: 'var(--font-mono)' }}>MISS</span>
                )}
                {session === 'rest' && (
                  <span style={{ fontSize: 6, color: 'var(--muted-foreground)', opacity: 0.5, fontFamily: 'var(--font-mono)' }}>REST</span>
                )}

                {isDone && (
                  <div style={{
                    position: 'absolute', top: 2, right: 2,
                    width: 5, height: 5, borderRadius: '50%', background: s?.color,
                  }} />
                )}
                {hasOverride && !isMissed && !isDone && (
                  <div style={{
                    position: 'absolute', top: 2, right: 2,
                    width: 4, height: 4, borderRadius: '50%', background: 'var(--chart-1)',
                  }} />
                )}
                {isStart && (
                  <div style={{
                    position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)',
                    width: 3, height: 3, borderRadius: '50%', background: 'var(--primary)',
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend: dynamic — shows all user plans */}
        <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          {userPlans && Object.entries(userPlans).map(([key, v]) => {
            const m = getPlanMeta(key, userPlans);
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.color }} />
                <span style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>{m.label.toUpperCase()}</span>
              </div>
            );
          })}
          {SESSION_META.cardio && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: SESSION_META.cardio.color }} />
              <span style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>CARDIO</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--destructive)' }} />
            <span style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>MISSED</span>
          </div>
          {programStart && (
            <span style={{ fontSize: 9, color: 'var(--muted-foreground)', fontStyle: 'italic', marginLeft: 'auto' }}>
              Long-press to adjust
            </span>
          )}
        </div>
      </div>

      {actionDate && (
        <DayActionSheet
          date={actionDate}
          programStart={programStart}
          overrides={overrides}
          setOverrides={setOverrides}
          onClose={() => setActionDate(null)}
          userPlans={userPlans}
          weeklySchedule={weeklySchedule}
          setWeeklySchedule={setWeeklySchedule}
          completedDays={completedDays}
        />
      )}
    </>
  );
}
