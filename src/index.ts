#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { MCPBridgeManager } from './mcp-bridge-manager.js';
import { BridgeToolRegistry } from './bridge-tool-registry.js';
import { MCPHttpServer } from './mcp-http-server.js';
import { logger } from './utils/logger.js';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize MCP Bridge Manager and Tool Registry
const mcpManager = new MCPBridgeManager();
const toolRegistry = new BridgeToolRegistry(mcpManager);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get available MCP servers
app.get('/mcp/servers', async (req, res) => {
  try {
    const servers = mcpManager.getAvailableServers();
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

// 古いAPI '/mcp/tools/call'は削除されました - v1.2.1から非推奨
// 代わりに '/mcp/servers/:serverId/tools/call' エンドポイント、または直接登録されたツールを使用してください

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
    await mcpManager.initialize();
    
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
