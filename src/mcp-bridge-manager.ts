import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { logger } from './utils/logger.js';
import { MCPServerConfig, loadMCPConfig, MCPConfig, getEnabledServers } from './config/mcp-config.js';

interface MCPConnection {
  id: string;
  config: MCPServerConfig;
  client: Client;
  transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport;
  connected: boolean;
}

interface NamespacedTool {
  name: string;
  namespacedName: string; // e.g., "filesystem:read_file"
  serverId: string;
  description?: string;
  inputSchema?: any;
}

interface ToolConflict {
  toolName: string;
  servers: string[];
}

export class MCPBridgeManager {
  private connections: Map<string, MCPConnection> = new Map();
  private config: MCPConfig | null = null;

  async initialize(configPath?: string): Promise<void> {
    logger.info('Initializing MCP Bridge Manager...');
    
    // Load MCP server configuration
    this.config = loadMCPConfig(configPath || './mcp-config.json');
    const enabledServers = getEnabledServers(this.config);
    logger.info(`Found ${enabledServers.length} enabled MCP server configurations`);

    // Initialize connections to all configured servers
    for (const serverConfig of enabledServers) {
      await this.connectToServer(serverConfig);
    }

    logger.info(`Successfully connected to ${this.connections.size} MCP servers`);
  }

