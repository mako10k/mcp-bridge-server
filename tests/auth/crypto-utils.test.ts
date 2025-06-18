import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encrypt, decrypt, generateRandomString, hashSHA256 } from '../../src/auth/utils/crypto-utils.js';

test('encrypt and decrypt roundtrip', () => {
  const key = 'my_secret_key';
  const message = 'hello world';
  const encrypted = encrypt(message, key);
  assert.notEqual(encrypted, message);
  const decrypted = decrypt(encrypted, key);
  assert.equal(decrypted, message);
});

test('generateRandomString returns hex string of expected length', () => {
  const s = generateRandomString(16);
  assert.equal(s.length, 32); // 16 bytes -> 32 hex chars
  assert.match(s, /^[0-9a-f]+$/);
});

test('hashSHA256 generates deterministic hash', () => {
  const h1 = hashSHA256('test');
  const h2 = hashSHA256('test');
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/);
});
