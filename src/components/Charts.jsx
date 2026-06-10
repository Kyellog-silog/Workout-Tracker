/**
 * Charts — the progress payoff for the Progress tab.
 *
 *   1. Per-exercise strength trend (est. 1RM for weighted lifts, or top-set reps
 *      for bodyweight lifts). For bodyweight/pull-up exercises, logged bodyweight
 *      is folded into the load so the est-1RM reflects true effort.
 *   2. Weekly training volume (tonnage) as a bar chart.
 *
 * Chart primitives live in MiniChart; series maths in lib/chartData.
 */
import { useState, useMemo } from 'react';
import { getPlanExercises } from '../lib/planUtils';
import { totalVolume } from '../lib/prCalc';
import {
  exerciseProgressSeries,
  isBodyweightSeries,
  weeklyVolumeSeries,
  loggedExerciseIds,
} from '../lib/chartData';
import { LineChart, BarChart, fmtShort, fmtNum } from './MiniChart';

const BODYWEIGHT_TYPES = new Set(['bodyweight', 'pullup']);

function buildExerciseMeta(userPlans) {
  const map = {};
  for (const key of Object.keys(userPlans || {})) {
    for (const ex of getPlanExercises(key, userPlans)) {
      if (ex?.id && !map[ex.id]) map[ex.id] = { name: ex.name || ex.id, type: ex.type };
    }
  }
  return map;
}

const cardStyle = {
  background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '20px 22px', boxShadow: 'var(--shadow-sm)',
};
const sectionLabel = {
  fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, fontFamily: 'var(--font-mono)',
};

export default function Charts({ completedDays, userPlans, bodyMetrics }) {
  const exMeta = useMemo(() => buildExerciseMeta(userPlans), [userPlans]);
  const ids = useMemo(() => loggedExerciseIds(completedDays), [completedDays]);
  const [selected, setSelected] = useState(null);

  const activeId = (selected && ids.includes(selected)) ? selected : ids[0];
  const usesBodyweight = activeId ? BODYWEIGHT_TYPES.has(exMeta[activeId]?.type) : false;

  const series = useMemo(
    () => activeId ? exerciseProgressSeries(activeId, completedDays, { addBodyweight: usesBodyweight, bodyMetrics }) : [],
    [activeId, completedDays, usesBodyweight, bodyMetrics]
  );
  const weekly = useMemo(() => weeklyVolumeSeries(completedDays, 12), [completedDays]);
  const allVolume = useMemo(() => totalVolume(completedDays), [completedDays]);

  if (ids.length === 0) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', padding: '32px 22px' }}>
        <div style={{ ...sectionLabel, marginBottom: 8 }}>PROGRESS CHARTS</div>
        <div style={{ fontSize: 13, color: 'var(--muted-foreground)', fontStyle: 'italic', lineHeight: 1.7 }}>
          Log a few sets with weight and reps, and your strength and volume trends will appear here.
        </div>
      </div>
    );
  }

  // If bodyweight is folded in, topWeight is no longer all-zero, so we show 1RM.
  const repsOnly = isBodyweightSeries(series);
  const metricLabel = repsOnly ? 'Top-set reps' : (usesBodyweight ? 'Est. 1RM (incl. bodyweight)' : 'Est. 1-rep max');
  const unit = repsOnly ? 'reps' : 'kg';
  const points = series.map(p => ({ value: repsOnly ? p.topReps : p.e1rm, date: p.date }));

  const latest = points.length ? points[points.length - 1].value : 0;
  const first = points.length ? points[0].value : 0;
  const delta = Math.round((latest - first) * 10) / 10;

  const bars = weekly.map(w => ({ key: w.weekStart, value: w.volume, title: `Week of ${fmtShort(w.weekStart)} · ${fmtNum(w.value)} kg` }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Strength trend */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={sectionLabel}>STRENGTH TREND</div>
          <select
            value={activeId}
            onChange={e => setSelected(e.target.value)}
            aria-label="Choose exercise to chart"
            style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--foreground)',
              background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4,
              padding: '6px 10px', cursor: 'pointer', maxWidth: 200,
            }}
          >
            {ids.map(id => <option key={id} value={id}>{exMeta[id]?.name || id}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 30, fontWeight: 500, color: 'var(--foreground)' }}>
            {latest}<span style={{ fontSize: 13, color: 'var(--muted-foreground)', marginLeft: 4 }}>{unit}</span>
          </div>
          {points.length >= 2 && (
            <span style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: 1, padding: '3px 8px', borderRadius: 20,
              color: delta >= 0 ? '#5c7a5c' : 'var(--destructive)',
              background: delta >= 0 ? 'rgba(92,122,92,0.12)' : 'rgba(176,74,50,0.10)',
            }}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} {unit} since {fmtShort(points[0].date)}
            </span>
          )}
        </div>
        <div style={{ ...sectionLabel, marginBottom: 6 }}>{metricLabel.toUpperCase()}</div>

        <LineChart points={points} color="var(--primary)" emptyHint="Log this exercise in at least two sessions to see a trend." />

        {points.length >= 2 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 9, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>
            <span>{fmtShort(points[0].date)}</span>
            <span>{fmtShort(points[points.length - 1].date)}</span>
          </div>
        )}
      </div>

      {/* Weekly volume */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={sectionLabel}>WEEKLY VOLUME</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>
            {fmtNum(allVolume)} kg lifted all-time
          </div>
        </div>

        {bars.length === 0 ? (
          <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 12, fontStyle: 'italic' }}>
            No weighted sets logged yet.
          </div>
        ) : (
          <>
            <BarChart bars={bars} color="var(--chart-4)" />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 9, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>
              <span>{fmtShort(weekly[0].weekStart)}</span>
              <span>{fmtShort(weekly[weekly.length - 1].weekStart)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
