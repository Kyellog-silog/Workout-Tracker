/**
 * useSyncedData hook.
 *
 * Dual-write persistence hook that keeps application state in both
 * localStorage (immediate, for offline resilience) and Supabase
 * (debounced at 1.5s, for cross-device sync).
 *
 * On initial load:
 * 1. Fetches data from Supabase (remote wins for all fields)
 * 2. Preserves the local selectedDate to avoid overwriting the user's view
 * 3. Falls back to localStorage if Supabase is unreachable
 *
 * Sync status transitions: loading -> synced | offline
 * On each write: saving -> synced | offline
 *
 * @param {string|null} passphrase - The user's passphrase (null = not authenticated).
 * @returns {{ data: object, setData: Function, syncStatus: string }}
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { loadFromSupabaseWithHash, saveToSupabaseWithHash } from '../lib/supabase';
import { validateLoadedData } from '../lib/securityGuards';

const LOCAL_KEY = 'ppl-app-data';
const DEBOUNCE_MS = 1500; // save to Supabase 1.5s after last change

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return validateLoadedData(parsed);
  } catch { return null; }
}

function writeLocal(data) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch {}
}

/**
 * Deep-merges two completedDays objects.
 * For each date, merges the three sub-keys (checked, notes, sets) independently
 * so that a stale local copy never wipes remote set logs from another device.
 *
 * Strategy per sub-key:
 *   checked / notes — local wins per exercise (local is the "active" device)
 *   sets            — remote sets are preserved for any exercise the local side
 *                     has no entries for; local wins only when it has actual data
 */
function mergeCompletedDays(remote = {}, local = {}) {
  const allDates = new Set([...Object.keys(remote), ...Object.keys(local)]);
  const result = {};
  for (const date of allDates) {
    const r = remote[date];
    const l = local[date];
    if (!r) { result[date] = l; continue; }
    if (!l) { result[date] = r; continue; }
    // Both sides have this date — merge sub-keys
    const remoteSets = r.sets || {};
    const localSets  = l.sets || {};
    const allExIds   = new Set([...Object.keys(remoteSets), ...Object.keys(localSets)]);
    const mergedSets = {};
    for (const id of allExIds) {
      const localEx  = localSets[id];
      const remoteEx = remoteSets[id];
      // Use local only if it has actual logged sets; otherwise keep remote
      mergedSets[id] = (Array.isArray(localEx) && localEx.length > 0) ? localEx : (remoteEx || []);
    }
    result[date] = {
      ...r,
      ...l,
      checked: { ...(r.checked || {}), ...(l.checked || {}) },
      notes:   { ...(r.notes   || {}), ...(l.notes   || {}) },
      sets:    mergedSets,
    };
  }
  return result;
}

const DEFAULT_DATA = {
  programStart: null,
  completedDays: {},
  overrides: {},
  streakRestores: {},
  selectedDate: (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })(),
};

export function useSyncedData(passphrase) {
  const [data, setDataRaw] = useState(DEFAULT_DATA);
  const [syncStatus, setSyncStatus] = useState('loading'); // loading | synced | saving | offline | error
  const debounceTimer = useRef(null);
  const passphraseRef = useRef(passphrase);
  passphraseRef.current = passphrase;

  // Listen for changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === LOCAL_KEY) {
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
    if (!passphrase) return;
    setSyncStatus('loading');

    loadFromSupabaseWithHash(passphrase)
      .then(remote => {
        const local = readLocal() || DEFAULT_DATA;

        if (remote) {
          // --- SAFE MERGE LOGIC ---
          // Validate remote data before merging to prevent prototype pollution
          const validRemote = validateLoadedData(remote) || {};
          const merged = { ...DEFAULT_DATA, ...validRemote };

          // Keep local selectedDate to not disrupt UI
          merged.selectedDate = local.selectedDate;

          // If local has a program start but remote doesn't, keep it.
          if (local.programStart && !validRemote.programStart) {
            merged.programStart = local.programStart;
          }

          // Deep merge overrides and completedDays, assuming local is fresher
          // (A proper CRDT or versioned-field approach would be better long-term)
          merged.overrides = { ...(validRemote.overrides || {}), ...(local.overrides || {}) };
          merged.completedDays = mergeCompletedDays(validRemote.completedDays, local.completedDays);

          setDataRaw(merged);
          writeLocal(merged);
          setSyncStatus('synced');
        } else {
          // First time with this passphrase — push local data up
          setDataRaw(local);
          saveToSupabaseWithHash(passphrase, local)
            .then(() => setSyncStatus('synced'))
            .catch(() => setSyncStatus('offline'));
        }
      })
      .catch(() => {
        // Offline — use localStorage
        const local = readLocal();
        if (local) {
          setDataRaw(local);
        }
        setSyncStatus('offline');
      });
  }, [passphrase]);

  // Debounced save to Supabase whenever data changes
  const setData = useCallback((updater) => {
    setDataRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // --- CRITICAL: Read latest from localStorage before writing ---
      // This prevents a stale `prev` from overwriting fresher state
      // that might have come from another tab via the storage event.
      const currentLocal = readLocal() || DEFAULT_DATA;
      const finalState = { ...currentLocal, ...next };

      writeLocal(finalState);

      // Debounce Supabase write
      clearTimeout(debounceTimer.current);
      setSyncStatus('saving');
      debounceTimer.current = setTimeout(() => {
        saveToSupabaseWithHash(passphraseRef.current, finalState)
          .then(() => setSyncStatus('synced'))
          .catch(() => setSyncStatus('offline'));
      }, DEBOUNCE_MS);

      return finalState;
    });
  }, []);

  return { data, setData, syncStatus };
}
