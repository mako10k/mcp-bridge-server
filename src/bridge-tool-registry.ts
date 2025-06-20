import { MCPBridgeManager } from './mcp-bridge-manager.js';
import { logger } from './utils/logger.js';
import { MCPConfig } from './config/mcp-config.js';
import { DynamicConfigManager } from './config/dynamic-config-manager.js';

// BridgeToolRegistry Interface
export interface IBridgeToolRegistry {
  getTools(): ToolDefinition[];
  callTool(name: string, args?: any): Promise<any>;
  handleCreateToolAlias(args: any): Promise<any>;
  handleRemoveToolAlias(args: any): Promise<any>;
  handleUpdateToolAlias(args: any): Promise<any>;
  handleListAliasedTools(): Promise<any>;
  startStdioServer(): Promise<void>;
  shutdown(): Promise<void>;
  applyDiscoveryRules(): Promise<void>;
  setDiscoveryRules(patterns: ToolDiscoveryRule[]): void;
}

// Type for storing information about tool aliases
interface AliasedToolInfo {
  namespacedName: string;   // Original tool name (serverId:toolName)
  serverId: string;         // Source server ID
  originalName: string;     // Original tool name (without serverId)
  description?: string;     // Tool description
  inputSchema: any;         // Input schema
  source: 'explicit' | 'auto-discovery'; // Source of the alias
}

// Tool discovery rule definition type
export interface ToolDiscoveryRule {
  serverPattern: string;    // Server ID pattern (supports wildcards)
  toolPattern: string;      // Tool name pattern (supports wildcards)
  exclude: boolean;         // Whether this is an exclusion pattern (true=exclude, false=include)
}

/**
 * Check if a wildcard pattern matches the given text
 * Supported wildcards: * (any string), ? (any single character)
 * @param pattern Wildcard pattern
 * @param text Text to compare
 * @returns true if matches
 */
export function matchWildcard(pattern: string, text: string): boolean {
  // Escape pattern for regex
  let regexPattern = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  
  // Convert wildcards to regex
  regexPattern = regexPattern.replace(/\*/g, '.*')
                            .replace(/\?/g, '.');
  
  // Regex for exact match
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(text);
}

// Type representing tool information
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

/**
 * Bridge internal tool management class
 * Functions as an internal component rather than an external MCP server
 */
export class BridgeToolRegistry implements IBridgeToolRegistry {
  private mcpManager: MCPBridgeManager;
  private config: MCPConfig;
  private configManager: DynamicConfigManager;
  private toolAliases: Map<string, AliasedToolInfo> = new Map(); // Map to manage tool aliases
  private standardTools: ToolDefinition[] = [];
  private toolDiscoveryRules: ToolDiscoveryRule[] = []; // Tool discovery rules

  constructor(mcpManager: MCPBridgeManager, config: MCPConfig, configPath?: string) {
    this.mcpManager = mcpManager;
    this.config = config;
    this.configManager = new DynamicConfigManager(configPath || './mcp-config.json', config);
    this.initializeStandardTools();
    logger.info('Bridge Tool Registry initialized');
  }

  /**
   * Set tool discovery rules
   * @param patterns Array of tool discovery rules
   */
  setDiscoveryRules(patterns: ToolDiscoveryRule[]): void {
    this.toolDiscoveryRules = patterns;
    logger.info(`Set ${patterns.length} tool discovery rules`);
  }

  /**
   * Clear all auto-discovery tool aliases
   * This is called before reapplying discovery rules to ensure old aliases are removed
   */
  private clearAutoDiscoveryAliases(): void {
    const aliasesToRemove: string[] = [];
    
    // Find all auto-discovery aliases
    for (const [aliasName, aliasInfo] of this.toolAliases.entries()) {
      if (aliasInfo.source === 'auto-discovery') {
        aliasesToRemove.push(aliasName);
      }
    }
    
    // Remove them
    for (const aliasName of aliasesToRemove) {
      this.toolAliases.delete(aliasName);
    }
    
    if (aliasesToRemove.length > 0) {
      logger.info(`Cleared ${aliasesToRemove.length} auto-discovery tool aliases`);
    }
  }

