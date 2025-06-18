import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRandomBytes,
  generateRandomString,
  encryptAESGCM,
  decryptAESGCM,
  hashSHA256
} from '../../src/auth/utils/crypto-utils.js';

test('generateRandomString creates string of expected length', () => {
  const str = generateRandomString(16);
  assert.equal(str.length, 32); // hex length = bytes*2
});

test('encryptAESGCM and decryptAESGCM roundtrip', () => {
  const key = 'secret-key';
  const plaintext = 'hello world';
  const encrypted = encryptAESGCM(plaintext, key);
  const decrypted = decryptAESGCM(encrypted, key);
  assert.equal(decrypted, plaintext);
});

test('hashSHA256 returns consistent digest', () => {
  const a = hashSHA256('data');
  const b = hashSHA256('data');
  assert.equal(a, b);
});
