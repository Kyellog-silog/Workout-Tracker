/**
 * MiniChart — small, dependency-free, theme-aware chart primitives shared by the
 * progress charts and the bodyweight tracker.
 *
 * LineChart uses a normalized 0–100 viewBox with preserveAspectRatio="none" and
 * a non-scaling stroke, so it stretches crisply to any width without distorting
 * line weight. Axis labels are rendered as HTML by the caller (so they never
 * scale oddly).
 */
import { useId } from 'react';

export const fmtShort = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const fmtNum = (n) => Math.round(n).toLocaleString();

/**
 * @param {{value:number}[]} points  ordered oldest → newest
 * @param {string} color             CSS colour for line/fill/dot
 * @param {string} emptyHint         message shown when there are < 2 points
 */
export function LineChart({ points, color, height = 140, emptyHint = 'Not enough data yet.' }) {
  const gid = 'cg' + useId().replace(/:/g, ''); // unconditional — keeps hook order stable
  if (points.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontSize: 12, fontStyle: 'italic', textAlign: 'center', padding: '0 16px' }}>
        {emptyHint}
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
    <div style={{ position: 'relative', height, marginInline: 4 }}>
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
        width: 9, height: 9, borderRadius: '50%', background: color, boxShadow: '0 0 0 3px var(--card)',
      }} />
    </div>
  );
}

/** @param {{label?:string, title?:string, value:number}[]} bars */
export function BarChart({ bars, color, height = 130 }) {
  const max = Math.max(...bars.map(b => b.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height }}>
      {bars.map((b, i) => (
        <div key={b.key ?? i} title={b.title} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{
            width: '100%', height: `${Math.max((b.value / max) * 100, 2)}%`, minHeight: 2,
            background: color, borderRadius: '3px 3px 0 0', opacity: i === bars.length - 1 ? 1 : 0.5,
          }} />
        </div>
      ))}
    </div>
  );
}