  /**
   * Apply configured tool discovery rules and automatically register matching tools
   */
  async applyDiscoveryRules(): Promise<void> {
    if (this.toolDiscoveryRules.length === 0) {
      logger.debug('No tool discovery rules to apply');
      return;
    }

    try {
      // First, clear all existing auto-discovery aliases
      this.clearAutoDiscoveryAliases();
      
      logger.info('Applying tool registration patterns...');
      const allServers = this.mcpManager.getAvailableServers();
      const processedTools: Set<string> = new Set(); // Set to track processed tools
      let registerCount = 0;

      // Process all servers
      for (const serverId of allServers) {
        try {
          const serverTools = await this.mcpManager.getServerTools(serverId);
          
          // Apply pattern matching to each tool of the server
          for (const tool of serverTools) {
            const namespacedName = `${serverId}:${tool.name}`;
            
            // Skip already processed tools
            if (processedTools.has(namespacedName)) continue;
            processedTools.add(namespacedName);
            
            // Check if the tool matches any discovery rule
            if (this.shouldDiscoverTool(serverId, tool.name)) {
              try {
                await this.createToolAlias(serverId, tool.name, undefined, 'auto-discovery');
                registerCount++;
              } catch (error) {
                logger.error(`Failed to create tool alias for ${tool.name} from server ${serverId}:`, error);
              }
            }
          }
        } catch (error) {
          logger.error(`Error getting tools from server ${serverId}:`, error);
        }
      }

      logger.info(`Applied registration patterns: ${registerCount} tools registered automatically`);
    } catch (error) {
      logger.error('Error applying registration patterns:', error);
      throw new Error(`Failed to apply registration patterns: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Determine if a tool should be discovered based on rules
   * @param serverId Server ID
   * @param toolName Tool name
   * @returns true if the tool should be discovered and aliased
   */
  private shouldDiscoverTool(serverId: string, toolName: string): boolean {
    // Don't discover by default if there are no rules
    if (this.toolDiscoveryRules.length === 0) return false;
    
    let shouldDiscover = false;
    
    // Evaluate all discovery rules in order
    for (const rule of this.toolDiscoveryRules) {
      const serverMatched = matchWildcard(rule.serverPattern, serverId);
      const toolMatched = matchWildcard(rule.toolPattern, toolName);
      
      // If the rule matches
      if (serverMatched && toolMatched) {
        if (rule.exclude) {
          // If matched an exclusion rule, don't discover
          return false;
        } else {
          // If matched an inclusion rule, mark as discovery candidate
          shouldDiscover = true;
        }
      }
    }
    
    return shouldDiscover;
  }

  /**
   * Create an alias for a tool from a specific server
   * @param serverId Server ID
   * @param toolName Original tool name
   * @param aliasName New alias name (optional)
   * @param source Source of the alias ('explicit' or 'auto-discovery')
   * @returns Alias creation result
   */
  private async createToolAlias(serverId: string, toolName: string, aliasName?: string, source: 'explicit' | 'auto-discovery' = 'explicit'): Promise<any> {
    try {
      // Check if server exists
      const availableServers = this.mcpManager.getAvailableServers();
      if (!availableServers.includes(serverId)) {
        throw new Error(`Server ${serverId} not found or not connected`);
      }
      
      // Get tool information
      const serverTools = await this.mcpManager.getServerTools(serverId);
      const toolInfo = serverTools.find(t => t.name === toolName);
      if (!toolInfo) {
        throw new Error(`Tool ${toolName} not found on server ${serverId}`);
      }
      
      // Determine the actual tool name to use
      const finalAliasName = aliasName || toolName;
      const namespacedName = `${serverId}:${toolName}`;
      
      // Check if a tool alias with the same name already exists
      if (this.toolAliases.has(finalAliasName)) {
        throw new Error(`A tool alias with name ${finalAliasName} already exists`);
      }

      // Register tool alias information with source
      this.toolAliases.set(finalAliasName, {
        namespacedName,
        serverId,
        originalName: toolName,
        description: toolInfo.description,
        inputSchema: toolInfo.inputSchema,
        source: source
      });
      
      logger.info(`Created tool alias: ${serverId}:${toolName} as ${finalAliasName}`);
      return { success: true, name: finalAliasName };
    } catch (error) {
      logger.error(`Failed to register direct tool ${serverId}:${toolName}:`, error);
      throw new Error(`Failed to register tool: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Initialize standard tool definitions
   */
  private initializeStandardTools(): void {
    this.standardTools = [
      {
        name: 'list_servers',
        description: 'List all MCP servers with detailed status information including connection state, retry status, and error details',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'list_all_tools',
        description: 'List all tools from all connected MCP servers with namespace information',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'list_conflicts',
        description: 'Get tool name conflicts between different MCP servers',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'list_server_tools',
        description: 'List tools from a specific MCP server',
        inputSchema: {
          type: 'object',
          properties: {
            serverId: {
              type: 'string',
              description: 'The ID of the MCP server',
            },
          },
          required: ['serverId'],
        },
      },
      {
        name: 'create_tool_alias',
        description: 'Create an alias for a server tool (with optional custom name)',
        inputSchema: {
          type: 'object',
          properties: {
            serverId: {
              type: 'string',
              description: 'The ID of the MCP server',
            },
            toolName: {
              type: 'string',
              description: 'The name of the tool to alias',
            },
            newName: {
              type: 'string',
              description: 'Optional custom alias name (if different from original name)',
            },
          },
          required: ['serverId', 'toolName'],
        },
      },
      {
        name: 'remove_tool_alias',
        description: 'Remove a tool alias',
        inputSchema: {
          type: 'object',
          properties: {
            toolName: {
              type: 'string',
              description: 'The name of the tool alias to remove',
            },
          },
          required: ['toolName'],
        },
      },
      {
        name: 'list_aliased_tools',
        description: 'List all tool aliases',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'call_server_tool',
        description: 'Call a tool on a specific MCP server',
        inputSchema: {
          type: 'object',
          properties: {
            serverId: {
              type: 'string',
              description: 'The ID of the MCP server',
            },
            toolName: {
              type: 'string',
              description: 'The name of the tool to call',
            },
            arguments: {
              type: 'object',
              description: 'Arguments to pass to the tool',
            },
          },
          required: ['serverId', 'toolName'],
        },
      },
      {
        name: 'list_server_resources',
        description: 'List resources from a specific MCP server',
        inputSchema: {
          type: 'object',
          properties: {
            serverId: {
              type: 'string',
              description: 'The ID of the MCP server',
            },
          },
          required: ['serverId'],
        },
      },
      {
        name: 'read_server_resource',
        description: 'Read a resource from a specific MCP server',
        inputSchema: {
          type: 'object',
          properties: {
            serverId: {
              type: 'string',
              description: 'The ID of the MCP server',
            },
            resourceUri: {
              type: 'string',
              description: 'The URI of the resource to read',
            },
          },
          required: ['serverId', 'resourceUri'],
        },
      },
      {
        name: 'retry_server',
        description: 'Force retry connection to a specific MCP server',
        inputSchema: {
          type: 'object',
          properties: {
            serverId: {
              type: 'string',
              description: 'The ID of the MCP server to retry',
            },
          },
          required: ['serverId'],
        },
      },
      {
        name: 'retry_all_servers',
        description: 'Force retry connection to all failed MCP servers',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_server_status',
        description: 'Get detailed status information for a specific MCP server',
        inputSchema: {
          type: 'object',
          properties: {
            serverId: {
              type: 'string',
              description: 'The ID of the MCP server',
            },
          },
          required: ['serverId'],
        },
      },
      {
        name: 'add_server_config',
        description: 'Add a new MCP server configuration',
        inputSchema: {
          type: 'object',
          properties: {
            serverId: {
              type: 'string',
              description: 'Unique server ID',
            },
            config: {
              type: 'object',
              description: 'Server configuration object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Human-readable server name',
                },
                command: {
                  type: 'string',
                  description: 'Command to execute',
                },
                args: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Command arguments',
                },
                cwd: {
                  type: 'string',
                  description: 'Working directory (optional)',
                },
                env: {
                  type: 'object',
                  description: 'Environment variables (optional)',
                },
              },
              required: ['name', 'command', 'args'],
            },
          },
          required: ['serverId', 'config'],
        },
      },
      {
        name: 'update_server_config',
        description: 'Update an existing MCP server configuration',
        inputSchema: {
          type: 'object',
          properties: {
            serverId: {
              type: 'string',
              description: 'Server ID to update',
            },
            config: {
              type: 'object',
              description: 'Updated server configuration object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Human-readable server name',
                },
                command: {
                  type: 'string',
                  description: 'Command to execute',
                },
                args: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Command arguments',
                },
                cwd: {
                  type: 'string',
                  description: 'Working directory (optional)',
                },
                env: {
                  type: 'object',
                  description: 'Environment variables (optional)',
                },
              },
            },
          },
          required: ['serverId', 'config'],
        },
      },
      {
        name: 'remove_server_config',
        description: 'Remove an MCP server configuration',
        inputSchema: {
          type: 'object',
          properties: {
            serverId: {
              type: 'string',
              description: 'Server ID to remove',
            },
          },
          required: ['serverId'],
        },
      },
      {
        name: 'update_global_config',
        description: 'Update global configuration settings',
        inputSchema: {
          type: 'object',
          properties: {
            config: {
              type: 'object',
              description: 'Global configuration updates',
              properties: {
                httpPort: {
                  type: 'number',
                  description: 'HTTP server port',
                },
                hostName: {
                  type: 'string',
                  description: 'Server hostname',
                },
                logLevel: {
                  type: 'string',
                  enum: ['error', 'warn', 'info', 'debug'],
                  description: 'Logging level',
                },
                maxRetries: {
                  type: 'number',
                  description: 'Maximum retry attempts for failed servers',
                },
                retryInterval: {
                  type: 'number',
                  description: 'Base retry interval in milliseconds',
                },
                fixInvalidToolSchemas: {
                  type: 'boolean',
                  description: 'Whether to auto-fix invalid tool schemas',
                },
                enableToolDiscovery: {
                  type: 'boolean',
                  description: 'Enable auto tool discovery',
                },
              },
            },
          },
          required: ['config'],
        },
      },
    ];
  }

  /**
   * Get a list of all tools including standard tools and registered tools
   */
  public getTools(): ToolDefinition[] {
    // Copy standard tools
    const allTools = [...this.standardTools];
    
    // Add aliased tools to the list
    const aliasedTools = Array.from(this.toolAliases.entries()).map(([aliasName, tool]) => ({
      name: aliasName,
      description: tool.description || `Aliased tool from ${tool.serverId} (original: ${tool.originalName})`,
      inputSchema: tool.inputSchema
    }));
    
    // 両方を結合して返す
    return [...allTools, ...aliasedTools];
  }

  /**
   * Call a tool
   */
  public async callTool(name: string, args: any = {}): Promise<any> {
    try {
      // If it's an aliased tool, redirect to the original server and tool name
      const aliasedTool = this.toolAliases.get(name);
      if (aliasedTool) {
        logger.info(`Calling aliased tool: ${name} -> ${aliasedTool.namespacedName}`);
        try {
          const result = await this.mcpManager.callTool(
            aliasedTool.serverId, 
            aliasedTool.originalName, 
            args
          );
          return { result };
        } catch (error) {
          logger.error(`Error calling aliased tool ${name}:`, error);
          throw new Error(`Error calling tool: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Handle backward compatibility (calling tools with old names)
      if (name === 'register_direct_tool') {
        logger.warn('Tool name "register_direct_tool" is deprecated, use "create_tool_alias" instead');
        return await this.handleCreateToolAlias(args);
      } else if (name === 'unregister_direct_tool') {
        logger.warn('Tool name "unregister_direct_tool" is deprecated, use "remove_tool_alias" instead');
        return await this.handleRemoveToolAlias(args);
      } else if (name === 'list_registered_tools') {
        logger.warn('Tool name "list_registered_tools" is deprecated, use "list_aliased_tools" instead');
        return await this.handleListAliasedTools();
      }
      
      // Handle standard tools
      switch (name) {
        case 'list_servers':
          return {
            servers: this.mcpManager.getDetailedServerInfo(),
          };

        case 'list_all_tools':
          return {
            tools: await this.mcpManager.getAllTools(),
          };

        case 'list_conflicts':
          return {
            conflicts: await this.mcpManager.getToolConflicts(),
          };
          
        case 'create_tool_alias':
          return await this.handleCreateToolAlias(args);
          
        case 'remove_tool_alias':
          return await this.handleRemoveToolAlias(args);
          
        case 'list_aliased_tools':
          return await this.handleListAliasedTools();

        case 'list_server_tools':
          if (!args.serverId) {
            throw new Error('serverId is required');
          }
          return {
            tools: await this.mcpManager.listTools(args.serverId as string),
          };

        case 'call_server_tool':
          if (!args.serverId || !args.toolName) {
            throw new Error('serverId and toolName are required');
          }
          return {
            result: await this.mcpManager.callTool(args.serverId as string, args.toolName as string, args.arguments || {}),
          };

        case 'list_server_resources':
          if (!args.serverId) {
            throw new Error('serverId is required');
          }
          return {
            resources: await this.mcpManager.listResources(args.serverId as string),
          };

        case 'read_server_resource':
          if (!args.serverId || !args.resourceUri) {
            throw new Error('serverId and resourceUri are required');
          }
          return {
            resource: await this.mcpManager.readResource(args.serverId as string, args.resourceUri as string),
          };

        case 'retry_server':
          if (!args.serverId) {
            throw new Error('serverId is required');
          }
          try {
            await this.mcpManager.forceRetryServer(args.serverId as string);
            return {
              success: true,
              message: `Retry initiated for server ${args.serverId}`
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }

        case 'retry_all_servers':
          try {
            await this.mcpManager.forceRetryAllServers();
            return {
              success: true,
              message: 'Retry initiated for all failed servers'
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }

        case 'get_server_status':
          if (!args.serverId) {
            throw new Error('serverId is required');
          }
          const status = this.mcpManager.getServerStatus(args.serverId as string);
          if (!status) {
            return {
              error: `Server ${args.serverId} not found`
            };
          }
          return {
            serverId: args.serverId,
            status
          };

        case 'add_server_config':
          return await this.handleAddServerConfig(args);

        case 'update_server_config':
          return await this.handleUpdateServerConfig(args);

        case 'remove_server_config':
          return await this.handleRemoveServerConfig(args);

        case 'update_global_config':
          return await this.handleUpdateGlobalConfig(args);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Error executing registry tool ${name}:`, error);
      throw new Error(`Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Tool alias creation handler
   */
  public async handleCreateToolAlias(args: any): Promise<any> {
    if (!args.serverId || !args.toolName) {
      throw new Error('serverId and toolName are required');
    }
    
    try {
      const result = await this.createToolAlias(args.serverId, args.toolName, args.newName);
      return {
        success: true,
        tool: {
          name: args.newName || args.toolName,
          serverId: args.serverId,
          originalName: args.toolName
        }
      };
    } catch (error) {
      logger.error(`Error creating tool alias:`, error);
      throw new Error(`Alias creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Tool alias removal handler
   */
  public async handleRemoveToolAlias(args: any): Promise<any> {
    if (!args.toolName) {
      throw new Error('toolName is required');
    }
    
    const toolName = args.toolName as string;
    
    if (!this.toolAliases.has(toolName)) {
      throw new Error(`No tool alias found with name: ${toolName}`);
    }
    
    this.toolAliases.delete(toolName);
    logger.info(`Removed tool alias: ${toolName}`);
    
    return { success: true };
  }

  /**
   * Aliased tool list retrieval handler
   */
  public async handleListAliasedTools(): Promise<any> {
    const aliasedTools = Array.from(this.toolAliases.entries()).map(([name, info]) => ({
      name,
      namespacedName: info.namespacedName,
      serverId: info.serverId,
      originalName: info.originalName,
      description: info.description,
      source: info.source
    }));
    
    return { tools: aliasedTools };
  }

  /**
   * Add server configuration handler
   */
  public async handleAddServerConfig(args: any): Promise<any> {
    if (!args.serverId || !args.config) {
      throw new Error('serverId and config are required');
    }

    try {
      // Convert serverId to server name and merge with config
      const serverConfig = {
        name: args.serverId,
        ...args.config
      };
      
      const result = await this.configManager.addServer(serverConfig);
      if (!result.success) {
        throw new Error(result.message);
      }
      
      // Notify MCPManager to reload configuration and reconnect
      if (result.config) {
        await this.mcpManager.reloadConfiguration(result.config);
      }
      
      return {
        success: true,
        message: result.message
      };
    } catch (error) {
      logger.error(`Error adding server config:`, error);
      throw new Error(`Failed to add server config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update server configuration handler
   */
  public async handleUpdateServerConfig(args: any): Promise<any> {
    if (!args.serverId || !args.config) {
      throw new Error('serverId and config are required');
    }

    try {
      const result = await this.configManager.updateServer(args.serverId, args.config);
      if (!result.success) {
        throw new Error(result.message);
      }
      
      // Notify MCPManager to reload configuration and reconnect
      if (result.config) {
        await this.mcpManager.reloadConfiguration(result.config);
      }
      
      return {
        success: true,
        message: result.message
      };
    } catch (error) {
      logger.error(`Error updating server config:`, error);
      throw new Error(`Failed to update server config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove server configuration handler
   */
  public async handleRemoveServerConfig(args: any): Promise<any> {
    if (!args.serverId) {
      throw new Error('serverId is required');
    }

    try {
      const result = await this.configManager.removeServer(args.serverId);
      if (!result.success) {
        throw new Error(result.message);
      }
      
      // Notify MCPManager to reload configuration and reconnect
      if (result.config) {
        await this.mcpManager.reloadConfiguration(result.config);
      }
      
      return {
        success: true,
        message: result.message
      };
    } catch (error) {
      logger.error(`Error removing server config:`, error);
      throw new Error(`Failed to remove server config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update global configuration handler
   */
  public async handleUpdateGlobalConfig(args: any): Promise<any> {
    if (!args.config) {
      throw new Error('config is required');
    }

    try {
      const result = await this.configManager.updateGlobalSettings(args.config);
      if (!result.success) {
        throw new Error(result.message);
      }
      
      // Notify MCPManager to reload configuration and reconnect
      if (result.config) {
        await this.mcpManager.reloadConfiguration(result.config);
      }
      
      return {
        success: true,
        message: result.message
      };
    } catch (error) {
      logger.error(`Error updating global config:`, error);
      throw new Error(`Failed to update global config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * 互換性のためのダミーメソッド
   */
  public async startStdioServer(): Promise<void> {
    logger.info('Bridge Tool Registry is an internal component, no STDIO server needed');
  }
  
  /**
   * 互換性のためのダミーメソッド
   */
  public async shutdown(): Promise<void> {
    logger.info('Bridge Tool Registry shutdown');
  }
  
  /**
   * Tool alias registration notification (log output only)
   */
  private registerAliasedToolHandler(aliasName: string, toolInfo: AliasedToolInfo): void {
    logger.info(`Registered tool alias handler for: ${aliasName} (${toolInfo.namespacedName})`);
  }

  /**
   * Get the configuration manager instance
   * @returns DynamicConfigManager instance
   */
  getConfigManager(): DynamicConfigManager {
    return this.configManager;
  }

  /**
   * Update tool alias name handler (for explicit aliases only)
   */
  public async handleUpdateToolAlias(args: any): Promise<any> {
    if (!args.oldName || !args.newName) {
      throw new Error('oldName and newName are required');
    }

    const { oldName, newName } = args;

    try {
      // Check if the old alias exists
      const oldAlias = this.toolAliases.get(oldName);
      if (!oldAlias) {
        throw new Error(`Tool alias ${oldName} not found`);
      }

      // Only allow updating explicit aliases
      if (oldAlias.source !== 'explicit') {
        throw new Error(`Cannot update auto-discovery alias ${oldName}. Only explicit aliases can be renamed.`);
      }

      // Check if the new name is already taken
      if (this.toolAliases.has(newName)) {
        throw new Error(`Tool alias name ${newName} is already taken`);
      }

      // Create new alias with same properties but new name
      this.toolAliases.set(newName, {
        ...oldAlias
      });

      // Remove old alias
      this.toolAliases.delete(oldName);

      logger.info(`Tool alias renamed: ${oldName} -> ${newName}`);
      return {
        success: true,
        message: `Tool alias renamed from ${oldName} to ${newName}`
      };
    } catch (error) {
      logger.error(`Error updating tool alias ${oldName}:`, error);
      throw new Error(`Failed to update tool alias: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
