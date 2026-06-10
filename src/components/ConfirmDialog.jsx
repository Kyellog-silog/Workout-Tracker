/**
 * ConfirmDialog + ConfirmProvider.
 *
 * A themed, accessible replacement for the native window.confirm(). The
 * provider exposes an imperative, promise-based `confirm()` via context so call
 * sites read almost identically to before:
 *
 *     const confirm = useConfirm();
 *     if (!(await confirm('Delete this?'))) return;
 *     // or, with options:
 *     await confirm({ title, message, confirmLabel, cancelLabel, danger: true });
 *
 * Mount <ConfirmProvider> above everything that needs it (see main.jsx).
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Icon } from './Icons';

const ConfirmContext = createContext(() => Promise.resolve(true));

/** Hook: returns confirm(messageOrOptions) → Promise<boolean>. */
export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }) {
  const [opts, setOpts] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((arg) => {
    const options = typeof arg === 'string' ? { message: arg } : (arg || {});
    setOpts(options);
    return new Promise((resolve) => { resolver.current = resolve; });
  }, []);

  const settle = useCallback((result) => {
    setOpts(null);
    const r = resolver.current;
    resolver.current = null;
    if (r) r(result);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <ConfirmDialog
          {...opts}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);

  // Focus the primary action and wire Esc / Enter.
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      else if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm]);

  const accent = danger ? 'var(--destructive)' : 'var(--primary)';

  return (
    <>
      <div
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(40,30,18,0.45)', backdropFilter: 'blur(3px)' }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={title ? 'confirm-title' : undefined}
        aria-describedby="confirm-message"
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          zIndex: 501, background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '22px 24px', width: 'min(380px, 92vw)',
          boxShadow: 'var(--shadow-lg)',
          animation: 'fadeInScale 0.16s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: `${danger ? 'rgba(176,74,50,0.12)' : 'rgba(138,90,46,0.12)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={danger ? 'alertTriangle' : 'info'} size={15} color={accent} />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
            {title && (
              <div id="confirm-title" style={{
                fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: 16,
                color: 'var(--foreground)', marginBottom: 4,
              }}>{title}</div>
            )}
            <div id="confirm-message" style={{
              fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.6,
              whiteSpace: 'pre-line',
            }}>{message}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            fontSize: 10, letterSpacing: 2, color: 'var(--muted-foreground)',
            background: 'var(--muted)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '9px 16px', cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontWeight: 700,
          }}>{cancelLabel.toUpperCase()}</button>
          <button ref={confirmRef} onClick={onConfirm} style={{
            fontSize: 10, letterSpacing: 2, color: '#fff',
            background: accent, border: 'none',
            borderRadius: 4, padding: '9px 16px', cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontWeight: 700,
          }}>{confirmLabel.toUpperCase()}</button>
        </div>
      </div>
    </>
  );
}
