/**
 * PassphraseGate component.
 *
 * Login screen that accepts a user passphrase. On first use, a new record
 * is created in Supabase. On subsequent uses, existing data is loaded.
 * The passphrase is hashed (SHA-256) before being sent to the server;
 * the raw value is only stored in the browser's localStorage for
 * session persistence.
 */
import { useState } from 'react';
import { Icon } from './Icons';

export default function PassphraseGate({ onUnlock }) {
  const [phrase, setPhrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);

  const handleSubmit = async () => {
    if (!phrase.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onUnlock(phrase.trim());
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
          boxShadow: '2px 3px 5px rgba(50,35,20,0.10)',
        }}>
          <div style={{ fontSize: 14, color: 'var(--foreground)', marginBottom: 6, fontWeight: 700 }}>
            Enter your passphrase
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 24, lineHeight: 1.7 }}>
            Any phrase you'll remember. First time? Just type one and your log is created instantly.
          </div>

          {/* Input */}
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
                placeholder="e.g. iron-bear-morning"
                autoFocus
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
            disabled={loading || !phrase.trim()}
            style={{
              width: '100%', padding: '13px',
              borderRadius: 4,
              background: loading || !phrase.trim() ? 'var(--accent)' : 'var(--primary)',
              border: 'none',
              color: loading || !phrase.trim() ? 'var(--muted-foreground)' : '#fff',
              fontSize: 11, fontWeight: 700, letterSpacing: 3,
              cursor: loading || !phrase.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', fontFamily: 'var(--font-mono)',
            }}
          >
            {loading ? 'CONNECTING...' : 'OPEN LOG'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 10, color: 'var(--muted-foreground)', lineHeight: 1.8, fontFamily: 'var(--font-mono)' }}>
          Passphrase is hashed before storage.<br />
          We never see it. This device will remember it.
        </div>
      </div>
    </div>
  );
}
