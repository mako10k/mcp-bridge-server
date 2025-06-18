import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GitHubProvider } from '../../src/auth/providers/github-provider.js';

const config = {
  clientId: 'id',
  clientSecret: 'secret',
  redirectUri: 'https://app/cb',
  scope: 'read:user user:email'
};

test('GitHubProvider generates authorization url', () => {
  const provider = new GitHubProvider(config);
  const url = provider.getAuthorizationUrl('state1', {
    codeVerifier: 'verifier',
    codeChallenge: 'challenge',
    method: 'S256'
  });
  const u = new URL(url);
  assert.equal(u.hostname, 'github.com');
  assert.equal(u.searchParams.get('client_id'), 'id');
  assert.equal(u.searchParams.get('state'), 'state1');
  assert.equal(u.searchParams.get('code_challenge'), 'challenge');
});

test('GitHubProvider.getUserInfo parses response', async () => {
  const provider = new GitHubProvider(config);
  const expected = { id: 1, login: 't', email: 'e', avatar_url: 'p' };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(expected), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
  const result = await provider.getUserInfo('token');
  assert.deepEqual(result, {
    sub: '1',
    name: 't',
    email: 'e',
    picture: 'p'
  });
  globalThis.fetch = originalFetch;
});
