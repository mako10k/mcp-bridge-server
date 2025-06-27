import { MCPServerConfig } from '../config/mcp-config.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { logger } from '../utils/logger.js';
import { MCPConnection, MCPServerStatus, MCPServerStatusInfo } from './mcp-bridge-types';

export class MCPServerConnectionManager {
  async createStdioTransport(config: MCPServerConfig): Promise<StdioClientTransport> {
    if (!config.command) throw new Error('Command is required for STDIO transport');
    const envVars: Record<string, string> = {};
    Object.entries(process.env).forEach(([key, value]) => {
      if (typeof value === 'string') envVars[key] = value;
    });
    if (config.env) Object.assign(envVars, config.env);
    return new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env: envVars,
      cwd: config.cwd
    });
  }

  async createSSETransport(config: MCPServerConfig): Promise<SSEClientTransport> {
    if (!config.url) throw new Error('URL is required for SSE transport');
    new URL(config.url); // throws if invalid
    const options: any = config.headers ? { requestInit: { headers: config.headers } } : {};
    return new SSEClientTransport(new URL(config.url), options);
  }

  async createHTTPTransport(config: MCPServerConfig): Promise<StreamableHTTPClientTransport> {
    if (!config.url) throw new Error('URL is required for HTTP transport');
    new URL(config.url);
    const options: any = config.headers ? { requestInit: { headers: config.headers } } : {};
    return new StreamableHTTPClientTransport(new URL(config.url), options);
  }

  async connectToServer(config: MCPServerConfig): Promise<MCPConnection> {
    let transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport;
    switch (config.transport) {
      case 'stdio':
        transport = await this.createStdioTransport(config);
        break;
      case 'sse':
        transport = await this.createSSETransport(config);
        break;
      case 'http':
        transport = await this.createHTTPTransport(config);
        break;
      default:
        throw new Error(`Unsupported transport type: ${config.transport}`);
    }
    const client = new Client({ name: 'mcp-bridge', version: '1.0.0' }, { capabilities: { tools: {}, resources: {} } });
    await client.connect(transport);
    return {
      id: config.name,
      config,
      client,
      transport,
      connected: true,
      statusInfo: {
        status: MCPServerStatus.CONNECTED,
        retryCount: 0,
        maxRetries: config.maxRestarts || 5,
        lastRetryTime: null,
        nextRetryTime: null,
        errorMessage: null
      }
    };
  }
}
