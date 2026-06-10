/**
 * BodyMetrics — bodyweight & body-measurement tracking (Progress tab).
 *
 * Logs today's weight (and optional measurements) into data.bodyMetrics, keyed
 * by date, and shows a weight trend chart. Bodyweight also feeds bodyweight-
 * adjusted strength PRs in the Charts component.
 */
import { useState } from 'react';
import { Icon } from './Icons';
import { clampNumber } from '../lib/securityGuards';
import { todayStr } from '../lib/scheduler';
import { bodyweightSeries } from '../lib/chartData';
import { LineChart, fmtShort } from './MiniChart';

const WEIGHT = { key: 'weight', label: 'Weight', unit: 'kg', max: 500 };
const MEASUREMENTS = [
  { key: 'bodyfat', label: 'Body fat', unit: '%', max: 70 },
  { key: 'waist', label: 'Waist', unit: 'cm', max: 300 },
  { key: 'chest', label: 'Chest', unit: 'cm', max: 300 },
  { key: 'arms', label: 'Arms', unit: 'cm', max: 120 },
  { key: 'thighs', label: 'Thighs', unit: 'cm', max: 150 },
];

const cardStyle = {
  background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '20px 22px', boxShadow: 'var(--shadow-sm)',
};
const labelStyle = { fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, fontFamily: 'var(--font-mono)' };
const inputStyle = {
  background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 4,
  color: 'var(--foreground)', fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box',
};

function Field({ field, value, onChange }) {
  return (
    <div>
      <label htmlFor={`bm-${field.key}`} style={{ ...labelStyle, display: 'block', marginBottom: 6 }}>
        {field.label.toUpperCase()} <span style={{ opacity: 0.6 }}>({field.unit})</span>
      </label>
      <input
        id={`bm-${field.key}`}
        type="number" min={0} max={field.max} step={0.1}
        value={value ?? ''}
        onChange={e => onChange(field.key, e.target.value, field.max)}
        placeholder="—"
        style={{ ...inputStyle, width: '100%', padding: '9px 10px', fontSize: 15, textAlign: 'right' }}
      />
    </div>
  );
}

export default function BodyMetrics({ bodyMetrics, setBodyMetrics }) {
  const today = todayStr();
  const [open, setOpen] = useState(false);
  const todayEntry = bodyMetrics[today] || {};

  const update = (key, raw, max) => {
    const val = clampNumber(raw, 0, max);
    setBodyMetrics(prev => {
      const entry = { ...(prev[today] || {}), [key]: val };
      if (val === '' || val === null || val === undefined) delete entry[key];
      return { ...prev, [today]: entry };
    });
  };

  const series = bodyweightSeries(bodyMetrics);
  const points = series.map(s => ({ date: s.date, value: s.weight }));
  const current = points.length ? points[points.length - 1].value : null;
  const first = points.length ? points[0].value : null;
  const delta = current != null && first != null ? Math.round((current - first) * 10) / 10 : 0;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={labelStyle}>BODY</div>
        {current != null && (
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>
            Latest {current} kg · logged {fmtShort(series[series.length - 1].date)}
          </div>
        )}
      </div>

      {/* Today's weight — primary input */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px', minWidth: 140 }}>
          <Field field={WEIGHT} value={todayEntry.weight} onChange={update} />
        </div>
        {points.length >= 2 && (
          <span style={{
            fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: 1, padding: '6px 10px', borderRadius: 20, marginBottom: 2,
            color: delta <= 0 ? '#5c7a5c' : 'var(--primary)',
            background: delta <= 0 ? 'rgba(92,122,92,0.12)' : 'rgba(138,90,46,0.10)',
          }}>
            {delta === 0 ? '±0' : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)}`} kg since {fmtShort(points[0].date)}
          </span>
        )}
      </div>

      {/* Measurements (collapsible) */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--muted-foreground)', fontSize: 10, letterSpacing: 2, fontFamily: 'var(--font-mono)', padding: '4px 0', marginBottom: open ? 12 : 4,
        }}
      >
        <Icon name="chevronDown" size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
        {open ? 'HIDE MEASUREMENTS' : 'ADD MEASUREMENTS'}
      </button>
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 16 }}>
          {MEASUREMENTS.map(f => (
            <Field key={f.key} field={f} value={todayEntry[f.key]} onChange={update} />
          ))}
        </div>
      )}

      {/* Weight trend */}
      <div style={{ ...labelStyle, marginBottom: 8, marginTop: 4 }}>WEIGHT TREND</div>
      <LineChart points={points} color="var(--chart-2)" emptyHint="Log your weight on a couple of days to see the trend." />
      {points.length >= 2 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 9, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>
          <span>{fmtShort(points[0].date)}</span>
          <span>{fmtShort(points[points.length - 1].date)}</span>
        </div>
      )}
    </div>
  );
}
