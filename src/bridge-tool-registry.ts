import { MCPBridgeManager } from './mcp-bridge-manager.js';
import { logger } from './utils/logger.js';

// BridgeToolRegistry Interface
export interface IBridgeToolRegistry {
  getTools(): ToolDefinition[];
  callTool(name: string, args?: any): Promise<any>;
  handleRegisterDirectTool(args: any): Promise<any>;
  handleUnregisterDirectTool(args: any): Promise<any>;
  handleListRegisteredTools(): Promise<any>;
  startStdioServer(): Promise<void>;
  shutdown(): Promise<void>;
  applyRegistrationPatterns(): Promise<void>;
  setRegistrationPatterns(patterns: RegistrationPattern[]): void;
}

// Type for storing information about directly registered tools
interface RegisteredToolInfo {
  namespacedName: string;   // Original tool name (serverId:toolName)
  serverId: string;         // Source server ID
  originalName: string;     // Original tool name (without serverId)
  description?: string;     // Tool description
  inputSchema: any;         // Input schema
}

// Registration pattern definition type
export interface RegistrationPattern {
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
  private registeredTools: Map<string, RegisteredToolInfo> = new Map(); // Map to manage directly registered tools
  private standardTools: ToolDefinition[] = [];
  private registrationPatterns: RegistrationPattern[] = []; // Registration patterns

  constructor(mcpManager: MCPBridgeManager) {
    this.mcpManager = mcpManager;
    this.initializeStandardTools();
    logger.info('Bridge Tool Registry initialized');
  }

  /**
   * Set registration patterns
   * @param patterns Array of registration patterns
   */
  setRegistrationPatterns(patterns: RegistrationPattern[]): void {
    this.registrationPatterns = patterns;
    logger.info(`Set ${patterns.length} tool registration patterns`);
  }

