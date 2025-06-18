/**
 * @fileoverview Global instance manager for MCP servers
 * Manages globally shared MCP server instances (singleton pattern)
 */

import { EventEmitter } from 'events';
import { 
  MCPServerInstance, 
  MCPServerConfig, 
  MCPInstanceContext, 
  InstanceKey, 
  InstanceManager,
  InstanceStatus 
} from './types.js';
import { logger } from '../../utils/logger.js';
import { spawn, ChildProcess } from 'child_process';
import { PathTemplateResolver } from '../templates/path-template-resolver.js';

/**
 * Manages globally shared MCP server instances
 * These instances are shared across all users and sessions
 */
export class GlobalInstanceManager extends EventEmitter implements InstanceManager {
  private instances = new Map<string, MCPServerInstance>();
  private templateResolver = new PathTemplateResolver();

  /**
   * Get existing global instance by server ID
   */
  async getInstance(key: InstanceKey): Promise<MCPServerInstance | undefined> {
    if (key.lifecycleMode !== 'global') {
      throw new Error('GlobalInstanceManager only handles global lifecycle mode');
    }

    const instance = this.instances.get(key.serverId);
    if (instance) {
      // Update last accessed time
      instance.lastAccessed = new Date();
      instance.metrics.requestCount++;
    }
    return instance;
  }

  /**
   * Create a new global instance
   */
  async createInstance(
    config: MCPServerConfig, 
    context: MCPInstanceContext
  ): Promise<MCPServerInstance> {
    if (config.lifecycle !== 'global') {
      throw new Error('GlobalInstanceManager only handles global lifecycle mode');
    }

    // Check if instance already exists
    const existing = this.instances.get(config.name);
    if (existing && existing.status === 'running') {
      logger.info(`Global instance already exists for server: ${config.name}`);
      existing.lastAccessed = new Date();
      existing.metrics.requestCount++;
      return existing;
    }

    const instanceId = `global_${config.name}_${Date.now()}`;
    
    logger.info(`Creating global instance: ${instanceId}`);

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
    this.instances.set(config.name, instance);

    try {
      // Start the process
      await this.startProcess(instance);
      
      instance.status = 'running';
      logger.info(`Global instance started successfully: ${instanceId}`);
      
      this.emit('instance-created', instance);
      this.emit('instance-started', instance);
      
      return instance;

    } catch (error) {
      instance.status = 'error';
      instance.error = error as Error;
      instance.metrics.errorCount++;
      
      logger.error(`Failed to start global instance ${instanceId}:`, error);
      this.emit('instance-error', instance, error as Error);
      
      throw error;
    }
  }

  /**
   * Stop a global instance
   */
  async stopInstance(key: InstanceKey): Promise<void> {
    if (key.lifecycleMode !== 'global') {
      throw new Error('GlobalInstanceManager only handles global lifecycle mode');
    }

    const instance = this.instances.get(key.serverId);
    if (!instance) {
      logger.warn(`Global instance not found for server: ${key.serverId}`);
      return;
    }

    logger.info(`Stopping global instance: ${instance.id}`);
    
    instance.status = 'stopping';
    
    try {
      if (instance.process) {
        // Graceful shutdown first
        instance.process.kill('SIGTERM');
        
        // Force kill after timeout
        setTimeout(() => {
          if (instance.process && !instance.process.killed) {
            logger.warn(`Force killing global instance: ${instance.id}`);
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
      this.instances.delete(key.serverId);
      
      logger.info(`Global instance stopped: ${instance.id}`);
      this.emit('instance-stopped', instance);

    } catch (error) {
      instance.status = 'error';
      instance.error = error as Error;
      
      logger.error(`Error stopping global instance ${instance.id}:`, error);
      this.emit('instance-error', instance, error as Error);
      
      throw error;
    }
  }

  /**
   * List all global instances
   */
  listInstances(filter?: Partial<InstanceKey>): MCPServerInstance[] {
    let instances = Array.from(this.instances.values());
    
    if (filter?.serverId) {
      instances = instances.filter(i => i.serverId === filter.serverId);
    }
    
    return instances;
  }

  /**
   * Cleanup unused instances
   */
  async cleanup(): Promise<void> {
    const now = new Date();
    const cleanupPromises: Promise<void>[] = [];

    for (const [serverId, instance] of this.instances.entries()) {
      // Check if instance should be cleaned up
      const idleTime = now.getTime() - instance.lastAccessed.getTime();
      const maxIdleTime = 30 * 60 * 1000; // 30 minutes for global instances

      if (idleTime > maxIdleTime && instance.status === 'running') {
        logger.info(`Cleaning up idle global instance: ${instance.id}`);
        cleanupPromises.push(this.stopInstance({
          serverId,
          lifecycleMode: 'global'
        }));
      }
    }

    if (cleanupPromises.length > 0) {
      await Promise.all(cleanupPromises);
      logger.info(`Cleaned up ${cleanupPromises.length} global instances`);
    }
  }

  /**
   * Get instance count
   */
  getInstanceCount(): number {
    return this.instances.size;
  }

  /**
   * Get running instance count
   */
  getRunningInstanceCount(): number {
    return Array.from(this.instances.values())
      .filter(i => i.status === 'running').length;
  }

  /**
   * Start the MCP server process
   */
  private async startProcess(instance: MCPServerInstance): Promise<void> {
    const { config, context } = instance;

    // Resolve templates for global context (no user-specific variables)
    const templateVars = this.templateResolver.createTemplateVariables({
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

    // Spawn process
    const childProcess: ChildProcess = spawn(resolved.config.command, resolved.config.args, {
      cwd: resolved.config.workingDirectory || process.cwd(),
      env: { ...process.env, ...resolved.config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    instance.process = childProcess;

    // Handle process events
    childProcess.on('error', (error: Error) => {
      instance.status = 'error';
      instance.error = error;
      instance.metrics.errorCount++;
      logger.error(`Global instance process error ${instance.id}:`, error);
      this.emit('instance-error', instance, error);
    });

    childProcess.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      const wasRunning = instance.status === 'running';
      instance.status = code === 0 ? 'stopped' : 'crashed';
      
      logger.info(`Global instance process exited ${instance.id}: code=${code}, signal=${signal}`);
      
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
}
