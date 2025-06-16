#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { loadMCPConfig } from './config/mcp-config.js';
import { MCPBridgeManager } from './mcp-bridge-manager.js';
import { BridgeToolRegistry } from './bridge-tool-registry.js';
import { MCPHttpServer } from './mcp-http-server.js';
import { logger } from './utils/logger.js';

// Get configuration file path from command line arguments
const configPath = process.argv[2] || './mcp-config.json';
logger.info(`Using configuration file: ${configPath}`);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Load MCP configuration
const mcpConfig = loadMCPConfig(configPath);

// Initialize MCP Bridge Manager and Tool Registry
const mcpManager = new MCPBridgeManager();
const toolRegistry = new BridgeToolRegistry(mcpManager, mcpConfig, configPath);
// Set reference to the tool registry
mcpManager.setToolRegistry(toolRegistry);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get available MCP servers (with status information)
app.get('/mcp/servers', async (req, res) => {
  try {
    const servers = mcpManager.getAvailableServers();
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

// Update global configuration
app.put('/mcp/config/global', (async (req, res) => {
  try {
    const { config } = req.body;
    if (!config) {
      return res.status(400).json({ error: 'config is required' });
    }
    
    const result = await toolRegistry.handleUpdateGlobalConfig({ config });
    res.json(result);
  } catch (error) {
    logger.error('Error updating global configuration:', error);
    res.status(500).json({ error: 'Failed to update global configuration' });
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
    
    app.listen(port, () => {
      logger.info(`MCP Bridge Server running on port ${port}`);
      logger.info(`Health check: http://localhost:${port}/health`);
      logger.info(`Available servers: http://localhost:${port}/mcp/servers`);
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

startServer();
