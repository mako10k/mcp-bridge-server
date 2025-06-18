import { EventEmitter } from 'events';
import { InstanceManager } from './types.js';

export interface InstanceCleanupOptions {
  intervalMs?: number;
  managers: InstanceManager[];
}

/**
 * Periodically triggers cleanup on all provided instance managers.
 */
export class InstanceCleanup extends EventEmitter {
  private interval: NodeJS.Timeout | null = null;
  private readonly managers: InstanceManager[];
  private readonly intervalMs: number;

  constructor(options: InstanceCleanupOptions) {
    super();
    this.managers = options.managers;
    this.intervalMs = options.intervalMs ?? 10 * 60 * 1000;
  }

  start(): void {
    if (this.interval) return;
    this.interval = setInterval(async () => {
      this.emit('cleanup-started');
      try {
        const results = await Promise.all(
          this.managers.map(m => m.cleanup())
        );
        const removed = results.reduce((sum, r) => sum + r, 0);
        this.emit('cleanup-completed', removed);
      } catch (err) {
        this.emit('cleanup-error', err as Error);
      }
    }, this.intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
