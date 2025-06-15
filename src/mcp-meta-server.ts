import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MCPBridgeManager } from './mcp-bridge-manager.js';
import { IBridgeToolRegistry } from './bridge-tool-registry.js';
import { logger } from './utils/logger.js';

/**
 * MCP Meta Server
 * Functions as an MCP server for the bridge, providing tools from the bridge tool registry via MCP
 */
export class MCPMetaServer {
  private server: Server;
  private mcpManager: MCPBridgeManager;
  private toolRegistry: IBridgeToolRegistry;

  constructor(mcpManager: MCPBridgeManager, toolRegistry: IBridgeToolRegistry) {
    this.mcpManager = mcpManager;
    this.toolRegistry = toolRegistry;
    
    this.server = new Server(
      {
        name: 'mcp-bridge-meta',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        }
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List all available tools (from the tool registry)
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      // Get all tools from the tool registry
      const tools = this.toolRegistry.getTools();
      
      return {
        tools: tools,
      };
    });

    // Handle tool calls (delegate to the tool registry)
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args = {} } = request.params;
        
        // Call the tool through the tool registry
        const result = await this.toolRegistry.callTool(name, args);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error(`Error executing tool ${request.params.name}:`, error);
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
