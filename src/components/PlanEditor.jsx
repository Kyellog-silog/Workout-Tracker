/**
 * PlanEditor component.
 *
 * Tabbed exercise plan editor for Push, Pull, and Legs sessions.
 * Supports:
 * - Inline editing of all exercise fields (name, sets, reps, type, weight, cues)
 * - Reordering exercises up/down
 * - Adding and removing exercises
 * - Text import: parses "4x8-12 Bench Press @15kg" format automatically
 * - File import: loads a .txt file and parses it the same way
 * - Resetting a session to the default plan
 *
 * Changes apply to future sessions only; past workout logs are never modified.
 */
import { useState, useRef } from 'react';
import { SESSION_META, DEFAULT_EXERCISES, EXERCISE_TYPES } from '../data/workouts';
import { Icon } from './Icons';

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

export default function PlanEditor({ customPlans, setCustomPlans }) {
  const [activeSession, setActiveSession] = useState('push');
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importError, setImportError] = useState('');
  const [saved, setSaved] = useState(false);
  const fileRef = useRef();

  const sessionMeta = SESSION_META[activeSession];
  const currentExercises = (customPlans?.[activeSession]) || DEFAULT_EXERCISES[activeSession];
  const isCustomized = !!(customPlans && customPlans[activeSession]);

  const setExercises = (exs) => setCustomPlans(prev => ({ ...(prev || {}), [activeSession]: exs }));
  const handleChange = (index, key, value) => setExercises(currentExercises.map((ex, i) => i === index ? { ...ex, [key]: value } : ex));
  const handleAdd = () => setExercises([...currentExercises, { ...EMPTY_EXERCISE, id: genId(activeSession[0]), order: currentExercises.length + 1 }]);
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
    if (!confirm(`Reset ${activeSession.toUpperCase()} to the default plan?`)) return;
    const updated = { ...(customPlans || {}) }; delete updated[activeSession]; setCustomPlans(updated);
  };
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const handleImport = () => {
    setImportError('');
    if (!importText.trim()) { setImportError('Paste some exercises first.'); return; }
    try {
      const parsed = parseTextImport(importText, activeSession);
      if (parsed.length === 0) { setImportError('Could not parse any exercises.'); return; }
      if (!confirm(`Import ${parsed.length} exercise(s)? This replaces your current ${activeSession.toUpperCase()} plan.`)) return;
      setExercises(parsed); setImportText(''); setShowImport(false);
    } catch (e) { setImportError('Parse error: ' + e.message); }
  };
  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 500 * 1024) {
      setImportError('File too large (max 500 KB). Paste the text directly instead.');
      e.target.value = '';
      return;
    }
    if (!file.type.startsWith('text/')) {
      setImportError('Only plain text (.txt) files are accepted.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader(); reader.onload = (ev) => setImportText(ev.target.result);
    reader.readAsText(file); e.target.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Session picker ──────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8 }}>
        {['push', 'pull', 'legs'].map(key => {
          const m = SESSION_META[key];
          const active = activeSession === key;
          return (
            <button key={key} onClick={() => setActiveSession(key)} style={{
              flex: 1, padding: '12px 8px', borderRadius: 4, cursor: 'pointer',
              border: active ? `2px solid ${m.color}` : '2px solid var(--border)',
              background: active ? `${m.color}10` : 'var(--muted)',
              transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-serif)', letterSpacing: 1, color: active ? m.color : 'var(--muted-foreground)' }}>
                {m.label}
              </div>
              {customPlans?.[key] && (
                <div style={{ fontSize: 8, color: m.color, marginTop: 3, letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>CUSTOM</div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Header bar ─────────────────────────────────── */}
      <div style={{
        background: sessionMeta.dimColor, border: `1px solid ${sessionMeta.borderColor}`,
        borderRadius: 4, padding: '14px 18px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 24, color: sessionMeta.color }}>
            {sessionMeta.label}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', fontStyle: 'italic', marginTop: 1 }}>
            {sessionMeta.focus} · {currentExercises.length} exercises
            {isCustomized && <span style={{ fontStyle: 'normal', color: sessionMeta.color, marginLeft: 8, fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>· CUSTOM</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ActionBtn
            color={showImport ? 'var(--muted-foreground)' : sessionMeta.color}
            bg={showImport ? 'var(--muted)' : `${sessionMeta.color}10`}
            border={showImport ? 'var(--border)' : sessionMeta.borderColor}
            icon={showImport ? 'x' : 'arrowUp'}
            onClick={() => setShowImport(s => !s)}
          >
            {showImport ? 'CANCEL' : 'IMPORT TEXT'}
          </ActionBtn>
          {isCustomized && (
            <ActionBtn
              color="var(--destructive)" bg="rgba(181,74,53,0.05)"
              border="rgba(181,74,53,0.22)" icon="undo"
              onClick={handleResetSession}
            >
              RESET TO DEFAULT
            </ActionBtn>
          )}
        </div>
      </div>

      {/* ── Import panel ───────────────────────────────── */}
      {showImport && (
        <div style={{ background: 'var(--card)', border: `1px solid ${sessionMeta.borderColor}`, borderRadius: 4, padding: '16px 18px' }}>
          <div style={{ fontSize: 9, color: sessionMeta.color, letterSpacing: 3, marginBottom: 10, fontFamily: 'var(--font-mono)' }}>IMPORT FROM TEXT</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 10, lineHeight: 1.8 }}>
            One exercise per line:&nbsp;
            <code style={{ fontFamily: 'var(--font-mono)', color: sessionMeta.color, fontSize: 10 }}>4x8-12 Bench Press</code>
            &nbsp;·&nbsp;
            <code style={{ fontFamily: 'var(--font-mono)', color: sessionMeta.color, fontSize: 10 }}>DB Row 3 sets 10-12 @12kg</code>
          </div>
          <textarea value={importText} onChange={e => setImportText(e.target.value)}
            placeholder={"4x8-12 Bench Press\n3x10-12 DB Row\n3x15 Lateral Raises @5kg"}
            rows={5}
            style={{ ...inputBase, width: '100%', fontSize: 12, padding: '10px 12px', resize: 'vertical' }}
          />
          {importError && <div style={{ fontSize: 11, color: 'var(--destructive)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>{importError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <ActionBtn color={sessionMeta.color} bg={`${sessionMeta.color}10`} border={sessionMeta.borderColor} onClick={handleImport}>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {currentExercises.map((ex, i) => (
          <ExerciseFormRow
            key={ex.id} ex={ex} index={i} total={currentExercises.length}
            sessionColor={sessionMeta.color}
            onChange={(key, val) => handleChange(i, key, val)}
            onDelete={() => handleDelete(i)}
            onMoveUp={() => handleMove(i, -1)}
            onMoveDown={() => handleMove(i, 1)}
          />
        ))}
      </div>

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
          background: saved ? '#5c7a5c' : sessionMeta.color,
          border: 'none', color: '#fff', fontSize: 11, fontWeight: 700,
          letterSpacing: 2, fontFamily: 'var(--font-mono)', transition: 'background 0.2s',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          {saved && <Icon name="check" size={13} color="#fff" strokeWidth={2.5} />}
          {saved ? 'SAVED' : 'SAVE PLAN'}
        </button>
      </div>

      {/* ── Footer note ─────────────────────────────────── */}
      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'center', fontStyle: 'italic', padding: '0 8px', lineHeight: 1.7 }}>
        Changes apply to all future sessions of this type. Past workout logs are preserved.
      </div>

    </div>
  );
}
