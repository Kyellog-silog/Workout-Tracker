/**
 * PlanEditor component.
 *
 * Tabbed exercise plan editor — fully customisable:
 * - Rename any plan, pick its accent colour, edit its focus area
 * - Add new plans (up to 8) and delete existing ones
 * - Per-plan exercises: inline editing, reordering, text import, file import, reset to default
 * - Weekly Rotation editor: assigns a plan to each of the 7 rotation slots
 *
 * Changes apply to future sessions only; past workout logs are never modified.
 */
import { useState, useRef } from 'react';
import { SESSION_META, DEFAULT_EXERCISES, EXERCISE_TYPES, PLAN_COLORS } from '../data/workouts';
import { getPlanMeta, getPlanExercises, isPlanCustomised } from '../lib/planUtils';
import { Icon } from './Icons';

const MAX_PLANS = 8;

const EMPTY_EXERCISE = {
  name: '', type: 'dumbbell', sets: '3', reps: '8–12', rest: '90s',
  weightStart: '', weightIncrement: '', cue: '', progression: '', whyOrder: '',
};

function genId(prefix) {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return prefix + '_' + hex;
}

function parseTextImport(text, sessionKey) {
  const prefix = sessionKey[0];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const exercises = [];
  lines.forEach((line, i) => {
    let name = line;
    let sets = '3', reps = '8–12', weightStart = '';
    const sxr = line.match(/(\d+)\s*[x×]\s*([\d–\-]+(?:\s*(?:each|per\s*side)?)?)/i);
    if (sxr) {
      sets = sxr[1]; reps = sxr[2].replace('-', '–');
      name = line.replace(sxr[0], '').replace(/^[\s\-–:]+|[\s\-–:]+$/g, '').trim();
    }
    const setMatch = line.match(/(\d+)\s*sets?\s+(?:of\s+)?([\d–\-]+)/i);
    if (!sxr && setMatch) {
      sets = setMatch[1]; reps = setMatch[2].replace('-', '–');
      name = line.replace(setMatch[0], '').replace(/^[\s\-–:]+|[\s\-–:]+$/g, '').trim();
    }
    const wMatch = line.match(/@\s*(\d+(?:\.\d+)?)\s*kg/i) || line.match(/(\d+(?:\.\d+)?)\s*kg/i);
    if (wMatch) { weightStart = wMatch[1]; name = name.replace(wMatch[0], '').replace(/^[\s\-–:@]+|[\s\-–:@]+$/g, '').trim(); }
    const lower = name.toLowerCase();
    let type = 'dumbbell';
    if (/pull.?up|chin.?up|hang|bar/i.test(lower)) type = 'pullup';
    else if (/push.?up|plank|dip|lunge|squat|crunch|sit.?up|nordic|bodyweight|bw\b/i.test(lower)) type = 'bodyweight';
    if (name) exercises.push({ ...EMPTY_EXERCISE, id: genId(prefix), name, type, sets, reps, weightStart, order: i + 1 });
  });
  return exercises;
}

// ── Shared styles (parchment-native) ──────────────────────────────────────
const inputBase = {
  background: 'var(--muted)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--foreground)',
  fontFamily: 'var(--font-mono)',
  outline: 'none',
  boxSizing: 'border-box',
};

const selectStyle = {
  ...inputBase,
  fontSize: 11,
  padding: '5px 22px 5px 8px',
  cursor: 'pointer',
  appearance: 'none',
  WebkitAppearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%237d6b56' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 7px center',
};

function CtrlBtn({ onClick, disabled, title, children, danger }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      width: 28, height: 28, borderRadius: 4, flexShrink: 0,
      border: `1px solid ${danger ? 'rgba(181,74,53,0.3)' : 'var(--border)'}`,
      background: danger ? 'rgba(181,74,53,0.05)' : 'var(--muted)',
      color: disabled ? 'var(--border)' : danger ? 'var(--destructive)' : 'var(--muted-foreground)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'background 0.12s',
    }}>
      {children}
    </button>
  );
}

