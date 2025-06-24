import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRandomBytes,
  generateRandomString,
  hashSHA256,
  encryptAESGCM,
  decryptAESGCM,
  encrypt,
  decrypt,
  generateKey
} from '../../src/auth/utils/crypto-utils.js';

test('generateRandomBytes returns buffer of expected size', () => {
  const buf = generateRandomBytes(16);
  assert.equal(buf.length, 16);
  assert.ok(Buffer.isBuffer(buf));
});

test('generateRandomString creates hex string of expected length', () => {
  const str = generateRandomString(16);
  assert.equal(str.length, 32); // 16 bytes -> 32 hex chars
  assert.match(str, /^[0-9a-f]+$/);
});

test('generateKey creates key of expected length', () => {
  const key = generateKey(32);
  assert.equal(key.length, 64); // 32 bytes -> 64 hex chars
  assert.match(key, /^[0-9a-f]+$/);
});

test('hashSHA256 generates deterministic hash for string', () => {
  const h1 = hashSHA256('test');
  const h2 = hashSHA256('test');
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/);
});

test('hashSHA256 generates deterministic hash for buffer', () => {
  const data = Buffer.from('test');
  const h1 = hashSHA256(data);
  const h2 = hashSHA256(data);
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/);
});

// AES-GCM tests (modern encryption)
test('encryptAESGCM and decryptAESGCM roundtrip', () => {
  const key = 'secret-key';
  const plaintext = 'hello world';
  const encrypted = encryptAESGCM(plaintext, key);
  
  // Check structure
  assert.ok(encrypted.iv);
  assert.ok(encrypted.tag);
  assert.ok(encrypted.data);
  assert.match(encrypted.iv, /^[0-9a-f]+$/);
  assert.match(encrypted.tag, /^[0-9a-f]+$/);
  assert.match(encrypted.data, /^[0-9a-f]+$/);
  
  const decrypted = decryptAESGCM(encrypted, key);
  assert.equal(decrypted, plaintext);
});

test('encryptAESGCM creates different ciphertext for same input', () => {
  const key = 'secret-key';
  const plaintext = 'hello world';
  const encrypted1 = encryptAESGCM(plaintext, key);
  const encrypted2 = encryptAESGCM(plaintext, key);
  
  // Different IVs should produce different ciphertexts
  assert.notEqual(encrypted1.iv, encrypted2.iv);
  assert.notEqual(encrypted1.data, encrypted2.data);
});

// AES-CBC tests (legacy encryption)
test('encrypt and decrypt roundtrip (legacy CBC)', () => {
  const key = 'my_secret_key';
  const message = 'hello world';
  const encrypted = encrypt(message, key);
  assert.notEqual(encrypted, message);
  assert.ok(encrypted.includes(':'));
  
  const decrypted = decrypt(encrypted, key);
  assert.equal(decrypted, message);
});

test('encrypt creates different ciphertext for same input (legacy CBC)', () => {
  const key = 'my_secret_key';
  const message = 'hello world';
  const encrypted1 = encrypt(message, key);
  const encrypted2 = encrypt(message, key);
  
  // Different IVs should produce different ciphertexts
  assert.notEqual(encrypted1, encrypted2);
});
