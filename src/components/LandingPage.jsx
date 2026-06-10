/**
 * LandingPage — public marketing page shown to logged-out visitors.
 *
 * Aesthetic: "Training Almanac" — an editorial, field-journal extension of the
 * app's coffee/apothecary system. Serif headlines, mono labels, ruled dividers,
 * and the PPL rotation rendered as a strip of earth-toned day-chips (the
 * memorable anchor). Fully theme-aware and responsive via fluid grids.
 *
 * Props:
 *   onGetStarted()   — open the sign-in/sign-up gate
 *   theme            — 'light' | 'dark' (from the shared useTheme in App)
 *   onToggleTheme()  — flip the theme
 */
import { useRef } from 'react';
import { Icon } from './Icons';
import { SESSION_META, DEFAULT_SCHEDULE } from '../data/workouts';

const FEATURES = [
  {
    icon: 'swap', color: '#b86a3c',
    title: 'Schedules around your life',
    body: 'Miss a session? It quietly shifts the plan forward. Travel or illness for days? A smart guard pauses the rotation and resumes you cleanly — no endless drift.',
  },
  {
    icon: 'trophy', color: '#8c5a72',
    title: 'Every rep, every PR',
    body: 'Log weight × reps per set. The moment you beat a personal best — max weight, estimated 1RM, reps, or session volume — it tells you, right on the card.',
  },
  {
    icon: 'edit', color: '#4e7d76',
    title: 'Make the plan yours',
    body: 'Rename plans, pick their colours, reorder exercises, or paste your own list. Build a custom weekly rotation that fits how you actually train.',
  },
  {
    icon: 'shield', color: '#7c7a46',
    title: 'Private by design',
    body: 'No email, no profile. Your log is encrypted on your device with your username and passphrase before it ever syncs. We literally cannot read it.',
  },
];

const STEPS = [
  { n: '01', title: 'Pick a username + passphrase', body: 'No sign-up forms. Choose a pair you’ll remember — your encrypted log is created the instant you open it.' },
  { n: '02', title: 'Follow your rotation', body: 'Push, Pull, Legs and rest, sequenced so every muscle gets trained twice a week. Today’s session is always one tap away.' },
  { n: '03', title: 'Log sets, beat PRs', body: 'Tick exercises off, record your sets, and watch your streak and personal records climb across every device.' },
];

