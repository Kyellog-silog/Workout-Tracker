/**
 * RestTimer component.
 *
 * Floating action button (FAB) that expands into a rest timer panel.
 * Features:
 * - Preset durations: 30s, 60s, 90s, 2m, 3m
 * - Circular SVG progress ring
 * - Play, pause, and reset controls
 * - Audio beep (Web Audio API) on completion
 * - Pointer-based drag repositioning across the viewport
 * - Auto-opens when the timer finishes
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from './Icons';

const PRESETS = [
  { label: '30s', seconds: 30 },
  { label: '60s', seconds: 60 },
  { label: '90s', seconds: 90 },
  { label: '2m',  seconds: 120 },
  { label: '3m',  seconds: 180 },
];

const FAB_SIZE = 48;
const PANEL_W = 200;
const PANEL_H = 310; // approx expanded height
const DRAG_THRESHOLD = 6;

export default function RestTimer({ sessionColor = 'var(--primary)' }) {
  const [open, setOpen] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(90);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Drag state — null means "use CSS right/bottom default", otherwise {x,y} = top-left
  const [pos, setPos] = useState(null);           // FAB position when collapsed
  const [panelPos, setPanelPos] = useState(null); // Panel position when expanded
  const dragRef = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0, moved: false });
  const elRef = useRef(null);

  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  const vpW = () => document.documentElement.clientWidth;
  const vpH = () => document.documentElement.clientHeight;

  /** Place the panel so it always opens toward the page center from the FAB. */
  const computePanelPos = useCallback((fabPos) => {
    const w = vpW(), h = vpH();
    const fabX = fabPos ? fabPos.x : w - 16 - FAB_SIZE; // mirrors CSS right:16
    const fabY = fabPos ? fabPos.y : h - 90 - FAB_SIZE; // mirrors CSS bottom:90
    const cx = fabX + FAB_SIZE / 2;
    const cy = fabY + FAB_SIZE / 2;
    // FAB right of center → align panel's right edge with FAB's right (panel opens left)
    const panelX = cx > w / 2 ? fabX + FAB_SIZE - PANEL_W : fabX;
    // FAB below center → align panel's bottom edge with FAB's bottom (panel opens up)
    const panelY = cy > h / 2 ? fabY + FAB_SIZE - PANEL_H : fabY;
    return {
      x: clamp(panelX, 8, w - PANEL_W - 8),
      y: clamp(panelY, 8, h - PANEL_H - 8),
    };
  }, []);

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    let currentPos = open ? panelPos : pos;
    if (!currentPos && elRef.current) {
      const rect = elRef.current.getBoundingClientRect();
      currentPos = { x: rect.left, y: rect.top };
      if (open) setPanelPos(currentPos); else setPos(currentPos);
    }
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: currentPos?.x ?? 0,
      origY: currentPos?.y ?? 0,
      moved: false,
    };
  }, [pos, panelPos, open]);

  const onPointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    const w = open ? PANEL_W : FAB_SIZE;
    const h = open ? PANEL_H : FAB_SIZE;
    const newPos = {
      x: clamp(d.origX + dx, 0, vpW() - w),
      y: clamp(d.origY + dy, 0, vpH() - h),
    };
    if (open) setPanelPos(newPos); else setPos(newPos);
  }, [open]);

  const onPointerUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Countdown logic
  useEffect(() => {
    if (!running || remaining <= 0) return;
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearTimer();
          setRunning(false);
          setFinished(true);
          playBeep();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return clearTimer;
  }, [running, clearTimer]);

  // Auto-open when finished
  useEffect(() => {
    if (finished) {
      setPanelPos(computePanelPos(pos));
      setOpen(true);
    }
  }, [finished]);

  const playBeep = () => {
    try {
      const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      // Three short beeps
      [0, 0.2, 0.4].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.value = 0.3;
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.12);
      });
    } catch { /* silent fallback */ }
  };

  const start = () => {
    setFinished(false);
    if (remaining > 0) {
      setRunning(true);
    } else {
      setRemaining(totalSeconds);
      setRunning(true);
    }
  };

  const pause = () => {
    clearTimer();
    setRunning(false);
  };

  const reset = () => {
    clearTimer();
    setRunning(false);
    setFinished(false);
    setRemaining(0);
  };

  const selectPreset = (secs) => {
    clearTimer();
    setRunning(false);
    setFinished(false);
    setTotalSeconds(secs);
    setRemaining(secs);
    // Auto-start on preset tap
    setTimeout(() => setRunning(true), 0);
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = totalSeconds > 0 ? remaining / totalSeconds : 0;

  // SVG circle props for progress ring
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const isActive = running || remaining > 0;

  return (
    <>
      {/* Collapsed FAB */}
      {!open && (
        <button
          ref={elRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => {
            const wasDrag = dragRef.current.moved;
            onPointerUp(e);
            if (!wasDrag) {
              setPanelPos(computePanelPos(pos));
              setOpen(true);
            }
          }}
          aria-label="Open rest timer"
          className="rest-timer-fab"
          style={{
            position: 'fixed',
            ...(pos ? { left: pos.x, top: pos.y } : { right: 16, bottom: 90 }),
            zIndex: 150,
            width: FAB_SIZE,
            height: FAB_SIZE,
            borderRadius: '50%',
            background: isActive ? sessionColor : 'var(--surface)',
            border: `1.5px solid ${isActive ? sessionColor : 'var(--border)'}`,
            color: isActive ? '#fff' : 'var(--muted-foreground)',
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(50,35,20,0.15)',
            transition: dragRef.current.moved ? 'none' : 'all 0.2s',
            animation: finished ? 'timerPulse 0.6s ease infinite' : 'none',
            touchAction: 'none',
          }}
        >
          {isActive ? (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>
              {mins}:{secs.toString().padStart(2, '0')}
            </span>
          ) : (
            <Icon name="timer" size={20} />
          )}
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div
          ref={elRef}
          className="rest-timer-panel"
          style={{
            position: 'fixed',
            ...(panelPos ? { left: panelPos.x, top: panelPos.y } : { right: 16, bottom: 90 }),
            zIndex: 150,
            width: PANEL_W,
            background: 'var(--surface)',
            border: `1px solid ${finished ? sessionColor : 'var(--border)'}`,
            borderRadius: 12,
            boxShadow: '0 4px 24px rgba(50,35,20,0.15)',
            animation: 'timerSlideIn 0.2s ease',
            overflow: 'hidden',
          }}
        >
          {/* Header — drag handle */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px 8px',
              borderBottom: '1px solid var(--border)',
              cursor: 'grab',
              touchAction: 'none',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <Icon name="timer" size={12} color={sessionColor} />
              <span style={{
                fontSize: 9,
                letterSpacing: 3,
                fontFamily: 'var(--font-mono)',
                color: 'var(--muted-foreground)',
              }}>REST TIMER</span>
            </div>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={() => setOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted-foreground)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                position: 'relative',
                zIndex: 2,
              }}
            >
              <Icon name="x" size={14} />
            </button>
          </div>

          {/* Timer display */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '16px 14px 12px',
          }}>
            {/* Circular progress */}
            <div style={{ position: 'relative', width: 84, height: 84, marginBottom: 12 }}>
              <svg width={84} height={84} style={{ transform: 'rotate(-90deg)' }}>
                <circle
                  cx={42} cy={42} r={radius}
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth={3}
                />
                <circle
                  cx={42} cy={42} r={radius}
                  fill="none"
                  stroke={finished ? 'var(--destructive)' : sessionColor}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  style={{ transition: 'stroke-dashoffset 0.3s linear' }}
                />
              </svg>
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 22,
                  fontWeight: 600,
                  color: finished ? 'var(--destructive)' : 'var(--foreground)',
                  letterSpacing: 1,
                  animation: finished ? 'timerPulse 0.6s ease infinite' : 'none',
                }}>
                  {mins}:{secs.toString().padStart(2, '0')}
                </span>
                {finished && (
                  <span style={{
                    fontSize: 8,
                    letterSpacing: 2,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--destructive)',
                    marginTop: 2,
                  }}>GO!</span>
                )}
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {!running ? (
                <button
                  onClick={start}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: sessionColor, border: 'none',
                    color: '#fff', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'opacity 0.15s',
                  }}
                >
                  <Icon name="play" size={14} color="#fff" strokeWidth={2} />
                </button>
              ) : (
                <button
                  onClick={pause}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'var(--muted)', border: '1px solid var(--border)',
                    color: 'var(--foreground)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon name="pause" size={14} strokeWidth={2} />
                </button>
              )}
              {(remaining > 0 || finished) && (
                <button
                  onClick={reset}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'var(--muted)', border: '1px solid var(--border)',
                    color: 'var(--muted-foreground)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon name="undo" size={14} strokeWidth={2} />
                </button>
              )}
            </div>

            {/* Presets */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 5,
              justifyContent: 'center',
            }}>
              {PRESETS.map(p => {
                const active = totalSeconds === p.seconds && !finished;
                return (
                  <button
                    key={p.seconds}
                    onClick={() => selectPreset(p.seconds)}
                    style={{
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: 1,
                      padding: '4px 10px',
                      borderRadius: 20,
                      border: `1px solid ${active ? sessionColor : 'var(--border)'}`,
                      background: active ? `${sessionColor}18` : 'var(--muted)',
                      color: active ? sessionColor : 'var(--muted-foreground)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
