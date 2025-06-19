import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { logger } from './utils/logger.js';
import { MCPServerConfig, loadMCPConfig, MCPConfig, getEnabledServers } from './config/mcp-config.js';
import { MCPLifecycleManager } from './mcp/lifecycle/mcp-lifecycle-manager.js';
import { MCPInstanceContext } from './mcp/lifecycle/types.js';
import crypto from 'crypto';
import { IBridgeToolRegistry } from './bridge-tool-registry.js';

import { AuthContextManager } from "./auth/context/auth-context.js";
// Server status enumeration
export enum MCPServerStatus {
  CONNECTED = 'connected',      // Successfully connected
  DISCONNECTED = 'disconnected',// Disconnected
  CONNECTING = 'connecting',    // Currently trying to connect
  RETRYING = 'retrying',        // Retrying connection after failure
  FAILED = 'failed'             // Failed after max retries
}

// Server status tracking information
export interface MCPServerStatusInfo {
  status: MCPServerStatus;      // Current status
  retryCount: number;           // Current retry count
  maxRetries: number;           // Maximum configured retries
  lastRetryTime: Date | null;   // Last retry attempt time
  nextRetryTime: Date | null;   // Next scheduled retry time
  errorMessage: string | null;  // Latest error message
}

interface MCPConnection {
  id: string;
  config: MCPServerConfig;
  client: Client;
  transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport;
  connected: boolean;
  statusInfo: MCPServerStatusInfo;
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
  private toolRegistry: IBridgeToolRegistry | null = null;
  private lifecycleManager = new MCPLifecycleManager();
  private authContextManager = new AuthContextManager();
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();
  
  // Default retry configuration
  private readonly DEFAULT_MAX_RETRIES = 5;
  private readonly BASE_RETRY_DELAY = 1000; // 1 second
  private readonly MAX_RETRY_DELAY = 30000; // 30 seconds

  async initialize(configPath?: string, config?: MCPConfig): Promise<void> {
    logger.info('Initializing MCP Bridge Manager...');
    
    // Use provided config or load from file
    this.config = config || loadMCPConfig(configPath || './mcp-config.json');
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

      // Update status to connecting
      const existingConnection = this.connections.get(config.name);
      if (existingConnection) {
        existingConnection.statusInfo.status = MCPServerStatus.CONNECTING;
      }

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
        this.handleServerDisconnection(config.name);
      };

      transport.onerror = (error: Error) => {
        logger.error(`MCP server ${config.name} transport error:`, error);
        this.handleServerError(config.name, error);
      };

      // Connect the client
      await client.connect(transport);

      // Store or update the connection
      const connection: MCPConnection = {
        id: config.name,
        config,
        client,
        transport,
        connected: true,
        statusInfo: {
          status: MCPServerStatus.CONNECTED,
          retryCount: 0,
          maxRetries: config.maxRestarts || this.DEFAULT_MAX_RETRIES,
          lastRetryTime: null,
          nextRetryTime: null,
          errorMessage: null
        }
      };

      this.connections.set(config.name, connection);
      
