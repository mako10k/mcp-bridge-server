import { EventEmitter } from 'events';
import pidusage from 'pidusage';
import { ChildProcess } from 'child_process';
import { InstanceMetrics } from './instance-metrics.js';

export interface ResourceMonitorOptions {
  intervalMs?: number;
  metrics: InstanceMetrics;
}

/**
 * Periodically collects CPU and memory usage for registered processes.
 */
export class ResourceMonitor extends EventEmitter {
  private readonly intervalMs: number;
  private interval: NodeJS.Timeout | null = null;
  private readonly metrics: InstanceMetrics;
  private processes = new Map<string, ChildProcess>();

  constructor(options: ResourceMonitorOptions) {
    super();
    this.intervalMs = options.intervalMs ?? 5000;
    this.metrics = options.metrics;
  }

  addProcess(id: string, proc: ChildProcess): void {
    this.processes.set(id, proc);
  }

  removeProcess(id: string): void {
    this.processes.delete(id);
  }

  start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => this.poll(), this.intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async poll(): Promise<void> {
    for (const [id, proc] of this.processes.entries()) {
      const pid = proc.pid;
      if (!pid) continue;
      try {
        const usage = await pidusage(pid);
        const memoryMB = Math.round(usage.memory / (1024 * 1024));
        this.metrics.recordResourceUsage(id, memoryMB, usage.cpu);
      } catch (err) {
        this.emit('error', err as Error);
      }
    }
  }
}
