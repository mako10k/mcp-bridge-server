import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GoogleProvider } from '../../src/auth/providers/google-provider.js';

const config = {
  clientId: 'id',
  clientSecret: 'secret',
  redirectUri: 'https://app/cb',
  scope: 'openid email profile'
};

test('GoogleProvider generates authorization url', () => {
  const provider = new GoogleProvider(config);
  const url = provider.getAuthorizationUrl('state1', {
    codeVerifier: 'verifier',
    codeChallenge: 'challenge',
    method: 'S256'
  });
  const u = new URL(url);
  assert.equal(u.hostname, 'accounts.google.com');
  assert.equal(u.searchParams.get('client_id'), 'id');
  assert.equal(u.searchParams.get('state'), 'state1');
  assert.equal(u.searchParams.get('code_challenge'), 'challenge');
});

test('GoogleProvider.getUserInfo parses response', async () => {
  const provider = new GoogleProvider(config);
  const expected = { sub: '1', name: 't', email: 'e', picture: 'p' };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(expected), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const result = await provider.getUserInfo('token');
  assert.deepEqual(result, expected);
  globalThis.fetch = originalFetch;
});