  private async connectToServer(config: MCPServerConfig): Promise<void> {
    try {
      logger.info(`Connecting to MCP server: ${config.name} (transport: ${config.transport})`);

      let transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport;

      switch (config.transport) {
        case 'stdio':
          if (!config.command) {
            throw new Error(`STDIO transport requires 'command' for server ${config.name}`);
          }
          transport = await this.createStdioTransport(config);
          break;
          
        case 'sse':
          if (!config.url) {
            throw new Error(`SSE transport requires 'url' for server ${config.name}`);
          }
          transport = await this.createSSETransport(config);
          break;
          
        case 'http':
          if (!config.url) {
            throw new Error(`HTTP transport requires 'url' for server ${config.name}`);
          }
          transport = await this.createHTTPTransport(config);
          break;
          
        default:
          throw new Error(`Unsupported transport type: ${config.transport}`);
      }

      // Create MCP client
      const client = new Client({
        name: 'mcp-bridge',
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {},
          resources: {}
        }
      });

      // Handle transport errors
      transport.onclose = () => {
        logger.warn(`MCP server ${config.name} transport closed`);
        this.connections.delete(config.name);
      };

      transport.onerror = (error: Error) => {
        logger.error(`MCP server ${config.name} transport error:`, error);
        this.connections.delete(config.name);
      };

      // Connect the client
      await client.connect(transport);

      // Store the connection
      const connection: MCPConnection = {
        id: config.name,
        config,
        client,
        transport,
        connected: true
      };

      this.connections.set(config.name, connection);
      logger.info(`Successfully connected to MCP server: ${config.name}`);

    } catch (error) {
      logger.error(`Failed to connect to MCP server ${config.name}:`, error);
    }
  }

  private async createStdioTransport(config: MCPServerConfig): Promise<StdioClientTransport> {
    if (!config.command) {
      throw new Error('Command is required for STDIO transport');
    }

    // Create environment variables
    const envVars: Record<string, string> = {};
    Object.entries(process.env).forEach(([key, value]) => {
      if (value !== undefined) {
        envVars[key] = value;
      }
    });
    if (config.env) {
      Object.assign(envVars, config.env);
    }

    return new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env: envVars,
      cwd: config.cwd
    });
  }

  private async createSSETransport(config: MCPServerConfig): Promise<SSEClientTransport> {
    if (!config.url) {
      throw new Error('URL is required for SSE transport');
    }

    logger.debug(`Creating SSE transport for ${config.name} with URL: ${config.url}`);

    // Validate URL format
    try {
      new URL(config.url);
      logger.debug(`URL validation passed for SSE: ${config.url}`);
    } catch (error) {
      logger.error(`Invalid URL format for SSE: ${config.url}`, error);
      throw new Error(`Invalid URL format for server ${config.name}: ${config.url}`);
    }

    const options: any = {};

    if (config.headers) {
      options.requestInit = {
        headers: config.headers
      };
    }

    logger.debug(`SSE transport URL:`, config.url);
    logger.debug(`SSE transport options:`, JSON.stringify(options, null, 2));

    try {
      // Pass URL as first parameter, options as second parameter
      const transport = new SSEClientTransport(new URL(config.url), options);
      logger.debug(`SSEClientTransport created successfully for ${config.name}`);
      return transport;
    } catch (error) {
      logger.error(`Failed to create SSEClientTransport for ${config.name}:`, error);
      throw error;
    }
  }

  private async createHTTPTransport(config: MCPServerConfig): Promise<StreamableHTTPClientTransport> {
    if (!config.url) {
      throw new Error('URL is required for HTTP transport');
    }

    logger.debug(`Creating HTTP transport for ${config.name} with URL: ${config.url}`);
    logger.debug(`Config object:`, JSON.stringify(config, null, 2));

    // Validate URL format
    try {
      new URL(config.url);
      logger.debug(`URL validation passed for: ${config.url}`);
    } catch (error) {
      logger.error(`Invalid URL format: ${config.url}`, error);
      throw new Error(`Invalid URL format for server ${config.name}: ${config.url}`);
    }

    const options: any = {};

    if (config.headers) {
      options.requestInit = {
        headers: config.headers
      };
    }

    logger.debug(`HTTP transport URL:`, config.url);
    logger.debug(`HTTP transport options:`, JSON.stringify(options, null, 2));

    try {
      // Pass URL as first parameter, options as second parameter
      const transport = new StreamableHTTPClientTransport(new URL(config.url), options);
      logger.debug(`StreamableHTTPClientTransport created successfully for ${config.name}`);
      return transport;
    } catch (error) {
      logger.error(`Failed to create StreamableHTTPClientTransport for ${config.name}:`, error);
      throw error;
    }
  }

  getAvailableServers(): string[] {
    return Array.from(this.connections.keys()).filter(
      serverId => this.connections.get(serverId)?.connected
    );
  }

  async listTools(serverId: string): Promise<any[]> {
    const connection = this.connections.get(serverId);
    if (!connection || !connection.connected) {
      throw new Error(`MCP server ${serverId} not found or not connected`);
    }

    try {
      const response = await connection.client.listTools();
      return response.tools;
    } catch (error) {
      logger.error(`Failed to list tools for server ${serverId}:`, error);
      throw error;
    }
  }

  async callTool(serverId: string, toolName: string, arguments_: Record<string, any>): Promise<any> {
    const connection = this.connections.get(serverId);
    if (!connection || !connection.connected) {
      throw new Error(`MCP server ${serverId} not found or not connected`);
    }

    try {
      const response = await connection.client.callTool({
        name: toolName,
        arguments: arguments_
      });
      return response;
    } catch (error) {
      logger.error(`Failed to call tool ${toolName} on server ${serverId}:`, error);
      throw error;
    }
  }

  async listResources(serverId: string): Promise<any[]> {
    const connection = this.connections.get(serverId);
    if (!connection || !connection.connected) {
      throw new Error(`MCP server ${serverId} not found or not connected`);
    }

    try {
      const response = await connection.client.listResources();
      return response.resources;
    } catch (error) {
      logger.error(`Failed to list resources for server ${serverId}:`, error);
      throw error;
    }
  }

  async readResource(serverId: string, resourceUri: string): Promise<any> {
    const connection = this.connections.get(serverId);
    if (!connection || !connection.connected) {
      throw new Error(`MCP server ${serverId} not found or not connected`);
    }

    try {
      const response = await connection.client.readResource({
        uri: resourceUri
      });
      return response;
    } catch (error) {
      logger.error(`Failed to read resource ${resourceUri} from server ${serverId}:`, error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down MCP connections...');
    
    for (const [serverId, connection] of this.connections.entries()) {
      try {
        logger.info(`Closing connection to ${serverId}`);
        await connection.client.close();
        connection.transport.close?.();
      } catch (error) {
        logger.error(`Error shutting down connection to ${serverId}:`, error);
      }
    }

    this.connections.clear();
    logger.info('All MCP connections closed');
  }

  // Get all tools from all servers with namespace information
  async getAllTools(): Promise<NamespacedTool[]> {
    const allTools: NamespacedTool[] = [];
    
    for (const [serverId, connection] of this.connections.entries()) {
      if (!connection.connected) continue;
      
      try {
        const response = await connection.client.listTools();
        for (const tool of response.tools) {
          allTools.push({
            name: tool.name,
            namespacedName: `${serverId}:${tool.name}`,
            serverId,
            description: tool.description,
            inputSchema: tool.inputSchema
          });
        }
      } catch (error) {
        logger.error(`Failed to get tools from server ${serverId}:`, error);
      }
    }
    
    return allTools;
  }

  // Detect tool name conflicts across servers
  async getToolConflicts(): Promise<ToolConflict[]> {
    const allTools = await this.getAllTools();
    const toolMap = new Map<string, string[]>();
    
    // Group tools by name
    for (const tool of allTools) {
      if (!toolMap.has(tool.name)) {
        toolMap.set(tool.name, []);
      }
      toolMap.get(tool.name)!.push(tool.serverId);
    }
    
    // Find conflicts (tools with same name from different servers)
    const conflicts: ToolConflict[] = [];
    for (const [toolName, servers] of toolMap.entries()) {
      if (servers.length > 1) {
        conflicts.push({
          toolName,
          servers: [...new Set(servers)] // Remove duplicates
        });
      }
    }
    
    return conflicts;
  }

  // Call tool with namespace support
  async callToolByNamespace(namespacedName: string, arguments_: Record<string, any>): Promise<any> {
    const parts = namespacedName.split(':');
    if (parts.length !== 2) {
      throw new Error(`Invalid namespaced tool name: ${namespacedName}. Expected format: 'serverId:toolName'`);
    }
    
    const [serverId, toolName] = parts;
    return this.callTool(serverId, toolName, arguments_);
  }

  // Get tool by namespaced name
  async getToolByNamespace(namespacedName: string): Promise<NamespacedTool | null> {
    const allTools = await this.getAllTools();
    return allTools.find(tool => tool.namespacedName === namespacedName) || null;
  }


}
