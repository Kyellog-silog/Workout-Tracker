/**
 * Cryptographic primitives for identity-based key derivation and data
 * encryption/decryption. All operations use the Web Crypto API (no external
 * dependencies) and run entirely client-side so the raw credentials and
 * plaintext data never leave the browser.
 *
 * IDENTITY = username + passphrase (v3)
 * ------------------------------------
 * Both the row lookup key AND the encryption key are derived from the
 * combination of username and passphrase. This salts every account by its
 * username, so two users who happen to pick the same passphrase derive
 * completely different keys (different row, different ciphertext) instead of
 * colliding on — and being able to decrypt — one shared row.
 *
 *   - Lookup key : "v3:" + PBKDF2(username+passphrase, FIXED_APP_SALT_V3)
 *                  Deterministic, so the same identity always maps to the same
 *                  Supabase row.
 *   - Encryption : AES-GCM-256, key = PBKDF2(username+passphrase, randomSalt).
 *                  The per-row salt and IV are stored with the ciphertext.
 *
 * Legacy v2 (passphrase-only) lookup/decrypt helpers are retained so existing
 * rows can be found and transparently migrated to v3 on first login.
 */

// Fixed application-level salts for *lookup* key derivation. Not secrets — they
// domain-separate this app's hashes from generic rainbow tables. Never change a
// value in use; doing so would orphan every existing row keyed under it.
const APP_LOOKUP_SALT_V2 = 'ppl-tracker-v2-lookup-2024'; // legacy: passphrase only
const APP_LOOKUP_SALT_V3 = 'ppl-tracker-v3-lookup-2026'; // current: username + passphrase

const PBKDF2_ITERS = 100_000;

// Unit-separator (0x1F) placed between username and passphrase in the
// key-derivation input. It cannot occur in normalized text, so ("ab","c") and
// ("a","bc") can never produce identical material. Built via fromCharCode so the
// source stays printable ASCII (no raw control byte for a tool to strip).
const IDENTITY_SEP = String.fromCharCode(0x1f);

const enc = new TextEncoder();
const dec = new TextDecoder();

function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
  return new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b, 16)));
}

function normalize(s) {
  return (s || '').trim().toLowerCase();
}

function identityMaterial(username, passphrase) {
  return normalize(username) + IDENTITY_SEP + normalize(passphrase);
}

async function importKey(material) {
  return crypto.subtle.importKey(
    'raw', enc.encode(material), 'PBKDF2', false, ['deriveBits', 'deriveKey']
  );
}

async function lookupHex(material, salt) {
  const km = await importKey(material);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    km, 256
  );
  return toHex(new Uint8Array(bits));
}

/**
 * Derives the v3 Supabase row lookup key from username + passphrase.
 * @returns {Promise<string>} "v3:" + 64 hex chars
 */
export async function deriveLookupKey(username, passphrase) {
  return 'v3:' + await lookupHex(identityMaterial(username, passphrase), APP_LOOKUP_SALT_V3);
}

/**
 * Derives the legacy v2 lookup key (passphrase only). Used solely to locate a
 * pre-username row so it can be migrated to v3.
 * @returns {Promise<string>} "v2:" + 64 hex chars
 */
export async function deriveLookupKeyV2(passphrase) {
  return 'v2:' + await lookupHex(normalize(passphrase), APP_LOOKUP_SALT_V2);
}

async function encryptionKey(material, saltBytes) {
  const km = await importKey(material);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a data object with AES-GCM-256 under the v3 (username+passphrase)
 * identity. A fresh random salt (32B) and IV (12B) are generated each call.
 * @returns {Promise<{v:3, salt:string, iv:string, ct:string}>}
 */
export async function encryptPayload(data, username, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await encryptionKey(identityMaterial(username, passphrase), salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data))
  );

  return {
    v:    3,
    salt: toHex(salt),
    iv:   toHex(iv),
    ct:   btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
  };
}

/**
 * Decrypts an envelope produced by encryptPayload. v>=3 envelopes are keyed by
 * username+passphrase; legacy v2 envelopes are keyed by passphrase only (the
 * username argument is ignored for those).
 * @throws If the credentials are wrong or the ciphertext is corrupt
 */
export async function decryptPayload(envelope, username, passphrase) {
  const material = (envelope.v >= 3)
    ? identityMaterial(username, passphrase)
    : normalize(passphrase);

  const salt = fromHex(envelope.salt);
  const iv   = fromHex(envelope.iv);
  const ct   = Uint8Array.from(atob(envelope.ct), c => c.charCodeAt(0));
  const key  = await encryptionKey(material, salt);

  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(dec.decode(plaintext));
}

/**
 * SHA-256 hash used only to look up the oldest (v1) rows during migration.
 * @returns {Promise<string>} 64 hex chars
 */
export async function legacyHashPassphrase(passphrase) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(normalize(passphrase)));
  return toHex(new Uint8Array(hashBuffer));
}
