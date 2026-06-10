import { describe, it, expect } from 'vitest';
import { deriveLookupKey, deriveLookupKeyV2, encryptPayload, decryptPayload } from './crypto';

describe('identity key derivation (collision fix)', () => {
  it('same passphrase + different usernames → different lookup keys', async () => {
    const a = await deriveLookupKey('alice', 'shared-pass');
    const b = await deriveLookupKey('bob', 'shared-pass');
    expect(a).not.toBe(b);
    expect(a.startsWith('v3:')).toBe(true);
  });

  it('separator prevents ("ab","c") colliding with ("a","bc")', async () => {
    expect(await deriveLookupKey('ab', 'c')).not.toBe(await deriveLookupKey('a', 'bc'));
  });

  it('is stable and normalizes case/whitespace for the same identity', async () => {
    expect(await deriveLookupKey('Alice', ' PASS ')).toBe(await deriveLookupKey('alice', 'pass'));
  });

  it('v3 identity key differs from the legacy v2 (passphrase-only) key', async () => {
    expect(await deriveLookupKey('alice', 'pass')).not.toBe(await deriveLookupKeyV2('pass'));
  });
});

describe('encrypt / decrypt round-trip', () => {
  it('decrypts what it encrypted under the same identity', async () => {
    const data = { hello: 'world', n: 42, nested: { a: [1, 2, 3] } };
    const env = await encryptPayload(data, 'alice', 'pass');
    expect(env.v).toBe(3);
    expect(await decryptPayload(env, 'alice', 'pass')).toEqual(data);
  });

  it('cannot decrypt with the wrong username', async () => {
    const env = await encryptPayload({ a: 1 }, 'alice', 'pass');
    await expect(decryptPayload(env, 'bob', 'pass')).rejects.toBeTruthy();
  });
});
