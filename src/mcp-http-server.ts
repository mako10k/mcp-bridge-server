import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, LATEST_PROTOCOL_VERSION, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import express, { Request, Response, NextFunction } from 'express';
import { MCPBridgeManager } from './mcp-bridge-manager.js';
import { logger } from './utils/logger.js';
import { randomUUID } from 'crypto';

/**
 * MCP HTTP Server implementation using the StreamableHTTPServerTransport from the MCP SDK.
 * Implements a proper MCP server using the MCP SDK's Server module and StreamableHTTPServerTransport.
 * Uses per-request transports to ensure correct protocol version negotiation with clients.
 * This implementation is based on the approach used in mako10k/mcp-search, which successfully works with VS Code.
 */
export class MCPHttpServer {
  private mcpManager: MCPBridgeManager;
  private server: Server;
  
  // Keep track of active transports by session ID
  private transports: Record<string, StreamableHTTPServerTransport> = {};
  private lastAccessTime: Record<string, number> = {};
  private readonly IDLE_TIMEOUT = 1800000; // 30 minutes idle timeout
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(mcpManager: MCPBridgeManager) {
    this.mcpManager = mcpManager;
    
    // Initialize the MCP server
    this.server = new Server(
      {
        name: 'mcp-bridge-http',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        }
      }
    );
    
    // Setup tools by forwarding to MCP Bridge Manager
    this.setupTools();
    
    // Start the cleanup interval
    this.startCleanupInterval();
    
