/**
 * @fileoverview Session instance manager for MCP servers
 * Manages session-specific MCP server instances with per-user/session isolation
 */

import { EventEmitter } from 'events';
import {
  MCPServerInstance,
  MCPServerConfig,
  MCPInstanceContext,
  InstanceKey,
  InstanceManager,
  UserLimits
} from './types.js';
import { logger } from '../../utils/logger.js';
import { spawn, ChildProcess } from 'child_process';
import { PathTemplateResolver } from '../templates/path-template-resolver.js';

/**
 * Manages session-specific MCP server instances
 * Each session gets its own isolated instance per user
 */
export class SessionInstanceManager extends EventEmitter implements InstanceManager {
  private instances = new Map<string, MCPServerInstance>();
  private templateResolver = new PathTemplateResolver();
  private userLimits = new Map<string, UserLimits>();

  constructor() {
    super();
    this.setDefaultUserLimits();
  }

  /**
   * Get existing session instance
   */
  async getInstance(key: InstanceKey): Promise<MCPServerInstance | undefined> {
    if (key.lifecycleMode !== 'session' || !key.userId || !key.sessionId) {
      throw new Error('SessionInstanceManager requires session lifecycle mode with userId and sessionId');
    }

    const instanceKey = this.getInstanceKey(key);
    const instance = this.instances.get(instanceKey);
    
    if (instance) {
      // Update last accessed time
      instance.lastAccessed = new Date();
      instance.metrics.requestCount++;
    }
    
    return instance;
  }

  /**
   * Create a new session instance
   */
  async createInstance(
    config: MCPServerConfig,
    context: MCPInstanceContext
  ): Promise<MCPServerInstance> {
    if (config.lifecycle !== 'session' || !context.userId || !context.sessionId) {
      throw new Error('SessionInstanceManager requires session lifecycle mode with userId and sessionId');
    }

    const key: InstanceKey = {
      serverId: config.name,
      lifecycleMode: 'session',
      userId: context.userId,
      sessionId: context.sessionId
    };

    // Check if instance already exists
    const existing = await this.getInstance(key);
    if (existing && existing.status === 'running') {
      logger.info(`Session instance already exists: ${existing.id}`);
      return existing;
    }

    // Check user limits
    await this.checkUserLimits(context.userId, config);

    const instanceId = `session_${context.userId}_${context.sessionId}_${config.name}_${Date.now()}`;

    logger.info(`Creating session instance: ${instanceId}`);

    // Create instance object
    const instance: MCPServerInstance = {
      id: instanceId,
      serverId: config.name,
      config,
      context,
      createdAt: new Date(),
      lastAccessed: new Date(),
      status: 'starting',
      metrics: {
        requestCount: 0,
        errorCount: 0
      },
      retryCount: 0
    };

    // Store instance
    const instanceKey = this.getInstanceKey(key);
    this.instances.set(instanceKey, instance);

    try {
      // Start the process
      await this.startProcess(instance);
      
      instance.status = 'running';
      logger.info(`Session instance started successfully: ${instanceId}`);
      
      this.emit('instance-created', instance);
      this.emit('instance-started', instance);
      
      return instance;

    } catch (error) {
      instance.status = 'error';
      instance.error = error as Error;
      instance.metrics.errorCount++;
      
      logger.error(`Failed to start session instance ${instanceId}:`, error);
      this.emit('instance-error', instance, error as Error);
      
      // Remove failed instance
      this.instances.delete(instanceKey);
      
      throw error;
    }
  }

