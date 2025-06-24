/**
 * SessionInstanceManager
 * Manages session-specific MCP instances.
 */

import { MCPInstanceContext } from './types';
import { logger } from '../../utils/logger';

export class SessionInstanceManager {
  private sessionInstances: Map<string, MCPInstanceContext>;

  constructor() {
    this.sessionInstances = new Map();
  }

  /**
   * Create or retrieve an instance for a specific session.
   * @param sessionId - The ID of the session.
   * @returns The MCPInstanceContext for the session.
   */
  public getInstance(sessionId: string): MCPInstanceContext {
    if (!this.sessionInstances.has(sessionId)) {
      const instance = this.createInstance(sessionId);
      this.sessionInstances.set(sessionId, instance);
      logger.info(`Created new instance for session: ${sessionId}`);
    }
    return this.sessionInstances.get(sessionId)!;
  }

  /**
   * Remove an instance for a specific session.
   * @param sessionId - The ID of the session.
   */
  public removeInstance(sessionId: string): void {
    if (this.sessionInstances.has(sessionId)) {
      this.sessionInstances.delete(sessionId);
      logger.info(`Removed instance for session: ${sessionId}`);
    }
  }

  /**
   * Create a new MCPInstanceContext for a session.
   * @param sessionId - The ID of the session.
   * @returns A new MCPInstanceContext.
   */
  private createInstance(sessionId: string): MCPInstanceContext {
    // Placeholder for actual instance creation logic
    return {
      sessionId,
      createdAt: new Date(),
    };
  }
}