  /**
   * Apply configured registration patterns and automatically register matching tools
   */
  async applyRegistrationPatterns(): Promise<void> {
    if (this.registrationPatterns.length === 0) {
      logger.debug('No registration patterns to apply');
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
            
            // Check if the tool matches any pattern
            if (this.shouldRegisterTool(serverId, tool.name)) {
              try {
                await this.registerDirectTool(serverId, tool.name);
                registerCount++;
              } catch (error) {
                logger.error(`Failed to register tool ${tool.name} from server ${serverId}:`, error);
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
   * Determine if a tool should be registered based on patterns
   * @param serverId Server ID
   * @param toolName Tool name
   * @returns true if the tool should be registered
   */
  private shouldRegisterTool(serverId: string, toolName: string): boolean {
    // Don't register by default if there are no patterns
    if (this.registrationPatterns.length === 0) return false;
    
    let shouldRegister = false;
    
    // Evaluate all patterns in order
    for (const pattern of this.registrationPatterns) {
      const serverMatched = matchWildcard(pattern.serverPattern, serverId);
      const toolMatched = matchWildcard(pattern.toolPattern, toolName);
      
      // If the pattern matches
      if (serverMatched && toolMatched) {
        if (pattern.exclude) {
          // If matched an exclusion pattern, don't register
          return false;
        } else {
          // If matched an inclusion pattern, mark as registration candidate
          shouldRegister = true;
        }
      }
    }
    
    return shouldRegister;
  }

  /**
   * Directly register a tool from a specific server
   * @param serverId Server ID
   * @param toolName Tool name to register
   * @param newName New tool name (optional)
   * @returns Registration result
   */
  private async registerDirectTool(serverId: string, toolName: string, newName?: string): Promise<any> {
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
      const registrationName = newName || toolName;
      const namespacedName = `${serverId}:${toolName}`;
      
      // 既に同じ名前のツールが登録されていないか確認
      if (this.registeredTools.has(registrationName)) {
        throw new Error(`A tool with name ${registrationName} is already registered`);
      }

      // ツール情報を登録
      this.registeredTools.set(registrationName, {
        namespacedName,
        serverId,
        originalName: toolName,
        description: toolInfo.description,
        inputSchema: toolInfo.inputSchema,
      });
      
      logger.info(`Registered direct tool: ${serverId}:${toolName} as ${registrationName}`);
      return { success: true, name: registrationName };
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
        name: 'register_direct_tool',
        description: 'Register a tool for direct access (with optional rename)',
        inputSchema: {
          type: 'object',
          properties: {
            serverId: {
              type: 'string',
              description: 'The ID of the MCP server',
            },
            toolName: {
              type: 'string',
              description: 'The name of the tool to register',
            },
            newName: {
              type: 'string',
              description: 'Optional new name for the tool (if different from original name)',
            },
          },
          required: ['serverId', 'toolName'],
        },
      },
      {
        name: 'unregister_direct_tool',
        description: 'Remove a directly registered tool',
        inputSchema: {
          type: 'object',
          properties: {
            toolName: {
              type: 'string',
              description: 'The name of the tool to remove (must be a previously registered tool)',
            },
          },
          required: ['toolName'],
        },
      },
      {
        name: 'list_registered_tools',
        description: 'List all directly registered tools',
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
    
    // 登録済みのダイナミックツールをリストに追加
    const dynamicTools = Array.from(this.registeredTools.entries()).map(([registeredName, tool]) => ({
      name: registeredName,
      description: tool.description || `Registered tool from ${tool.serverId} (original: ${tool.originalName})`,
      inputSchema: tool.inputSchema
    }));
    
    // 両方を結合して返す
    return [...allTools, ...dynamicTools];
  }

  /**
   * ツールを呼び出す
   */
  public async callTool(name: string, args: any = {}): Promise<any> {
    try {
      // 登録済みツールであれば、そのツールの元のサーバーとツール名にリダイレクト
      const registeredTool = this.registeredTools.get(name);
      if (registeredTool) {
        logger.info(`Calling registered tool: ${name} -> ${registeredTool.namespacedName}`);
        try {
          const result = await this.mcpManager.callTool(
            registeredTool.serverId, 
            registeredTool.originalName, 
            args
          );
          return { result };
        } catch (error) {
          logger.error(`Error calling registered tool ${name}:`, error);
          throw new Error(`Error calling tool: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
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
          
        case 'register_direct_tool':
          return await this.handleRegisterDirectTool(args);
          
        case 'unregister_direct_tool':
          return await this.handleUnregisterDirectTool(args);
          
        case 'list_registered_tools':
          return await this.handleListRegisteredTools();

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
   * 直接ツール登録処理
   */
  public async handleRegisterDirectTool(args: any): Promise<any> {
    if (!args.serverId || !args.toolName) {
      throw new Error('serverId and toolName are required');
    }
    
    try {
      const result = await this.registerDirectTool(args.serverId, args.toolName, args.newName);
      return {
        success: true,
        tool: {
          name: args.newName || args.toolName,
          serverId: args.serverId,
          originalName: args.toolName
        }
      };
    } catch (error) {
      logger.error(`Error registering direct tool:`, error);
      throw new Error(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 直接ツール登録解除処理
   */
  public async handleUnregisterDirectTool(args: any): Promise<any> {
    if (!args.toolName) {
      throw new Error('toolName is required');
    }
    
    const toolName = args.toolName as string;
    
    if (!this.registeredTools.has(toolName)) {
      throw new Error(`No registered tool found with name: ${toolName}`);
    }
    
    this.registeredTools.delete(toolName);
    logger.info(`Unregistered direct tool: ${toolName}`);
    
    return { success: true };
  }

  /**
   * 登録済みツール一覧取得処理
   */
  public async handleListRegisteredTools(): Promise<any> {
    const registeredTools = Array.from(this.registeredTools.entries()).map(([name, info]) => ({
      name,
      namespacedName: info.namespacedName,
      serverId: info.serverId,
      originalName: info.originalName,
      description: info.description
    }));
    
    return { tools: registeredTools };
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
   * ツール登録通知（ログ出力のみ）
   */
  private registerDynamicToolHandler(toolName: string, toolInfo: RegisteredToolInfo): void {
    logger.info(`Registered dynamic tool handler for: ${toolName} (${toolInfo.namespacedName})`);
  }
}
