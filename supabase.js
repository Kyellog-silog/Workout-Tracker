/**
 * Root-level Supabase client.
 *
 * Reads credentials from Vite environment variables (VITE_SUPABASE_URL,
 * VITE_SUPABASE_ANON_KEY). The primary client used at runtime is in
 * src/lib/supabase.js; this file serves as an alternative entry point
 * that relies on .env configuration.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
