import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'http';
import { createCorsMiddleware } from '../../src/middleware/cors-middleware.js';

function createServer() {
  const app = express();
  app.use(createCorsMiddleware({ allowedOrigins: ['http://example.com'], allowCredentials: true }));
  app.get('/data', (_req, res) => { res.json({ ok: true }); });
  return app.listen(0);
}

test('allows configured origin with credentials', async () => {
  const server = createServer();
  await new Promise<void>((r) => server.once('listening', r));
  const { port } = server.address() as any;
  const res = await new Promise<http.IncomingMessage>((resolve) => {
    http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: '/data',
        headers: { Origin: 'http://example.com' }
      },
      resolve
    );
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['access-control-allow-origin'], 'http://example.com');
  assert.equal(res.headers['access-control-allow-credentials'], 'true');
  server.close();
});

test('rejects unknown origin', async () => {
  const server = createServer();
  await new Promise<void>((r) => server.once('listening', r));
  const { port } = server.address() as any;
  const res = await new Promise<http.IncomingMessage>((resolve) => {
    http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: '/data',
        headers: { Origin: 'http://evil.com' }
      },
      resolve
    );
  });
  assert.equal(res.statusCode, 403);
  server.close();
});

