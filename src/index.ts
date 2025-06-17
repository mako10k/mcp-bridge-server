#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { loadMCPConfig } from './config/mcp-config.js';
import { MCPBridgeManager } from './mcp-bridge-manager.js';
import { BridgeToolRegistry } from './bridge-tool-registry.js';
import { MCPHttpServer } from './mcp-http-server.js';
import { logger } from './utils/logger.js';
import { Server } from 'http';
import net from 'net';

// Server instance reference for restart functionality
let server: Server | null = null;
let currentPort: number = 3000;

// Get configuration file path from command line arguments
const configPath = process.argv[2] || './mcp-config.json';
logger.info(`Using configuration file: ${configPath}`);

const app = express();
// Load MCP configuration first to get port setting
const mcpConfig = loadMCPConfig(configPath);
const port = Number(process.env.PORT || mcpConfig.global?.httpPort || 3000);
currentPort = port;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize MCP Bridge Manager and Tool Registry
const mcpManager = new MCPBridgeManager();
const toolRegistry = new BridgeToolRegistry(mcpManager, mcpConfig, configPath);
// Set reference to the tool registry
mcpManager.setToolRegistry(toolRegistry);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get server information (port, status, etc.)
app.get('/mcp/server-info', (req, res) => {
  try {
    res.json({ 
      port: currentPort,
      status: 'running',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting server info:', error);
    res.status(500).json({ error: 'Failed to get server info' });
  }
});

// Get available MCP servers (with status information)
app.get('/mcp/servers', async (req, res) => {
  try {
    const servers = mcpManager.getDetailedServerInfo();
    res.json({ servers });
  } catch (error) {
    logger.error('Error getting MCP servers:', error);
    res.status(500).json({ error: 'Failed to get MCP servers' });
  }
});

// Get server status for a specific server
app.get('/mcp/servers/:serverId/status', ((req, res) => {
  try {
    const { serverId } = req.params;
    const status = mcpManager.getServerStatus(serverId);
    if (!status) {
      return res.status(404).json({ error: 'Server not found' });
    }
    res.json({ status });
  } catch (error) {
    logger.error(`Error getting server status for ${req.params.serverId}:`, error);
    res.status(500).json({ error: 'Failed to get server status' });
  }
}) as express.RequestHandler);

// Force retry connection for a specific server
app.post('/mcp/servers/:serverId/retry', async (req, res) => {
  try {
    const { serverId } = req.params;
    await mcpManager.forceRetryServer(serverId);
    res.json({ success: true, message: 'Retry initiated' });
  } catch (error) {
    logger.error(`Error retrying server ${req.params.serverId}:`, error);
    res.status(500).json({ error: 'Failed to retry server' });
  }
});

// Force retry connection for all failed servers
app.post('/mcp/servers/retry-all', async (req, res) => {
  try {
    const results = await mcpManager.forceRetryAllServers();
    res.json({ results });
  } catch (error) {
    logger.error('Error retrying all servers:', error);
    res.status(500).json({ error: 'Failed to retry all servers' });
  }
});

// Get all tools from all servers (with namespace information)
app.get('/mcp/tools', async (req, res) => {
  try {
    const tools = await mcpManager.getAllTools();
    res.json({ tools });
  } catch (error) {
    logger.error('Error getting all tools:', error);
    res.status(500).json({ error: 'Failed to get all tools' });
  }
});

// Get tool name conflicts
app.get('/mcp/conflicts', async (req, res) => {
  try {
    const conflicts = await mcpManager.getToolConflicts();
    res.json({ conflicts });
  } catch (error) {
    logger.error('Error getting tool conflicts:', error);
    res.status(500).json({ error: 'Failed to get tool conflicts' });
  }
});

// List tools from a specific MCP server
app.get('/mcp/servers/:serverId/tools', async (req, res) => {
  try {
    const { serverId } = req.params;
    const tools = await mcpManager.listTools(serverId);
    res.json({ tools });
  } catch (error) {
    logger.error(`Error listing tools for server ${req.params.serverId}:`, error);
    res.status(500).json({ error: 'Failed to list tools' });
  }
});

// Call a tool on a specific MCP server
const CallToolSchema = z.object({
  name: z.string(),
  arguments: z.record(z.any()).optional().default({})
});

app.post('/mcp/servers/:serverId/tools/call', async (req, res) => {
  try {
    const { serverId } = req.params;
    const { name, arguments: toolArgs } = CallToolSchema.parse(req.body);
    
    const result = await mcpManager.callTool(serverId, name, toolArgs);
    res.json({ result });
  } catch (error) {
    logger.error(`Error calling tool on server ${req.params.serverId}:`, error);
    res.status(500).json({ error: 'Failed to call tool' });
  }
});

// Old API '/mcp/tools/call' has been removed - deprecated since v1.2.1
// Use the '/mcp/servers/:serverId/tools/call' endpoint or directly registered tools instead

// Tool alias management endpoints

// List all tool aliases
app.get('/mcp/tool-aliases', (async (req, res) => {
  try {
    const result = await toolRegistry.handleListAliasedTools();
    res.json(result);
  } catch (error) {
    logger.error('Error listing tool aliases:', error);
    res.status(500).json({ error: 'Failed to list tool aliases' });
  }
}) as express.RequestHandler);

// Create a tool alias
app.post('/mcp/tool-aliases', (async (req, res) => {
  try {
    const { serverId, toolName, newName } = req.body;
    if (!serverId || !toolName) {
      return res.status(400).json({ error: 'serverId and toolName are required' });
    }
    
    const result = await toolRegistry.handleCreateToolAlias({ serverId, toolName, newName });
    res.json(result);
  } catch (error) {
    logger.error('Error creating tool alias:', error);
    res.status(500).json({ error: 'Failed to create tool alias' });
  }
}) as express.RequestHandler);

// Remove a tool alias
app.delete('/mcp/tool-aliases/:aliasName', (async (req, res) => {
  try {
    const { aliasName } = req.params;
    const result = await toolRegistry.handleRemoveToolAlias({ toolName: aliasName });
    res.json(result);
  } catch (error) {
    logger.error(`Error removing tool alias ${req.params.aliasName}:`, error);
    res.status(500).json({ error: 'Failed to remove tool alias' });
  }
}) as express.RequestHandler);

// Get tool aliases by source (explicit or auto-discovery)
app.get('/mcp/tool-aliases/explicit', (async (req, res) => {
  try {
    const result = await toolRegistry.handleListAliasedTools();
    const explicitTools = result.tools.filter((tool: any) => tool.source === 'explicit');
    res.json({ tools: explicitTools });
  } catch (error) {
    logger.error('Error listing explicit tool aliases:', error);
    res.status(500).json({ error: 'Failed to list explicit tool aliases' });
  }
}) as express.RequestHandler);

app.get('/mcp/tool-aliases/auto-discovery', (async (req, res) => {
  try {
    const result = await toolRegistry.handleListAliasedTools();
    const autoDiscoveryTools = result.tools.filter((tool: any) => tool.source === 'auto-discovery');
    res.json({ tools: autoDiscoveryTools });
  } catch (error) {
    logger.error('Error listing auto-discovery tool aliases:', error);
    res.status(500).json({ error: 'Failed to list auto-discovery tool aliases' });
  }
}) as express.RequestHandler);

// Update tool alias name (for explicit aliases only)
app.put('/mcp/tool-aliases/:aliasName', (async (req, res) => {
  try {
    const { aliasName } = req.params;
    const { newName } = req.body;
    
    if (!newName) {
      return res.status(400).json({ error: 'newName is required' });
    }
    
    const result = await toolRegistry.handleUpdateToolAlias({ oldName: aliasName, newName });
    res.json(result);
  } catch (error) {
    logger.error(`Error updating tool alias ${req.params.aliasName}:`, error);
    res.status(500).json({ error: 'Failed to update tool alias' });
  }
}) as express.RequestHandler);

// List resources from a specific MCP server
app.get('/mcp/servers/:serverId/resources', async (req, res) => {
  try {
    const { serverId } = req.params;
    const resources = await mcpManager.listResources(serverId);
    res.json({ resources });
  } catch (error) {
    logger.error(`Error listing resources for server ${req.params.serverId}:`, error);
    res.status(500).json({ error: 'Failed to list resources' });
  }
});

// Read a resource from a specific MCP server
app.get('/mcp/servers/:serverId/resources/:resourceUri', async (req, res) => {
  try {
    const { serverId, resourceUri } = req.params;
    const resource = await mcpManager.readResource(serverId, decodeURIComponent(resourceUri));
    res.json({ resource });
  } catch (error) {
    logger.error(`Error reading resource from server ${req.params.serverId}:`, error);
    res.status(500).json({ error: 'Failed to read resource' });
  }
});

// Configuration management endpoints

// Get all server configurations
app.get('/mcp/config/servers', (async (req, res) => {
  try {
    const configManager = toolRegistry.getConfigManager();
    const currentConfig = configManager.getCurrentConfig();
    res.json({ servers: currentConfig.servers || [] });
  } catch (error) {
    logger.error('Error getting server configurations:', error);
    res.status(500).json({ error: 'Failed to get server configurations' });
  }
}) as express.RequestHandler);

// Get specific server configuration
app.get('/mcp/config/servers/:serverId', (async (req, res) => {
  try {
    const { serverId } = req.params;
    const configManager = toolRegistry.getConfigManager();
    const currentConfig = configManager.getCurrentConfig();
    const server = currentConfig.servers?.find((s: any) => s.name === serverId);
    
    if (!server) {
      return res.status(404).json({ error: 'Server configuration not found' });
    }
    
    res.json({ server });
  } catch (error) {
    logger.error(`Error getting server configuration for ${req.params.serverId}:`, error);
    res.status(500).json({ error: 'Failed to get server configuration' });
  }
}) as express.RequestHandler);

// Add server configuration
app.post('/mcp/config/servers', (async (req, res) => {
  try {
    const { serverId, config } = req.body;
    if (!serverId || !config) {
      return res.status(400).json({ error: 'serverId and config are required' });
    }
    
    const result = await toolRegistry.handleAddServerConfig({ serverId, config });
    res.json(result);
  } catch (error) {
    logger.error('Error adding server configuration:', error);
    res.status(500).json({ error: 'Failed to add server configuration' });
  }
}) as express.RequestHandler);

// Update server configuration
app.put('/mcp/config/servers/:serverId', (async (req, res) => {
  try {
    const { serverId } = req.params;
    const { config } = req.body;
    if (!config) {
      return res.status(400).json({ error: 'config is required' });
    }
    
    const result = await toolRegistry.handleUpdateServerConfig({ serverId, config });
    res.json(result);
  } catch (error) {
    logger.error(`Error updating server configuration for ${req.params.serverId}:`, error);
    res.status(500).json({ error: 'Failed to update server configuration' });
  }
}) as express.RequestHandler);

// Remove server configuration
app.delete('/mcp/config/servers/:serverId', (async (req, res) => {
  try {
    const { serverId } = req.params;
    const result = await toolRegistry.handleRemoveServerConfig({ serverId });
    res.json(result);
  } catch (error) {
    logger.error(`Error removing server configuration for ${req.params.serverId}:`, error);
    res.status(500).json({ error: 'Failed to remove server configuration' });
  }
}) as express.RequestHandler);

// Get global configuration
app.get('/mcp/config/global', (async (req, res) => {
  try {
    const configManager = toolRegistry.getConfigManager();
    const currentConfig = configManager.getCurrentConfig();
    res.json({ config: currentConfig.global || {} });
  } catch (error) {
    logger.error('Error getting global configuration:', error);
    res.status(500).json({ error: 'Failed to get global configuration' });
  }
}) as express.RequestHandler);

// Update global configuration
app.put('/mcp/config/global', (async (req, res) => {
  try {
    const { config } = req.body;
    if (!config) {
      return res.status(400).json({ error: 'config is required' });
    }
    
    // Check if httpPort is being changed
    const currentConfig = toolRegistry.getConfigManager().getCurrentConfig();
    const currentHttpPort = currentConfig.global?.httpPort || 3000;
    const newHttpPort = config.httpPort;
    
    const result = await toolRegistry.handleUpdateGlobalConfig({ config });
    
    // If httpPort changed and update was successful, restart server on new port
    if (result.success && newHttpPort && newHttpPort !== currentHttpPort) {
      logger.info(`HTTP port changed from ${currentHttpPort} to ${newHttpPort}, restarting server...`);
      
      // Send response first before restarting
      res.json({ 
        ...result, 
        message: `${result.message}. Server restarting on port ${newHttpPort}...` 
      });
      
      // Restart server with new port after short delay
      setTimeout(() => {
        restartServerOnNewPort(newHttpPort);
      }, 500);
      
      return;
    }
    
    res.json(result);
  } catch (error) {
    logger.error('Error updating global configuration:', error);
    res.status(500).json({ error: 'Failed to update global configuration' });
  }
}) as express.RequestHandler);

// Get tool discovery rules
app.get('/mcp/config/discovery-rules', (async (req, res) => {
  try {
    const configManager = toolRegistry.getConfigManager();
    const currentConfig = configManager.getCurrentConfig();
    res.json({ 
      rules: currentConfig.toolDiscoveryRules || currentConfig.registrationPatterns || [] 
    });
  } catch (error) {
    logger.error('Error getting tool discovery rules:', error);
    res.status(500).json({ error: 'Failed to get tool discovery rules' });
  }
}) as express.RequestHandler);

// Update tool discovery rules
app.put('/mcp/config/discovery-rules', (async (req, res) => {
  try {
    const { rules } = req.body;
    if (!Array.isArray(rules)) {
      return res.status(400).json({ error: 'rules must be an array' });
    }
    
    // Validate each rule
    const validatedRules = rules.map(rule => {
      if (!rule.serverPattern || !rule.toolPattern) {
        throw new Error('Each rule must have serverPattern and toolPattern');
      }
      return {
        serverPattern: rule.serverPattern,
        toolPattern: rule.toolPattern,
        exclude: Boolean(rule.exclude)
      };
    });
    
    const configManager = toolRegistry.getConfigManager();
    
    // Update discovery rules
    const result = await configManager.updateToolDiscoveryRules(validatedRules);
    if (!result.success) {
      return res.status(500).json({ error: result.message });
    }
    
    // Notify MCP Manager of configuration changes
    const updatedConfig = configManager.getCurrentConfig();
    await mcpManager.reloadConfiguration(updatedConfig);
    
    // Apply new discovery rules
    toolRegistry.setDiscoveryRules(validatedRules);
    await toolRegistry.applyDiscoveryRules();
    
    logger.info(`Updated tool discovery rules: ${validatedRules.length} rules`);
    res.json({ 
      success: true, 
      message: 'Tool discovery rules updated successfully',
      rules: validatedRules
    });
  } catch (error) {
    logger.error('Error updating tool discovery rules:', error);
    res.status(500).json({ error: 'Failed to update tool discovery rules' });
  }
}) as express.RequestHandler);

// Logs API endpoints
app.get('/mcp/logs', (async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const logs = logger.getLogs(limit);
    res.json({ logs });
  } catch (error) {
    logger.error('Error retrieving logs:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
}) as express.RequestHandler);

app.delete('/mcp/logs', (async (req, res) => {
  try {
    logger.clearLogs();
    logger.info('Logs cleared via API');
    res.json({ success: true, message: 'Logs cleared successfully' });
  } catch (error) {
    logger.error('Error clearing logs:', error);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
}) as express.RequestHandler);

// Server management API endpoints
app.post('/mcp/server/restart', (async (req, res) => {
  try {
    const newPort = req.body.port || currentPort;
    logger.info(`Server restart requested via API, port: ${newPort}`);
    
    res.json({ 
      success: true, 
      message: 'Server restart initiated',
      newPort: newPort
    });
    
    // Restart server after sending response
    setTimeout(async () => {
      try {
        await restartServerOnNewPort(newPort);
      } catch (error) {
        logger.error('Failed to restart server:', error);
      }
    }, 100);
    
  } catch (error) {
    logger.error('Error initiating server restart:', error);
    res.status(500).json({ error: 'Failed to initiate server restart' });
  }
}) as express.RequestHandler);

app.post('/mcp/server/shutdown', (async (req, res) => {
  try {
    logger.info('Server shutdown requested via API');
    res.json({ 
      success: true, 
      message: 'Server shutdown initiated'
    });
    
    // Shutdown server after sending response
    setTimeout(async () => {
      try {
        await performGracefulShutdown();
        process.exit(0);
      } catch (error) {
        logger.error('Failed to shutdown server gracefully:', error);
        process.exit(1);
      }
    }, 100);
    
  } catch (error) {
    logger.error('Error initiating server shutdown:', error);
    res.status(500).json({ error: 'Failed to initiate server shutdown' });
  }
}) as express.RequestHandler);

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// MCP HTTP Server using StreamableHTTPServerTransport from the SDK
const mcpHttpServer = new MCPHttpServer(mcpManager);
mcpHttpServer.registerWithApp(app);

/**
 * Restart server on new port
 */
async function restartServerOnNewPort(newPort: number): Promise<void> {
  try {
    logger.info(`Restarting server on port ${newPort}...`);
    
    // Close current server if running
    if (server) {
      await new Promise<void>((resolve) => {
        server!.close(() => {
          logger.info(`Server stopped on port ${currentPort}`);
          resolve();
        });
      });
    }
    
    // Update current port
    currentPort = newPort;
    
    // Start server on new port (localhost only for security)
    server = app.listen(newPort, '127.0.0.1', () => {
      logger.info(`MCP Bridge Server restarted on port ${newPort} (localhost only)`);
      logger.info(`Health check: http://localhost:${newPort}/health`);
      logger.info(`Available servers: http://localhost:${newPort}/mcp/servers`);
    });
    
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${newPort} is already in use during restart. Cannot restart server.`);
      } else {
        logger.error(`Failed to start server on port ${newPort}:`, error);
      }
    });
    
  } catch (error) {
    logger.error(`Failed to restart server on port ${newPort}:`, error);
  }
}

/**
 * Perform graceful shutdown
 */
async function performGracefulShutdown(): Promise<void> {
  logger.info('Performing graceful shutdown...');
  
  // Close HTTP server
  if (server) {
    await new Promise<void>((resolve) => {
      server!.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });
  }
  
  // Shutdown MCP components
  await toolRegistry.shutdown();
  await mcpManager.shutdown();
  
  logger.info('Graceful shutdown completed');
}

// Start the server
async function startServer() {
  try {
    // Initialize MCP connections
    await mcpManager.initialize(configPath);
    
    // Set tool discovery rules if configured (new naming)
    if (mcpConfig.toolDiscoveryRules && mcpConfig.toolDiscoveryRules.length > 0) {
      logger.info(`Configuring ${mcpConfig.toolDiscoveryRules.length} tool discovery rules`);
      toolRegistry.setDiscoveryRules(mcpConfig.toolDiscoveryRules);
    }
    // Support legacy naming for backward compatibility
    else if (mcpConfig.registrationPatterns && mcpConfig.registrationPatterns.length > 0) {
      logger.info(`Configuring ${mcpConfig.registrationPatterns.length} tool discovery rules (legacy)`);
      toolRegistry.setDiscoveryRules(mcpConfig.registrationPatterns);
    }
    
    // Register tool aliases if configured in config (new naming)
    if (mcpConfig.toolAliases && mcpConfig.toolAliases.length > 0) {
      logger.info(`Registering ${mcpConfig.toolAliases.length} tool aliases from configuration`);
      for (const toolConfig of mcpConfig.toolAliases) {
        try {
          await toolRegistry.handleCreateToolAlias(toolConfig);
        } catch (error) {
          logger.error(`Failed to register tool alias ${toolConfig.serverId}:${toolConfig.toolName}:`, error);
        }
      }
    }
    // Support legacy naming for backward compatibility
    else if (mcpConfig.directTools && mcpConfig.directTools.length > 0) {
      logger.info(`Registering ${mcpConfig.directTools.length} tool aliases from configuration (legacy)`);
      for (const toolConfig of mcpConfig.directTools) {
        try {
          await toolRegistry.handleCreateToolAlias(toolConfig);
        } catch (error) {
          logger.error(`Failed to register tool alias ${toolConfig.serverId}:${toolConfig.toolName}:`, error);
        }
      }
    }
    
    // Execute automatic discovery based on tool discovery rules
    await toolRegistry.applyDiscoveryRules();
    
    // Check if configured port is available, otherwise find an available one
    let actualPort = port;
    if (!(await isPortAvailable(port))) {
      logger.warn(`Configured port ${port} is not available, searching for alternative...`);
      try {
        actualPort = await findAvailablePort(port);
        logger.info(`Using alternative port ${actualPort}`);
      } catch (error) {
        logger.error('No available ports found:', error);
        process.exit(1);
      }
    }
    
    server = app.listen(actualPort, '127.0.0.1', () => {
      currentPort = actualPort; // Update current port
      logger.info(`MCP Bridge Server running on port ${actualPort} (localhost only)`);
      logger.info(`Health check: http://localhost:${actualPort}/health`);
      logger.info(`Available servers: http://localhost:${actualPort}/mcp/servers`);
    });

    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${actualPort} is already in use. Please check if another MCP Bridge Server is running or use a different port.`);
        logger.error('To check for running processes: ps aux | grep "node dist/src/index.js"');
        logger.error('To kill existing processes: pkill -f "node dist/src/index.js"');
      } else {
        logger.error(`Server failed to start on port ${actualPort}:`, error);
      }
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start MCP Bridge Server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down MCP Bridge Server...');
  await toolRegistry.shutdown();
  await mcpManager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down MCP Bridge Server...');
  await toolRegistry.shutdown();
  await mcpManager.shutdown();
  process.exit(0);
});

/**
 * Check if a port is available
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, '127.0.0.1', () => {
      server.close(() => {
        resolve(true);
      });
    });
    
    server.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Find next available port starting from given port
 */
async function findAvailablePort(startPort: number): Promise<number> {
  for (let port = startPort; port <= startPort + 100; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available ports found in range ${startPort}-${startPort + 100}`);
}

startServer();
