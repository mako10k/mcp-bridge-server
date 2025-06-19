import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'http';
import { createSecurityHeadersMiddleware } from '../../src/middleware/security-headers.js';

function createServer() {
  const app = express();
  app.use(createSecurityHeadersMiddleware());
  app.get('/test', (_req, res) => { res.json({ ok: true }); });
  return app.listen(0);
}

test('sets security headers', async () => {
  const server = createServer();
  await new Promise<void>((r) => server.once('listening', r));
  const { port } = server.address() as any;
  const res = await new Promise<http.IncomingMessage>((resolve) => {
    http.get(`http://127.0.0.1:${port}/test`, resolve);
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.headers['content-security-policy']);
  assert.ok(res.headers['strict-transport-security']);
  assert.equal(res.headers['x-frame-options'], 'DENY');
  server.close();
});
