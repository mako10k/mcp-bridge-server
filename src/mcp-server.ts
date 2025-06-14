#!/usr/bin/env node

import { MCPBridgeManager } from './mcp-bridge-manager.js';
import { MCPMetaServer } from './mcp-meta-server.js';
import { logger } from './utils/logger.js';

async function startMCPServer() {
  try {
    // Initialize MCP Bridge Manager
    const mcpManager = new MCPBridgeManager();
    await mcpManager.initialize();
    
    // Initialize MCP Meta Server
    const metaServer = new MCPMetaServer(mcpManager);
    
    // Start stdio server
    await metaServer.startStdioServer();
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down MCP Meta Server...');
      await metaServer.shutdown();
      await mcpManager.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down MCP Meta Server...');
      await metaServer.shutdown();
      await mcpManager.shutdown();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start MCP Meta Server:', error);
    process.exit(1);
  }
}

startMCPServer();
