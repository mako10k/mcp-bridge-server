import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'http';
import { AuthContextManager } from '../../src/auth/context/auth-context.js';
import { createAuthContextMiddleware, AuthContextRequest } from '../../src/middleware/auth-context.js';

function createServer(user?: any) {
  const app = express();
  const manager = new AuthContextManager();
  app.use((req, _res, next) => {
    (req as any).sessionID = 's1';
    if (user) (req as any).user = user;
    next();
  });
  app.use(createAuthContextMiddleware(manager));
  app.get('/ctx', (req: AuthContextRequest, res) => {
    res.json(req.authContext);
  });
  return app.listen(0);
}

test('auth context includes user info when authenticated', async () => {
  const user = { id: 'u1', email: 'u@example.com', name: 'U', roles: ['admin'], sessionId: 's1' };
  const server = createServer(user);
  await new Promise<void>((r) => server.once('listening', r));
  const { port } = server.address() as any;
  const data = await new Promise<string>((resolve) => {
    http.get(`http://127.0.0.1:${port}/ctx`, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(body));
    });
  });
  const ctx = JSON.parse(data);
  assert.equal(ctx.userId, 'u1');
  assert.equal(ctx.userEmail, 'u@example.com');
  assert.equal(ctx.sessionId, 's1');
  assert.ok(ctx.requestId);
  server.close();
});

test('auth context still provided when unauthenticated', async () => {
  const server = createServer();
  await new Promise<void>((r) => server.once('listening', r));
  const { port } = server.address() as any;
  const data = await new Promise<string>((resolve) => {
    http.get(`http://127.0.0.1:${port}/ctx`, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(body));
    });
  });
  const ctx = JSON.parse(data);
  assert.equal(ctx.userId, undefined);
  assert.equal(ctx.sessionId, 's1');
  assert.ok(ctx.requestId);
  server.close();
});
