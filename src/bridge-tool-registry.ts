import { MCPBridgeManager } from './mcp-bridge-manager.js';
import { logger } from './utils/logger.js';

// BridgeToolRegistry Interface
export interface IBridgeToolRegistry {
  getTools(): ToolDefinition[];
  callTool(name: string, args?: any): Promise<any>;
  handleCreateToolAlias(args: any): Promise<any>;
  handleRemoveToolAlias(args: any): Promise<any>;
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
  private toolAliases: Map<string, AliasedToolInfo> = new Map(); // Map to manage tool aliases
  private standardTools: ToolDefinition[] = [];
  private toolDiscoveryRules: ToolDiscoveryRule[] = []; // Tool discovery rules

  constructor(mcpManager: MCPBridgeManager) {
    this.mcpManager = mcpManager;
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
   * Apply configured tool discovery rules and automatically register matching tools
   */
  async applyDiscoveryRules(): Promise<void> {
    if (this.toolDiscoveryRules.length === 0) {
      logger.debug('No tool discovery rules to apply');
      return;
    }

    try {
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
                await this.createToolAlias(serverId, tool.name);
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
   * @returns Alias creation result
   */
  private async createToolAlias(serverId: string, toolName: string, aliasName?: string): Promise<any> {
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
      
      // 既に同じ名前のツールエイリアスがないか確認
      if (this.toolAliases.has(finalAliasName)) {
        throw new Error(`A tool alias with name ${finalAliasName} already exists`);
      }

      // ツールエイリアス情報を登録
      this.toolAliases.set(finalAliasName, {
        namespacedName,
        serverId,
        originalName: toolName,
        description: toolInfo.description,
        inputSchema: toolInfo.inputSchema,
      });
      
      logger.info(`Created tool alias: ${serverId}:${toolName} as ${finalAliasName}`);
      return { success: true, name: finalAliasName };
    } catch (error) {
      logger.error(`Failed to register direct tool ${serverId}:${toolName}:`, error);
      throw new Error(`Failed to register tool: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 標準ツールの定義を初期化
   */
  private initializeStandardTools(): void {
    this.standardTools = [
      {
        name: 'list_servers',
        description: 'List all available MCP servers connected to the bridge',
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
    ];
  }

  /**
   * 標準ツールと登録済みツールを含む全ツールのリストを取得
   */
  public getTools(): ToolDefinition[] {
    // 標準ツールをコピー
    const allTools = [...this.standardTools];
    
    // エイリアスされたツールをリストに追加
    const aliasedTools = Array.from(this.toolAliases.entries()).map(([aliasName, tool]) => ({
      name: aliasName,
      description: tool.description || `Aliased tool from ${tool.serverId} (original: ${tool.originalName})`,
      inputSchema: tool.inputSchema
    }));
    
    // 両方を結合して返す
    return [...allTools, ...aliasedTools];
  }

  /**
   * ツールを呼び出す
   */
  public async callTool(name: string, args: any = {}): Promise<any> {
    try {
      // エイリアスされたツールであれば、元のサーバーとツール名にリダイレクト
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
      
      // 後方互換性のための処理（古い名前でのツール呼び出し）
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
      
      // 標準ツールの処理
      switch (name) {
        case 'list_servers':
          return {
            servers: this.mcpManager.getAvailableServers(),
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

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Error executing registry tool ${name}:`, error);
      throw new Error(`Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * ツールエイリアス作成処理
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
   * ツールエイリアス削除処理
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
   * エイリアスされたツール一覧取得処理
   */
  public async handleListAliasedTools(): Promise<any> {
    const aliasedTools = Array.from(this.toolAliases.entries()).map(([name, info]) => ({
      name,
      namespacedName: info.namespacedName,
      serverId: info.serverId,
      originalName: info.originalName,
      description: info.description
    }));
    
    return { tools: aliasedTools };
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
   * ツールエイリアス登録通知（ログ出力のみ）
   */
  private registerAliasedToolHandler(aliasName: string, toolInfo: AliasedToolInfo): void {
    logger.info(`Registered tool alias handler for: ${aliasName} (${toolInfo.namespacedName})`);
  }
}
