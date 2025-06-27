import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { MCPServerConfig } from '../config/mcp-config.js';

export enum MCPServerStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  RETRYING = 'retrying',
  FAILED = 'failed'
}

export interface MCPServerStatusInfo {
  status: MCPServerStatus;
  retryCount: number;
  maxRetries: number;
  lastRetryTime: Date | null;
  nextRetryTime: Date | null;
  errorMessage: string | null;
}

export interface MCPConnection {
  id: string;
  config: MCPServerConfig;
  client: Client;
  transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport;
  connected: boolean;
  statusInfo: MCPServerStatusInfo;
}

export interface NamespacedTool {
  name: string;
  namespacedName: string;
  serverId: string;
  description?: string;
  inputSchema?: any;
}

export interface ToolConflict {
  toolName: string;
  servers: string[];
}
