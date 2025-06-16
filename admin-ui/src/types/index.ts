export interface MCPServer {
  id: string;
  name: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  status: MCPServerStatus;
  connectedAt?: string;
  lastError?: string;
  retryCount?: number;
  nextRetryAt?: string;
}

export interface MCPServerStatus {
  state: 'connected' | 'connecting' | 'disconnected' | 'failed' | 'retrying';
  connectedAt?: string;
  lastError?: string;
  retryCount: number;
  nextRetryAt?: string;
}

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface Tool {
  name: string;
  description?: string;
  inputSchema: any;
  serverId?: string;
  serverName?: string;
  namespace?: string;
}

export interface ToolAlias {
  alias: string;
  originalName: string;
  serverId: string;
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
