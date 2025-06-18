import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ResourceMonitor } from '../../../src/mcp/monitoring/resource-monitor.js';
import { InstanceMetrics } from '../../../src/mcp/monitoring/instance-metrics.js';
import { spawn } from 'child_process';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

test('resource monitor records usage metrics', async () => {
  const metrics = new InstanceMetrics();
  const monitor = new ResourceMonitor({ metrics, intervalMs: 100 });
  const proc = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 300);']);
  monitor.addProcess('p1', proc);
  monitor.start();
  await sleep(200);
  monitor.stop();
  proc.kill();
  await new Promise(res => proc.on('exit', res));
  const entries = metrics.getInstanceMetrics('p1');
  assert.ok(entries.some(m => m.type === 'memory'));
  assert.ok(entries.some(m => m.type === 'cpu'));
});

