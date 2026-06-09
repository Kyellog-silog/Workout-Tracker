/**
 * Supabase client module.
 *
 * Provides loadFromSupabase / saveToSupabase which handle:
 *   - PBKDF2-based lookup key derivation (v2)
 *   - AES-GCM-256 encryption of the data payload before storage
 *   - Transparent migration of legacy SHA-256 (v1) rows on first login
 *
 * The raw passphrase is NEVER transmitted or stored; only the derived
 * lookup key reaches the database, and the data column holds ciphertext.
 *
 * All DB access goes through SECURITY DEFINER RPCs (get_row / put_row) rather
 * than direct table access. This lets the ppl_data table itself be locked down
 * with RLS (deny-by-default for the anon role), so the public anon key cannot be
 * used to dump or wipe the table — a caller can only fetch/write the exact key
 * (= passphrase-derived) it already knows. See SECURITY.md.
 *
 * Database table: ppl_data
 *   - passphrase (text, PK): "v2:" + PBKDF2 hex, or legacy SHA-256 hex
 *   - data (jsonb)          : {v:2, salt, iv, ct} envelope, or legacy plain object
 *   - updated_at (timestamptz)
 *
 * RPCs (created in Supabase, see SECURITY.md):
 *   - get_row(p_key text) returns jsonb            — the data column, or null
 *   - put_row(p_key text, p_data jsonb) returns void — upsert by key
 */
import { createClient } from '@supabase/supabase-js';
import {
  deriveLookupKey,
  encryptPayload,
  decryptPayload,
  legacyHashPassphrase,
} from './crypto';

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Loads the user's data from Supabase.
 *
 * Lookup order:
 *   1. PBKDF2 v2 key  → decrypt and return
 *   2. Legacy SHA-256  → migrate (re-save encrypted under v2 key) then return
 *   3. Not found       → return null (new account)
 *
 * @param {string} phrase - Raw passphrase as entered by the user
 * @returns {Promise<object|null>} Decrypted data object, or null if not found
 */
export async function loadFromSupabase(phrase) {
  const v2Key = await deriveLookupKey(phrase);

  // 1. Try v2 lookup. get_row returns the `data` jsonb directly (or null).
  const { data: v2Payload, error: v2Err } = await supabase
    .rpc('get_row', { p_key: v2Key });

  if (v2Err) throw v2Err;

  if (v2Payload) {
    // Encrypted envelope
    if (v2Payload?.v === 2) return decryptPayload(phrase, v2Payload);
    // Unencrypted v2 row (shouldn't happen, but safe fallback)
    return v2Payload;
  }

  // 2. Fall back to legacy SHA-256 row
  const legacyKey = await legacyHashPassphrase(phrase);
  const { data: v1Payload, error: v1Err } = await supabase
    .rpc('get_row', { p_key: legacyKey });

  if (v1Err) throw v1Err;

  if (v1Payload) {
    // Migrate: write encrypted copy under v2 key (fire-and-forget; non-blocking)
    const plainData = v1Payload;
    encryptPayload(phrase, plainData).then(encrypted =>
      supabase.rpc('put_row', { p_key: v2Key, p_data: encrypted })
    ).catch(() => {/* migration failure is non-fatal */});

    return plainData;
  }

  // 3. New account
  return null;
}

/**
 * Saves the user's data to Supabase, encrypted under the v2 key.
 *
 * @param {string} phrase   - Raw passphrase
 * @param {object} payload  - Data object to encrypt and store
 */
export async function saveToSupabase(phrase, payload) {
  const [v2Key, encrypted] = await Promise.all([
    deriveLookupKey(phrase),
    encryptPayload(phrase, payload),
  ]);

  const { error } = await supabase
    .rpc('put_row', { p_key: v2Key, p_data: encrypted });

  if (error) throw error;
}
