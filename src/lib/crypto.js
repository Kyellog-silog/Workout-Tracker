/**
 * Cryptographic primitives for passphrase-based key derivation and data
 * encryption/decryption. All operations use the Web Crypto API (no external
 * dependencies) and run entirely client-side so the raw passphrase and
 * plaintext data never leave the browser.
 *
 * Key design:
 *   - Lookup key  : PBKDF2(passphrase, FIXED_APP_SALT, 100k iters, SHA-256)
 *                   Deterministic so the same passphrase always maps to the
 *                   same Supabase row, but hardened against rainbow tables.
 *   - Encryption  : AES-GCM-256 with a random 32-byte salt and 12-byte IV,
 *                   key derived via PBKDF2(passphrase, randomSalt, 100k iters).
 *                   The salt and IV are stored alongside the ciphertext so
 *                   decryption needs only the passphrase.
 */

// Fixed application-level salt for the *lookup* key derivation.
// Not a secret — its purpose is to domain-separate this app's hashes from
// generic SHA-256 rainbow tables. Never change this value; doing so would
// invalidate all existing rows.
const APP_LOOKUP_SALT = 'ppl-tracker-v2-lookup-2024';

const enc = new TextEncoder();
const dec = new TextDecoder();

function toHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex) {
  return new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b, 16)));
}

function normalizePhrase(phrase) {
  return phrase.trim().toLowerCase();
}

async function importPbkdf2Key(phrase) {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(normalizePhrase(phrase)),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
}

/**
 * Derives the Supabase row lookup key from a passphrase.
 * Result is prefixed with "v2:" to distinguish it from legacy SHA-256 hashes.
 *
 * @param {string} phrase - Raw passphrase as entered by the user
 * @returns {Promise<string>} "v2:" + 64 hex chars
 */
export async function deriveLookupKey(phrase) {
  const keyMaterial = await importPbkdf2Key(phrase);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(APP_LOOKUP_SALT),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return 'v2:' + toHex(new Uint8Array(bits));
}

/**
 * Derives an AES-GCM-256 CryptoKey from a passphrase and a per-row random salt.
 *
 * @param {string} phrase - Raw passphrase
 * @param {Uint8Array} saltBytes - 32-byte random salt (stored in the DB row)
 * @returns {Promise<CryptoKey>}
 */
async function deriveEncryptionKey(phrase, saltBytes) {
  const keyMaterial = await importPbkdf2Key(phrase);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a data object with AES-GCM-256.
 * A fresh random salt (32 bytes) and IV (12 bytes) are generated each call.
 *
 * @param {string} phrase - Raw passphrase
 * @param {object} data   - Plaintext data object (will be JSON-serialised)
 * @returns {Promise<{v:2, salt:string, iv:string, ct:string}>}
 *   v    - envelope version
 *   salt - hex-encoded 32-byte PBKDF2 salt
 *   iv   - hex-encoded 12-byte AES-GCM nonce
 *   ct   - base64-encoded ciphertext
 */
export async function encryptPayload(phrase, data) {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveEncryptionKey(phrase, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(data))
  );

  return {
    v:    2,
    salt: toHex(salt),
    iv:   toHex(iv),
    ct:   btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
  };
}

/**
 * Decrypts an envelope produced by encryptPayload.
 *
 * @param {string} phrase    - Raw passphrase
 * @param {{v,salt,iv,ct}} envelope
 * @returns {Promise<object>} Decrypted data object
 * @throws If the passphrase is wrong or the ciphertext is corrupt
 */
export async function decryptPayload(phrase, envelope) {
  const salt = fromHex(envelope.salt);
  const iv   = fromHex(envelope.iv);
  const ct   = Uint8Array.from(atob(envelope.ct), c => c.charCodeAt(0));
  const key  = await deriveEncryptionKey(phrase, salt);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ct
  );

  return JSON.parse(dec.decode(plaintext));
}

/**
 * SHA-256 hash used only to look up legacy (v1) rows during migration.
 * Do not use for new data.
 *
 * @param {string} phrase
 * @returns {Promise<string>} 64 hex chars
 */
export async function legacyHashPassphrase(phrase) {
  const normalized = normalizePhrase(phrase);
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(normalized));
  return toHex(new Uint8Array(hashBuffer));
}
