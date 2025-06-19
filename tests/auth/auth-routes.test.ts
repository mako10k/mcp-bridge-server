import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { AddressInfo } from 'net';
import http from 'http';
import { AuthManager } from '../../src/auth/managers/auth-manager.js';
import { BaseProvider, OAuthProviderConfig } from '../../src/auth/providers/base-provider.js';
import { registerAuthRoutes } from '../../src/routes/auth.js';
import { PKCECodes } from '../../src/auth/utils/pkce-utils.js';
import { sessionStore } from '../../src/auth/session-store.js';

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
  async getUserInfo(accessToken: string): Promise<any> {
    const res = await fetch('https://example.com/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
    return res.json();
  }
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
  globalThis.fetch = async (url: any) => {
    if (typeof url === 'string' && url.includes('token')) {
      return new Response(JSON.stringify(expected), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ sub: 'user1', email: 'user@example.com' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

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

test('callback assigns roles from user mappings', async () => {
  const manager = new AuthManager();
  const provider = new DummyProvider('dummy', { clientId: 'id', clientSecret: 'sec', redirectUri: 'https://app/cb' });
  manager.registerProvider(provider);

  const rbac = {
    defaultRole: 'viewer',
    roles: {
      admin: { id: 'admin', name: 'Admin', permissions: ['*'], isSystemRole: true },
      viewer: { id: 'viewer', name: 'Viewer', permissions: ['read'], isSystemRole: true }
    },
    userMappings: [{ email: 'test@example.com', role: 'admin' }]
  };

  const app = express();
  app.use(express.json());
  registerAuthRoutes(app, { authManager: manager, getRBACConfig: () => rbac });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${address.port}`;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url: any) => {
    if (typeof _url === 'string' && _url.includes('token')) {
      return new Response(JSON.stringify({ access_token: 't', token_type: 'Bearer' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ sub: '1', email: 'test@example.com' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const loginData = await new Promise<any>((resolve, reject) => {
    http.get(`${base}/auth/login/dummy`, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
  const state = new URL(loginData.authUrl).searchParams.get('state');

  await new Promise<http.IncomingMessage>((resolve, reject) => {
    http.get(`${base}/auth/callback/dummy?code=abc&state=${state}`,(res) => { res.resume(); resolve(res); }).on('error', reject);
  });

  const session = sessionStore.get(loginData.sessionId);
  assert.deepEqual(session?.user?.roles, ['admin']);

  globalThis.fetch = originalFetch;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
