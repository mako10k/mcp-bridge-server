import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MCPLifecycleManager } from '../../../src/mcp/lifecycle/mcp-lifecycle-manager.js';
import { MCPServerConfig, MCPInstanceContext } from '../../../src/mcp/lifecycle/types.js';

function createConfig(mode: 'global' | 'user' | 'session'): MCPServerConfig {
  return {
    name: `srv-${mode}`,
    command: 'node',
    args: ['-e', 'console.log("ok")'],
    lifecycle: mode,
    requireAuth: false
  } as MCPServerConfig;
}

function createContext(mode: 'global' | 'user' | 'session'): MCPInstanceContext {
  return {
    lifecycleMode: mode,
    userId: mode !== 'global' ? 'u1' : undefined,
    sessionId: mode === 'session' ? 's1' : undefined,
    requestId: 'req1',
    timestamp: new Date()
  } as MCPInstanceContext;
}

test('lifecycle manager creates instances per mode', async () => {
  const mgr = new MCPLifecycleManager(50);
  const g = await mgr.getOrCreateInstance(createConfig('global'), createContext('global'));
  const u = await mgr.getOrCreateInstance(createConfig('user'), createContext('user'));
  const s = await mgr.getOrCreateInstance(createConfig('session'), createContext('session'));
  assert.equal(g.context.lifecycleMode, 'global');
  assert.equal(u.context.userId, 'u1');
  assert.equal(s.context.sessionId, 's1');
  mgr.stopCleanupTask();
  mgr.stopMonitoring();
});

