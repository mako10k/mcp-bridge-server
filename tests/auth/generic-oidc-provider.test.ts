import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GenericOIDCProvider } from '../../src/auth/providers/generic-oidc.js';

const config = {
  issuer: 'https://idp.example.com',
  clientId: 'id',
  clientSecret: 'secret',
  redirectUri: 'https://app/cb',
  discovery: true,
  scope: 'openid profile'
};

const discoveryResponse = {
  issuer: 'https://idp.example.com',
  authorization_endpoint: 'https://idp.example.com/authorize',
  token_endpoint: 'https://idp.example.com/token',
  userinfo_endpoint: 'https://idp.example.com/userinfo',
  jwks_uri: 'https://idp.example.com/jwks'
};

test('GenericOIDCProvider discovery fetches metadata', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: RequestInfo | URL) => {
    assert.equal(url.toString(), 'https://idp.example.com/.well-known/openid-configuration');
    return new Response(JSON.stringify(discoveryResponse), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const provider = new GenericOIDCProvider(config);
  await provider.init();
  const url = provider.getAuthorizationUrl('s1', {
    codeVerifier: 'v',
    codeChallenge: 'c',
    method: 'S256'
  });
  const u = new URL(url);
  assert.equal(u.hostname, 'idp.example.com');
  assert.equal(u.searchParams.get('client_id'), 'id');
  assert.equal(u.searchParams.get('state'), 's1');
  globalThis.fetch = originalFetch;
});

test('GenericOIDCProvider.getUserInfo parses response', async () => {
  const provider = new GenericOIDCProvider({ ...config, discovery: false });
  // manually set metadata endpoints
  (provider as any).metadata.authorizationEndpoint = 'https://idp.example.com/a';
  (provider as any).metadata.tokenEndpoint = 'https://idp.example.com/t';
  (provider as any).metadata.userInfoEndpoint = 'https://idp.example.com/u';

  const expected = { sub: '1', name: 't', email: 'e' };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(expected), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const result = await provider.getUserInfo('token');
  assert.deepEqual(result, expected);
  globalThis.fetch = originalFetch;
});
