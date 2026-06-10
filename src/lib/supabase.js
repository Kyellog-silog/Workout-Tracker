/**
 * Supabase client module.
 *
 * Provides loadFromSupabase / saveToSupabase which handle:
 *   - PBKDF2-based lookup key derivation from username + passphrase (v3)
 *   - AES-GCM-256 encryption of the data payload before storage
 *   - Transparent migration of legacy v2 (passphrase-only) and v1 (SHA-256)
 *     rows up to v3 on first login
 *
 * Neither the raw passphrase nor username is transmitted or stored; only the
 * derived lookup key reaches the database, and the data column holds ciphertext.
 *
 * All DB access goes through SECURITY DEFINER RPCs (get_row / put_row) rather
 * than direct table access. This lets the ppl_data table itself be locked down
 * with RLS (deny-by-default for the anon role), so the public anon key cannot be
 * used to dump or wipe the table — a caller can only fetch/write the exact key
 * (= passphrase-derived) it already knows. See SECURITY.md.
 *
 * Database table: ppl_data
 *   - passphrase (text, PK): "v3:"/"v2:" + PBKDF2 hex, or legacy SHA-256 hex
 *   - data (jsonb)          : {v:3, salt, iv, ct} envelope, or legacy v2/plain
 *   - updated_at (timestamptz)
 *
 * RPCs (created in Supabase, see SECURITY.md):
 *   - get_row(p_key text) returns jsonb            — the data column, or null
 *   - put_row(p_key text, p_data jsonb) returns void — upsert by key
 */
import { createClient } from '@supabase/supabase-js';
import {
  deriveLookupKey,
  deriveLookupKeyV2,
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
 * Lookup order (each rung migrates an older row up to v3 on hit):
 *   1. v3 key (username + passphrase) → decrypt and return
 *   2. v2 key (passphrase only)       → migrate → return
 *   3. Legacy SHA-256 (passphrase)    → migrate → return
 *   4. Not found                      → null (new account)
 *
 * @param {string} username - Account username
 * @param {string} phrase   - Raw passphrase as entered by the user
 * @returns {Promise<object|null>} Decrypted data object, or null if not found
 */
export async function loadFromSupabase(username, phrase) {
  const v3Key = await deriveLookupKey(username, phrase);

  // Fire-and-forget re-save of migrated plaintext under the v3 key.
  const migrateToV3 = (plain) => {
    encryptPayload(plain, username, phrase)
      .then(encrypted => supabase.rpc('put_row', { p_key: v3Key, p_data: encrypted }))
      .catch(() => {/* migration failure is non-fatal */});
  };

  // 1. Try v3 lookup. get_row returns the `data` jsonb directly (or null).
  const { data: v3Payload, error: v3Err } = await supabase.rpc('get_row', { p_key: v3Key });
  if (v3Err) throw v3Err;
  if (v3Payload) {
    if (v3Payload?.v >= 3) return decryptPayload(v3Payload, username, phrase);
    return v3Payload; // unencrypted (shouldn't happen) — safe fallback
  }

  // 2. Fall back to the legacy v2 (passphrase-only) row, then migrate.
  const v2Key = await deriveLookupKeyV2(phrase);
  const { data: v2Payload, error: v2Err } = await supabase.rpc('get_row', { p_key: v2Key });
  if (v2Err) throw v2Err;
  if (v2Payload) {
    const plain = (v2Payload?.v === 2) ? await decryptPayload(v2Payload, username, phrase) : v2Payload;
    migrateToV3(plain);
    return plain;
  }

  // 3. Fall back to the oldest SHA-256 (passphrase-only) row, then migrate.
  const legacyKey = await legacyHashPassphrase(phrase);
  const { data: v1Payload, error: v1Err } = await supabase.rpc('get_row', { p_key: legacyKey });
  if (v1Err) throw v1Err;
  if (v1Payload) {
    migrateToV3(v1Payload); // v1 rows stored plaintext
    return v1Payload;
  }

  // 4. New account
  return null;
}

/**
 * Saves the user's data to Supabase, encrypted under the v3 (username +
 * passphrase) identity.
 *
 * @param {string} username - Account username
 * @param {string} phrase   - Raw passphrase
 * @param {object} payload  - Data object to encrypt and store
 */
export async function saveToSupabase(username, phrase, payload) {
  const [v3Key, encrypted] = await Promise.all([
    deriveLookupKey(username, phrase),
    encryptPayload(payload, username, phrase),
  ]);

  const { error } = await supabase.rpc('put_row', { p_key: v3Key, p_data: encrypted });
  if (error) throw error;
}
