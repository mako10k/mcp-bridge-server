#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import * as path from 'path';
import { ConfigManager, ConfigEventType } from './config/config-manager.js';
import { MCPBridgeManager } from './mcp-bridge-manager.js';
import { BridgeToolRegistry } from './bridge-tool-registry.js';
import { MCPHttpServer } from './mcp-http-server.js';
import { logger } from './utils/logger.js';

// Parse command line arguments
function parseArgs() {
  const args = {
    configPath: './mcp-config.json',
    additionalConfigPaths: [] as string[],
    watchMode: false,
    debug: false
  };
  
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    
    if (arg === '--watch' || arg === '-w') {
      args.watchMode = true;
      continue;
    }
    
    if (arg === '--debug' || arg === '-d') {
      args.debug = true;
      continue;
    }
    
    if ((arg === '--config' || arg === '-c') && i + 1 < process.argv.length) {
      args.configPath = process.argv[++i];
      continue;
    }
    
    if ((arg === '--add-config' || arg === '-a') && i + 1 < process.argv.length) {
      args.additionalConfigPaths.push(process.argv[++i]);
      continue;
    }
    
    // If no flag, treat as the main config path
    if (!arg.startsWith('-')) {
      args.configPath = arg;
    }
  }
  
  return args;
}

// Parse command line arguments
const args = parseArgs();
const configPath = path.resolve(args.configPath);

logger.info(`Using configuration file: ${configPath}`);
if (args.additionalConfigPaths.length > 0) {
  logger.info(`Additional configuration paths: ${args.additionalConfigPaths.join(', ')}`);
}
if (args.watchMode) {
  logger.info('Watch mode enabled - will automatically reload on configuration changes');
}
if (args.debug) {
  logger.info('Debug mode enabled - additional logging will be shown');
}

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Configuration Manager
const configManager = new ConfigManager(configPath);
// Add additional config paths if specified
for (const additionalPath of args.additionalConfigPaths) {
  configManager.addConfigSource(path.resolve(additionalPath), 50);
}
let mcpConfig: any = null;

// Initialize MCP Bridge Manager and Tool Registry
const mcpManager = new MCPBridgeManager();
const toolRegistry = new BridgeToolRegistry(mcpManager);

// Set up configuration change handler
configManager.on(ConfigEventType.LOADED, (config) => {
  mcpConfig = config;
  logger.info('Configuration loaded');
});

