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

const SUPABASE_URL = 'https://xuqpzzokewyheahkaapb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1cXB6em9rZXd5aGVhaGthYXBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjY4MzIsImV4cCI6MjA4ODU0MjgzMn0.0YuDJBGyBO2-K8l-C-e2esp__SyrM5IdOZf9_bXlcLo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Hash the passphrase so the raw phrase is never stored in the DB
async function hashPassphrase(phrase) {
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
