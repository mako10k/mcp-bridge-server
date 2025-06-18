import express from 'express';
import { z } from 'zod';
import { MCPBridgeManager } from '../mcp-bridge-manager.js';
import { logger } from '../utils/logger.js';

export interface ToolRouteContext {
  mcpManager: MCPBridgeManager;
}

// Zod schema for tool call validation
const CallToolSchema = z.object({
  name: z.string(),
  arguments: z.record(z.any()).optional().default({})
});

/**
 * Get all tools from all servers (with namespace information) handler
 */
export const getAllToolsHandler = (context: ToolRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const tools = await context.mcpManager.getAllTools();
      res.json({ tools });
    } catch (error) {
      logger.error('Error getting all tools:', error);
      res.status(500).json({ error: 'Failed to get all tools' });
    }
  };

/**
 * Get tool name conflicts handler
 */
export const getToolConflictsHandler = (context: ToolRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const conflicts = await context.mcpManager.getToolConflicts();
      res.json({ conflicts });
    } catch (error) {
      logger.error('Error getting tool conflicts:', error);
      res.status(500).json({ error: 'Failed to get tool conflicts' });
    }
  };

/**
 * List tools from a specific MCP server handler
 */
export const listServerToolsHandler = (context: ToolRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const { serverId } = req.params;
      const tools = await context.mcpManager.listTools(serverId);
      res.json({ tools });
    } catch (error) {
      logger.error(`Error listing tools for server ${req.params.serverId}:`, error);
      res.status(500).json({ error: 'Failed to list tools' });
    }
  };

/**
 * Call a tool on a specific MCP server handler
 */
export const callToolHandler = (context: ToolRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const { serverId } = req.params;
      const { name, arguments: toolArgs } = CallToolSchema.parse(req.body);
      
      const result = await context.mcpManager.callToolWithContext(serverId, name, toolArgs, req);
      res.json({ result });
    } catch (error) {
      logger.error(`Error calling tool on server ${req.params.serverId}:`, error);
      res.status(500).json({ error: 'Failed to call tool' });
    }
  };

/**
 * Register tool management routes
 */
export const registerToolRoutes = (
  app: express.Application, 
  context: ToolRouteContext
): void => {
  app.get('/mcp/tools', getAllToolsHandler(context));
  app.get('/mcp/conflicts', getToolConflictsHandler(context));
  app.get('/mcp/servers/:serverId/tools', listServerToolsHandler(context));
  app.post('/mcp/servers/:serverId/tools/call', callToolHandler(context));
};
