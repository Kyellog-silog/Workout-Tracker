/**
 * Root application component.
 *
 * Manages global state (programme start date, completed days, schedule overrides,
 * custom plans), handles passphrase-based authentication, sync status display,
 * tab navigation, and midnight schedule checks.
 *
 * State is persisted via the useSyncedData hook which writes to both
 * localStorage (immediate) and Supabase (debounced).
 */
import { useState, useEffect, useRef } from 'react';
import { useSyncedData } from './hooks/useSyncedData';
import { useTheme } from './hooks/useTheme';
import { useConfirm } from './components/ConfirmDialog';
import PassphraseGate from './components/PassphraseGate';
import LandingPage from './components/LandingPage';
import Calendar from './components/Calendar';
import WorkoutTracker from './components/WorkoutTracker';
import Stats from './components/Stats';
import Progression from './components/Progression';
import Charts from './components/Charts';
import BodyMetrics from './components/BodyMetrics';
import PlanEditor from './components/PlanEditor';
import MissedAlert from './components/MissedAlert';
import RestTimer from './components/RestTimer';
import { Icon } from './components/Icons';
import { applySmartGuard, todayStr, resolvedSession, addDays, isBefore } from './lib/scheduler';
import { SESSION_META, DEFAULT_SCHEDULE } from './data/workouts';
import { getPlanMeta, initUserPlansFromLegacy, renamePlanInData, deletePlanFromData, countCompletedSessionsForPlan, generateUniqueKey, migrateDefaultPlanColors, setMetaTheme } from './lib/planUtils';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { clearAllMissedAdjustments } from './lib/scheduler';
import { clearAllCustomWorkouts } from './lib/planUtils';

const TABS = [
  { id: 'today',    label: 'Today',    icon: 'zap' },
  { id: 'calendar', label: 'Plan',     icon: 'calendar' },
  { id: 'edit',     label: 'Edit',     icon: 'edit' },
  { id: 'progress', label: 'Progress', icon: 'barChart' },
];

const IDENTITY_KEY = 'ppl-identity';

