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
import { useState, useEffect, useMemo } from 'react';
import { SESSION_META } from '../data/workouts';
import { resolvedSession } from '../lib/scheduler';
import { getPlanMeta, getPlanExercises, isPlanCustomised } from '../lib/planUtils';
import { getExerciseHistory, getTodayPRs } from '../lib/prCalc';
import { Icon } from './Icons';
import { clampNumber } from '../lib/securityGuards';

const TYPE_META = {
  dumbbell:   { icon: 'dumbbell', label: 'DB',  color: '#a05c2c' },
  bodyweight: { icon: 'activity', label: 'BW',  color: '#2c6e7a' },
  pullup:     { icon: 'pullup',   label: 'PU',  color: '#6b4fa0' },
};

const PR_LABEL = {
  maxWeight:        'Max Weight',
  estimated1RM:     'Est. 1RM',
  maxRepsAtWeight:  'Max Reps',
  maxSessionVolume: 'Session Vol.',
};

function SetLogger({ exercise, todaySets, lastSessionSets, onSetsChange, sessionColor }) {
  const isBodyweight = exercise.type === 'bodyweight' || exercise.type === 'pullup';
  const targetSets = parseInt(exercise.sets) || 0;
  const defaultWeight = parseFloat(exercise.weightStart) || 0;

  const addSet = (e) => {
    e.stopPropagation();
    const lastWeight = todaySets.length > 0 ? todaySets[todaySets.length - 1].weight : defaultWeight;
    onSetsChange([...todaySets, { weight: lastWeight, reps: '' }]);
  };

  const updateSet = (idx, field, value) => {
    const updated = todaySets.map((s, i) =>
      i === idx ? { ...s, [field]: clampNumber(value, 0, field === 'weight' ? 999 : 100) } : s
    );
    onSetsChange(updated);
  };

  const removeSet = (e, idx) => {
    e.stopPropagation();
    onSetsChange(todaySets.filter((_, i) => i !== idx));
  };

  const inputStyle = {
    padding: '5px 8px', borderRadius: 3,
    background: 'var(--muted)', border: '1px solid var(--border)',
    color: 'var(--foreground)', fontSize: 12, textAlign: 'right',
    fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 2, fontFamily: 'var(--font-mono)' }}>SET LOG</div>
        <div style={{
          fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: 1,
          color: todaySets.length >= targetSets && targetSets > 0 ? sessionColor : 'var(--muted-foreground)',
        }}>
          {todaySets.length} / {targetSets} sets
        </div>
      </div>

      {lastSessionSets?.length > 0 && (
        <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginBottom: 8, fontFamily: 'var(--font-mono)', opacity: 0.65 }}>
          Last: {lastSessionSets.map(s => `${s.weight}×${s.reps}`).join(', ')}
        </div>
      )}

      {todaySets.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 16, fontSize: 9, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', textAlign: 'right', flexShrink: 0 }}>
            {i + 1}
          </div>
          <input
            type="number"
            value={s.weight}
            onChange={e => updateSet(i, 'weight', e.target.value)}
            onClick={e => e.stopPropagation()}
            min={0}
            step={isBodyweight ? 1 : 0.5}
            placeholder={isBodyweight ? '0' : String(defaultWeight)}
            style={{ ...inputStyle, width: 64 }}
          />
          <span style={{ fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
            {isBodyweight ? '+kg' : 'kg'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)', flexShrink: 0 }}>×</span>
          <input
            type="number"
            value={s.reps}
            onChange={e => updateSet(i, 'reps', e.target.value)}
            onClick={e => e.stopPropagation()}
            min={0}
            step={1}
            placeholder="reps"
            style={{ ...inputStyle, width: 52 }}
          />
          <span style={{ fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>reps</span>
          <button
            onClick={e => removeSet(e, i)}
            style={{
              width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border)',
              background: 'var(--muted)', cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--muted-foreground)', fontSize: 13, lineHeight: 1, padding: 0,
            }}
          >×</button>
        </div>
      ))}

      <button
        onClick={addSet}
        style={{
          marginTop: 4, width: '100%', padding: '7px 0', borderRadius: 3,
          background: 'none', border: `1px dashed ${sessionColor}60`,
          color: sessionColor, cursor: 'pointer', fontSize: 10,
          fontFamily: 'var(--font-mono)', letterSpacing: 2,
        }}
      >+ ADD SET</button>
    </div>
  );
}

