export interface MCPServer {
  id: string;
  name: string;
  transport: 'stdio' | 'http' | 'sse';
  connected: boolean;
  statusInfo: MCPServerStatusInfo;
}

export interface MCPServerStatusInfo {
  status: 'connected' | 'connecting' | 'disconnected' | 'failed' | 'retrying';
  retryCount: number;
  maxRetries: number;
  lastRetryTime: string | null;
  nextRetryTime: string | null;
  errorMessage: string | null;
}

// Legacy interface for backward compatibility
export interface MCPServerStatus {
  state: 'connected' | 'connecting' | 'disconnected' | 'failed' | 'retrying';
  connectedAt?: string;
  lastError?: string;
  retryCount: number;
  nextRetryAt?: string;
}

export interface MCPServerConfig {
  name?: string;
  displayName?: string;
  transport: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  cwd?: string;
  env?: Record<string, string>;
  enabled?: boolean;
  timeout?: number;
  restartOnFailure?: boolean;
  maxRestarts?: number;
}

export interface Tool {
  name: string;
  namespacedName?: string;
  description?: string;
  inputSchema?: any;
  serverId?: string;
  serverName?: string;
  namespace?: string;
  originalName?: string;
  source?: 'explicit' | 'auto-discovery';
}

export interface ToolAlias {
  alias: string;
  originalName: string;
  serverId: string;
  source: 'explicit' | 'auto-discovery';
}

export interface GlobalConfig {
  httpPort?: number;
  hostName?: string;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
  enableToolDiscovery?: boolean;
  autoToolDiscoveryPatterns?: string[];
  fixInvalidToolSchemas?: boolean;
  maxRetries?: number;
  retryInterval?: number;
}

export interface ServerStats {
  totalServers: number;
  connectedServers: number;
  failedServers: number;
  totalTools: number;
  aliasedTools: number;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  serverId?: string;
  error?: string;
}
