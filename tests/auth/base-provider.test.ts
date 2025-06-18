import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BaseProvider } from '../../src/auth/providers/base-provider.js';
import { PKCECodes } from '../../src/auth/utils/pkce-utils.js';

class DummyProvider extends BaseProvider {
  getAuthorizationUrl(state: string, pkce: PKCECodes): string {
    const url = new URL(this.metadata.authorizationEndpoint);
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', pkce.codeChallenge);
    url.searchParams.set('code_challenge_method', pkce.method);
    return url.toString();
  }

  async getUserInfo(): Promise<undefined> {
    return undefined;
  }
}

test('BaseProvider.requestToken sends POST request and parses JSON', async () => {
  const dummy = new DummyProvider(
    'dummy',
    {
      issuer: 'https://example.com',
      authorizationEndpoint: 'https://example.com/authorize',
      tokenEndpoint: 'https://example.com/token',
      jwksUri: 'https://example.com/jwks'
    },
    { clientId: 'abc', clientSecret: 'secret', redirectUri: 'https://app/callback' }
  );

  const expected = { access_token: 'token', token_type: 'Bearer', expires_in: 3600 };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(url.toString(), 'https://example.com/token');
    assert.equal(init?.method, 'POST');
    const body = init?.body as string;
    assert.ok(body.includes('client_id=abc'));
    return new Response(JSON.stringify(expected), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const result = await dummy['requestToken']({ client_id: 'abc' });
  assert.deepEqual(result, expected);

  globalThis.fetch = originalFetch;
});

test('BaseProvider.refreshToken uses refresh_token grant', async () => {
  const dummy = new DummyProvider(
    'dummy',
    {
      issuer: 'https://example.com',
      authorizationEndpoint: 'https://example.com/authorize',
      tokenEndpoint: 'https://example.com/token',
      jwksUri: 'https://example.com/jwks'
    },
    { clientId: 'abc', clientSecret: 'secret', redirectUri: 'https://app/callback' }
  );

  const expected = { access_token: 'new', token_type: 'Bearer', expires_in: 3600 };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = init?.body as string;
    assert.ok(body.includes('grant_type=refresh_token'));
    assert.ok(body.includes('refresh_token=r1'));
    return new Response(JSON.stringify(expected), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const result = await dummy.refreshToken('r1');
  assert.deepEqual(result, expected);

  globalThis.fetch = originalFetch;
});
