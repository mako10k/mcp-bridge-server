import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AzureProvider } from '../../src/auth/providers/azure-provider.js';

const config = {
  tenantId: 'common',
  clientId: 'id',
  clientSecret: 'secret',
  redirectUri: 'https://app/cb',
  scope: 'openid email profile'
};

test('AzureProvider generates authorization url', () => {
  const provider = new AzureProvider(config);
  const url = provider.getAuthorizationUrl('state1', {
    codeVerifier: 'verifier',
    codeChallenge: 'challenge',
    method: 'S256'
  });
  const u = new URL(url);
  assert.equal(u.hostname, 'login.microsoftonline.com');
  assert.equal(u.searchParams.get('client_id'), 'id');
  assert.equal(u.searchParams.get('state'), 'state1');
  assert.equal(u.searchParams.get('code_challenge'), 'challenge');
});

test('AzureProvider.getUserInfo parses response', async () => {
  const provider = new AzureProvider(config);
  const expected = { sub: '1', displayName: 't', userPrincipalName: 'e' };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(expected), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const result = await provider.getUserInfo('token');
  assert.deepEqual(result, {
    sub: '1',
    name: 't',
    email: 'e',
    picture: undefined
  });
  globalThis.fetch = originalFetch;
});