  /**
   * Stop a session instance
   */
  async stopInstance(key: InstanceKey): Promise<void> {
    if (key.lifecycleMode !== 'session' || !key.userId || !key.sessionId) {
      throw new Error('SessionInstanceManager requires session lifecycle mode with userId and sessionId');
    }

    const instanceKey = this.getInstanceKey(key);
    const instance = this.instances.get(instanceKey);
    
    if (!instance) {
      logger.warn(`Session instance not found: ${instanceKey}`);
      return;
    }

    logger.info(`Stopping session instance: ${instance.id}`);
    
    instance.status = 'stopping';
    
    try {
      if (instance.process) {
        // Graceful shutdown first
        instance.process.kill('SIGTERM');
        
        // Force kill after timeout
        setTimeout(() => {
          if (instance.process && !instance.process.killed) {
            logger.warn(`Force killing session instance: ${instance.id}`);
            instance.process.kill('SIGKILL');
          }
        }, 5000);
      }

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        if (!instance.process) {
          resolve();
          return;
        }

        instance.process.on('exit', () => resolve());
        
        // Timeout after 10 seconds
        setTimeout(() => resolve(), 10000);
      });

      instance.status = 'stopped';
      this.instances.delete(instanceKey);
      
      logger.info(`Session instance stopped: ${instance.id}`);
      this.emit('instance-stopped', instance);

    } catch (error) {
      instance.status = 'error';
      instance.error = error as Error;
      
      logger.error(`Error stopping session instance ${instance.id}:`, error);
      this.emit('instance-error', instance, error as Error);
      
      throw error;
    }
  }

  /**
   * List session instances
   */
  listInstances(filter?: Partial<InstanceKey>): MCPServerInstance[] {
    let instances = Array.from(this.instances.values());
    
    if (filter?.serverId) {
      instances = instances.filter(i => i.serverId === filter.serverId);
    }
    
    if (filter?.userId) {
      instances = instances.filter(i => i.context.userId === filter.userId);
    }
    
    return instances;
  }

  /**
   * Cleanup unused session instances
   */
  async cleanup(): Promise<void> {
    const now = new Date();
    const cleanupPromises: Promise<void>[] = [];

    for (const [instanceKey, instance] of this.instances.entries()) {
      // Check if instance should be cleaned up
      const idleTime = now.getTime() - instance.lastAccessed.getTime();
      const maxIdleTime = 15 * 60 * 1000; // 15 minutes for session instances

      if (idleTime > maxIdleTime && instance.status === 'running') {
        logger.info(`Cleaning up idle session instance: ${instance.id}`);
        cleanupPromises.push(this.stopInstance({
          serverId: instance.serverId,
          lifecycleMode: 'session',
          userId: instance.context.userId,
          sessionId: instance.context.sessionId
        }));
      }
    }

    if (cleanupPromises.length > 0) {
      await Promise.all(cleanupPromises);
      logger.info(`Cleaned up ${cleanupPromises.length} session instances`);
    }
  }

  /**
   * Stop all instances for a specific user
   */
  async stopUserSessions(userId: string): Promise<void> {
    const userInstances = this.listInstances({ userId });
    const stopPromises = userInstances.map(instance => 
      this.stopInstance({
        serverId: instance.serverId,
        lifecycleMode: 'session',
        userId,
        sessionId: instance.context.sessionId
      })
    );

    await Promise.all(stopPromises);
    logger.info(`Stopped ${stopPromises.length} session instances for user: ${userId}`);
  }

  /**
   * Get instance count for a user
   */
  getUserSessionInstanceCount(userId: string): number {
    return this.listInstances({ userId }).length;
  }

  /**
   * Set user limits
   */
  setUserLimits(userId: string, limits: UserLimits): void {
    this.userLimits.set(userId, limits);
    logger.info(`Updated limits for user ${userId}:`, limits);
  }

  /**
   * Get user limits
   */
  getUserLimits(userId: string): UserLimits {
    return this.userLimits.get(userId) || this.getDefaultUserLimits();
  }

  /**
   * Generate instance key
   */
  private getInstanceKey(key: InstanceKey): string {
    return `${key.serverId}_${key.userId}_${key.sessionId}`;
  }

  /**
   * Check if user can create new instance
   */
  private async checkUserLimits(userId: string, config: MCPServerConfig): Promise<void> {
    const limits = this.getUserLimits(userId);
    const currentCount = this.getUserSessionInstanceCount(userId);

    // Check instance limit
    if (currentCount >= limits.maxUserInstances) {
      throw new Error(`User ${userId} has reached maximum instance limit: ${limits.maxUserInstances}`);
    }

    // Check lifecycle mode permission
    if (!limits.allowedLifecycleModes.includes(config.lifecycle)) {
      throw new Error(`User ${userId} is not allowed to use lifecycle mode: ${config.lifecycle}`);
    }

    // Check resource limits
    if (config.resourceLimits) {
      if (limits.resourceQuota.maxMemoryMB && 
          config.resourceLimits.maxMemoryMB && 
          config.resourceLimits.maxMemoryMB > limits.resourceQuota.maxMemoryMB) {
        throw new Error(`Requested memory exceeds user quota: ${config.resourceLimits.maxMemoryMB}MB > ${limits.resourceQuota.maxMemoryMB}MB`);
      }
    }
  }

  /**
   * Start the MCP server process for user
   */
  private async startProcess(instance: MCPServerInstance): Promise<void> {
    const { config, context } = instance;

    // Create user-specific template variables
    const templateVars = this.templateResolver.createTemplateVariables({
      userId: context.userId,
      userEmail: context.userEmail,
      requestId: context.requestId,
      timestamp: context.timestamp
    });

    const resolved = this.templateResolver.validateAndResolveConfig(
      {
        command: config.command,
        args: config.args,
        env: config.env,
        workingDirectory: config.workingDirectory,
        pathTemplates: config.pathTemplates
      },
      templateVars
    );

    if (!resolved.validation.valid) {
      throw new Error(`Invalid configuration: ${resolved.validation.errors.join(', ')}`);
    }

    // Log warnings
    if (resolved.validation.warnings.length > 0) {
      logger.warn(`Configuration warnings for ${instance.id}:`, resolved.validation.warnings);
    }

    // Add session-specific environment variables
    const userEnv = {
      ...process.env,
      ...resolved.config.env,
      MCP_USER_ID: context.userId,
      MCP_USER_EMAIL: context.userEmail || '',
      MCP_SESSION_ID: context.sessionId,
      MCP_LIFECYCLE_MODE: 'session'
    };

    // Spawn process
    const childProcess: ChildProcess = spawn(resolved.config.command, resolved.config.args, {
      cwd: resolved.config.workingDirectory || process.cwd(),
      env: userEnv,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    instance.process = childProcess;

    // Handle process events
    childProcess.on('error', (error: Error) => {
      instance.status = 'error';
      instance.error = error;
      instance.metrics.errorCount++;
      logger.error(`Session instance process error ${instance.id}:`, error);
      this.emit('instance-error', instance, error);
    });

    childProcess.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      const wasRunning = instance.status === 'running';
      instance.status = code === 0 ? 'stopped' : 'crashed';
      
      logger.info(`Session instance process exited ${instance.id}: code=${code}, signal=${signal}`);
      
      if (wasRunning) {
        this.emit('instance-stopped', instance);
      }
    });

    // Wait for process to start
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Process start timeout'));
      }, 10000);

      childProcess.once('spawn', () => {
        clearTimeout(timeout);
        resolve();
      });

      childProcess.once('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Set default user limits
   */
  private setDefaultUserLimits(): void {
    // These should come from configuration
    const defaultLimits: UserLimits = {
      maxUserInstances: 5,
      maxSessionInstances: 3,
      allowedLifecycleModes: ['user', 'session'],
      resourceQuota: {
        maxMemoryMB: 1024,
        maxCpuPercent: 50,
        timeoutMinutes: 60
      }
    };

    this.userLimits.set('default', defaultLimits);
  }

  /**
   * Get default user limits
   */
  private getDefaultUserLimits(): UserLimits {
    return this.userLimits.get('default')!;
  }
}