export default function LandingPage({ onGetStarted, theme, onToggleTheme }) {
  const howRef = useRef(null);
  const scrollToHow = () => howRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const wrap = { maxWidth: 1080, margin: '0 auto', padding: '0 24px', width: '100%', boxSizing: 'border-box' };
  const eyebrow = { fontSize: 10, letterSpacing: 4, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' };
  const serifH = { fontFamily: 'var(--font-serif)', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.1, letterSpacing: 0.3 };

  const primaryBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    background: 'var(--primary)', color: 'var(--primary-foreground)',
    border: 'none', borderRadius: 6, padding: '14px 24px', cursor: 'pointer',
    fontSize: 11, fontWeight: 700, letterSpacing: 2, fontFamily: 'var(--font-mono)',
  };
  const ghostBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    background: 'transparent', color: 'var(--foreground)',
    border: '1px solid var(--border)', borderRadius: 6, padding: '14px 22px', cursor: 'pointer',
    fontSize: 11, fontWeight: 700, letterSpacing: 2, fontFamily: 'var(--font-mono)',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-body)' }}>

      {/* ── Nav ─────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--header-bg)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 20, letterSpacing: 1, color: 'var(--primary)' }}>WORKOUT</span>
            <span style={{ fontSize: 8, color: 'var(--muted-foreground)', letterSpacing: 4, fontFamily: 'var(--font-mono)' }}>TRACKER</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              style={{
                width: 32, height: 32, borderRadius: '50%', background: 'var(--secondary)',
                border: '1px solid var(--border)', color: 'var(--muted-foreground)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={14} />
            </button>
            <button onClick={onGetStarted} style={{
              background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none',
              borderRadius: 20, padding: '8px 16px', cursor: 'pointer',
              fontSize: 10, fontWeight: 700, letterSpacing: 2, fontFamily: 'var(--font-mono)',
            }}>OPEN LOG</button>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section style={{ ...wrap, paddingTop: 'clamp(56px, 10vw, 110px)', paddingBottom: 'clamp(40px, 7vw, 80px)', textAlign: 'center' }}>
        <div style={{ ...eyebrow, marginBottom: 20, animation: 'fadeIn 0.5s ease both' }}>
          Science-based · Push / Pull / Legs
        </div>
        <h1 style={{ ...serifH, fontSize: 'clamp(38px, 7vw, 68px)', maxWidth: 760, margin: '0 auto 22px', animation: 'fadeIn 0.5s ease 0.05s both' }}>
          Train with intent.<br />
          <span style={{ color: 'var(--primary)' }}>Track every rep.</span>
        </h1>
        <p style={{ fontSize: 'clamp(14px, 2.2vw, 17px)', color: 'var(--muted-foreground)', maxWidth: 540, margin: '0 auto 32px', lineHeight: 1.7, animation: 'fadeIn 0.5s ease 0.1s both' }}>
          A focused workout log built on a proven rotation — each muscle trained twice a week, your sessions rescheduled when life happens, and every personal record caught automatically.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', animation: 'fadeIn 0.5s ease 0.15s both' }}>
          <button onClick={onGetStarted} style={primaryBtn}>
            OPEN YOUR LOG <Icon name="arrowRight" size={13} color="var(--primary-foreground)" />
          </button>
          <button onClick={scrollToHow} style={ghostBtn}>HOW IT WORKS</button>
        </div>

        {/* Rotation strip — the visual anchor */}
        <div style={{ marginTop: 'clamp(44px, 8vw, 76px)', animation: 'fadeIn 0.6s ease 0.2s both' }}>
          <div style={{ ...eyebrow, marginBottom: 12 }}>The weekly rotation</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 620, margin: '0 auto' }}>
            {DEFAULT_SCHEDULE.map((key, i) => {
              const m = SESSION_META[key] || {};
              const rest = key === 'rest';
              return (
                <div key={i} style={{
                  flex: '1 1 64px', minWidth: 64, padding: '14px 8px', borderRadius: 8,
                  background: rest ? 'var(--muted)' : `${m.color}14`,
                  border: `1px solid ${rest ? 'var(--border)' : `${m.color}40`}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 8, color: 'var(--muted-foreground)', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>D{i + 1}</span>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: rest ? 'var(--border)' : m.color }} />
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, fontFamily: 'var(--font-mono)', color: rest ? 'var(--muted-foreground)' : m.color }}>
                    {(m.label || key).toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 14, fontStyle: 'italic' }}>
            Each muscle group hit exactly twice a week — the frequency the research favours.
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ ...wrap, padding: 'clamp(48px, 8vw, 84px) 24px' }}>
          <div style={{ ...eyebrow, marginBottom: 10 }}>What you get</div>
          <h2 style={{ ...serifH, fontSize: 'clamp(26px, 4vw, 38px)', maxWidth: 560, marginBottom: 40 }}>
            Everything a serious log needs. Nothing it doesn’t.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: `${f.color}18`, border: `1px solid ${f.color}38`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name={f.icon} size={18} color={f.color} />
                </div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 17, color: 'var(--foreground)' }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.7 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section ref={howRef} style={{ ...wrap, padding: 'clamp(48px, 8vw, 84px) 24px' }}>
        <div style={{ ...eyebrow, marginBottom: 10 }}>How it works</div>
        <h2 style={{ ...serifH, fontSize: 'clamp(26px, 4vw, 38px)', maxWidth: 520, marginBottom: 40 }}>
          From zero to logging in under a minute.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 28 }}>
          {STEPS.map(s => (
            <div key={s.n} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 30, fontWeight: 500, color: 'var(--primary)', opacity: 0.85 }}>{s.n}</div>
              <div style={{ height: 1, background: 'var(--border)', width: 40 }} />
              <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 18, color: 'var(--foreground)' }}>{s.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.7 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Privacy band ────────────────────────────────────── */}
      <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ ...wrap, padding: 'clamp(44px, 7vw, 72px) 24px', display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, flexShrink: 0,
            background: 'rgba(138,90,46,0.12)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="lock" size={24} color="var(--primary)" />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ ...eyebrow, marginBottom: 8 }}>Yours alone</div>
            <h2 style={{ ...serifH, fontSize: 'clamp(22px, 3.4vw, 30px)', marginBottom: 10 }}>
              End-to-end encrypted. No account required.
            </h2>
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)', lineHeight: 1.7, maxWidth: 620 }}>
              Your training data is encrypted with AES-GCM in your browser, keyed to your username and passphrase, before it’s ever stored. There’s no email, no tracking, and no way for us to read your log — only you hold the key.
            </p>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────── */}
      <section style={{ ...wrap, padding: 'clamp(56px, 9vw, 100px) 24px', textAlign: 'center' }}>
        <h2 style={{ ...serifH, fontSize: 'clamp(30px, 5vw, 50px)', maxWidth: 640, margin: '0 auto 18px' }}>
          Your next session is already planned.
        </h2>
        <p style={{ fontSize: 15, color: 'var(--muted-foreground)', maxWidth: 480, margin: '0 auto 30px', lineHeight: 1.7 }}>
          Open your log, pick today’s session, and start lifting. It’s free, and it works offline.
        </p>
        <button onClick={onGetStarted} style={{ ...primaryBtn, padding: '16px 30px', fontSize: 12 }}>
          OPEN YOUR LOG <Icon name="arrowRight" size={14} color="var(--primary-foreground)" />
        </button>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{ ...wrap, padding: '28px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 16, letterSpacing: 1, color: 'var(--primary)' }}>WORKOUT</span>
            <span style={{ fontSize: 7, color: 'var(--muted-foreground)', letterSpacing: 4, fontFamily: 'var(--font-mono)' }}>TRACKER</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted-foreground)', letterSpacing: 1.5, fontFamily: 'var(--font-mono)' }}>
            ENCRYPTED · OFFLINE-READY · FREE
          </div>
        </div>
      </footer>
    </div>
  );
}
