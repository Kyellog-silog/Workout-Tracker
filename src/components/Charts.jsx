/**
 * Charts — the progress payoff for the Progress tab.
 *
 * Two hand-rolled, theme-aware charts (no charting dependency):
 *   1. Per-exercise strength trend (est. 1RM for weighted lifts, or top-set reps
 *      for bodyweight lifts) as a responsive SVG line + area.
 *   2. Weekly training volume (tonnage) as an HTML bar chart.
 *
 * SVG uses a normalized 0–100 viewBox with preserveAspectRatio="none" and a
 * non-scaling stroke, so it stretches crisply to any width without distorting
 * line weight; axis labels are HTML (so they never scale oddly).
 */
import { useState, useMemo, useId } from 'react';
import { getPlanExercises } from '../lib/planUtils';
import { totalVolume } from '../lib/prCalc';
import {
  exerciseProgressSeries,
  isBodyweightSeries,
  weeklyVolumeSeries,
  loggedExerciseIds,
} from '../lib/chartData';

const fmtShort = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtNum = (n) => Math.round(n).toLocaleString();

function buildNameMap(userPlans) {
  const map = {};
  for (const key of Object.keys(userPlans || {})) {
    for (const ex of getPlanExercises(key, userPlans)) {
      if (ex?.id && !map[ex.id]) map[ex.id] = ex.name || ex.id;
    }
  }
  return map;
}

const cardStyle = {
  background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '20px 22px', boxShadow: '1px 2px 4px rgba(50,35,20,0.06)',
};
const sectionLabel = {
  fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3,
  fontFamily: 'var(--font-mono)',
};

function LineChart({ points, color }) {
  const gid = 'cg' + useId().replace(/:/g, ''); // unconditional — keeps hook order stable
  if (points.length < 2) {
    return (
      <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 12, fontStyle: 'italic' }}>
        Log this exercise in at least two sessions to see a trend.
      </div>
    );
  }
  const vals = points.map(p => p.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const n = points.length;
  const fx = (i) => (i / (n - 1)) * 100;
  const fy = (v) => 100 - ((v - min) / span) * 100;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${fx(i).toFixed(2)} ${fy(p.value).toFixed(2)}`).join(' ');
  const area = `${line} L100 100 L0 100 Z`;
  const lastTop = fy(points[n - 1].value);

  return (
    <div style={{ position: 'relative', height: 140, marginInline: 4 }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.20" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div style={{
        position: 'absolute', right: 0, top: `${lastTop}%`, transform: 'translate(50%, -50%)',
        width: 9, height: 9, borderRadius: '50%', background: color,
        boxShadow: '0 0 0 3px var(--card)',
      }} />
    </div>
  );
}

function BarChart({ bars, color }) {
  const max = Math.max(...bars.map(b => b.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 130 }}>
      {bars.map((b, i) => (
        <div key={b.weekStart} title={`Week of ${fmtShort(b.weekStart)} · ${fmtNum(b.value)} kg`}
          style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{
            width: '100%', height: `${Math.max((b.value / max) * 100, 2)}%`, minHeight: 2,
            background: color, borderRadius: '3px 3px 0 0',
            opacity: i === bars.length - 1 ? 1 : 0.5,
          }} />
        </div>
      ))}
    </div>
  );
}

export default function Charts({ completedDays, userPlans }) {
  const nameMap = useMemo(() => buildNameMap(userPlans), [userPlans]);
  const ids = useMemo(() => loggedExerciseIds(completedDays), [completedDays]);
  const [selected, setSelected] = useState(null);

  const activeId = (selected && ids.includes(selected)) ? selected : ids[0];
  const series = useMemo(() => activeId ? exerciseProgressSeries(activeId, completedDays) : [], [activeId, completedDays]);
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

  const bodyweight = isBodyweightSeries(series);
  const metricLabel = bodyweight ? 'Top-set reps' : 'Est. 1-rep max';
  const unit = bodyweight ? 'reps' : 'kg';
  const points = series.map(p => ({ value: bodyweight ? p.topReps : p.e1rm, date: p.date }));

  const latest = points.length ? points[points.length - 1].value : 0;
  const first = points.length ? points[0].value : 0;
  const delta = Math.round((latest - first) * 10) / 10;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Strength trend */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={sectionLabel}>STRENGTH TREND</div>
          <select
            value={activeId}
            onChange={e => setSelected(e.target.value)}
            aria-label="Choose exercise"
            style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--foreground)',
              background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4,
              padding: '6px 10px', cursor: 'pointer', maxWidth: 200,
            }}
          >
            {ids.map(id => <option key={id} value={id}>{nameMap[id] || id}</option>)}
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
        <div style={{ fontSize: 9, ...sectionLabel, marginBottom: 6 }}>{metricLabel.toUpperCase()}</div>

        <LineChart points={points} color="var(--primary)" />

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

        {weekly.length === 0 ? (
          <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 12, fontStyle: 'italic' }}>
            No weighted sets logged yet.
          </div>
        ) : (
          <>
            <BarChart bars={weekly} color="var(--chart-4)" />
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
