import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'http';
import { generateKeyPairSync } from 'crypto';
import { JWTUtils } from '../../src/auth/utils/jwt-utils.js';
import { requireAuth } from '../../src/middleware/auth-middleware.js';
import { createRBACMiddleware } from '../../src/middleware/rbac-middleware.js';
import { registerMCPServerRoutes } from '../../src/routes/mcp-servers.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwtUtils = new JWTUtils({ issuer: 'test', audience: 'test', expiresIn: '1h' },
  privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
  publicKey.export({ type: 'pkcs1', format: 'pem' }).toString());

const rbac = {
  defaultRole: 'viewer',
  roles: {
    admin: { id: 'admin', name: 'Admin', permissions: ['*'], isSystemRole: true },
    viewer: { id: 'viewer', name: 'Viewer', permissions: ['read'], isSystemRole: true }
  }
};

function createServer() {
  const app = express();
  const requirePermission = createRBACMiddleware(rbac as any);
  const auth = requireAuth({ jwtUtils, mode: 'required' });
  const mcpManager = {
    getDetailedServerInfo: () => [],
    getServerStatus: () => ({}),
    forceRetryServer: async () => {},
    forceRetryAllServers: async () => []
  } as any;
  registerMCPServerRoutes(app, { mcpManager }, { requireAuth: auth, requirePermission });
  return app.listen(0);
}

test('viewer can access GET /mcp/servers', async () => {
  const token = jwtUtils.sign({ sub: '1', roles: ['viewer'] });
  const server = createServer();
  await new Promise<void>((r) => server.once('listening', r));
  const { port } = server.address() as any;
  const res = await new Promise<http.IncomingMessage>((resolve) => {
    http.get({ hostname: '127.0.0.1', port, path: '/mcp/servers', headers: { Authorization: `Bearer ${token}` } }, resolve);
  });
  assert.equal(res.statusCode, 200);
  server.close();
});

test('viewer cannot POST /mcp/servers/x/retry', async () => {
  const token = jwtUtils.sign({ sub: '1', roles: ['viewer'] });
  const server = createServer();
  await new Promise<void>((r) => server.once('listening', r));
  const { port } = server.address() as any;
  const res = await new Promise<http.IncomingMessage>((resolve) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: '/mcp/servers/s1/retry', method: 'POST', headers: { Authorization: `Bearer ${token}` } }, resolve);
    req.end();
  });
  assert.equal(res.statusCode, 403);
  server.close();
});
