import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthManager } from '../../src/auth/managers/auth-manager.js';
import { BaseProvider, OAuthProviderConfig } from '../../src/auth/providers/base-provider.js';
import { PKCECodes } from '../../src/auth/utils/pkce-utils.js';

class DummyProvider extends BaseProvider {
  lastParams: Record<string, string> | undefined;
  constructor(id: string, config: OAuthProviderConfig) {
    super(id, {
      issuer: 'https://example.com',
      authorizationEndpoint: 'https://example.com/authorize',
      tokenEndpoint: 'https://example.com/token',
      jwksUri: 'https://example.com/jwks'
    }, config);
  }

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

test('AuthManager.beginLogin returns url and pkce', () => {
  const manager = new AuthManager();
  const provider = new DummyProvider('dummy', { clientId: 'id', clientSecret: 'secret', redirectUri: 'https://app/cb' });
  manager.registerProvider(provider);

  const result = manager.beginLogin('dummy', 'state123');
  assert.ok(result.url.includes('state=state123'));
  assert.ok(result.pkce.codeVerifier.length > 0);
});

test('AuthManager.handleCallback exchanges code using provider', async () => {
  const manager = new AuthManager();
  const provider = new DummyProvider('dummy', { clientId: 'id', clientSecret: 'secret', redirectUri: 'https://app/cb' });
  manager.registerProvider(provider);

  const expected = { access_token: 'token', token_type: 'Bearer' };
  // patch fetch to simulate token response
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(expected), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const pkce: PKCECodes = { codeVerifier: 'verifier', codeChallenge: 'challenge', method: 'S256' };
  const res = await manager.handleCallback('dummy', 'code123', pkce);
  assert.deepEqual(res, expected);

  globalThis.fetch = originalFetch;
});
