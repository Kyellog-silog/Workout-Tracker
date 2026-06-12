/**
 * useSyncedData hook.
 *
 * Dual-write persistence hook that keeps application state in both
 * localStorage (immediate, for offline resilience) and Supabase
 * (debounced at 1.5s, for cross-device sync).
 *
 * On initial load:
 * 1. Fetches data from Supabase and reconciles it with localStorage via
 *    mergeAppData — the side with the newer `_savedAt` stamp wins, and
 *    completions are unioned so progress can never be silently dropped.
 * 2. Preserves the local selectedDate to avoid overwriting the user's view
 * 3. Falls back to localStorage if Supabase is unreachable (no push-back, so a
 *    failed read can never clobber good remote data)
 *
 * Sync status transitions: loading -> synced | offline
 * On each write: saving -> synced | offline
 *
 * @param {string|null} passphrase - The user's passphrase (null = not authenticated).
 * @returns {{ data: object, setData: Function, syncStatus: string }}
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { loadFromSupabase, saveToSupabase } from '../lib/supabase';
import { validateLoadedData } from '../lib/securityGuards';
import { mergeAppData, stampSavedAt } from '../lib/syncMerge';

const LOCAL_PREFIX = 'ppl-app-data';
const LEGACY_LOCAL_KEY = 'ppl-app-data'; // pre-namespacing shared key (purged on mount)
const DEBOUNCE_MS = 1500; // save to Supabase 1.5s after last change

// Fast, non-cryptographic hash (djb2) used ONLY to partition the local cache per
// account. The raw credentials already live in localStorage (IDENTITY_KEY), so a
// hash in a localStorage key name exposes nothing new — its sole job is to ensure
// two accounts on the same browser never share (and therefore never leak) a cache.
function hashAccount(username, passphrase) {
  const s = `${(username || '').trim().toLowerCase()}${passphrase.trim().toLowerCase()}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function localKeyFor(username, passphrase) {
  return (username && passphrase) ? `${LOCAL_PREFIX}:${hashAccount(username, passphrase)}` : null;
}

function readLocal(key) {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return validateLoadedData(parsed);
  } catch { return null; }
}

function writeLocal(key, data) {
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

const DEFAULT_DATA = {
  programStart: null,
  completedDays: {},
  overrides: {},
  streakRestores: {},
  bodyMetrics: {},
  selectedDate: (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })(),
};

export function useSyncedData(username, passphrase) {
  const [data, setDataRaw] = useState(DEFAULT_DATA);
  const [syncStatus, setSyncStatus] = useState('loading'); // loading | synced | saving | offline
  const debounceTimer = useRef(null);
  const usernameRef = useRef(username);
  usernameRef.current = username;
  const passphraseRef = useRef(passphrase);
  passphraseRef.current = passphrase;
  // Per-account local-cache key, recomputed on every render so reads/writes
  // and the cross-tab listener always target the *current* account's cache.
  const localKeyRef = useRef(localKeyFor(username, passphrase));
  localKeyRef.current = localKeyFor(username, passphrase);

  // One-time purge of the legacy shared cache (held the last account's data and
  // was the source of the cross-account leak). Remote is the source of truth.
  useEffect(() => {
    try { localStorage.removeItem(LEGACY_LOCAL_KEY); } catch { /* ignore */ }
  }, []);

  // Listen for changes from other tabs (same account only)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key && e.key === localKeyRef.current) {
        try {
          const newValue = JSON.parse(e.newValue);
          if (newValue) {
            setDataRaw(newValue);
          }
        } catch {
          // ignore parse errors
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Initial load: fetch from Supabase, fall back to localStorage
  useEffect(() => {
    // Cancel any pending save from the previous account/session.
    clearTimeout(debounceTimer.current);

    if (!passphrase || !username) {
      // Logged out — drop in-memory data so nothing carries into the next login.
      setDataRaw(DEFAULT_DATA);
      return;
    }

    const localKey = localKeyFor(username, passphrase);
    // Immediately show THIS account's own cache (or defaults) — never whatever
    // account was previously in memory.
    setDataRaw(readLocal(localKey) || DEFAULT_DATA);
    setSyncStatus('loading');

    loadFromSupabase(username, passphrase)
      .then(remote => {
        const local = readLocal(localKey) || DEFAULT_DATA;

        if (remote) {
          // Validate remote (strips prototype-pollution keys) then reconcile by
          // recency: the newer _savedAt wins, completions are unioned. This is
          // what prevents a stale device from hiding — or overwriting — fresher
          // data from another device.
          const validRemote = validateLoadedData(remote) || {};
          const merged = { ...DEFAULT_DATA, ...mergeAppData(validRemote, local) };

          setDataRaw(merged);
          writeLocal(localKey, merged);
          setSyncStatus('synced');
        } else {
          // First time with this passphrase — push local data up (stamped).
          const seeded = stampSavedAt(local);
          setDataRaw(seeded);
          writeLocal(localKey, seeded);
          saveToSupabase(username, passphrase, seeded)
            .then(() => setSyncStatus('synced'))
            .catch(() => setSyncStatus('offline'));
        }
      })
      .catch(() => {
        // Offline — use this account's local cache only.
        const local = readLocal(localKey);
        if (local) setDataRaw(local);
        setSyncStatus('offline');
      });
  }, [username, passphrase]);

  // Debounced save to Supabase whenever data changes
  const setData = useCallback((updater) => {
    const localKey = localKeyRef.current;
    if (!localKey) return; // not authenticated — never persist under no account
    setDataRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // --- CRITICAL: Read latest from localStorage before writing ---
      // This prevents a stale `prev` from overwriting fresher state
      // that might have come from another tab via the storage event.
      const currentLocal = readLocal(localKey) || DEFAULT_DATA;
      // Stamp the save so other devices can tell which copy is newer.
      const finalState = stampSavedAt({ ...currentLocal, ...next });

      writeLocal(localKey, finalState);

      // Debounce Supabase write
      clearTimeout(debounceTimer.current);
      setSyncStatus('saving');
      debounceTimer.current = setTimeout(() => {
        saveToSupabase(usernameRef.current, passphraseRef.current, finalState)
          .then(() => setSyncStatus('synced'))
          .catch(() => setSyncStatus('offline'));
      }, DEBOUNCE_MS);

      return finalState;
    });
  }, []);

  return { data, setData, syncStatus };
}
