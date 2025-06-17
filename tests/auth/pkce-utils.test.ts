import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePKCECodes, verifyCodeChallenge } from '../../src/auth/utils/pkce-utils.js';

// Basic test for PKCE code generation and verification

test('generatePKCECodes produces verifier and challenge pair that verify', () => {
  const { codeVerifier, codeChallenge } = generatePKCECodes(64);
  assert.ok(codeVerifier.length >= 43 && codeVerifier.length <= 128); // as per spec
  assert.ok(/^[-A-Za-z0-9._~]+$/.test(codeVerifier));
  assert.ok(codeChallenge.length > 0);
  assert.equal(verifyCodeChallenge(codeVerifier, codeChallenge), true);
});
