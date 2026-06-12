/**
 * PassphraseGate component.
 *
 * Login screen that accepts a user passphrase. On first use, a new record
 * is created in Supabase. On subsequent uses, existing data is loaded.
 * The passphrase never leaves the device in raw form: a PBKDF2-derived
 * lookup key locates the row and an AES-GCM key (also passphrase-derived)
 * encrypts the payload (see lib/crypto.js). The raw value is held in
 * localStorage so the session persists across browser restarts.
 */
import { useState } from 'react';
import { Icon } from './Icons';

// A handful of obviously-guessable phrases. Because the passphrase is BOTH the
// row lookup key and the encryption key, a weak/common phrase means another user
// (or an attacker who dumped the table) can land on — and decrypt — your data.
const COMMON_PHRASES = new Set([
  'password', 'passphrase', '12345678', '123456789', 'qwerty', 'letmein',
  'workout', 'fitness', 'iron-bear-morning', 'test', 'admin', 'hello',
]);

/**
 * Rough, non-blocking strength estimate for the passphrase.
 * Returns { score: 0-3, label, color }. Mirrors the crypto normalisation
 * (trim + lowercase) so the warning reflects what actually gets stored.
 */
function assessPhrase(raw) {
  const p = raw.trim().toLowerCase();
  if (!p) return null;
  const words = p.split(/[\s-]+/).filter(Boolean);
  if (p.length < 8 || COMMON_PHRASES.has(p)) {
    return { score: 0, label: 'WEAK — easy to guess', color: 'var(--destructive)' };
  }
  if (p.length < 12 || words.length < 2) {
    return { score: 1, label: 'FAIR — add more words', color: '#b8860b' };
  }
  if (words.length < 3 || p.length < 18) {
    return { score: 2, label: 'GOOD', color: '#8d6e4c' };
  }
  return { score: 3, label: 'STRONG', color: '#5c7a5c' };
}

export default function PassphraseGate({ onUnlock, onBack }) {
  const [username, setUsername] = useState('');
  const [phrase, setPhrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const strength = assessPhrase(phrase);
  const ready = !!(username.trim() && phrase.trim());

  const handleSubmit = async () => {
    if (!ready) return;
    setLoading(true);
    setError('');
    try {
      await onUnlock(username.trim(), phrase.trim());
    } catch {
      setError('Could not connect. Check your internet connection.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--background)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: 'var(--font-body)',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted-foreground)', fontSize: 10, letterSpacing: 2,
              fontFamily: 'var(--font-mono)', padding: 4,
            }}
          >
            <Icon name="chevronLeft" size={13} /> BACK
          </button>
        )}
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 700,
            fontSize: 40,
            letterSpacing: 4,
            color: 'var(--primary)',
            lineHeight: 1,
          }}>WORKOUT</div>
          <div style={{
            fontSize: 9,
            color: 'var(--muted-foreground)',
            letterSpacing: 8,
            marginTop: 8,
            fontFamily: 'var(--font-mono)',
          }}>TRACKER</div>
          {/* Divider */}
          <div style={{
            width: 48, height: 1, background: 'var(--border)',
            margin: '16px auto 0',
          }} />
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '32px 28px',
          boxShadow: 'var(--shadow-md)',
        }}>
          <div style={{ fontSize: 14, color: 'var(--foreground)', marginBottom: 6, fontWeight: 700 }}>
            Sign in to your log
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 24, lineHeight: 1.7 }}>
            Your username and passphrase together unlock your data. First time? Pick any pair you'll remember — your log is created instantly.
          </div>

          {/* Username */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--muted)', border: `1px solid ${error ? 'rgba(181,74,53,0.6)' : 'var(--border)'}`,
              borderRadius: 4, padding: '0 12px', transition: 'border-color 0.2s',
            }}>
              <Icon name="user" size={14} color="var(--muted-foreground)" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="username"
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: 'var(--foreground)', fontSize: 14,
                  padding: '12px 0', fontFamily: 'var(--font-mono)',
                }}
              />
            </div>
          </div>

          {/* Passphrase */}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--muted)', border: `1px solid ${error ? 'rgba(181,74,53,0.6)' : 'var(--border)'}`,
              borderRadius: 4, padding: '0 12px', transition: 'border-color 0.2s',
            }}>
              <Icon name="lock" size={14} color="var(--muted-foreground)" />
              <input
                type={show ? 'text' : 'password'}
                value={phrase}
                onChange={e => setPhrase(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="passphrase"
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: 'var(--foreground)', fontSize: 14,
                  padding: '12px 0',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: show ? 0 : 2,
                }}
              />
              <button
                onClick={() => setShow(s => !s)}
                style={{
                  background: 'none', border: 'none', color: 'var(--muted-foreground)',
                  cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
                }}
              >
                <Icon name={show ? 'eyeOff' : 'eye'} size={15} />
              </button>
            </div>
          </div>

          {/* Strength meter — guidance only, never blocks submission */}
          {strength && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    flex: 1, height: 3, borderRadius: 2,
                    background: i < strength.score ? strength.color : 'var(--border)',
                    transition: 'background 0.2s',
                  }} />
                ))}
              </div>
              <div style={{ fontSize: 10, color: strength.color, letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>
                {strength.label}
              </div>
            </div>
          )}

          {error && (
            <div style={{
              fontSize: 11, color: 'var(--destructive)', marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)',
            }}>
              <Icon name="alertTriangle" size={11} color="var(--destructive)" />
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !ready}
            style={{
              width: '100%', padding: '13px',
              borderRadius: 4,
              background: loading || !ready ? 'var(--accent)' : 'var(--primary)',
              border: 'none',
              color: loading || !ready ? 'var(--muted-foreground)' : '#fff',
              fontSize: 11, fontWeight: 700, letterSpacing: 3,
              cursor: loading || !ready ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', fontFamily: 'var(--font-mono)',
            }}
          >
            {loading ? 'CONNECTING...' : 'OPEN LOG'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 10, color: 'var(--muted-foreground)', lineHeight: 1.8, fontFamily: 'var(--font-mono)' }}>
          Your username + passphrase encrypt your log before it leaves the device.<br />
          We never see them — pick a pair no one else would, and don't lose either.
        </div>
      </div>
    </div>
  );
}
