#!/usr/bin/env node

import { MCPBridgeManager } from './mcp-bridge-manager.js';
import { BridgeToolRegistry } from './bridge-tool-registry.js';
import { loadMCPConfig } from './config/mcp-config.js';
import { logger } from './utils/logger.js';

async function startMCPServer() {
  try {
    // Load configuration
    const configPath = process.argv[2] || './mcp-config.json';
    const config = loadMCPConfig(configPath);
    
    // Initialize MCP Bridge Manager
    const mcpManager = new MCPBridgeManager();
    await mcpManager.initialize(configPath, config);
    
    // Initialize Bridge Tool Registry
    const toolRegistry = new BridgeToolRegistry(mcpManager, config);
    
    // Start stdio server
    await toolRegistry.startStdioServer();
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down Bridge Tool Registry...');
      await toolRegistry.shutdown();
      await mcpManager.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down Bridge Tool Registry...');
      await toolRegistry.shutdown();
      await mcpManager.shutdown();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start MCP Meta Server:', error);
    process.exit(1);
  }
}

startMCPServer();
