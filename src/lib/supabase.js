/**
 * Supabase client module.
 *
 * Initialises the Supabase client and provides functions for loading and
 * saving application data. Passphrases are normalised and hashed with
 * SHA-256 (via the Web Crypto API) before being used as database keys.
 * The raw passphrase is never transmitted to or stored on the server.
 *
 * Database table: ppl_data
 *   - passphrase (text, PK): SHA-256 hex digest of the normalised passphrase
 *   - data (jsonb): full application state
 *   - updated_at (timestamptz): last sync timestamp
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Hash the passphrase so the raw phrase is never stored in the DB
export async function hashPassphrase(phrase) {
  const normalized = phrase.trim().toLowerCase();
  const encoded = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function loadFromSupabase(passphrase) {
  const key = await hashPassphrase(passphrase);
  const { data, error } = await supabase
    .from('ppl_data')
    .select('data')
    .eq('passphrase', key)
    .maybeSingle();

  if (error) throw error;
  return data?.data || null;
}

export async function saveToSupabase(passphrase, payload) {
  const key = await hashPassphrase(passphrase);
  const { error } = await supabase
    .from('ppl_data')
    .upsert(
      { passphrase: key, data: payload, updated_at: new Date().toISOString() },
      { onConflict: 'passphrase' }
    );
  if (error) throw error;
}

// ── WithHash variants accept a pre-computed SHA-256 hex string ──────────────
// Used when App.jsx has already hashed the passphrase before storing it.

export async function loadFromSupabaseWithHash(hash) {
  const { data, error } = await supabase
    .from('ppl_data')
    .select('data')
    .eq('passphrase', hash)
    .maybeSingle();
  if (error) throw error;
  return data?.data || null;
}

export async function saveToSupabaseWithHash(hash, payload) {
  const { error } = await supabase
    .from('ppl_data')
    .upsert(
      { passphrase: hash, data: payload, updated_at: new Date().toISOString() },
      { onConflict: 'passphrase' }
    );
  if (error) throw error;
}