function ExerciseFormRow({ ex, index, total, onChange, onDelete, onMoveUp, onMoveDown, sessionColor }) {
  const [expanded, setExpanded] = useState(false);

  const detailField = (key, label, placeholder, multiline = false) => (
    <div>
      <label style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 2, display: 'block', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>{label}</label>
      {multiline
        ? <textarea value={ex[key] || ''} onChange={e => onChange(key, e.target.value)} placeholder={placeholder} rows={2}
            style={{ ...inputBase, width: '100%', fontSize: 12, padding: '8px 10px', resize: 'vertical' }} />
        : <input type="text" value={ex[key] || ''} onChange={e => onChange(key, e.target.value)} placeholder={placeholder}
            style={{ ...inputBase, width: '100%', fontSize: 12, padding: '8px 10px' }} />
      }
    </div>
  );

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${sessionColor}`,
      borderRadius: '0 4px 4px 0',
      overflow: 'hidden',
      boxShadow: '1px 2px 3px rgba(50,35,20,0.05)',
    }}>
      {/* ── Row: two visual lines on mobile, single line on desktop ── */}
      <div style={{ padding: '10px 12px' }}>

        {/* Top line: number + name + controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
            background: `${sessionColor}15`, border: `1px solid ${sessionColor}35`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: sessionColor, fontFamily: 'var(--font-mono)',
          }}>{index + 1}</div>

          <input
            type="text" value={ex.name}
            onChange={e => onChange('name', e.target.value)}
            placeholder="Exercise name..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--foreground)', fontSize: 13, fontWeight: 700,
              fontFamily: 'var(--font-serif)', minWidth: 0,
            }}
          />

          {/* Controls always visible, right-aligned */}
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            <CtrlBtn onClick={onMoveUp} disabled={index === 0} title="Move up">
              <Icon name="chevronDown" size={11} style={{ transform: 'rotate(180deg)' }} />
            </CtrlBtn>
            <CtrlBtn onClick={onMoveDown} disabled={index === total - 1} title="Move down">
              <Icon name="chevronDown" size={11} />
            </CtrlBtn>
            <CtrlBtn onClick={() => setExpanded(e => !e)} title="Edit details">
              <Icon name="edit" size={11} style={{ opacity: expanded ? 1 : 0.6 }} />
            </CtrlBtn>
            <CtrlBtn onClick={onDelete} danger title="Remove">
              <Icon name="x" size={11} />
            </CtrlBtn>
          </div>
        </div>

        {/* Bottom line: sets × reps + type — sits below name on its own row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingLeft: 32 }}>
          <input type="text" value={ex.sets} onChange={e => onChange('sets', e.target.value)}
            placeholder="3" title="Sets" maxLength={6}
            style={{ ...inputBase, width: 32, fontSize: 12, padding: '4px 5px', textAlign: 'center' }} />
          <span style={{ color: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>×</span>
          <input type="text" value={ex.reps} onChange={e => onChange('reps', e.target.value)}
            placeholder="8–12" title="Reps" maxLength={6}
            style={{ ...inputBase, width: 54, fontSize: 12, padding: '4px 5px', textAlign: 'center' }} />
          <select value={ex.type} onChange={e => onChange('type', e.target.value)} style={selectStyle}>
            {EXERCISE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── Expanded detail fields ─────────────────────── */}
      {expanded && (
        <div style={{ padding: '0 12px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginTop: 12 }}>
            {detailField('rest', 'REST BETWEEN SETS', 'e.g. 2–3min')}
            {detailField('weightStart', 'STARTING WEIGHT (kg)', 'e.g. 12')}
            {detailField('weightIncrement', 'INCREMENT (kg)', 'e.g. 2.5')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 10 }}>
            {detailField('cue', 'COACHING CUE', 'Form cue for this exercise...', true)}
            {detailField('progression', 'PROGRESSION PATH', 'e.g. 10kg → 12.5kg → 15kg', true)}
          </div>
          <div style={{ marginTop: 10 }}>
            {detailField('whyOrder', 'WHY THIS ORDER (optional)', 'Why does this exercise sit here?', true)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tonal action button helper ─────────────────────────────────────────────
function ActionBtn({ color, border, bg, onClick, icon, children }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 10, letterSpacing: 2, color,
      background: bg, border: `1px solid ${border}`,
      borderRadius: 4, padding: '7px 14px', cursor: 'pointer',
      fontFamily: 'var(--font-mono)', fontWeight: 700,
      display: 'flex', alignItems: 'center', gap: 6,
      transition: 'opacity 0.12s',
    }}>
      {icon && <Icon name={icon} size={10} color={color} />}
      {children}
    </button>
  );
}

// ── Add Plan Modal ─────────────────────────────────────────────────────────
function AddPlanModal({ onAdd, onClose }) {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(PLAN_COLORS[4]);

  const handle = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    onAdd(trimmed, color);
    onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(50,35,20,0.4)', backdropFilter: 'blur(3px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 401, background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '24px 28px', width: 'min(360px, 90vw)',
        boxShadow: '0 8px 32px rgba(50,35,20,0.18)',
      }}>
        <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, marginBottom: 16, fontFamily: 'var(--font-mono)' }}>NEW PLAN</div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 2, display: 'block', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>PLAN NAME</label>
          <input
            autoFocus
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handle()}
            placeholder="e.g. Upper Body"
            maxLength={32}
            style={{ ...inputBase, width: '100%', fontSize: 14, padding: '9px 12px', fontFamily: 'var(--font-serif)' }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 2, display: 'block', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>COLOUR</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PLAN_COLORS.map(c => (
              <button
                key={c} onClick={() => setColor(c)}
                style={{
                  width: 26, height: 26, borderRadius: '50%', background: c,
                  border: color === c ? '3px solid var(--foreground)' : '2px solid transparent',
                  cursor: 'pointer', flexShrink: 0, padding: 0,
                  boxShadow: color === c ? `0 0 0 1px ${c}` : 'none',
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            fontSize: 10, letterSpacing: 2, color: 'var(--muted-foreground)',
            background: 'var(--muted)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '8px 16px', cursor: 'pointer', fontFamily: 'var(--font-mono)',
          }}>CANCEL</button>
          <button onClick={handle} disabled={!label.trim()} style={{
            fontSize: 10, letterSpacing: 2, color: '#fff',
            background: label.trim() ? color : 'var(--border)',
            border: 'none', borderRadius: 4, padding: '8px 16px',
            cursor: label.trim() ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-mono)', fontWeight: 700,
            transition: 'background 0.15s',
          }}>CREATE</button>
        </div>
      </div>
    </>
  );
}

// ── Weekly Schedule Editor ─────────────────────────────────────────────────
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function WeeklyScheduleEditor({ weeklySchedule, setWeeklySchedule, userPlans, programStart }) {
  const startDow = programStart ? new Date(programStart + 'T12:00:00').getDay() : 0;

  const planOptions = [
    { key: 'rest', label: 'Rest' },
    { key: 'cardio', label: SESSION_META.cardio?.label || 'Cardio' },
    ...Object.entries(userPlans || {}).map(([k, v]) => ({ key: k, label: v.label || k.toUpperCase() })),
  ];

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px 18px' }}>
      <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, marginBottom: 12, fontFamily: 'var(--font-mono)' }}>WEEKLY ROTATION</div>
      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 14, lineHeight: 1.6, fontStyle: 'italic' }}>
        Set the default plan for each slot in your weekly rotation.
        {!programStart && ' Set a start date on the calendar first to see day names.'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {(weeklySchedule || []).map((slot, i) => {
          const dayLabel = DOW_SHORT[(startDow + i) % 7];
          const meta = getPlanMeta(slot, userPlans);
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
              <div style={{ fontSize: 8, color: 'var(--muted-foreground)', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>
                {programStart ? dayLabel.toUpperCase() : `D${i + 1}`}
              </div>
              <div style={{
                width: '100%', borderRadius: 4, overflow: 'hidden',
                border: `2px solid ${meta.color}`,
                background: `${meta.color}10`,
              }}>
                <select
                  value={slot}
                  onChange={e => {
                    const newSched = [...weeklySchedule];
                    newSched[i] = e.target.value;
                    setWeeklySchedule(newSched);
                  }}
                  style={{
                    width: '100%', border: 'none', background: 'transparent',
                    color: meta.color, fontFamily: 'var(--font-mono)', fontSize: 9,
                    fontWeight: 700, letterSpacing: 1, padding: '6px 4px',
                    cursor: 'pointer', outline: 'none', textAlign: 'center',
                    appearance: 'none', WebkitAppearance: 'none',
                  }}
                >
                  {planOptions.map(o => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main PlanEditor ────────────────────────────────────────────────────────

export default function PlanEditor({
  userPlans,
  setUserPlans,
  weeklySchedule,
  setWeeklySchedule,
  programStart,
  onAddPlan,
  onRenamePlan,
  onDeletePlan,
  onUpdatePlanColor,
  onUpdatePlanFocus,
}) {
  const planKeys = Object.keys(userPlans || {});
  const [activeSession, setActiveSession] = useState(planKeys[0] || 'push');
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importError, setImportError] = useState('');
  const [saved, setSaved] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const fileRef = useRef();

  // Keep activeSession valid if plans change
  const safeActive = planKeys.includes(activeSession) ? activeSession : (planKeys[0] || 'push');

  const meta = getPlanMeta(safeActive, userPlans);
  const currentExercises = getPlanExercises(safeActive, userPlans);
  const isCustomised = isPlanCustomised(safeActive, userPlans);
  const hasDefaultKey = !!(userPlans?.[safeActive]?.defaultKey);

  const setExercises = (exs) => setUserPlans(prev => ({
    ...prev,
    [safeActive]: { ...(prev[safeActive] || {}), exercises: exs },
  }));

  const handleChange = (index, key, value) =>
    setExercises(currentExercises.map((ex, i) => i === index ? { ...ex, [key]: value } : ex));
  const handleAdd = () =>
    setExercises([...currentExercises, { ...EMPTY_EXERCISE, id: genId(safeActive[0] || 'x'), order: currentExercises.length + 1 }]);
  const handleDelete = (index) => {
    if (!confirm('Remove this exercise?')) return;
    setExercises(currentExercises.filter((_, i) => i !== index).map((ex, i) => ({ ...ex, order: i + 1 })));
  };
  const handleMove = (index, dir) => {
    const exs = [...currentExercises]; const target = index + dir;
    if (target < 0 || target >= exs.length) return;
    [exs[index], exs[target]] = [exs[target], exs[index]];
    setExercises(exs.map((ex, i) => ({ ...ex, order: i + 1 })));
  };

  const handleResetSession = () => {
    const defaultKey = userPlans?.[safeActive]?.defaultKey;
    if (!defaultKey) return;
    if (!confirm(`Reset ${meta.label} to the default plan?`)) return;
    setUserPlans(prev => ({
      ...prev,
      [safeActive]: { ...(prev[safeActive] || {}), exercises: null },
    }));
  };

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const handleImport = () => {
    setImportError('');
    if (!importText.trim()) { setImportError('Paste some exercises first.'); return; }
    try {
      const parsed = parseTextImport(importText, safeActive);
      if (parsed.length === 0) { setImportError('Could not parse any exercises.'); return; }
      if (!confirm(`Import ${parsed.length} exercise(s)? This replaces your current ${meta.label} plan.`)) return;
      setExercises(parsed); setImportText(''); setShowImport(false);
    } catch (e) { setImportError('Parse error: ' + e.message); }
  };

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 500 * 1024) {
      setImportError('File too large (max 500 KB). Paste the text directly instead.');
      e.target.value = ''; return;
    }
    if (!file.type.startsWith('text/')) {
      setImportError('Only plain text (.txt) files are accepted.');
      e.target.value = ''; return;
    }
    const reader = new FileReader(); reader.onload = (ev) => setImportText(ev.target.result);
    reader.readAsText(file); e.target.value = '';
  };

  const startRename = () => { setRenameVal(meta.label); setRenaming(true); };
  const commitRename = () => {
    setRenaming(false);
    const trimmed = renameVal.trim();
    if (!trimmed || trimmed === meta.label) return;
    onRenamePlan(safeActive, trimmed);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Plan tab bar ──────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {planKeys.map(key => {
          const m = getPlanMeta(key, userPlans);
          const active = safeActive === key;
          return (
            <button key={key} onClick={() => setActiveSession(key)} style={{
              flex: '1 1 80px', minWidth: 72, padding: '10px 8px', borderRadius: 4, cursor: 'pointer',
              border: active ? `2px solid ${m.color}` : '2px solid var(--border)',
              background: active ? `${m.color}10` : 'var(--muted)',
              transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-serif)', letterSpacing: 0.5, color: active ? m.color : 'var(--muted-foreground)' }}>
                {m.label}
              </div>
              {isPlanCustomised(key, userPlans) && (
                <div style={{ fontSize: 7, color: m.color, marginTop: 2, letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>CUSTOM</div>
              )}
            </button>
          );
        })}

        {/* Add plan button */}
        <button
          onClick={() => setShowAddModal(true)}
          disabled={planKeys.length >= MAX_PLANS}
          title={planKeys.length >= MAX_PLANS ? `Maximum ${MAX_PLANS} plans reached` : 'Add a new plan'}
          style={{
            width: 44, height: 46, borderRadius: 4,
            cursor: planKeys.length >= MAX_PLANS ? 'not-allowed' : 'pointer',
            border: '2px dashed var(--border)', background: 'transparent',
            color: planKeys.length >= MAX_PLANS ? 'var(--border)' : 'var(--muted-foreground)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 300, flexShrink: 0,
            transition: 'border-color 0.15s, color 0.15s',
          }}
        >+</button>
      </div>

      {/* ── Plan header bar ────────────────────────────── */}
      <div style={{
        background: meta.dimColor, border: `1px solid ${meta.borderColor}`,
        borderRadius: 4, padding: '14px 18px',
      }}>
        {/* Title row: name (editable) + colour swatches */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            {renaming ? (
              <input
                autoFocus
                value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }}
                maxLength={32}
                style={{
                  ...inputBase, fontSize: 22, fontFamily: 'var(--font-serif)', fontWeight: 700,
                  color: meta.color, padding: '2px 8px', letterSpacing: 0.5, width: '100%',
                }}
              />
            ) : (
              <div
                onClick={startRename}
                title="Click to rename"
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'text', userSelect: 'none' }}
              >
                <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 24, color: meta.color }}>{meta.label}</span>
                <Icon name="edit" size={12} color={meta.color} style={{ opacity: 0.5 }} />
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', fontStyle: 'italic', marginTop: 3 }}>
              {currentExercises.length} exercise{currentExercises.length !== 1 ? 's' : ''}
              {isCustomised && <span style={{ fontStyle: 'normal', color: meta.color, marginLeft: 8, fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>· CUSTOM</span>}
            </div>
          </div>

          {/* Colour swatches */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {PLAN_COLORS.map(c => (
              <button
                key={c} onClick={() => onUpdatePlanColor(safeActive, c)}
                style={{
                  width: 22, height: 22, borderRadius: '50%', background: c,
                  border: meta.color === c ? '3px solid var(--foreground)' : '2px solid transparent',
                  cursor: 'pointer', flexShrink: 0, padding: 0,
                  boxShadow: meta.color === c ? `0 0 0 1px ${c}` : 'none',
                  transition: 'transform 0.1s',
                }}
              />
            ))}
          </div>
        </div>

        {/* Focus / subtitle */}
        <input
          type="text"
          value={userPlans?.[safeActive]?.focus ?? (meta.focus || '')}
          onChange={e => onUpdatePlanFocus(safeActive, e.target.value)}
          placeholder="Focus area (e.g. Chest · Shoulders · Triceps)"
          style={{
            ...inputBase, width: '100%', fontSize: 12, padding: '6px 10px',
            fontStyle: 'italic', color: 'var(--muted-foreground)', marginBottom: 12,
          }}
        />

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ActionBtn
            color={showImport ? 'var(--muted-foreground)' : meta.color}
            bg={showImport ? 'var(--muted)' : `${meta.color}10`}
            border={showImport ? 'var(--border)' : meta.borderColor}
            icon={showImport ? 'x' : 'arrowUp'}
            onClick={() => setShowImport(s => !s)}
          >
            {showImport ? 'CANCEL' : 'IMPORT TEXT'}
          </ActionBtn>

          {isCustomised && hasDefaultKey && DEFAULT_EXERCISES[userPlans[safeActive]?.defaultKey] && (
            <ActionBtn
              color="var(--muted-foreground)" bg="var(--muted)"
              border="var(--border)" icon="undo"
              onClick={handleResetSession}
            >
              RESET TO DEFAULT
            </ActionBtn>
          )}

          <ActionBtn
            color="var(--destructive)" bg="rgba(181,74,53,0.05)"
            border="rgba(181,74,53,0.22)" icon="x"
            onClick={() => onDeletePlan(safeActive)}
          >
            DELETE PLAN
          </ActionBtn>
        </div>
      </div>

      {/* ── Import panel ───────────────────────────────── */}
      {showImport && (
        <div style={{ background: 'var(--card)', border: `1px solid ${meta.borderColor}`, borderRadius: 4, padding: '16px 18px' }}>
          <div style={{ fontSize: 9, color: meta.color, letterSpacing: 3, marginBottom: 10, fontFamily: 'var(--font-mono)' }}>IMPORT FROM TEXT</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 10, lineHeight: 1.8 }}>
            One exercise per line:&nbsp;
            <code style={{ fontFamily: 'var(--font-mono)', color: meta.color, fontSize: 10 }}>4x8-12 Bench Press</code>
            &nbsp;·&nbsp;
            <code style={{ fontFamily: 'var(--font-mono)', color: meta.color, fontSize: 10 }}>DB Row 3 sets 10-12 @12kg</code>
          </div>
          <textarea value={importText} onChange={e => setImportText(e.target.value)}
            placeholder={"4x8-12 Bench Press\n3x10-12 DB Row\n3x15 Lateral Raises @5kg"}
            rows={5}
            style={{ ...inputBase, width: '100%', fontSize: 12, padding: '10px 12px', resize: 'vertical' }}
          />
          {importError && <div style={{ fontSize: 11, color: 'var(--destructive)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>{importError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <ActionBtn color={meta.color} bg={`${meta.color}10`} border={meta.borderColor} onClick={handleImport}>
              PARSE & IMPORT
            </ActionBtn>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>or</span>
            <ActionBtn color="var(--muted-foreground)" bg="var(--muted)" border="var(--border)" icon="arrowUp" onClick={() => fileRef.current.click()}>
              LOAD .TXT FILE
            </ActionBtn>
            <input ref={fileRef} type="file" accept=".txt" onChange={handleFile} style={{ display: 'none' }} />
          </div>
        </div>
      )}

      {/* ── Exercise list ───────────────────────────────── */}
      {currentExercises.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {currentExercises.map((ex, i) => (
            <ExerciseFormRow
              key={ex.id || i} ex={ex} index={i} total={currentExercises.length}
              sessionColor={meta.color}
              onChange={(key, val) => handleChange(i, key, val)}
              onDelete={() => handleDelete(i)}
              onMoveUp={() => handleMove(i, -1)}
              onMoveDown={() => handleMove(i, 1)}
            />
          ))}
        </div>
      ) : (
        <div style={{
          padding: '32px 20px', textAlign: 'center',
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4,
          color: 'var(--muted-foreground)', fontSize: 12, fontStyle: 'italic', lineHeight: 1.7,
        }}>
          No exercises yet. Add your first exercise below or import from text.
        </div>
      )}

      {/* ── Add + Save ──────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={handleAdd} style={{
          flex: 1, padding: '13px', borderRadius: 4, cursor: 'pointer',
          background: 'var(--muted)', border: '2px dashed var(--border)',
          color: 'var(--foreground)', fontSize: 11,
          fontFamily: 'var(--font-mono)', letterSpacing: 2,
          transition: 'border-color 0.15s, color 0.15s',
        }}>
          + ADD EXERCISE
        </button>
        <button onClick={handleSave} style={{
          padding: '13px 24px', borderRadius: 4, cursor: 'pointer',
          background: saved ? '#5c7a5c' : meta.color,
          border: 'none', color: '#fff', fontSize: 11, fontWeight: 700,
          letterSpacing: 2, fontFamily: 'var(--font-mono)', transition: 'background 0.2s',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          {saved && <Icon name="check" size={13} color="#fff" strokeWidth={2.5} />}
          {saved ? 'SAVED' : 'SAVE PLAN'}
        </button>
      </div>

      {/* ── Weekly Schedule Editor ──────────────────────── */}
      <WeeklyScheduleEditor
        weeklySchedule={weeklySchedule}
        setWeeklySchedule={setWeeklySchedule}
        userPlans={userPlans}
        programStart={programStart}
      />

      {/* ── Footer note ─────────────────────────────────── */}
      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'center', fontStyle: 'italic', padding: '0 8px', lineHeight: 1.7 }}>
        Changes apply to all future sessions of this type. Past workout logs are preserved.
      </div>

      {/* ── Add Plan Modal ──────────────────────────────── */}
      {showAddModal && (
        <AddPlanModal
          onAdd={onAddPlan}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