function useNarrow() {
  const mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 479px)') : null;
  const [narrow, setNarrow] = useState(() => mq?.matches ?? false);
  useEffect(() => {
    if (!mq) return;
    const handler = (e) => setNarrow(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return narrow;
}

function ExerciseCard({ exercise, sessionColor, checked, onToggle, notes, setNotes, todaySets, onSetsChange, completedDaysHistory }) {
  const [expanded, setExpanded] = useState(false);
  const narrow = useNarrow();
  const t = TYPE_META[exercise.type] || TYPE_META.bodyweight;
  const hasWeight = exercise.weightStart && parseFloat(exercise.weightStart) > 0;

  const validTodaySets = todaySets.filter(s => Number(s.reps) > 0);
  const prTypes = validTodaySets.length > 0
    ? getTodayPRs(exercise.id, validTodaySets, completedDaysHistory)
    : [];
  const lastSessionSets = getExerciseHistory(exercise.id, completedDaysHistory)[0]?.sets || [];

  return (
    <div style={{
      background: checked ? `${sessionColor}0D` : 'var(--card)',
      border: `1px solid ${checked ? sessionColor + '50' : 'var(--border)'}`,
      borderRadius: 4, overflow: 'hidden', transition: 'all 0.2s',
      boxShadow: checked ? 'none' : '1px 2px 4px rgba(50,35,20,0.06)',
    }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: narrow ? 8 : 12, padding: narrow ? '10px 12px' : '13px 16px', cursor: 'pointer' }}
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
          {prTypes.length > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 9, padding: '2px 6px', borderRadius: 3, marginTop: 4,
              background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.4)',
              color: '#b8960c', letterSpacing: 1, fontFamily: 'var(--font-mono)',
            }}>
              <Icon name="trophy" size={9} color="#b8960c" strokeWidth={2} />
              {PR_LABEL[prTypes[0]]}
            </div>
          )}
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
            <SetLogger
              exercise={exercise}
              todaySets={todaySets}
              lastSessionSets={lastSessionSets}
              onSetsChange={onSetsChange}
              sessionColor={sessionColor}
            />
          </div>
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

