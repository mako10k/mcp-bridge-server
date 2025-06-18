import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { AddressInfo } from 'net';
import http from 'http';
import { AuthManager } from '../../src/auth/managers/auth-manager.js';
import { BaseProvider, OAuthProviderConfig } from '../../src/auth/providers/base-provider.js';
import { registerAuthRoutes } from '../../src/routes/auth.js';
import { PKCECodes } from '../../src/auth/utils/pkce-utils.js';

class DummyProvider extends BaseProvider {
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
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', pkce.codeChallenge);
    url.searchParams.set('code_challenge_method', pkce.method);
    return url.toString();
  }
  async getUserInfo(): Promise<{ sub: string }> { return { sub: 'user1' }; }
}

test('auth routes login and callback flow', async () => {
  const manager = new AuthManager();
  const provider = new DummyProvider('dummy', { clientId: 'id', clientSecret: 'sec', redirectUri: 'https://app/cb' });
  manager.registerProvider(provider);

  const app = express();
  app.use(express.json());
  registerAuthRoutes(app, { authManager: manager });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${address.port}`;

  // patch fetch for token request
  const expected = { access_token: 'token', token_type: 'Bearer' };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(expected), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const loginData = await new Promise<any>((resolve, reject) => {
    http.get(`${base}/auth/login/dummy`, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
  assert.ok(loginData.authUrl.includes('state='));
  assert.ok(loginData.sessionId);
  const stateParam = new URL(loginData.authUrl).searchParams.get('state');
  const cbRes = await new Promise<http.IncomingMessage>((resolve, reject) => {
    http.get(`${base}/auth/callback/dummy?code=abc&state=${stateParam}`,(res) => resolve(res)).on('error', reject);
  });
  assert.equal(cbRes.statusCode, 302);
  assert.ok(cbRes.headers.location?.includes('/admin?auth=success'));

  globalThis.fetch = originalFetch;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
