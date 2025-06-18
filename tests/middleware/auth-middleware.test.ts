import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'http';
import { generateKeyPairSync } from 'crypto';
import { JWTUtils } from '../../src/auth/utils/jwt-utils.js';
import { requireAuth } from '../../src/middleware/auth-middleware.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwtUtils = new JWTUtils({ issuer: 'test', audience: 'test', expiresIn: '1h' }, privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(), publicKey.export({ type: 'pkcs1', format: 'pem' }).toString());

function createServer(mode: 'disabled' | 'optional' | 'required') {
  const app = express();
  app.get('/protected', requireAuth({ jwtUtils, mode }), (_req, res) => {
    res.json({ ok: true });
  });
  return app.listen(0);
}

test('requireAuth allows valid token', async () => {
  const token = jwtUtils.sign({ sub: '1', roles: ['admin'] });
  const server = createServer('required');
  await new Promise<void>((r) => server.once('listening', r));
  const { port } = server.address() as any;
  const data = await new Promise<http.IncomingMessage>((resolve) => {
    http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: '/protected',
        headers: { Authorization: `Bearer ${token}` }
      },
      resolve
    );
  });
  assert.equal(data.statusCode, 200);
  server.close();
});

test('requireAuth rejects missing token when required', async () => {
  const server = createServer('required');
  await new Promise<void>((r) => server.once('listening', r));
  const { port } = server.address() as any;
  const res = await new Promise<http.IncomingMessage>((resolve) => {
    http.get(`http://127.0.0.1:${port}/protected`, resolve);
  });
  assert.equal(res.statusCode, 401);
  server.close();
});

test('requireAuth passes through when optional and no token', async () => {
  const server = createServer('optional');
  await new Promise<void>((r) => server.once('listening', r));
  const { port } = server.address() as any;
  const res = await new Promise<http.IncomingMessage>((resolve) => {
    http.get(`http://127.0.0.1:${port}/protected`, resolve);
  });
  assert.equal(res.statusCode, 200);
  server.close();
});
