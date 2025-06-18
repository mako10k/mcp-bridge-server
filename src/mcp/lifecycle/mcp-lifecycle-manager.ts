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

/**
 * Main lifecycle manager coordinating global, user and session instances.
 */
export class MCPLifecycleManager extends EventEmitter {
  private globalManager = new GlobalInstanceManager();
  private userManager = new UserInstanceManager();
  private sessionManager = new SessionInstanceManager();

  constructor() {
    super();
  }

  async getOrCreateInstance(
    config: MCPServerConfig,
    context: MCPInstanceContext
  ): Promise<MCPServerInstance> {
    switch (context.lifecycleMode) {
      case 'global':
        return this.globalManager.createInstance(config, context);
      case 'user':
        return this.userManager.createInstance(config, context);
      case 'session':
        return this.sessionManager.createInstance(config, context);
      default:
        throw new Error(`Unsupported lifecycle mode: ${context.lifecycleMode}`);
    }
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
}
