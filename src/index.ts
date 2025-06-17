#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { loadMCPConfig } from './config/mcp-config.js';
import { MCPBridgeManager } from './mcp-bridge-manager.js';
import { BridgeToolRegistry } from './bridge-tool-registry.js';
import { MCPHttpServer } from './mcp-http-server.js';
import { logger } from './utils/logger.js';
import { Server } from 'http';
import net from 'net';

// Import route handlers
import { registerHealthRoutes } from './routes/health.js';
import { registerMCPServerRoutes } from './routes/mcp-servers.js';
import { registerToolRoutes } from './routes/tools.js';
import { registerToolAliasRoutes } from './routes/tool-aliases.js';
import { registerResourceRoutes } from './routes/resources.js';
import { registerConfigRoutes } from './routes/config.js';
import { registerLogRoutes } from './routes/logs.js';
import { registerServerManagementRoutes } from './routes/server-management.js';
import { registerErrorHandler } from './middleware/error-handler.js';

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

// Register all routes
registerHealthRoutes(app, { currentPort });
registerMCPServerRoutes(app, { mcpManager });
registerToolRoutes(app, { mcpManager });
registerToolAliasRoutes(app, { toolRegistry });
registerResourceRoutes(app, { mcpManager });
registerConfigRoutes(app, { toolRegistry, mcpManager, restartServerOnNewPort });
registerLogRoutes(app);
registerServerManagementRoutes(app, { 
  currentPort, 
  restartServerOnNewPort, 
  performGracefulShutdown 
});

// Register error handling middleware
registerErrorHandler(app);

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
