import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MCPBridgeManager } from './mcp-bridge-manager.js';
import { logger } from './utils/logger.js';

// 直接登録されたツールの情報を格納する型
interface RegisteredToolInfo {
  namespacedName: string;   // 元のツール名（サーバーID:ツール名）
  serverId: string;         // ソースサーバーID
  originalName: string;     // 元のツール名（サーバーID抜き）
  description?: string;     // ツールの説明
  inputSchema: any;         // 入力スキーマ
}

export class MCPMetaServer {
  private server: Server;
  private mcpManager: MCPBridgeManager;
  private registeredTools: Map<string, RegisteredToolInfo> = new Map(); // 直接登録されたツールを管理するマップ

  constructor(mcpManager: MCPBridgeManager) {
    this.mcpManager = mcpManager;
    
    this.server = new Server(
      {
        name: 'mcp-bridge-meta',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        }
        // SDK内部でプロトコルバージョン交渉が行われる
      }
    );

    this.setupTools();
  }

  private setupTools(): void {
    // List all available MCP servers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      // 標準ツールのリスト
      const standardTools = [
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
          // ツール直接登録/管理機能
          {
            name: 'register_direct_tool',
            description: 'Register a tool for direct access (with optional rename)',
            inputSchema: {
              type: 'object',
              properties: {
                namespacedName: {
                  type: 'string',
                  description: 'The namespaced tool name to register (format: "serverId:toolName")',
                },
                newName: {
                  type: 'string',
                  description: 'Optional new name for the tool (if different from original name)',
                },
              },
              required: ['namespacedName'],
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
            name: 'call_tool',
            description: 'Call a tool using namespaced name (serverId:toolName)',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Namespaced tool name in format "serverId:toolName"',
                },
                arguments: {
                  type: 'object',
                  description: 'Arguments to pass to the tool',
                },
              },
              required: ['name'],
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

      // 登録済みのダイナミックツールをリストに追加
      const dynamicTools = Array.from(this.registeredTools.entries()).map(([registeredName, tool]) => ({
        name: registeredName,  // 登録名で表示
        description: tool.description || `Registered tool from ${tool.serverId} (original: ${tool.originalName})`,
        inputSchema: tool.inputSchema
      }));

      // 標準ツールと登録ツールを結合して返す
      return {
        tools: [...standardTools, ...dynamicTools],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args = {} } = request.params;
        
        // 登録済みツールであれば、そのツールの元のサーバーとツール名にリダイレクト
        const registeredTool = this.registeredTools.get(name);
        if (registeredTool) {
          logger.info(`Calling registered tool: ${name} -> ${registeredTool.namespacedName}`);
          try {
            // 元のサーバーとツール名を使ってツールを呼び出す
            const result = await this.mcpManager.callTool(
              registeredTool.serverId, 
              registeredTool.originalName, 
              args
            );
            
            // 結果を返す
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          } catch (error) {
            logger.error(`Error calling registered tool ${name}:`, error);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    error: error instanceof Error ? error.message : 'Unknown error'
                  }, null, 2),
                },
              ],
              isError: true,
            };
          }
        }
        
        // 標準ツールの処理

        switch (name) {
          case 'list_servers':
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    servers: this.mcpManager.getAvailableServers(),
                  }, null, 2),
                },
              ],
            };

          case 'list_all_tools':
            const allTools = await this.mcpManager.getAllTools();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ tools: allTools }, null, 2),
                },
              ],
            };

          case 'list_conflicts':
            const conflicts = await this.mcpManager.getToolConflicts();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ conflicts }, null, 2),
                },
              ],
            };
            
          // ツール直接登録/管理機能のハンドラー
          case 'register_direct_tool':
            if (!args.namespacedName) {
              throw new Error('namespacedName is required');
            }
            try {
              // ツールの詳細情報を取得
              const parts = (args.namespacedName as string).split(':');
              if (parts.length !== 2) {
                throw new Error(`Invalid namespaced tool name: ${args.namespacedName}. Expected format: 'serverId:toolName'`);
              }
              
              const [serverId, originalToolName] = parts;
              const toolName = args.newName as string || originalToolName;
              
              // ツールが存在するか確認
              const sourceServer = await this.mcpManager.getToolByNamespace(args.namespacedName as string);
              if (!sourceServer) {
                throw new Error(`Tool ${originalToolName} not found on server ${serverId}`);
              }
              
              // 同じ名前のツールが既に登録されていないか確認
              if (this.registeredTools.has(toolName)) {
                throw new Error(`A tool with name ${toolName} is already registered`);
              }
              
              // ツール情報を保存
              const toolInfo: RegisteredToolInfo = {
                namespacedName: args.namespacedName as string,
                serverId,
                originalName: originalToolName,
                description: sourceServer.description,
                inputSchema: sourceServer.inputSchema
              };
              
              this.registeredTools.set(toolName, toolInfo);
              
              // ツールのハンドラーを動的に登録
              this.registerDynamicToolHandler(toolName, toolInfo);
              
              logger.info(`Registered direct tool: ${toolName} (${args.namespacedName})`);
              
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({ 
                      success: true, 
                      tool: {
                        name: toolName,
                        namespacedName: args.namespacedName,
                        description: sourceServer.description
                      }
                    }, null, 2),
                  },
                ],
              };
            } catch (error) {
              logger.error(`Error registering direct tool:`, error);
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      success: false,
                      error: error instanceof Error ? error.message : 'Unknown error'
                    }, null, 2),
                  },
                ],
                isError: true,
              };
            }
            
          case 'unregister_direct_tool':
            if (!args.toolName) {
              throw new Error('toolName is required');
            }
            
            const toolName = args.toolName as string;
            
            // ツールが登録済みかどうかを確認
            if (!this.registeredTools.has(toolName)) {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({ 
                      success: false, 
                      error: `No registered tool found with name: ${toolName}` 
                    }, null, 2),
                  },
                ],
                isError: true,
              };
            }
            
            // 登録を削除
            this.registeredTools.delete(toolName);
            logger.info(`Unregistered direct tool: ${toolName}`);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true }, null, 2),
                },
              ],
            };
            
          case 'list_registered_tools':
            // 登録済みツールの情報を簡略化して返す
            const registeredTools = Array.from(this.registeredTools.entries()).map(([name, info]) => ({
              name,
              namespacedName: info.namespacedName,
              serverId: info.serverId,
              originalName: info.originalName,
              description: info.description
            }));
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ tools: registeredTools }, null, 2),
                },
              ],
            };
            


          case 'list_server_tools':
            if (!args.serverId) {
              throw new Error('serverId is required');
            }
            const tools = await this.mcpManager.listTools(args.serverId as string);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ tools }, null, 2),
                },
              ],
            };

          case 'call_tool':
            if (!args.name) {
              throw new Error('name is required');
            }
            const result = await this.mcpManager.callToolByNamespace(args.name as string, args.arguments || {});
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ result }, null, 2),
                },
              ],
            };

          case 'call_server_tool':
            if (!args.serverId || !args.toolName) {
              throw new Error('serverId and toolName are required');
            }
            const serverResult = await this.mcpManager.callTool(args.serverId as string, args.toolName as string, args.arguments || {});
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ result: serverResult }, null, 2),
                },
              ],
            };

          case 'list_server_resources':
            if (!args.serverId) {
              throw new Error('serverId is required');
            }
            const resources = await this.mcpManager.listResources(args.serverId as string);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ resources }, null, 2),
                },
              ],
            };

          case 'read_server_resource':
            if (!args.serverId || !args.resourceUri) {
              throw new Error('serverId and resourceUri are required');
            }
            const resource = await this.mcpManager.readResource(args.serverId as string, args.resourceUri as string);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ resource }, null, 2),
                },
              ],
            };

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error(`Error executing meta tool ${request.params.name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error',
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
  }

  async startStdioServer(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('MCP Meta Server started on stdio');
  }

  async shutdown(): Promise<void> {
    await this.server.close();
  }
  
  // 登録済みツールのハンドリングを準備する（実際の呼び出しはCallToolRequestSchemaハンドラーで行う）
  private registerDynamicToolHandler(toolName: string, toolInfo: RegisteredToolInfo): void {
    logger.info(`Registered dynamic tool handler for: ${toolName} (${toolInfo.namespacedName})`);
    // ハンドラーの処理はCallToolRequestSchemaの中で行うので、このメソッドは単なる通知用
  }
}
