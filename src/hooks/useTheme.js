/**
 * useTheme hook.
 *
 * Manages the light/dark colour theme by toggling the `dark` class on the
 * document root (<html>), which flips the CSS custom properties defined in
 * index.css (:root vs .dark). The choice is:
 *   - persisted to localStorage ('ppl-theme'), so it survives reloads, and
 *   - defaulted to the OS preference (prefers-color-scheme) on first visit.
 *
 * Applying the class on <html> means the theme is in effect before the first
 * paint of any component (including the passphrase gate), avoiding a flash.
 *
 * @returns {{ theme: 'light'|'dark', toggle: () => void, setTheme: (t) => void }}
 */
import { useState, useEffect, useCallback } from 'react';

const THEME_KEY = 'ppl-theme';

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* ignore */ }
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme; // native form controls / scrollbars follow
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggle, setTheme };
}