      // Clear any existing retry timeout
      const retryTimeout = this.retryTimeouts.get(config.name);
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        this.retryTimeouts.delete(config.name);
      }
      
      logger.info(`Successfully connected to MCP server: ${config.name}`);

    } catch (error) {
      logger.error(`Failed to connect to MCP server ${config.name}:`, error);
      this.handleServerError(config.name, error as Error);
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

  /**
   * Get detailed server information including configuration and status
   */
  getDetailedServerInfo(): Array<{
    id: string;
    name: string;
    transport: string;
    connected: boolean;
    statusInfo: MCPServerStatusInfo;
  }> {
    const servers: Array<{
      id: string;
      name: string;
      transport: string;
      connected: boolean;
      statusInfo: MCPServerStatusInfo;
    }> = [];

    // Add connected servers
    for (const [serverId, connection] of this.connections.entries()) {
      servers.push({
        id: connection.id,
        name: connection.config.name,
        transport: connection.config.transport,
        connected: connection.connected,
        statusInfo: connection.statusInfo
      });
    }

    // Add servers from config that aren't connected
    if (this.config) {
      const enabledServers = getEnabledServers(this.config);
      for (const serverConfig of enabledServers) {
        if (!this.connections.has(serverConfig.name)) {
          servers.push({
            id: serverConfig.name,
            name: serverConfig.name,
            transport: serverConfig.transport,
            connected: false,
            statusInfo: {
              status: MCPServerStatus.DISCONNECTED,
              retryCount: 0,
              maxRetries: serverConfig.maxRestarts || this.DEFAULT_MAX_RETRIES,
              lastRetryTime: null,
              nextRetryTime: null,
              errorMessage: null
            }
          });
        }
      }
    }

    return servers;
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

  /**
   * Normalize tool schema if config allows, otherwise validate it
   * @param tool Tool information
   * @param serverId Server ID for logging
   * @returns Normalized schema or throws error if strict mode
   */
  private normalizeOrValidateToolSchema(tool: any, serverId: string): any {
    let inputSchema = tool.input_schema || tool.inputSchema;
    
    // Check if schema is invalid
    const isInvalid = !inputSchema || typeof inputSchema !== 'object' || 
                     !inputSchema.type || !inputSchema.properties;
    
    if (isInvalid) {
      const fixInvalidSchemas = this.config?.global?.fixInvalidToolSchemas ?? false;
      
      if (!fixInvalidSchemas) {
        // Strict mode: reject invalid schemas
        const errorMsg = `Invalid tool schema for ${tool.name} from server ${serverId}: missing required fields (type, properties, or schema is not an object)`;
        logger.error(errorMsg);
        throw new Error(errorMsg);
      } else {
        // Fix mode: normalize the schema
        logger.warn(`Auto-fixing invalid schema for tool ${tool.name} from server ${serverId}`);
        if (!inputSchema || typeof inputSchema !== 'object') {
          inputSchema = { type: 'object', properties: {}, required: [] };
        } else {
          // Ensure type is set to 'object'
          if (!inputSchema.type) {
            inputSchema.type = 'object';
          }
          // Ensure properties exists
          if (!inputSchema.properties) {
            inputSchema.properties = {};
          }
          // Ensure required array exists
          if (!inputSchema.required) {
            inputSchema.required = [];
          }
        }
      }
    }
    
    return inputSchema;
  }

  /**
   * Get tool information from a specific server
   * @param serverId Server ID
   * @returns Array of tool information
   */
  async getServerTools(serverId: string): Promise<{ name: string, description: string, inputSchema: any }[]> {
    const tools = await this.listTools(serverId);
    const validTools: { name: string, description: string, inputSchema: any }[] = [];
    
    for (const tool of tools) {
      try {
        const inputSchema = this.normalizeOrValidateToolSchema(tool, serverId);
        validTools.push({
          name: tool.name,
          description: tool.description || '',
          inputSchema
        });
      } catch (error) {
        // In strict mode, skip invalid tools
        logger.error(`Skipping tool ${tool.name} from server ${serverId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        continue;
      }
    }
    
    return validTools;
  }

  async callTool(serverId: string, toolName: string, arguments_: Record<string, any>): Promise<any> {
    // Ensure server connection before tool call (triggers retry if needed)
    const isConnected = await this.ensureServerConnection(serverId);
    if (!isConnected) {
      throw new Error(`MCP server ${serverId} not found, not connected, or failed to reconnect`);
    }

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
      
      // If tool call failed, it might be due to connection issues, trigger retry
      this.handleServerError(serverId, error as Error);
      throw error;
    }
  }

  async callToolWithContext(
    serverId: string,
    toolName: string,
    arguments_: Record<string, any>,
    req: import('express').Request
  ): Promise<any> {
    const serverConfig = this.config?.servers.find(s => s.name === serverId) as any;
    if (!serverConfig) {
      throw new Error(`Server not found: ${serverId}`);
    }

    if (serverConfig.lifecycle === 'global' || !serverConfig.lifecycle) {
      return this.callTool(serverId, toolName, arguments_);
    }

    const context = this.authContextManager.extractContext(req);
    context.lifecycleMode = serverConfig.lifecycle as any;

    const instance = await this.lifecycleManager.getOrCreateInstance(serverConfig as any, context);
    return instance.client?.callTool({ name: toolName, arguments: arguments_ });
  }

  async listResources(serverId: string): Promise<any[]> {
    // Ensure server connection before listing resources
    const isConnected = await this.ensureServerConnection(serverId);
    if (!isConnected) {
      throw new Error(`MCP server ${serverId} not found, not connected, or failed to reconnect`);
    }

    const connection = this.connections.get(serverId);
    if (!connection || !connection.connected) {
      throw new Error(`MCP server ${serverId} not found or not connected`);
    }

    try {
      const response = await connection.client.listResources();
      return response.resources;
    } catch (error) {
      logger.error(`Failed to list resources for server ${serverId}:`, error);
      
      // If listing failed, it might be due to connection issues, trigger retry
      this.handleServerError(serverId, error as Error);
      throw error;
    }
  }

  async readResource(serverId: string, resourceUri: string): Promise<any> {
    // Ensure server connection before reading resource
    const isConnected = await this.ensureServerConnection(serverId);
    if (!isConnected) {
      throw new Error(`MCP server ${serverId} not found, not connected, or failed to reconnect`);
    }

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
      
      // If reading failed, it might be due to connection issues, trigger retry
      this.handleServerError(serverId, error as Error);
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
      // Try to ensure connection before listing tools
      try {
        const isConnected = await this.ensureServerConnection(serverId);
        if (!isConnected) {
          logger.warn(`Skipping tools from disconnected server: ${serverId}`);
          continue;
        }
        
        const response = await connection.client.listTools();
        for (const tool of response.tools) {
          try {
            const inputSchema = this.normalizeOrValidateToolSchema(tool, serverId);
            allTools.push({
              name: tool.name,
              namespacedName: `${serverId}:${tool.name}`,
              serverId,
              description: tool.description,
              inputSchema
            });
          } catch (error) {
            // In strict mode, skip invalid tools
            logger.error(`Skipping tool ${tool.name} from server ${serverId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            continue;
          }
        }
      } catch (error) {
        logger.error(`Failed to get tools from server ${serverId}:`, error);
        
        // If listing tools failed, trigger retry
        this.handleServerError(serverId, error as Error);
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



  // Get tool by namespaced name
  async getToolByNamespace(namespacedName: string): Promise<NamespacedTool | null> {
    const allTools = await this.getAllTools();
    return allTools.find(tool => tool.namespacedName === namespacedName) || null;
  }
  
  // Provide access to BridgeToolRegistry
  setToolRegistry(registry: IBridgeToolRegistry): void {
    this.toolRegistry = registry;
  }
  
  // Get BridgeToolRegistry instance
  getToolRegistry(): IBridgeToolRegistry | null {
    return this.toolRegistry;
  }

  getLifecycleManager(): MCPLifecycleManager {
    return this.lifecycleManager;
  }

  /**
   * Update configuration and reconnect servers if needed
   * @param newConfig New configuration
   */
  async updateConfiguration(newConfig: MCPConfig): Promise<void> {
    logger.info('Updating MCP Bridge configuration...');
    
    const oldConfig = this.config;
    this.config = newConfig;
    
    // Get enabled servers in new configuration
    const enabledServers = getEnabledServers(newConfig);
    
    // Track servers that need to be connected or reconnected
    const serversToConnect: MCPServerConfig[] = [];
    const serversToReconnect: MCPServerConfig[] = [];
    
    // Find servers to connect (new) or reconnect (changed config)
    for (const serverConfig of enabledServers) {
      const existingConnection = this.connections.get(serverConfig.name);
      
      if (!existingConnection) {
        // New server to connect
        serversToConnect.push(serverConfig);
      } else {
        // Check if configuration changed significantly
        const oldServerConfig = oldConfig?.servers.find(s => s.name === serverConfig.name);
        
        if (oldServerConfig) {
          // Check for significant changes that require reconnection
          if (
            oldServerConfig.transport !== serverConfig.transport ||
            oldServerConfig.command !== serverConfig.command ||
            oldServerConfig.url !== serverConfig.url ||
            JSON.stringify(oldServerConfig.args) !== JSON.stringify(serverConfig.args) ||
            JSON.stringify(oldServerConfig.env) !== JSON.stringify(serverConfig.env)
          ) {
            serversToReconnect.push(serverConfig);
          }
        }
      }
    }
    
    // Find servers to disconnect (removed from config)
    const serversToDisconnect = Array.from(this.connections.keys())
      .filter(serverId => !enabledServers.some(s => s.name === serverId));
    
    // Disconnect removed servers
    for (const serverId of serversToDisconnect) {
      logger.info(`Server ${serverId} removed from configuration, disconnecting...`);
      await this.disconnectServer(serverId);
    }
    
    // Reconnect changed servers
    for (const serverConfig of serversToReconnect) {
      logger.info(`Server ${serverConfig.name} configuration changed, reconnecting...`);
      await this.disconnectServer(serverConfig.name);
      await this.connectToServer(serverConfig);
    }
    
    // Connect new servers
    for (const serverConfig of serversToConnect) {
      logger.info(`New server ${serverConfig.name} found in configuration, connecting...`);
      await this.connectToServer(serverConfig);
    }
    
    logger.info(`Configuration updated: ${this.connections.size} active connections`);
  }

  /**
   * Disconnect a specific server
   * @param serverId Server ID to disconnect
   */
  private async disconnectServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    
    if (connection) {
      try {
        // Close the client
        await connection.client.close();
        logger.info(`Disconnected from server: ${serverId}`);
      } catch (error) {
        logger.error(`Error disconnecting from server ${serverId}:`, error);
      }
      
      // Remove from connections map
      this.connections.delete(serverId);
    }
  }

  /**
   * Handle server disconnection
   * @param serverId Server ID that disconnected
   */
  private handleServerDisconnection(serverId: string): void {
    const connection = this.connections.get(serverId);
    if (connection) {
      connection.connected = false;
      connection.statusInfo.status = MCPServerStatus.DISCONNECTED;
      logger.info(`Server ${serverId} disconnected, scheduling retry...`);
      this.scheduleRetry(serverId);
    }
  }

  /**
   * Handle server error
   * @param serverId Server ID that encountered error
   * @param error Error that occurred
   */
  private handleServerError(serverId: string, error: Error): void {
    const connection = this.connections.get(serverId);
    if (connection) {
      connection.connected = false;
      connection.statusInfo.errorMessage = error.message;
      logger.error(`Server ${serverId} encountered error: ${error.message}`);
      this.scheduleRetry(serverId);
    } else {
      // Create a minimal connection entry for retry purposes
      const serverConfig = this.config?.servers.find(s => s.name === serverId);
      if (serverConfig && serverConfig.enabled) {
        // Create a placeholder connection for tracking retry status
        const placeholderConnection: MCPConnection = {
          id: serverId,
          config: serverConfig,
          client: null as any, // placeholder
          transport: null as any, // placeholder
          connected: false,
          statusInfo: {
            status: MCPServerStatus.FAILED,
            retryCount: 0,
            maxRetries: serverConfig.maxRestarts || this.DEFAULT_MAX_RETRIES,
            lastRetryTime: null,
            nextRetryTime: null,
            errorMessage: error.message
          }
        };
        
        this.connections.set(serverId, placeholderConnection);
        logger.error(`Server ${serverId} failed to connect: ${error.message}`);
        this.scheduleRetry(serverId);
      }
    }
  }

  /**
   * Schedule retry for a server
   * @param serverId Server ID to retry
   */
  private scheduleRetry(serverId: string): void {
    const connection = this.connections.get(serverId);
    const serverConfig = this.config?.servers.find(s => s.name === serverId);
    
    if (!serverConfig || !serverConfig.enabled) {
      return;
    }

    // Clear existing timeout if any
    const existingTimeout = this.retryTimeouts.get(serverId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Get current retry state
    let retryCount = 0;
    let maxRetries = serverConfig.maxRestarts || this.DEFAULT_MAX_RETRIES;
    
    if (connection) {
      retryCount = connection.statusInfo.retryCount;
      maxRetries = connection.statusInfo.maxRetries;
      
      // Check if max retries exceeded BEFORE incrementing
      if (retryCount >= maxRetries) {
        logger.warn(`Server ${serverId} exceeded max retries (${maxRetries}), marking as failed`);
        connection.statusInfo.status = MCPServerStatus.FAILED;
        connection.statusInfo.nextRetryTime = null;
        return;
      }
      
      // Increment retry count and update state
      connection.statusInfo.retryCount++;
      connection.statusInfo.lastRetryTime = new Date();
      connection.statusInfo.status = MCPServerStatus.RETRYING;
    }

    // Calculate exponential backoff delay using the current retry count
    const retryDelay = Math.min(
      this.BASE_RETRY_DELAY * Math.pow(2, retryCount),
      this.MAX_RETRY_DELAY
    );

    const nextRetryTime = new Date(Date.now() + retryDelay);
    
    if (connection) {
      connection.statusInfo.nextRetryTime = nextRetryTime;
    }

    logger.info(`Scheduling retry for server ${serverId} in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);

    const timeout = setTimeout(async () => {
      this.retryTimeouts.delete(serverId);
      logger.info(`Retrying connection to server ${serverId}...`);
      await this.connectToServer(serverConfig);
    }, retryDelay);

    this.retryTimeouts.set(serverId, timeout);
  }

  /**
   * Force retry for a specific server
   * @param serverId Server ID to force retry
   */
  async forceRetryServer(serverId: string): Promise<void> {
    const serverConfig = this.config?.servers.find(s => s.name === serverId);
    
    if (!serverConfig) {
      throw new Error(`Server ${serverId} not found in configuration`);
    }

    if (!serverConfig.enabled) {
      throw new Error(`Server ${serverId} is disabled in configuration`);
    }

    logger.info(`Force retrying server ${serverId}...`);
    
    // Clear existing timeout if any
    const existingTimeout = this.retryTimeouts.get(serverId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.retryTimeouts.delete(serverId);
    }

    // Reset retry count for force retry
    const connection = this.connections.get(serverId);
    if (connection) {
      connection.statusInfo.retryCount = 0;
      connection.statusInfo.status = MCPServerStatus.CONNECTING;
      connection.statusInfo.lastRetryTime = new Date();
      connection.statusInfo.nextRetryTime = null;
      connection.statusInfo.errorMessage = null;
    }

    await this.connectToServer(serverConfig);
  }

  /**
   * Force retry for all failed servers
   */
  async forceRetryAllServers(): Promise<void> {
    const failedServers: string[] = [];
    
    // Find all failed servers
    for (const [serverId, connection] of this.connections.entries()) {
      if (connection.statusInfo.status === MCPServerStatus.FAILED || 
          connection.statusInfo.status === MCPServerStatus.DISCONNECTED) {
        failedServers.push(serverId);
      }
    }

    // Also check for servers in config that aren't connected
    if (this.config) {
      const enabledServers = getEnabledServers(this.config);
      for (const serverConfig of enabledServers) {
        if (!this.connections.has(serverConfig.name)) {
          failedServers.push(serverConfig.name);
        }
      }
    }

    logger.info(`Force retrying ${failedServers.length} failed servers...`);

    // Retry all failed servers
    for (const serverId of failedServers) {
      try {
        await this.forceRetryServer(serverId);
      } catch (error) {
        logger.error(`Failed to force retry server ${serverId}:`, error);
      }
    }
  }

  /**
   * Get server status information
   * @param serverId Server ID to get status for
   */
  getServerStatus(serverId: string): MCPServerStatusInfo | null {
    const connection = this.connections.get(serverId);
    return connection ? connection.statusInfo : null;
  }

  /**
   * Get all server statuses
   */
  getAllServerStatuses(): Map<string, MCPServerStatusInfo> {
    const statuses = new Map<string, MCPServerStatusInfo>();
    
    for (const [serverId, connection] of this.connections.entries()) {
      statuses.set(serverId, connection.statusInfo);
    }

    return statuses;
  }

  /**
   * Ensure server is connected before tool call (triggers retry if needed)
   * @param serverId Server ID to check
   */
  async ensureServerConnection(serverId: string): Promise<boolean> {
    const connection = this.connections.get(serverId);
    
    if (!connection) {
      // Server not found, try to connect
      const serverConfig = this.config?.servers.find(s => s.name === serverId);
      if (serverConfig && serverConfig.enabled) {
        logger.info(`Server ${serverId} not connected, attempting connection for tool call...`);
        await this.connectToServer(serverConfig);
        const newConnection = this.connections.get(serverId);
        return newConnection ? newConnection.connected : false;
      }
      return false;
    }

    if (connection.connected && connection.statusInfo.status === MCPServerStatus.CONNECTED) {
      return true;
    }

    // Server exists but not connected, trigger retry regardless of retry limits
    logger.info(`Server ${serverId} not connected for tool call, triggering retry...`);
    await this.forceRetryServer(serverId);
    
    const updatedConnection = this.connections.get(serverId);
    return updatedConnection ? updatedConnection.connected : false;
  }

  /**
   * Reload configuration and reconnect servers
   * @param newConfig New configuration to apply
   */
  async reloadConfiguration(newConfig: MCPConfig): Promise<void> {
    logger.info('Reloading MCP Bridge Manager configuration...');
    
    try {
      // Store old config for comparison
      const oldConfig = this.config;
      this.config = newConfig;

      const enabledServers = getEnabledServers(newConfig);
      const oldServerNames = new Set(oldConfig?.servers.map(s => s.name) || []);
      const newServerNames = new Set(enabledServers.map(s => s.name));

      // Disconnect servers that are no longer in the config
      for (const serverId of oldServerNames) {
        if (!newServerNames.has(serverId)) {
          logger.info(`Disconnecting removed server: ${serverId}`);
          const connection = this.connections.get(serverId);
          if (connection) {
            try {
              await connection.transport.close();
            } catch (error) {
              logger.error(`Error closing connection to ${serverId}:`, error);
            }
            this.connections.delete(serverId);
            
            // Clear retry timeout if any
            const retryTimeout = this.retryTimeouts.get(serverId);
            if (retryTimeout) {
              clearTimeout(retryTimeout);
              this.retryTimeouts.delete(serverId);
            }
          }
        }
      }

      // Connect to new servers or reconnect modified servers
      for (const serverConfig of enabledServers) {
        const existingConnection = this.connections.get(serverConfig.name);
        const oldServerConfig = oldConfig?.servers.find(s => s.name === serverConfig.name);
        
        // Connect new servers or reconnect if configuration changed
        if (!existingConnection || !oldServerConfig || 
            JSON.stringify(serverConfig) !== JSON.stringify(oldServerConfig)) {
          
          // Disconnect existing connection if any
          if (existingConnection) {
            logger.info(`Reconnecting modified server: ${serverConfig.name}`);
            try {
              await existingConnection.transport.close();
            } catch (error) {
              logger.error(`Error closing existing connection to ${serverConfig.name}:`, error);
            }
            this.connections.delete(serverConfig.name);
            
            // Clear retry timeout if any
            const retryTimeout = this.retryTimeouts.get(serverConfig.name);
            if (retryTimeout) {
              clearTimeout(retryTimeout);
              this.retryTimeouts.delete(serverConfig.name);
            }
          } else {
            logger.info(`Connecting new server: ${serverConfig.name}`);
          }
          
          // Connect to the server
          await this.connectToServer(serverConfig);
        }
      }

      logger.info(`Configuration reloaded successfully. Active connections: ${this.connections.size}`);
      
    } catch (error) {
      logger.error('Error reloading configuration:', error);
      throw new Error(`Failed to reload configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
