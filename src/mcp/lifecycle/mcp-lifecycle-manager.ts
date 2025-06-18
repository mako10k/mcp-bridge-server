import { EventEmitter } from 'events';
import {
  MCPServerInstance,
  MCPServerConfig,
  MCPInstanceContext,
  InstanceKey
} from './types.js';
import { GlobalInstanceManager } from './global-instance-manager.js';
import { UserInstanceManager } from './user-instance-manager.js';
import { SessionInstanceManager } from './session-instance-manager.js';
import { InstanceMetrics, InstanceSummary } from '../monitoring/instance-metrics.js';
import { InstanceCleanup } from './instance-cleanup.js';

/**
 * Main lifecycle manager coordinating global, user and session instances.
 */
export class MCPLifecycleManager extends EventEmitter {
  private globalManager = new GlobalInstanceManager();
  private userManager = new UserInstanceManager();
  private sessionManager = new SessionInstanceManager();
  private metrics = new InstanceMetrics();
  private cleanup: InstanceCleanup;

  constructor(cleanupIntervalMs = 10 * 60 * 1000) {
    super();
    this.cleanup = new InstanceCleanup({
      intervalMs: cleanupIntervalMs,
      managers: [this.globalManager, this.userManager, this.sessionManager]
    });
    this.cleanup.on('cleanup-started', () => this.emit('cleanup-started'));
    this.cleanup.on('cleanup-completed', (r) => this.emit('cleanup-completed', r));
    this.cleanup.on('cleanup-error', (e) => this.emit('instance-error', { id: 'cleanup' } as any, e));
    this.cleanup.start();
  }

  async getOrCreateInstance(
    config: MCPServerConfig,
    context: MCPInstanceContext
  ): Promise<MCPServerInstance> {
    let instance: MCPServerInstance;
    switch (context.lifecycleMode) {
      case 'global':
        instance = await this.globalManager.createInstance(config, context);
        break;
      case 'user':
        instance = await this.userManager.createInstance(config, context);
        break;
      case 'session':
        instance = await this.sessionManager.createInstance(config, context);
        break;
      default:
        throw new Error(`Unsupported lifecycle mode: ${context.lifecycleMode}`);
    }
    this.metrics.recordInstanceAccess(instance.id, context.userId);
    return instance;
  }

  async terminateInstance(key: InstanceKey): Promise<void> {
    switch (key.lifecycleMode) {
      case 'global':
        return this.globalManager.stopInstance(key);
      case 'user':
        return this.userManager.stopInstance(key);
      case 'session':
        return this.sessionManager.stopInstance(key);
    }
  }

  async terminateUserInstances(userId: string): Promise<void> {
    await this.userManager.stopUserInstances(userId);
    await this.sessionManager.stopUserSessions(userId);
  }

  async terminateSessionInstances(sessionId: string): Promise<void> {
    const instances = this.sessionManager.listInstances({ sessionId });
    await Promise.all(
      instances.map(i =>
        this.sessionManager.stopInstance({
          serverId: i.serverId,
          lifecycleMode: 'session',
          userId: i.context.userId!,
          sessionId
        })
      )
    );
  }

  listActiveInstances(): MCPServerInstance[] {
    return [
      ...this.globalManager.listInstances(),
      ...this.userManager.listInstances(),
      ...this.sessionManager.listInstances()
    ];
  }

  getMetrics(): InstanceSummary {
    return this.metrics.getAggregatedMetrics();
  }

  stopCleanupTask(): void {
    this.cleanup.stop();
  }
}

