import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'http';
import { generateKeyPairSync } from 'crypto';
import { JWTUtils } from '../../src/auth/utils/jwt-utils.js';
import { requireAuth } from '../../src/middleware/auth-middleware.js';
import { createRBACMiddleware } from '../../src/middleware/rbac-middleware.js';
import { RBACConfig } from '../../src/auth/types/rbac-types.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwtUtils = new JWTUtils({ issuer: 'test', audience: 'test', expiresIn: '1h' }, privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(), publicKey.export({ type: 'pkcs1', format: 'pem' }).toString());

const rbac: RBACConfig = {
  defaultRole: 'viewer',
  roles: {
    admin: { id: 'admin', name: 'Admin', permissions: ['*'], isSystemRole: true },
    viewer: { id: 'viewer', name: 'Viewer', permissions: ['read'], isSystemRole: true }
  }
};

function createServer(options = {}) {
  const app = express();
  const requirePermission = createRBACMiddleware(rbac, options as any);
  app.get(
    '/secure',
    requireAuth({ jwtUtils, mode: 'required' }),
    requirePermission('read'),
    (_req, res) => {
      res.json({ ok: true });
    }
  );
  app.get(
    '/admin',
    requireAuth({ jwtUtils, mode: 'required' }),
    requirePermission('write'),
    (_req, res) => {
      res.json({ ok: true });
    }
  );
  return app.listen(0);
}

test('requirePermission allows when role has permission', async () => {
  const token = jwtUtils.sign({ sub: '1', roles: ['admin'] });
  const server = createServer();
  await new Promise<void>((r) => server.once('listening', r));
  const { port } = server.address() as any;
  const res = await new Promise<http.IncomingMessage>((resolve) => {
    http.get({ hostname: '127.0.0.1', port, path: '/secure', headers: { Authorization: `Bearer ${token}` } }, resolve);
  });
  assert.equal(res.statusCode, 200);
  server.close();
});

test('requirePermission denies when permission missing', async () => {
  const token = jwtUtils.sign({ sub: '1', roles: ['viewer'] });
  const server = createServer();
  await new Promise<void>((r) => server.once('listening', r));
  const { port } = server.address() as any;
  const res = await new Promise<http.IncomingMessage>((resolve) => {
    http.get({ hostname: '127.0.0.1', port, path: '/admin', headers: { Authorization: `Bearer ${token}` } }, resolve);
  });
  assert.equal(res.statusCode, 403);
  server.close();
});

test('dynamic permission checker denies even with role', async () => {
  const token = jwtUtils.sign({ sub: '1', roles: ['admin'] });
  const server = createServer({
    checkPermission: () => false
  });
  await new Promise<void>((r) => server.once('listening', r));
  const { port } = server.address() as any;
  const res = await new Promise<http.IncomingMessage>((resolve) => {
    http.get(
      { hostname: '127.0.0.1', port, path: '/secure', headers: { Authorization: `Bearer ${token}` } },
      resolve
    );
  });
  assert.equal(res.statusCode, 403);
  server.close();
});

test('dynamic permission checker allows when role lacks permission', async () => {
  const token = jwtUtils.sign({ sub: '1', roles: ['viewer'] });
  const server = createServer({
    checkPermission: () => true
  });
  await new Promise<void>((r) => server.once('listening', r));
  const { port } = server.address() as any;
  const res = await new Promise<http.IncomingMessage>((resolve) => {
    http.get(
      { hostname: '127.0.0.1', port, path: '/admin', headers: { Authorization: `Bearer ${token}` } },
      resolve
    );
  });
  assert.equal(res.statusCode, 200);
  server.close();
});
