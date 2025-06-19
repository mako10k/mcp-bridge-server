import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SessionInstanceManager } from '../../../src/mcp/lifecycle/session-instance-manager.js';
import { MCPServerConfig, MCPInstanceContext } from '../../../src/mcp/lifecycle/types.js';

function createTestConfig(): MCPServerConfig {
  return {
    name: 'echo',
    command: 'node',
    args: ['-e', 'console.log("hello")'],
    lifecycle: 'session',
    requireAuth: false
  };
}

function createTestContext(opts: Partial<MCPInstanceContext>): MCPInstanceContext {
  return {
    lifecycleMode: 'session',
    userId: 'user1',
    sessionId: 'sess1',
    requestId: 'req',
    timestamp: new Date(),
    ...opts
  };
}

test('creates separate instances for different sessions', async () => {
  const manager = new SessionInstanceManager();
  const config = createTestConfig();
  const ctx1 = createTestContext({ sessionId: 's1' });
  const ctx2 = createTestContext({ sessionId: 's2' });
  const inst1 = await manager.createInstance(config, ctx1);
  const inst2 = await manager.createInstance(config, ctx2);
  assert.notEqual(inst1.id, inst2.id);
  await manager.stopInstance({ serverId: config.name, lifecycleMode: 'session', userId: ctx1.userId!, sessionId: 's1' });
  await manager.stopInstance({ serverId: config.name, lifecycleMode: 'session', userId: ctx2.userId!, sessionId: 's2' });
});

test('reuses instance for same session', async () => {
  const manager = new SessionInstanceManager();
  const config = createTestConfig();
  const ctx = createTestContext({ sessionId: 'same' });
  const inst1 = await manager.createInstance(config, ctx);
  const inst2 = await manager.getInstance({ serverId: config.name, lifecycleMode: 'session', userId: ctx.userId!, sessionId: 'same' });
  assert.equal(inst1.id, inst2?.id);
  await manager.stopInstance({ serverId: config.name, lifecycleMode: 'session', userId: ctx.userId!, sessionId: 'same' });
});

import fs from 'fs';

test('spawned process runs with specified uid/gid', async () => {
  const manager = new SessionInstanceManager();
  fs.copyFileSync('/usr/bin/id', '/tmp/testid');
  fs.chmodSync('/tmp/testid', 0o755);
  const config: MCPServerConfig = {
    name: 'uid-test',
    command: '/tmp/testid',
    args: ['-u'],
    lifecycle: 'session',
    requireAuth: false,
    uid: 65534,
    gid: 65534,
  };
  const ctx = createTestContext({ sessionId: 'uid' });
  const inst = await manager.createInstance(config, ctx);
  const output = await new Promise<string>(resolve => {
    let data = '';
    inst.process!.stdout!.on('data', chunk => (data += chunk.toString()));
    inst.process!.on('exit', () => resolve(data.trim()));
  });
  assert.equal(output, '65534');
  await manager.stopInstance({ serverId: config.name, lifecycleMode: 'session', userId: ctx.userId!, sessionId: 'uid' });
  fs.unlinkSync('/tmp/testid');
});

