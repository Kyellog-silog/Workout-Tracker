/**
 * WorkoutTracker component.
 *
 * Renders the daily session view for a selected date. Handles three cases:
 * - Workout day (Push/Pull/Legs): shows session header, warmup, exercise
 *   cards with completion toggles and notes, cooldown, and a progress bar.
 * - Rest day: shows recovery activities and tips.
 * - Missed day: shows a reassuring message about strength retention.
 *
 * Exercise data comes from customPlans (if the user has edited the plan)
 * or falls back to DEFAULT_EXERCISES.
 */
import { useState } from 'react';
import { SESSION_META, DEFAULT_EXERCISES } from '../data/workouts';
import { resolvedSession } from '../lib/scheduler';
import { Icon } from './Icons';

const TYPE_META = {
  dumbbell:   { icon: 'dumbbell', label: 'DB',  color: '#a05c2c' },
  bodyweight: { icon: 'activity', label: 'BW',  color: '#2c6e7a' },
  pullup:     { icon: 'pullup',   label: 'PU',  color: '#6b4fa0' },
};

function ExerciseCard({ exercise, sessionColor, checked, onToggle, notes, setNotes }) {
  const [expanded, setExpanded] = useState(false);
  const t = TYPE_META[exercise.type] || TYPE_META.bodyweight;
  const hasWeight = exercise.weightStart && parseFloat(exercise.weightStart) > 0;

  return (
    <div style={{
      background: checked ? `${sessionColor}0D` : 'var(--card)',
      border: `1px solid ${checked ? sessionColor + '50' : 'var(--border)'}`,
      borderRadius: 4, overflow: 'hidden', transition: 'all 0.2s',
      boxShadow: checked ? 'none' : '1px 2px 4px rgba(50,35,20,0.06)',
    }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Order number */}
        <div style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          background: checked ? `${sessionColor}25` : 'var(--muted)',
          border: `1px solid ${checked ? sessionColor + '60' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: checked ? sessionColor : 'var(--muted-foreground)',
          fontFamily: 'var(--font-mono)',
        }}>{exercise.order}</div>

        {/* Type badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 9, padding: '3px 7px', borderRadius: 3, flexShrink: 0,
          background: `${t.color}12`, border: `1px solid ${t.color}25`,
          color: t.color, letterSpacing: 1, fontFamily: 'var(--font-mono)',
        }}>
          <Icon name={t.icon} size={10} color={t.color} strokeWidth={2} />
          {t.label}
        </div>

        {/* Name + details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: checked ? sessionColor : 'var(--foreground)',
            textDecoration: checked ? 'line-through' : 'none',
            ...(expanded ? {} : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }),
            fontFamily: 'var(--font-serif)',
          }}>{exercise.name}</div>
          <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
            {exercise.sets} sets × {exercise.reps}
            {exercise.rest ? ` · ${exercise.rest} rest` : ''}
            {hasWeight ? ` · ${exercise.weightStart}kg` : ''}
          </div>
        </div>

        {/* Expand chevron */}
        <span style={{
          color: 'var(--muted-foreground)', flexShrink: 0,
          transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s',
        }}>
          <Icon name="chevronDown" size={14} />
        </span>

        {/* Check button */}
        <button
          onClick={e => { e.stopPropagation(); onToggle(); }}
          style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            border: checked ? `2px solid ${sessionColor}` : '1.5px solid var(--border)',
            background: checked ? sessionColor : 'var(--muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
        >
          {checked && <Icon name="check" size={13} color="#fff" strokeWidth={2.5} />}
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
          {hasWeight && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 4,
              background: `${sessionColor}0A`, border: `1px solid ${sessionColor}20`,
            }}>
              <div style={{ fontSize: 9, color: sessionColor, letterSpacing: 2, marginBottom: 3, fontFamily: 'var(--font-mono)' }}>WEIGHT PROGRESSION</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', fontFamily: 'var(--font-mono)' }}>
                Start: {exercise.weightStart}kg
                {exercise.weightIncrement ? ` · +${exercise.weightIncrement}kg when top rep range is easy` : ''}
              </div>
            </div>
          )}
          {exercise.cue && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 2, marginBottom: 5, fontFamily: 'var(--font-mono)' }}>COACHING CUE</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.7, fontStyle: 'italic' }}>{exercise.cue}</div>
            </div>
          )}
          {exercise.progression && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 2, marginBottom: 5, fontFamily: 'var(--font-mono)' }}>PROGRESSION PATH</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{exercise.progression}</div>
            </div>
          )}
          {exercise.whyOrder && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 2, marginBottom: 5, fontFamily: 'var(--font-mono)' }}>WHY THIS ORDER</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontStyle: 'italic' }}>{exercise.whyOrder}</div>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 2, marginBottom: 5, fontFamily: 'var(--font-mono)' }}>SESSION NOTES</div>
            <textarea
              placeholder="Weight used, how it felt, any PRs..."
              value={notes || ''}
              onChange={e => setNotes(e.target.value)}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                background: 'var(--muted)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--foreground)', fontSize: 12, padding: '8px 10px',
                resize: 'vertical', minHeight: 60, boxSizing: 'border-box',
                fontFamily: 'var(--font-mono)', outline: 'none',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkoutTracker({ selectedDate, programStart, completedDays, setCompletedDays, customPlans, overrides }) {
  const sessionKey = resolvedSession(selectedDate, programStart, overrides);
  const meta = sessionKey ? SESSION_META[sessionKey] : null;
  const exercises = sessionKey && sessionKey !== 'rest' && sessionKey !== 'missed'
    ? ((customPlans?.[sessionKey]) || DEFAULT_EXERCISES[sessionKey] || [])
    : [];

  if (!selectedDate) return <EmptyState icon="calendar" title="Select a date" sub="Tap any day on the calendar to view your session" />;
  if (!programStart) return <EmptyState icon="arrowRight" title="Set your start date" sub="Tap a date on the calendar to begin your programme" />;
  if (!meta) return <EmptyState icon="info" title="No session" sub={`Nothing scheduled for ${selectedDate}`} />;

  const dayData = completedDays[selectedDate] || { checked: {}, notes: {} };
  const checkedCount = Object.values(dayData.checked || {}).filter(Boolean).length;
  const totalExercises = exercises.length;
  const allDone = totalExercises > 0 && checkedCount === totalExercises;

  const toggleExercise = (id) => {
    setCompletedDays(prev => {
      const day = prev[selectedDate] || { checked: {}, notes: {} };
      const newChecked = { ...day.checked, [id]: !day.checked[id] };
      const allNowDone = exercises.every(e => newChecked[e.id]);
      return { ...prev, [selectedDate]: { ...day, checked: newChecked, allDone: allNowDone } };
    });
  };

  const setExerciseNote = (id, text) => {
    setCompletedDays(prev => {
      const day = prev[selectedDate] || { checked: {}, notes: {} };
      return { ...prev, [selectedDate]: { ...day, notes: { ...day.notes, [id]: text } } };
    });
  };

  const dateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  if (sessionKey === 'missed') {
    return (
      <div style={{ background: 'var(--card)', border: '1px solid rgba(181,74,53,0.25)', borderRadius: 4, padding: 28 }}>
        <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, marginBottom: 4, fontFamily: 'var(--font-mono)' }}>{dateLabel.toUpperCase()}</div>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 28, color: 'var(--destructive)', letterSpacing: 1, marginBottom: 12 }}>Missed Session</div>
        <div style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.7 }}>
          This session was marked missed. Research shows up to 7 consecutive days of rest cause no appreciable strength loss — you're fine. Resume from today.
        </div>
      </div>
    );
  }

  if (sessionKey === 'rest') {
    return (
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: 28, boxShadow: '1px 2px 4px rgba(50,35,20,0.06)' }}>
        <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, marginBottom: 4, fontFamily: 'var(--font-mono)' }}>{dateLabel.toUpperCase()}</div>
        <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 28, color: 'var(--muted-foreground)', letterSpacing: 1, marginBottom: 16 }}>Rest Day</div>
        <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 16 }}>Recovery is where growth happens. Today's mission:</div>
        {meta.restActivities.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--border)', marginTop: 6, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{a}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Session header */}
      <div style={{
        background: meta.dimColor,
        border: `1px solid ${meta.borderColor}`,
        borderRadius: 4, padding: '22px 24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, marginBottom: 2, fontFamily: 'var(--font-mono)' }}>
              {dateLabel.toUpperCase()}
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 36, color: meta.color, letterSpacing: 2, lineHeight: 1 }}>
              {meta.label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4, fontStyle: 'italic' }}>
              {meta.focus}
              {customPlans?.[sessionKey] && (
                <span style={{ color: meta.color, marginLeft: 8, fontSize: 9, letterSpacing: 1, fontFamily: 'var(--font-mono)', fontStyle: 'normal' }}>· CUSTOM</span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 30, fontWeight: 500,
              color: allDone ? meta.color : 'var(--foreground)',
            }}>
              {checkedCount}/{totalExercises}
            </div>
            <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 2, fontFamily: 'var(--font-mono)' }}>DONE</div>
            {allDone && (
              <div style={{ marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}>
                <Icon name="flame" size={18} color={meta.color} />
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 16, height: 3, background: `${meta.color}20`, borderRadius: 2 }}>
          <div style={{
            height: '100%', borderRadius: 2, background: meta.color,
            width: `${totalExercises > 0 ? (checkedCount / totalExercises) * 100 : 0}%`,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* Warmup */}
      {meta.warmup?.length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Icon name="sun" size={11} color="var(--muted-foreground)" />
            <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, fontFamily: 'var(--font-mono)' }}>WARMUP · 5–8 MIN</div>
          </div>
          {meta.warmup.map((w, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 5 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: meta.color, marginTop: 5, flexShrink: 0, opacity: 0.6 }} />
              {w}
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 10, color: 'var(--muted-foreground)', textAlign: 'center', fontStyle: 'italic' }}>
        Compounds first · Accessories · Isolation last
      </div>

      {/* Exercises */}
      {exercises.map(ex => (
        <ExerciseCard
          key={ex.id}
          exercise={ex}
          sessionColor={meta.color}
          checked={!!(dayData.checked || {})[ex.id]}
          onToggle={() => toggleExercise(ex.id)}
          notes={(dayData.notes || {})[ex.id]}
          setNotes={(text) => setExerciseNote(ex.id, text)}
        />
      ))}

      {/* Cooldown */}
      {meta.cooldown?.length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Icon name="moon" size={11} color="var(--muted-foreground)" />
            <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, fontFamily: 'var(--font-mono)' }}>COOLDOWN · 5–10 MIN</div>
          </div>
          {meta.cooldown.map((c, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--muted-foreground)', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 5 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: meta.color, marginTop: 5, flexShrink: 0, opacity: 0.6 }} />
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ background: 'var(--card)', borderRadius: 4, padding: 40, border: '1px solid var(--border)', textAlign: 'center', boxShadow: '1px 2px 4px rgba(50,35,20,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <Icon name={icon} size={36} color="var(--border)" strokeWidth={1} />
      </div>
      <div style={{ fontSize: 15, color: 'var(--muted-foreground)', fontFamily: 'var(--font-serif)', fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', opacity: 0.7 }}>{sub}</div>
    </div>
  );
}
