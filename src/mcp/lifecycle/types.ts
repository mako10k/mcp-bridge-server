/**
 * @fileoverview Type definitions for MCP server lifecycle management
 * Defines lifecycle modes, server configurations, instance contexts, and management interfaces
 */

import { ChildProcess } from 'child_process';
import { Client as MCPClient } from '@modelcontextprotocol/sdk/client/index.js';
import { OIDCUserInfo } from '../../auth/types/oidc-types.js';

/**
 * MCP server lifecycle modes
 */
export type LifecycleMode = 'global' | 'user' | 'session';

/**
 * Resource limits for MCP server instances
 */
export interface ResourceLimits {
  maxMemoryMB?: number;
  maxCpuPercent?: number;
  timeoutMinutes?: number;
  maxInstances?: number;
}

/**
 * Configuration for an MCP server with lifecycle management
 */
export interface MCPServerConfig {
  name: string;
  command?: string;
  args?: string[];
  lifecycle: LifecycleMode;
  requireAuth: boolean;
  pathTemplates?: Record<string, string>;
  env?: Record<string, string>;
  resourceLimits?: ResourceLimits;
  workingDirectory?: string;
  /** User ID to run the server process as */
  uid?: number;
  /** Group ID to run the server process as */
  gid?: number;
  autoRestart?: boolean;
  maxRetries?: number;
}

/**
 * Context information for an MCP server instance
 */
export interface MCPInstanceContext {
  lifecycleMode: LifecycleMode;
  userId?: string;
  userEmail?: string;
  sessionId?: string;
  authInfo?: OIDCUserInfo;
  requestId: string;
  timestamp: Date;
  permissions?: string[];
}

/**
 * Status of an MCP server instance
 */
export type InstanceStatus = 
  | 'starting' 
  | 'running' 
  | 'stopping' 
  | 'stopped' 
  | 'error' 
  | 'timeout'
  | 'crashed';

/**
 * Metrics for an MCP server instance
 */
export interface InstanceMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  requestCount: number;
  errorCount: number;
  lastRequestTime?: Date;
  averageResponseTime?: number;
}

/**
 * Running MCP server instance
 */
export interface MCPServerInstance {
  id: string;
  serverId: string;
  config: MCPServerConfig;
  context: MCPInstanceContext;
  process?: ChildProcess;
  client?: MCPClient;
  createdAt: Date;
  lastAccessed: Date;
  status: InstanceStatus;
  metrics: InstanceMetrics;
  error?: Error;
  retryCount: number;
}

/**
 * Key to identify a unique instance
 */
export interface InstanceKey {
  serverId: string;
  lifecycleMode: LifecycleMode;
  userId?: string;
  sessionId?: string;
}

/**
 * Instance cleanup configuration
 */
export interface CleanupConfig {
  idleTimeoutMinutes: number;
  maxInstanceAge: number;
  cleanupIntervalMinutes: number;
  forceCleanupAfterMinutes: number;
}

/**
 * Interface for instance managers
 */
export interface InstanceManager {
  getInstance(key: InstanceKey): Promise<MCPServerInstance | undefined>;
  createInstance(config: MCPServerConfig, context: MCPInstanceContext): Promise<MCPServerInstance>;
  stopInstance(key: InstanceKey): Promise<void>;
  listInstances(filter?: Partial<InstanceKey>): MCPServerInstance[];
  /**
   * Cleanup idle or expired instances.
   *
   * @returns number of instances removed
   */
  cleanup(): Promise<number>;
}

/**
 * Events emitted by lifecycle manager
 */
export interface LifecycleEvents {
  'instance-created': (instance: MCPServerInstance) => void;
  'instance-started': (instance: MCPServerInstance) => void;
  'instance-stopped': (instance: MCPServerInstance) => void;
  'instance-error': (instance: MCPServerInstance, error: Error) => void;
  'cleanup-started': () => void;
  'cleanup-completed': (removed: number) => void;
}

/**
 * User limits and quotas
 */
export interface UserLimits {
  maxUserInstances: number;
  maxSessionInstances: number;
  allowedLifecycleModes: LifecycleMode[];
  resourceQuota: ResourceLimits;
}

/**
 * Template variables for path resolution
 */
export interface TemplateVariables {
  userId?: string;
  userEmail?: string;
  sessionId?: string;
  timestamp: string;
  requestId: string;
  [key: string]: string | undefined;
}

/**
 * Security validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MCPInstanceMetric {
  instanceId: string;
  userId?: string;
  timestamp: Date;
  type: 'access' | 'memory' | 'cpu';
  value: number;
}

export interface InstanceSummary {
  totalInstances: number;
  totalAccesses: number;
  activeUsers: number;
  averageMemoryUsage: number;
  averageCpuUsage: number;
}
