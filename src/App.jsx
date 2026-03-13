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
import PassphraseGate from './components/PassphraseGate';
import Calendar from './components/Calendar';
import WorkoutTracker from './components/WorkoutTracker';
import Stats from './components/Stats';
import Progression from './components/Progression';
import PlanEditor from './components/PlanEditor';
import MissedAlert from './components/MissedAlert';
import RestTimer from './components/RestTimer';
import { Icon } from './components/Icons';
import { loadFromSupabase } from './lib/supabase';
import { applySmartGuard, todayStr, resolvedSession } from './lib/scheduler';
import { SESSION_META } from './data/workouts';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'today',    label: 'Today',    icon: 'zap' },
  { id: 'calendar', label: 'Plan',     icon: 'calendar' },
  { id: 'edit',     label: 'Edit',     icon: 'edit' },
  { id: 'progress', label: 'Progress', icon: 'barChart' },
];

const PASSPHRASE_KEY = 'ppl-passphrase';

const STATUS_CONFIG = {
  loading: { label: 'Syncing',  color: 'var(--muted-foreground)', icon: 'refresh' },
  synced:  { label: 'Synced',   color: '#2c6e7a',                 icon: 'cloudSync' },
  saving:  { label: 'Saving',   color: 'var(--chart-1)',          icon: 'refresh',  pulse: true },
  offline: { label: 'Offline',  color: 'var(--destructive)',       icon: 'cloudOff' },
  error:   { label: 'Error',    color: 'var(--destructive)',       icon: 'alertTriangle' },
};

export default function App() {
  const [passphrase, setPassphrase] = useState(() => {
    try { return localStorage.getItem(PASSPHRASE_KEY) || null; } catch { return null; }
  });
  const [activeTab, setActiveTab] = useState('today');
  const [pendingAlertEvents, setPendingAlertEvents] = useState([]);
  const midnightTimer = useRef(null);
  const { data, setData, syncStatus } = useSyncedData(passphrase);

  const today = todayStr();
  const selectedDate  = data.selectedDate  || today;
  const programStart  = data.programStart  || null;
  const completedDays = data.completedDays || {};
  const customPlans   = data.customPlans   || {};
  const overrides     = data.overrides     || {};

  const setSelectedDate  = (d)  => setData(p => ({ ...p, selectedDate: d }));
  const setProgramStart  = (d)  => setData(p => ({ ...p, programStart: d }));
  const setCompletedDays = (fn) => setData(p => ({
    ...p, completedDays: typeof fn === 'function' ? fn(p.completedDays || {}) : fn,
  }));
  const setCustomPlans = (fn) => setData(p => ({
    ...p, customPlans: typeof fn === 'function' ? fn(p.customPlans || {}) : fn,
  }));
  const setOverrides = (fn) => setData(p => ({
    ...p, overrides: typeof fn === 'function' ? fn(p.overrides || {}) : fn,
  }));

  // Midnight check
  const runCheck = () => {
    if (!data.programStart) return;
    const { overrides: newOv, events } = applySmartGuard(
      data.programStart,
      data.completedDays,
      data.overrides,
      todayStr()
    );
    if (JSON.stringify(newOv) !== JSON.stringify(data.overrides)) {
      setData(p => ({ ...p, overrides: newOv }));
    }
    if (events.length > 0) setPendingAlertEvents(events);
  };

  const handleResetSchedule = () => {
    if (window.confirm('Are you sure you want to reset your schedule? This will remove all automatic shifts and recalculate your plan from your workout history. This cannot be undone.')) {
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

  const handleUnlock = async (phrase) => {
    await loadFromSupabase(phrase);
    localStorage.setItem(PASSPHRASE_KEY, phrase);
    setPassphrase(phrase);
  };

  const handleSelectDay = (dateStr) => {
    setSelectedDate(dateStr);
    if (activeTab === 'calendar') setActiveTab('today');
  };

  const handleSignOut = () => {
    if (confirm('Sign out? Your data stays saved in the cloud.')) {
      localStorage.removeItem(PASSPHRASE_KEY);
      setPassphrase(null);
    }
  };

  const statusCfg = STATUS_CONFIG[syncStatus] || STATUS_CONFIG.synced;
  const todaySession = resolvedSession(today, programStart, overrides);
  const todayMeta = todaySession ? SESSION_META[todaySession] : null;

  if (!passphrase) return <PassphraseGate onUnlock={handleUnlock} />;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-body)' }}>

      {pendingAlertEvents.length > 0 && (
        <MissedAlert events={pendingAlertEvents} onDismiss={() => setPendingAlertEvents([])} />
      )}

      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(245,241,230,0.94)', backdropFilter: 'blur(16px)',
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
              <div style={{
                fontSize: 9, padding: '3px 10px', borderRadius: 20,
                background: todayMeta.dimColor, border: `1px solid ${todayMeta.borderColor}`,
                color: todayMeta.color, letterSpacing: 2, fontFamily: 'var(--font-mono)',
              }}>
                {todaySession.toUpperCase()}
              </div>
            )}
          </div>

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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

            <button onClick={() => { setSelectedDate(today); setActiveTab('today'); }} style={{
              fontSize: 10, letterSpacing: 2, color: 'var(--muted-foreground)',
              background: 'var(--secondary)', border: '1px solid var(--border)',
              borderRadius: 20, padding: '5px 10px', cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
            }}>TODAY</button>

            <button onClick={handleSignOut} title="Sign out" style={{
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
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
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
          background: 'rgba(245,241,230,0.9)', backdropFilter: 'blur(8px)',
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
              customPlans={customPlans}
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
            />
            {programStart && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px' }}>
                <div style={{ fontSize: 9, color: 'var(--muted-foreground)', letterSpacing: 3, marginBottom: 6, fontFamily: 'var(--font-mono)' }}>SCHEDULE</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 16, fontStyle: 'italic' }}>
                  5-day rotation · Each muscle 2× per week · Smart guard for travel &amp; illness
                </div>

                {Object.keys(overrides).filter(k => !k.startsWith('__')).length > 0 && (
                  <div style={{
                    marginBottom: 16, padding: '10px 14px', borderRadius: 6,
                    background: 'rgba(166,124,82,0.08)', border: '1px solid rgba(166,124,82,0.2)',
                    fontSize: 12, color: 'var(--primary)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                      {Object.keys(overrides).filter(k => !k.startsWith('__')).length} adjustment{Object.keys(overrides).filter(k => !k.startsWith('__')).length > 1 ? 's' : ''} active
                    </span>
                    <button
                      onClick={() => {
                        if (confirm('Clear all schedule adjustments?')) {
                          setOverrides(prev => ({
                            // Preserve the watermark so the scheduler doesn't re-evaluate historical dates
                            ...(prev.__processedUpTo ? { __processedUpTo: prev.__processedUpTo } : {}),
                          }));
                        }
                      }}
                      style={{
                        fontSize: 9, color: 'var(--primary)', background: 'none',
                        border: '1px solid var(--border)', borderRadius: 20,
                        padding: '4px 10px', cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: 1,
                      }}
                    >CLEAR ALL</button>
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
            <PlanEditor customPlans={customPlans} setCustomPlans={setCustomPlans} />
          </div>
        )}

        {/* PROGRESS */}
        {activeTab === 'progress' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Stats completedDays={completedDays} programStart={programStart} overrides={overrides} />
            <Progression programStart={programStart} />
          </div>
        )}

      </main>

      {activeTab === 'today' && <RestTimer sessionColor={todayMeta?.color} />}
    </div>
  );
}
