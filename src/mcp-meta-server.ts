import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MCPBridgeManager } from './mcp-bridge-manager.js';
import { logger } from './utils/logger.js';

export class MCPMetaServer {
  private server: Server;
  private mcpManager: MCPBridgeManager;

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
        },
      }
    );

    this.setupTools();
  }

  private setupTools(): void {
    // List all available MCP servers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
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
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args = {} } = request.params;

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
}