export default function WorkoutTracker({ selectedDate, programStart, completedDays, setCompletedDays, userPlans, weeklySchedule, overrides }) {
  const sessionKey = resolvedSession(selectedDate, programStart, overrides, weeklySchedule);
  const meta = sessionKey ? getPlanMeta(sessionKey, userPlans) : null;
  const exercises = sessionKey && sessionKey !== 'rest' && sessionKey !== 'missed'
    ? getPlanExercises(sessionKey, userPlans)
    : [];

  // completedDays without today's sets, used for PR comparison
  const completedDaysHistory = useMemo(() => {
    const today = completedDays[selectedDate];
    if (!today?.sets) return completedDays;
    return { ...completedDays, [selectedDate]: { ...today, sets: {} } };
  }, [completedDays, selectedDate]);

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

  const setExerciseSets = (id, newSets, targetSets) => {
    setCompletedDays(prev => {
      const day = prev[selectedDate] || { checked: {}, notes: {}, sets: {} };
      const updatedSets = { ...(day.sets || {}), [id]: newSets };
      // Auto-check when all target sets are logged
      const autoChecked = newSets.length >= targetSets && targetSets > 0;
      const prevChecked = day.checked || {};
      const newChecked = autoChecked ? { ...prevChecked, [id]: true } : prevChecked;
      const allNowDone = exercises.length > 0 && exercises.every(e => newChecked[e.id]);
      return { ...prev, [selectedDate]: { ...day, sets: updatedSets, checked: newChecked, allDone: allNowDone } };
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

  if (sessionKey === 'cardio') {
    const cardioLog = completedDays[selectedDate]?.cardioLog || {};
    const isCardioDone = !!cardioLog.done;

    const setCardioField = (field, value) => {
      setCompletedDays(prev => {
        const day = prev[selectedDate] || {};
        const newLog = { ...(day.cardioLog || {}), [field]: value };
        const allNowDone = field === 'done' ? !!value : (newLog.done || false);
        return { ...prev, [selectedDate]: { ...day, cardioLog: newLog, allDone: allNowDone } };
      });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Header */}
        <div style={{ background: meta.dimColor, border: `1px solid ${meta.borderColor}`, borderRadius: 4, padding: '22px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, marginBottom: 2, fontFamily: 'var(--font-mono)' }}>
                {dateLabel.toUpperCase()}
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 36, color: meta.color, letterSpacing: 2, lineHeight: 1 }}>
                {meta.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 4, fontStyle: 'italic' }}>{meta.focus}</div>
            </div>
            {isCardioDone && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Icon name="check" size={20} color={meta.color} strokeWidth={2.5} />
                <Icon name="flame" size={20} color={meta.color} />
              </div>
            )}
          </div>
        </div>

        {/* Activity ideas */}
        {meta.restActivities?.length > 0 && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px 20px' }}>
            <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, marginBottom: 10, fontFamily: 'var(--font-mono)' }}>ACTIVITY IDEAS</div>
            {meta.restActivities.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: meta.color, marginTop: 6, flexShrink: 0, opacity: 0.6 }} />
                <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{a}</span>
              </div>
            ))}
          </div>
        )}

        {/* Cardio log */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '20px 22px' }}>
          <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, marginBottom: 16, fontFamily: 'var(--font-mono)' }}>CARDIO LOG</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>

            {/* Distance */}
            <div>
              <label style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 2, display: 'block', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>DISTANCE</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <input
                  type="number" min={0} max={999} step={0.1}
                  value={cardioLog.distance ?? ''}
                  onChange={e => setCardioField('distance', e.target.value)}
                  placeholder="0.0"
                  style={{
                    flex: 1, padding: '9px 8px', borderRadius: 4,
                    background: 'var(--muted)', border: '1px solid var(--border)',
                    color: 'var(--foreground)', fontSize: 18, fontFamily: 'var(--font-mono)',
                    outline: 'none', boxSizing: 'border-box', textAlign: 'right', minWidth: 0,
                  }}
                />
                <span style={{ fontSize: 9, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>km</span>
              </div>
            </div>

            {/* Steps */}
            <div>
              <label style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 2, display: 'block', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>STEPS</label>
              <input
                type="number" min={0} max={999999} step={500}
                value={cardioLog.steps ?? ''}
                onChange={e => setCardioField('steps', e.target.value)}
                placeholder="0"
                style={{
                  width: '100%', padding: '9px 8px', borderRadius: 4,
                  background: 'var(--muted)', border: '1px solid var(--border)',
                  color: 'var(--foreground)', fontSize: 18, fontFamily: 'var(--font-mono)',
                  outline: 'none', boxSizing: 'border-box', textAlign: 'right',
                }}
              />
            </div>

            {/* Pace */}
            <div>
              <label style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 2, display: 'block', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>PACE</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <input
                  type="text"
                  value={cardioLog.pace ?? ''}
                  onChange={e => setCardioField('pace', e.target.value)}
                  placeholder="5:30"
                  maxLength={8}
                  style={{
                    flex: 1, padding: '9px 8px', borderRadius: 4,
                    background: 'var(--muted)', border: '1px solid var(--border)',
                    color: 'var(--foreground)', fontSize: 18, fontFamily: 'var(--font-mono)',
                    outline: 'none', boxSizing: 'border-box', textAlign: 'right', minWidth: 0,
                  }}
                />
                <span style={{ fontSize: 9, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>min/km</span>
              </div>
            </div>
          </div>

          {/* Mark complete */}
          <button
            onClick={() => setCardioField('done', !isCardioDone)}
            style={{
              width: '100%', padding: '14px', borderRadius: 4, cursor: 'pointer',
              background: isCardioDone ? meta.color : 'var(--muted)',
              border: `2px solid ${isCardioDone ? meta.color : 'var(--border)'}`,
              color: isCardioDone ? '#fff' : 'var(--muted-foreground)',
              fontSize: 11, fontWeight: 700, letterSpacing: 2,
              fontFamily: 'var(--font-mono)', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {isCardioDone && <Icon name="check" size={13} color="#fff" strokeWidth={2.5} />}
            {isCardioDone ? 'CARDIO COMPLETE ✓' : 'MARK COMPLETE'}
          </button>
        </div>
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
              {isPlanCustomised(sessionKey, userPlans) && (
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
      {exercises.length === 0 ? (
        <div style={{
          padding: '28px 20px', textAlign: 'center',
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4,
          color: 'var(--muted-foreground)', fontSize: 12, fontStyle: 'italic', lineHeight: 1.7,
        }}>
          No exercises yet. Add some in the <strong>Edit</strong> tab.
        </div>
      ) : exercises.map(ex => (
        <ExerciseCard
          key={ex.id}
          exercise={ex}
          sessionColor={meta.color}
          checked={!!(dayData.checked || {})[ex.id]}
          onToggle={() => toggleExercise(ex.id)}
          notes={(dayData.notes || {})[ex.id]}
          setNotes={(text) => setExerciseNote(ex.id, text)}
          todaySets={(dayData.sets || {})[ex.id] || []}
          onSetsChange={(sets) => setExerciseSets(ex.id, sets, parseInt(ex.sets) || 0)}
          completedDaysHistory={completedDaysHistory}
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