configManager.on(ConfigEventType.RELOADED, async (config) => {
  mcpConfig = config;
  logger.info('Configuration reloaded, applying changes...');
  
  try {
    // Update MCP Bridge Manager with new configuration
    await mcpManager.updateConfiguration(config);
    
    // Update tool discovery rules if changed
    if (config.toolDiscoveryRules && config.toolDiscoveryRules.length > 0) {
      logger.info(`Reconfiguring ${config.toolDiscoveryRules.length} tool discovery rules`);
      toolRegistry.setDiscoveryRules(config.toolDiscoveryRules);
      await toolRegistry.applyDiscoveryRules();
    } else if (config.registrationPatterns && config.registrationPatterns.length > 0) {
      // 後方互換性のためのフォールバック
      logger.warn('DEPRECATED: Using legacy "registrationPatterns" - please update to "toolDiscoveryRules"');
      toolRegistry.setDiscoveryRules(config.registrationPatterns);
      await toolRegistry.applyDiscoveryRules();
    }
    
    // Update tool aliases if changed
    if (config.toolAliases && config.toolAliases.length > 0) {
      logger.info(`Updating ${config.toolAliases.length} tool aliases from configuration`);
      // Then register new ones from updated configuration
      for (const aliasConfig of config.toolAliases) {
        await toolRegistry.handleCreateToolAlias({
          serverId: aliasConfig.serverId,
          toolName: aliasConfig.toolName,
          newName: aliasConfig.newName
        });
      }
    } else if (config.directTools && config.directTools.length > 0) {
      // 後方互換性のためのフォールバック
      logger.warn('DEPRECATED: Using legacy "directTools" - please update to "toolAliases"');
      for (const toolConfig of config.directTools) {
        await toolRegistry.handleCreateToolAlias({
          serverId: toolConfig.serverId,
          toolName: toolConfig.toolName,
          newName: toolConfig.newName
        });
      }
    }
    
    logger.info('Configuration changes applied successfully');
  } catch (error) {
    logger.error('Error applying configuration changes:', error);
  }
});
// Set reference to the tool registry
mcpManager.setToolRegistry(toolRegistry);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get available MCP servers with status information
app.get('/mcp/servers', async (req, res) => {
  try {
    const servers = mcpManager.getDetailedServerInfo();
    res.json({ servers });
  } catch (error) {
    logger.error('Error getting MCP servers:', error);
    res.status(500).json({ error: 'Failed to get MCP servers' });
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

// Force retry for a specific server
app.post('/mcp/servers/:serverId/retry', async (req, res) => {
  try {
    const serverId = req.params.serverId;
    await mcpManager.forceRetryServer(serverId);
    res.json({ 
      success: true, 
      message: `Retry initiated for server ${serverId}` 
    });
  } catch (error) {
    logger.error(`Error retrying server ${req.params.serverId}:`, error);
    res.status(500).json({ 
      error: 'Failed to retry server',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Force retry for all failed servers
app.post('/mcp/servers/retry-all', async (req, res) => {
  try {
    await mcpManager.forceRetryAllServers();
    res.json({ 
      success: true, 
      message: 'Retry initiated for all failed servers' 
    });
  } catch (error) {
    logger.error('Error retrying all servers:', error);
    res.status(500).json({ 
      error: 'Failed to retry all servers',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// TODO: Get detailed status for a specific server
// This endpoint needs investigation due to type issues
// Status information is available via the /mcp/servers endpoint

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
    // Initialize configuration manager
    logger.info('Initializing configuration manager...');
    mcpConfig = await configManager.initialize();
    
    // Initialize MCP connections using the loaded configuration
    logger.info('Initializing MCP Bridge Manager...');
    await mcpManager.initialize(configPath, mcpConfig);
    
    // Set tool discovery rules if configured
    if (mcpConfig.toolDiscoveryRules && mcpConfig.toolDiscoveryRules.length > 0) {
      logger.info(`Configuring ${mcpConfig.toolDiscoveryRules.length} tool discovery rules`);
      toolRegistry.setDiscoveryRules(mcpConfig.toolDiscoveryRules);
    } else if (mcpConfig.registrationPatterns && mcpConfig.registrationPatterns.length > 0) {
      // 後方互換性のためのフォールバック
      logger.warn('DEPRECATED: Using legacy "registrationPatterns" - please update to "toolDiscoveryRules"');
      toolRegistry.setDiscoveryRules(mcpConfig.registrationPatterns);
    }
    
    // Register tool aliases if configured in config
    if (mcpConfig.toolAliases && mcpConfig.toolAliases.length > 0) {
      logger.info(`Creating ${mcpConfig.toolAliases.length} tool aliases from configuration`);
      for (const aliasConfig of mcpConfig.toolAliases) {
        try {
          await toolRegistry.handleCreateToolAlias(aliasConfig);
        } catch (error) {
          logger.error(`Failed to create tool alias ${aliasConfig.serverId}:${aliasConfig.toolName}:`, error);
        }
      }
    } else if (mcpConfig.directTools && mcpConfig.directTools.length > 0) {
      // 後方互換性のためのフォールバック
      logger.warn('DEPRECATED: Using legacy "directTools" - please update to "toolAliases"');
      for (const toolConfig of mcpConfig.directTools) {
        try {
          await toolRegistry.handleCreateToolAlias(toolConfig);
        } catch (error) {
          logger.error(`Failed to create tool alias ${toolConfig.serverId}:${toolConfig.toolName}:`, error);
        }
      }
    }
    
    // Execute automatic registration based on tool discovery rules
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
  configManager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down MCP Bridge Server...');
  await toolRegistry.shutdown();
  await mcpManager.shutdown();
  configManager.shutdown();
  process.exit(0);
});

startServer();