const STATUS_CONFIG = {
  loading: { label: 'Syncing',  color: 'var(--muted-foreground)', icon: 'refresh' },
  synced:  { label: 'Synced',   color: '#2c6e7a',                 icon: 'cloudSync' },
  saving:  { label: 'Saving',   color: 'var(--chart-1)',          icon: 'refresh',  pulse: true },
  offline: { label: 'Offline',  color: 'var(--destructive)',       icon: 'cloudOff' },
};

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  // Keep session/plan colours in sync with the theme (brightened in dark). Set
  // during render so getPlanMeta calls in this pass use the correct theme.
  setMetaTheme(theme);
  const confirm = useConfirm();
  const [identity, setIdentity] = useState(null); // { username, passphrase } | null
  const [showGate, setShowGate] = useState(false); // logged-out: landing vs sign-in gate

  // On mount: restore identity from sessionStorage (tab-scoped; cleared on close).
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(IDENTITY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.username && parsed?.passphrase) setIdentity(parsed);
      }
    } catch { /* ignore */ }
  }, []);
  const [activeTab, setActiveTab] = useState('today');
  const [pendingAlertEvents, setPendingAlertEvents] = useState([]);
  const midnightTimer = useRef(null);
  const { data, setData, syncStatus } = useSyncedData(identity?.username ?? null, identity?.passphrase ?? null);

  const today = todayStr();
  const selectedDate  = data.selectedDate  || today;
  const programStart  = data.programStart  || null;
  const completedDays = data.completedDays || {};
  const overrides     = data.overrides     || {};
  const streakRestores  = data.streakRestores  || {};
  const bodyMetrics   = data.bodyMetrics   || {};

  // ── Custom plans: derive effective userPlans from raw data or legacy customPlans ──
  const userPlans = data.userPlans || initUserPlansFromLegacy(data.customPlans || {});
  const weeklySchedule = data.weeklySchedule || [...DEFAULT_SCHEDULE];

  const setSelectedDate  = (d)  => setData(p => ({ ...p, selectedDate: d }));
  const setProgramStart  = (d)  => setData(p => ({ ...p, programStart: d }));
  const setCompletedDays = (fn) => setData(p => ({
    ...p, completedDays: typeof fn === 'function' ? fn(p.completedDays || {}) : fn,
  }));
  const setUserPlans = (fn) => setData(p => ({
    ...p, userPlans: typeof fn === 'function' ? fn(p.userPlans || initUserPlansFromLegacy(p.customPlans || {})) : fn,
  }));
  const setWeeklySchedule = (fnOrArray) => setData(p => {
    const oldSchedule = p.weeklySchedule || [...DEFAULT_SCHEDULE];
    const newSchedule = typeof fnOrArray === 'function' ? fnOrArray(oldSchedule) : fnOrArray;

    // Short-circuit if nothing changed
    if (newSchedule.every((v, i) => v === oldSchedule[i])) return { ...p, weeklySchedule: newSchedule };

    // Pin overrides for any past/today completed day whose resolved session would change,
    // so that schedule edits never retroactively alter completed workout records.
    const pCompletedDays = p.completedDays || {};
    const pProgramStart = p.programStart;
    const pOverrides = p.overrides || {};
    const pinnedOverrides = {};

    if (pProgramStart) {
      const todayS = todayStr();
      let cursor = pProgramStart;
      // Walk from program start up to and including today
      while (!isBefore(todayS, cursor)) {
        const dayData = pCompletedDays[cursor];
        const hasData = dayData && (
          dayData.allDone ||
          Object.values(dayData.checked || {}).some(Boolean) ||
          dayData.cardio
        );
        // Only pin days that have data and don't already have an explicit override
        if (hasData && pOverrides[cursor] === undefined) {
          const oldSession = resolvedSession(cursor, pProgramStart, pOverrides, oldSchedule);
          const newSession = resolvedSession(cursor, pProgramStart, pOverrides, newSchedule);
          if (oldSession !== newSession) {
            pinnedOverrides[cursor] = oldSession;
          }
        }
        cursor = addDays(cursor, 1);
      }
    }

    return {
      ...p,
      weeklySchedule: newSchedule,
      overrides: { ...pOverrides, ...pinnedOverrides },
    };
  });
  const setOverrides = (fn) => setData(p => ({
    ...p, overrides: typeof fn === 'function' ? fn(p.overrides || {}) : fn,
  }));
  const setStreakRestores = (fn) => setData(p => ({
    ...p, streakRestores: typeof fn === 'function' ? fn(p.streakRestores || {}) : fn,
  }));
  const setBodyMetrics = (fn) => setData(p => ({
    ...p, bodyMetrics: typeof fn === 'function' ? fn(p.bodyMetrics || {}) : fn,
  }));

  const handleRestoreDay = (dateStr) => {
    const monthKey = dateStr.slice(0, 7);
    const current = streakRestores[monthKey] || [];
    if (current.includes(dateStr) || current.length >= 5) return;
    setStreakRestores(prev => ({ ...prev, [monthKey]: [...(prev[monthKey] || []), dateStr] }));
  };

  // ── Plan management handlers ──────────────────────────────────────────────

  const handleAddPlan = (label, color) => {
    const newKey = generateUniqueKey(label, Object.keys(userPlans));
    setData(prev => ({
      ...prev,
      userPlans: {
        ...(prev.userPlans || initUserPlansFromLegacy(prev.customPlans || {})),
        [newKey]: { label: label.toUpperCase(), color, focus: '', exercises: [], defaultKey: null },
      },
    }));
  };

  const handleRenamePlan = (oldKey, newLabel) => {
    const newKey = generateUniqueKey(newLabel, Object.keys(userPlans).filter(k => k !== oldKey));
    setData(prev => renamePlanInData(
      { ...prev, userPlans: prev.userPlans || initUserPlansFromLegacy(prev.customPlans || {}) },
      oldKey, newKey, newLabel
    ));
  };

  const handleDeletePlan = async (planKey) => {
    const count = countCompletedSessionsForPlan(planKey, completedDays, programStart, overrides, weeklySchedule);
    const label = userPlans[planKey]?.label || planKey.toUpperCase();
    const msg = count > 0
      ? `${count} session${count !== 1 ? 's' : ''} logged under ${label}. Past data will be preserved but this plan will be removed from your schedule.`
      : `This cannot be undone.`;
    const ok = await confirm({ title: `Delete "${label}"?`, message: msg, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    setData(prev => deletePlanFromData(
      { ...prev, userPlans: prev.userPlans || initUserPlansFromLegacy(prev.customPlans || {}) },
      planKey, programStart
    ));
  };

  const handleUpdatePlanColor = (planKey, color) => {
    setUserPlans(prev => ({
      ...prev,
      [planKey]: { ...prev[planKey], color },
    }));
  };

  const handleUpdatePlanFocus = (planKey, focus) => {
    setUserPlans(prev => ({
      ...prev,
      [planKey]: { ...prev[planKey], focus },
    }));
  };

  // ── One-time migrations: customPlans → userPlans, seed weeklySchedule, and
  //    remap legacy default session colours to the new "apothecary" palette ──
  useEffect(() => {
    if (syncStatus !== 'synced') return;

    const basePlans = data.userPlans || initUserPlansFromLegacy(data.customPlans || {});
    const needsInit = !data.userPlans || !data.weeklySchedule;
    const needsRecolor = migrateDefaultPlanColors(basePlans) !== basePlans;
    if (!needsInit && !needsRecolor) return;

    setData(p => {
      const next = {
        ...p,
        userPlans: migrateDefaultPlanColors(p.userPlans || initUserPlansFromLegacy(p.customPlans || {})),
        weeklySchedule: p.weeklySchedule || [...DEFAULT_SCHEDULE],
      };
      // Clean up old key
      if (next.customPlans) delete next.customPlans;
      return next;
    });
  }, [syncStatus]);

  // Midnight check
  const runCheck = () => {
    if (!data.programStart) return;
    const { overrides: newOv, events } = applySmartGuard(
      data.programStart,
      data.completedDays,
      data.overrides,
      todayStr(),
      weeklySchedule
    );
    if (JSON.stringify(newOv) !== JSON.stringify(data.overrides)) {
      setData(p => ({ ...p, overrides: newOv }));
    }
    if (events.length > 0) setPendingAlertEvents(events);
  };

  const handleResetSchedule = async () => {
    const ok = await confirm({
      title: 'Reset schedule?',
      message: 'This removes all automatic shifts and recalculates your plan from your workout history. This cannot be undone.',
      confirmLabel: 'Reset',
      danger: true,
    });
    if (ok) {
      setData(prev => ({
        ...prev,
        overrides: {
          // Preserve manual overrides, clear automatic ones
          ...Object.fromEntries(Object.entries(prev.overrides).filter(([key]) => !key.startsWith('__'))),
          __processedUpTo: null,
          __shifts: [],
          __resumeFrom: null,
        },
      }));
      // Use a timeout to ensure the state update is processed before re-running the check
      setTimeout(() => runCheck(), 100);
      toast.success('Schedule has been reset!');
    }
  };

  useEffect(() => {
    if (syncStatus === 'synced' && programStart) {
      runCheck();
    }
  }, [syncStatus]);

  useEffect(() => {
    if (!programStart) return;
    const scheduleNext = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setDate(midnight.getDate() + 1);
      midnight.setHours(0, 0, 30, 0);
      midnightTimer.current = setTimeout(() => {
        runCheck();
        scheduleNext();
      }, midnight - now);
    };
    scheduleNext();
    return () => clearTimeout(midnightTimer.current);
  }, [programStart, data]);

  const handleUnlock = (username, phrase) => {
    const id = { username: username.trim(), passphrase: phrase.trim() };
    sessionStorage.setItem(IDENTITY_KEY, JSON.stringify(id));
    setIdentity(id);
  };

  const handleSelectDay = (dateStr) => {
    setSelectedDate(dateStr);
    if (activeTab === 'calendar') setActiveTab('today');
  };

  const handleSignOut = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      message: 'Your data stays saved in the cloud — sign back in with your passphrase anytime.',
      confirmLabel: 'Sign out',
    });
    if (!ok) return;
    sessionStorage.removeItem(IDENTITY_KEY);
    setIdentity(null);
  };

  const statusCfg = STATUS_CONFIG[syncStatus] || STATUS_CONFIG.synced;
  const todaySession = resolvedSession(today, programStart, overrides, weeklySchedule);
  const todayMeta = todaySession ? getPlanMeta(todaySession, userPlans) : null;

  if (!identity) {
    return showGate
      ? <PassphraseGate onUnlock={handleUnlock} onBack={() => setShowGate(false)} />
      : <LandingPage onGetStarted={() => setShowGate(true)} theme={theme} onToggleTheme={toggleTheme} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-body)' }}>

      {pendingAlertEvents.length > 0 && (
        <MissedAlert events={pendingAlertEvents} onDismiss={() => setPendingAlertEvents([])} />
      )}

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--header-bg)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 12px',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, gap: 8, minWidth: 0 }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexShrink: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 20, letterSpacing: 1, color: 'var(--primary)' }}>WORKOUT</span>
              <span style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 4, fontFamily: 'var(--font-mono)' }}>TRACKER</span>
            </div>
            {/* Today's session chip */}
            {todayMeta && todaySession !== 'rest' && todaySession !== 'missed' && (
              <div className="session-chip" style={{
                fontSize: 9, padding: '3px 10px', borderRadius: 20,
                background: todayMeta.dimColor, border: `1px solid ${todayMeta.borderColor}`,
                color: todayMeta.color, letterSpacing: 2, fontFamily: 'var(--font-mono)',
              }}>
                {todaySession.toUpperCase()}
              </div>
            )}
          </div>

          {/* Right controls */}
          <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* Sync status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon
                name={statusCfg.icon}
                size={12}
                color={statusCfg.color}
                style={{ animation: statusCfg.pulse ? 'pulse 1.2s infinite' : 'none' }}
              />
              <span className="sync-label" style={{ fontSize: 9, letterSpacing: 2, color: statusCfg.color, fontFamily: 'var(--font-mono)' }}>
                {statusCfg.label.toUpperCase()}
              </span>
            </div>

            <button className="today-btn" onClick={() => { setSelectedDate(today); setActiveTab('today'); }} style={{
              fontSize: 10, letterSpacing: 2, color: 'var(--muted-foreground)',
              background: 'var(--secondary)', border: '1px solid var(--border)',
              borderRadius: 20, padding: '5px 10px', cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
            }}>TODAY</button>

            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--secondary)', border: '1px solid var(--border)',
                color: 'var(--muted-foreground)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={13} />
            </button>

            <button onClick={handleSignOut} title="Sign out" aria-label="Sign out" style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--secondary)', border: '1px solid var(--border)',
              color: 'var(--muted-foreground)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="signOut" size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 56, zIndex: 99 }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex' }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} aria-current={active ? 'page' : undefined} style={{
                flex: 1, padding: '12px 4px', cursor: 'pointer',
                background: 'transparent', border: 'none',
                borderBottom: active ? `2px solid var(--primary)` : '2px solid transparent',
                color: active ? 'var(--primary)' : 'var(--muted-foreground)',
                fontSize: 9, letterSpacing: 2, fontFamily: 'var(--font-mono)', transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
                <Icon name={tab.icon} size={15} color={active ? 'var(--primary)' : 'var(--muted-foreground)'} />
                {tab.label.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Offline banner */}
      {syncStatus === 'offline' && (
        <div style={{
          background: 'rgba(181,74,53,0.08)', borderBottom: '1px solid rgba(181,74,53,0.2)',
          padding: '8px 20px', textAlign: 'center', fontSize: 11,
          color: 'var(--destructive)', letterSpacing: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          fontFamily: 'var(--font-mono)',
        }}>
          <Icon name="alertTriangle" size={12} color="var(--destructive)" />
          Offline — changes saved locally, syncing when reconnected
        </div>
      )}

      {/* Loading overlay */}
      {syncStatus === 'loading' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'var(--overlay-bg)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16,
        }}>
          <Icon name="refresh" size={28} color="var(--primary)" style={{ animation: 'pulse 1s infinite' }} />
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', letterSpacing: 3, fontFamily: 'var(--font-mono)' }}>LOADING YOUR LOG</div>
        </div>
      )}

      {/* Main */}
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 100px' }}>

        {/* TODAY */}
        {activeTab === 'today' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              {selectedDate !== today && (
                <button onClick={() => setSelectedDate(today)} style={{
                  fontSize: 10, letterSpacing: 2, color: 'var(--primary)',
                  background: 'var(--muted)', border: '1px solid var(--border)',
                  borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                }}>← TODAY</button>
              )}
            </div>
            <WorkoutTracker
              selectedDate={selectedDate}
              programStart={programStart}
              completedDays={completedDays}
              setCompletedDays={setCompletedDays}
              userPlans={userPlans}
              weeklySchedule={weeklySchedule}
              overrides={overrides}
            />
          </div>
        )}

        {/* CALENDAR */}
        {activeTab === 'calendar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Calendar
              programStart={programStart}
              setProgramStart={setProgramStart}
              completedDays={completedDays}
              onSelectDay={handleSelectDay}
              selectedDate={selectedDate}
              overrides={overrides}
              setOverrides={setOverrides}
              userPlans={userPlans}
              weeklySchedule={weeklySchedule}
              setWeeklySchedule={setWeeklySchedule}
            />
            {programStart && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px' }}>
                <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, marginBottom: 6, fontFamily: 'var(--font-mono)' }}>SCHEDULE</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 16, fontStyle: 'italic' }}>
                  5-day rotation · Each muscle 2× per week · Smart guard for travel &amp; illness
                </div>

                {(Object.keys(overrides).filter(k => !k.startsWith('__')).length > 0 ||
                  Object.values(userPlans).some(up => up.exercises !== null && up.exercises !== undefined)) && (
                  <div style={{
                    marginBottom: 16, padding: '10px 14px', borderRadius: 6,
                    background: 'rgba(166,124,82,0.08)', border: '1px solid rgba(166,124,82,0.2)',
                    fontSize: 12, color: 'var(--primary)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                      {Object.keys(overrides).filter(k => !k.startsWith('__')).length} adjustment{Object.keys(overrides).filter(k => !k.startsWith('__')).length !== 1 ? 's' : ''} active
                    </span>
                    <button
                      onClick={async () => {
                        if (await confirm({ title: 'Clear adjustments?', message: 'Remove all missed-workout schedule adjustments?', confirmLabel: 'Clear' })) {
                          setOverrides(prev => clearAllMissedAdjustments(prev));
                        }
                      }}
                      style={{
                        fontSize: 9, color: 'var(--primary)', background: 'none',
                        border: '1px solid var(--border)', borderRadius: 20,
                        padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: 1,
                      }}
                    >CLEAR MISSED</button>
                    <button
                      onClick={async () => {
                        if (await confirm({ title: 'Clear custom workouts?', message: 'Reset all plans to their default exercises?', confirmLabel: 'Clear' })) {
                          setUserPlans(prev => clearAllCustomWorkouts(prev));
                        }
                      }}
                      style={{
                        fontSize: 9, color: 'var(--primary)', background: 'none',
                        border: '1px solid var(--border)', borderRadius: 20,
                        padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: 1,
                      }}
                    >CLEAR CUSTOM</button>
                  </div>
                )}

                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.8, marginBottom: 16 }}>
                  Long-press any calendar date to swap a workout to rest, mark it missed, or restore.
                </div>

                <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text)', fontStyle: 'italic' }}>
                    Started {new Date(programStart + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                  <button onClick={handleResetSchedule} title="Reset Schedule" style={{
                    fontSize: 9, letterSpacing: 2, color: 'var(--destructive)',
                    background: 'rgba(181,74,53,0.06)', border: '1px solid rgba(181,74,53,0.25)',
                    borderRadius: 20, padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--font-mono)',
                  }}>RESET PROGRAM</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* EDIT */}
        {activeTab === 'edit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{
              background: 'rgba(166,124,82,0.06)', border: '1px solid rgba(166,124,82,0.2)',
              borderRadius: 8, padding: '16px 20px',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', marginBottom: 6 }}>Customise Your Plan</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.7 }}>
                Edit exercises, paste a text list, or load a .txt file. Changes apply to future sessions — past logs are never touched.
              </div>
            </div>
            <PlanEditor
              userPlans={userPlans}
              setUserPlans={setUserPlans}
              weeklySchedule={weeklySchedule}
              setWeeklySchedule={setWeeklySchedule}
              programStart={programStart}
              onAddPlan={handleAddPlan}
              onRenamePlan={handleRenamePlan}
              onDeletePlan={handleDeletePlan}
              onUpdatePlanColor={handleUpdatePlanColor}
              onUpdatePlanFocus={handleUpdatePlanFocus}
            />
          </div>
        )}

        {/* PROGRESS */}
        {activeTab === 'progress' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Stats
              completedDays={completedDays}
              programStart={programStart}
              overrides={overrides}
              streakRestores={streakRestores}
              onRestoreDay={handleRestoreDay}
              userPlans={userPlans}
              weeklySchedule={weeklySchedule}
            />
            <Charts completedDays={completedDays} userPlans={userPlans} bodyMetrics={bodyMetrics} />
            <BodyMetrics bodyMetrics={bodyMetrics} setBodyMetrics={setBodyMetrics} />
            <Progression programStart={programStart} completedDays={completedDays} overrides={overrides} userPlans={userPlans} />
          </div>
        )}

      </main>

      {activeTab === 'today' && <RestTimer sessionColor={todayMeta?.color} />}
    </div>
  );
}
