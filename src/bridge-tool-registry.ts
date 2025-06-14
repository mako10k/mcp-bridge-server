import { MCPBridgeManager } from './mcp-bridge-manager.js';
import { logger } from './utils/logger.js';

// BridgeToolRegistry インターフェイス
export interface IBridgeToolRegistry {
  getTools(): ToolDefinition[];
  callTool(name: string, args?: any): Promise<any>;
  handleRegisterDirectTool(args: any): Promise<any>;
  handleUnregisterDirectTool(args: any): Promise<any>;
  handleListRegisteredTools(): Promise<any>;
  startStdioServer(): Promise<void>;
  shutdown(): Promise<void>;
}

// 直接登録されたツールの情報を格納する型
interface RegisteredToolInfo {
  namespacedName: string;   // 元のツール名（サーバーID:ツール名）
  serverId: string;         // ソースサーバーID
  originalName: string;     // 元のツール名（サーバーID抜き）
  description?: string;     // ツールの説明
  inputSchema: any;         // 入力スキーマ
}

// ツール情報を表す型
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

/**
 * ブリッジ内部のツール管理クラス
 * 外部MCPサーバーではなく、内部コンポーネントとして機能する
 */
export class BridgeToolRegistry implements IBridgeToolRegistry {
  private mcpManager: MCPBridgeManager;
  private registeredTools: Map<string, RegisteredToolInfo> = new Map(); // 直接登録されたツールを管理するマップ
  private standardTools: ToolDefinition[] = [];

  constructor(mcpManager: MCPBridgeManager) {
    this.mcpManager = mcpManager;
    this.initializeStandardTools();
    logger.info('Bridge Tool Registry initialized');
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
      const serverId = args.serverId as string;
      const originalToolName = args.toolName as string;
      const namespacedName = `${serverId}:${originalToolName}`;
      const toolName = args.newName as string || originalToolName;
      
      // ツールが存在するか確認
      const sourceServer = await this.mcpManager.getToolByNamespace(namespacedName);
      if (!sourceServer) {
        throw new Error(`Tool ${originalToolName} not found on server ${serverId}`);
      }
      
      // 同じ名前のツールが既に登録されていないか確認
      if (this.registeredTools.has(toolName)) {
        throw new Error(`A tool with name ${toolName} is already registered`);
      }
      
      // ツール情報を保存
      const toolInfo: RegisteredToolInfo = {
        namespacedName,
        serverId,
        originalName: originalToolName,
        description: sourceServer.description,
        inputSchema: sourceServer.inputSchema
      };
      
      this.registeredTools.set(toolName, toolInfo);
      
      // ツールの登録をログ出力
      this.registerDynamicToolHandler(toolName, toolInfo);
      
      logger.info(`Registered direct tool: ${toolName} (${serverId}:${originalToolName})`);
      
      return { 
        success: true, 
        tool: {
          name: toolName,
          serverId,
          originalName: originalToolName,
          description: sourceServer.description
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