    logger.info(`MCP HTTP Server initialized with protocol version: ${LATEST_PROTOCOL_VERSION}`);
  }

  /**
   * Start the interval for cleaning up idle transports
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleTransports();
    }, 300000); // Check every 5 minutes
  }

  /**
   * Clean up idle transports that haven't been used for a while
   */
  private cleanupIdleTransports(): void {
    const now = Date.now();
    const sessionsToRemove: string[] = [];

    // Check each transport for idle time
    Object.entries(this.lastAccessTime).forEach(([sessionId, lastAccess]) => {
      if (now - lastAccess > this.IDLE_TIMEOUT) {
        sessionsToRemove.push(sessionId);
      }
    });

    // Remove idle transports
    sessionsToRemove.forEach(sessionId => {
      logger.info(`Removing idle transport for session ${sessionId} (inactive for ${Math.round((now - (this.lastAccessTime[sessionId] || 0)) / 60000)} minutes)`);
      const transport = this.transports[sessionId];
      if (transport) {
        try {
          transport.close();
        } catch (error) {
          logger.error(`Error closing idle transport for session ${sessionId}:`, error);
        }
        delete this.transports[sessionId];
        delete this.lastAccessTime[sessionId];
      }
    });

    if (sessionsToRemove.length > 0) {
      logger.info(`Cleaned up ${sessionsToRemove.length} idle transports`);
    }
  }

  /**
   * Set up the tools handled by the MCP server.
   * These tools will delegate to the MCP Bridge Manager.
   */
  private setupTools(): void {
    this.setupListToolsHandler();
    this.setupCallToolHandler();
  }

  /**
   * Setup the handler for listing available tools.
   */
  private setupListToolsHandler(): void {
    // Handle tool listing requests
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('Handling ListTools request');
      
      // Get tool list from the tool registry
      const toolRegistry = this.mcpManager.getToolRegistry();
      if (toolRegistry) {
        // If tool registry is available, get all tools from it
        const tools = toolRegistry.getTools();
        logger.debug(`Returning ${tools.length} tools from registry`);
        return { tools };
      }
      
      // If tool registry is not configured, return only basic tools
      logger.warn('Tool registry not available, returning basic tools only');
      return {
          tools: [
            {
              name: 'list_servers',
              description: 'List all available MCP servers connected to the bridge',
              inputSchema: {
                type: 'object',
                properties: {},
                required: []
              }
            },
          {
            name: 'list_all_tools',
            description: 'List all tools from all connected MCP servers with namespace information',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          },
          {
            name: 'list_server_tools',
            description: 'List tools from a specific MCP server',
            inputSchema: {
              type: 'object',
              properties: {
                serverId: {
                  type: 'string',
                  description: 'The ID of the MCP server'
                }
              },
              required: ['serverId']
            }
          },

          {
            name: 'call_server_tool',
            description: 'Call a tool on a specific MCP server',
            inputSchema: {
              type: 'object',
              properties: {
                serverId: {
                  type: 'string',
                  description: 'The ID of the MCP server'
                },
                toolName: {
                  type: 'string',
                  description: 'The name of the tool to call'
                },
                arguments: {
                  type: 'object',
                  description: 'Arguments to pass to the tool'
                }
              },
              required: ['serverId', 'toolName']
            }
          },
          {
            name: 'register_direct_tool',
            description: 'Register a tool for direct access (with optional rename)',
            inputSchema: {
              type: 'object',
              properties: {
                serverId: {
                  type: 'string',
                  description: 'The ID of the MCP server'
                },
                toolName: {
                  type: 'string',
                  description: 'The name of the tool to register'
                },
                newName: {
                  type: 'string',
                  description: 'Optional new name for the tool (if different from original name)'
                }
              },
              required: ['serverId', 'toolName']
            }
          },
          {
            name: 'unregister_direct_tool',
            description: 'Remove a directly registered tool',
            inputSchema: {
              type: 'object',
              properties: {
                toolName: {
                  type: 'string',
                  description: 'The name of the tool to remove (must be a previously registered tool)'
                }
              },
              required: ['toolName']
            }
          },
          {
            name: 'list_registered_tools',
            description: 'List all directly registered tools',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          },
        ]
      };
    });
  }

  /**
   * Setup the handler for calling tools.
   */
  private setupCallToolHandler(): void {
    // Handle tool call requests
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args = {} } = request.params;
        logger.debug(`Handling CallTool request for tool: ${name}`);
        
        // Call from tool registry
        const toolRegistry = this.mcpManager.getToolRegistry();
        if (toolRegistry) {
          try {
            logger.debug(`Calling tool ${name} from registry`);
            const result = await toolRegistry.callTool(name, args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          } catch (error) {
            // If error occurs in tool registry, fall back to standard processing
            if (error instanceof Error && error.message.includes('Unknown tool')) {
              logger.debug(`Tool ${name} not found in registry, falling back to standard tools`);
            } else {
              logger.error(`Error calling tool ${name} from registry:`, error);
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
        }
        
        // Standard tool processing (fallback)
        switch (name) {
          case 'list_servers':
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  servers: this.mcpManager.getAvailableServers()
                }, null, 2)
              }]
            };
            
          case 'list_all_tools':
            const allTools = await this.mcpManager.getAllTools();
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ tools: allTools }, null, 2)
              }]
            };
            
          case 'list_server_tools':
            if (!args.serverId) {
              throw new Error('serverId is required');
            }
            const tools = await this.mcpManager.listTools(args.serverId as string);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ tools }, null, 2)
              }]
            };
            

            
          case 'call_server_tool':
            if (!args.serverId || !args.toolName) {
              throw new Error('serverId and toolName are required');
            }
            const serverResult = await this.mcpManager.callTool(
              args.serverId as string, 
              args.toolName as string, 
              args.arguments || {}
            );
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ result: serverResult }, null, 2)
              }]
            };
            
          case 'create_tool_alias':
          case 'register_direct_tool': // 後方互換性のため
            if (!args.serverId || !args.toolName) {
              throw new Error('serverId and toolName are required');
            }
            try {
              const serverId = args.serverId as string;
              const originalToolName = args.toolName as string;
              const namespacedName = `${serverId}:${originalToolName}`;
              const toolName = args.newName as string || originalToolName;
              
              // Check if the tool exists
              const allTools = await this.mcpManager.getAllTools();
              const sourceServer = allTools.find(tool => 
                tool.serverId === serverId && tool.name === originalToolName
              );
              
              if (!sourceServer) {
                throw new Error(`Tool ${originalToolName} not found on server ${serverId}`);
              }
              
              // Check if a tool with the same name is already registered
              // Note: In the MCPHttpServer implementation, the actual registration is proxied
              // The actual implementation of the tool is done by MCPMetaServer
              
              logger.info(`Registering direct tool via HTTP: ${toolName} (${serverId}:${originalToolName})`);
              
              // Reference the tool registry directly for registration (no MCP protocol needed)
              const bridgeToolRegistry = this.mcpManager.getToolRegistry();
              if (!bridgeToolRegistry) {
                throw new Error('Bridge Tool Registry is not available');
              }
              
              const toolRegistrationResult = await bridgeToolRegistry.handleCreateToolAlias({
                serverId: serverId,
                toolName: originalToolName,
                newName: toolName
              });
              
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify(toolRegistrationResult, null, 2)
                }]
              };
            } catch (error) {
              logger.error(`Error registering direct tool:`, error);
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                  }, null, 2)
                }],
                isError: true
              };
            }
            
          case 'remove_tool_alias':
          case 'unregister_direct_tool': // 後方互換性のため
            if (!args.toolName) {
              throw new Error('toolName is required');
            }
            
            try {
              const toolName = args.toolName as string;
              logger.info(`Unregistering direct tool via HTTP: ${toolName}`);
              
              // Reference the tool registry directly for unregistration
              const bridgeToolRegistry = this.mcpManager.getToolRegistry();
              if (!bridgeToolRegistry) {
                throw new Error('Bridge Tool Registry is not available');
              }
              
              const unregisterResult = await bridgeToolRegistry.handleRemoveToolAlias({
                toolName
              });
              
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify(unregisterResult, null, 2)
                }]
              };
            } catch (error) {
              logger.error(`Error unregistering direct tool:`, error);
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                  }, null, 2)
                }],
                isError: true
              };
            }
            
          case 'list_aliased_tools':
          case 'list_registered_tools': // 後方互換性のため
            try {
              logger.info(`Listing registered tools via HTTP`);
              
              // Reference the tool registry directly to get the list
              const bridgeToolRegistry = this.mcpManager.getToolRegistry();
              if (!bridgeToolRegistry) {
                throw new Error('Bridge Tool Registry is not available');
              }
              
              const listResult = await bridgeToolRegistry.handleListAliasedTools();
              
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify(listResult, null, 2)
                }]
              };
            } catch (error) {
              logger.error(`Error listing registered tools:`, error);
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                  }, null, 2)
                }],
                isError: true
              };
            }
            
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error(`Error executing tool ${request.params.name}:`, error);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error'
            }, null, 2)
          }],
          isError: true
        };
      }
    });
  }

  /**
   * Register the MCP server with an existing Express instance
   * @param expressApp Express application to register with
   */
  registerWithApp(expressApp: express.Application): void {
    // Handle all MCP requests at the /mcp endpoint
    expressApp.all('/mcp', async (req: Request, res: Response) => {
      logger.debug(`Received MCP ${req.method} request`);
      
      try {
        // Check for existing session ID
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;
        
        if (sessionId && this.transports[sessionId]) {
          // Use existing transport - don't recreate during a session
          // VSCode expects the same transport throughout a session
          transport = this.transports[sessionId];
          logger.info(`Using existing transport for session ${sessionId}`);
          
          // Update access time
          this.lastAccessTime[sessionId] = Date.now();
          

        } else if (!sessionId && req.method === 'POST' && req.body && isInitializeRequest(req.body)) {
          // New session - create a new transport with explicit debugging
          logger.info('Initializing new MCP session with request:', JSON.stringify(req.body));
          
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (newSessionId) => {
              logger.info(`New MCP session initialized with ID: ${newSessionId}`);
              this.transports[newSessionId] = transport;
              this.lastAccessTime[newSessionId] = Date.now();
              
              // Setup cleanup when transport is closed
              transport.onclose = () => {
                if (newSessionId && this.transports[newSessionId]) {
                  logger.info(`Transport closed for session ${newSessionId}, removing from transports map`);
                  delete this.transports[newSessionId];
                  delete this.lastAccessTime[newSessionId];
                }
              };
              
              // Add improved error handler for transport with reconnect support
              transport.onerror = (error) => {
                logger.error(`Transport error for session ${newSessionId}:`, error);
                // Don't close or delete transport on error - VS Code might reconnect
              };
            }
          });
          
          // Connect transport to server BEFORE handling the request
          logger.debug('Connecting new transport to MCP server');
          await this.server.connect(transport);
        } else {
          // Invalid request - no session ID for non-initialization request
          logger.error(`Invalid request: No session ID provided for non-initialization request or session expired`);
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided or not an initialization request',
            },
            id: null,
          });
          return;
        }
        
        // Close connection when done
        res.on('close', () => {
          logger.debug(`Connection closed for ${req.method} request`);
        });
        
        // Handle the request based on method
        if (req.method === 'POST') {
          logger.debug(`Processing MCP POST request with body: ${JSON.stringify(req.body)}`);
          logger.debug(`Session ID: ${sessionId || 'new session'}`);
          try {
            await transport.handleRequest(req, res, req.body);
            logger.debug('POST request handled successfully');
          } catch (transportError) {
            logger.error(`Error in transport.handleRequest for POST: ${transportError}`);
            throw transportError; // Re-throw to be caught by outer catch block
          }
        } else if (req.method === 'GET' || req.method === 'DELETE') {
          logger.debug(`Processing MCP ${req.method} request`);
          try {
            await transport.handleRequest(req, res);
            logger.debug(`${req.method} request handled successfully`);
          } catch (transportError) {
            logger.error(`Error in transport.handleRequest for ${req.method}: ${transportError}`);
            throw transportError; // Re-throw to be caught by outer catch block
          }
        } else {
          res.status(405).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Method not allowed',
            },
            id: null,
          });
        }
        
        logger.debug('MCP request handled successfully');
      } catch (error) {
        logger.error('Error handling MCP request:', error);
        if (!res.headersSent) {
          if (req.method === 'POST') {
            res.status(500).json({
              jsonrpc: '2.0',
              error: {
                code: -32603,
                message: 'Internal server error',
              },
              id: null,
            });
          } else {
            res.status(500).send('Internal server error');
          }
        }
      }
    });

    logger.info('MCP HTTP Server registered with Express application');
  }

  /**
   * Shutdown the MCP server and close all connections
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down MCP HTTP server');
    
    try {
      // Stop the cleanup interval if it exists
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
        logger.debug('Stopped idle transport cleanup interval');
      }
      
      // Close all active transports
      for (const sessionId in this.transports) {
        try {
          logger.debug(`Closing transport for session ${sessionId}`);
          await this.transports[sessionId].close();
        } catch (err) {
          logger.error(`Error closing transport for session ${sessionId}:`, err);
        }
      }
      
      // Clear transports dictionary
      Object.keys(this.transports).forEach(key => {
        delete this.transports[key];
      });
      
      // Clear last access time records
      this.lastAccessTime = {};
      
      // Close the server
      await this.server.close();
      logger.info('MCP HTTP server shutdown complete');
    } catch (error) {
      logger.error('Error closing MCP HTTP server', error);
    }
  }
}
