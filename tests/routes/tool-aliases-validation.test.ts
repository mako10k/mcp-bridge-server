import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'http';
import { registerToolAliasRoutes } from '../../src/routes/tool-aliases.js';

function createServer() {
  const app = express();
  app.use(express.json());
  const toolRegistry = {
    last: null,
    async handleCreateToolAlias(args: any) {
      this.last = args;
      return { success: true, data: args };
    },
    async handleUpdateToolAlias() { return { success: true }; },
    async handleListAliasedTools() { return { tools: [] }; },
    async handleRemoveToolAlias() { return { success: true }; }
  } as any;
  registerToolAliasRoutes(app, { toolRegistry });
  return { server: app.listen(0), registry: toolRegistry };
}

test('rejects invalid create alias body', async () => {
  const { server } = createServer();
  await new Promise<void>((r) => server.once('listening', r));
  const { port } = server.address() as any;
  const res = await new Promise<http.IncomingMessage>((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/mcp/tool-aliases',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, resolve);
    req.end(JSON.stringify({ toolName: 't1' }));
  });
  assert.equal(res.statusCode, 400);
  server.close();
});

test('trims newName in create alias body', async () => {
  const { server, registry } = createServer();
  await new Promise<void>((r) => server.once('listening', r));
  const { port } = server.address() as any;
  await new Promise<http.IncomingMessage>((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/mcp/tool-aliases',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, resolve);
    req.end(JSON.stringify({ serverId: 's1', toolName: 't1', newName: ' alias ' }));
  });
  assert.equal(registry.last.newName, 'alias');
  server.close();
});

