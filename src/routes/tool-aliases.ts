import express from 'express';
import { BridgeToolRegistry } from '../bridge-tool-registry.js';
import { logger } from '../utils/logger.js';

export interface ToolAliasRouteContext {
  toolRegistry: BridgeToolRegistry;
}

/**
 * List all tool aliases handler
 */
export const listToolAliasesHandler = (context: ToolAliasRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const result = await context.toolRegistry.handleListAliasedTools();
      res.json(result);
    } catch (error) {
      logger.error('Error listing tool aliases:', error);
      res.status(500).json({ error: 'Failed to list tool aliases' });
    }
  };

/**
 * Create a tool alias handler
 */
export const createToolAliasHandler = (context: ToolAliasRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const { serverId, toolName, newName } = req.body;
      if (!serverId || !toolName) {
        return res.status(400).json({ error: 'serverId and toolName are required' });
      }
      
      const result = await context.toolRegistry.handleCreateToolAlias({ serverId, toolName, newName });
      res.json(result);
    } catch (error) {
      logger.error('Error creating tool alias:', error);
      res.status(500).json({ error: 'Failed to create tool alias' });
    }
  };

/**
 * Remove a tool alias handler
 */
export const removeToolAliasHandler = (context: ToolAliasRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const { aliasName } = req.params;
      const result = await context.toolRegistry.handleRemoveToolAlias({ toolName: aliasName });
      res.json(result);
    } catch (error) {
      logger.error(`Error removing tool alias ${req.params.aliasName}:`, error);
      res.status(500).json({ error: 'Failed to remove tool alias' });
    }
  };

/**
 * List explicit tool aliases handler
 */
export const listExplicitToolAliasesHandler = (context: ToolAliasRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const result = await context.toolRegistry.handleListAliasedTools();
      const explicitTools = result.tools.filter((tool: any) => tool.source === 'explicit');
      res.json({ tools: explicitTools });
    } catch (error) {
      logger.error('Error listing explicit tool aliases:', error);
      res.status(500).json({ error: 'Failed to list explicit tool aliases' });
    }
  };

/**
 * List auto-discovery tool aliases handler
 */
export const listAutoDiscoveryToolAliasesHandler = (context: ToolAliasRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const result = await context.toolRegistry.handleListAliasedTools();
      const autoDiscoveryTools = result.tools.filter((tool: any) => tool.source === 'auto-discovery');
      res.json({ tools: autoDiscoveryTools });
    } catch (error) {
      logger.error('Error listing auto-discovery tool aliases:', error);
      res.status(500).json({ error: 'Failed to list auto-discovery tool aliases' });
    }
  };

/**
 * Update tool alias handler
 */
export const updateToolAliasHandler = (context: ToolAliasRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const { aliasName } = req.params;
      const { newName } = req.body;
      
      if (!newName) {
        return res.status(400).json({ error: 'newName is required' });
      }
      
      const result = await context.toolRegistry.handleUpdateToolAlias({ oldName: aliasName, newName });
      res.json(result);
    } catch (error) {
      logger.error(`Error updating tool alias ${req.params.aliasName}:`, error);
      res.status(500).json({ error: 'Failed to update tool alias' });
    }
  };

/**
 * Register tool alias management routes
 */
export const registerToolAliasRoutes = (
  app: express.Application, 
  context: ToolAliasRouteContext
): void => {
  app.get('/mcp/tool-aliases', listToolAliasesHandler(context) as express.RequestHandler);
  app.post('/mcp/tool-aliases', createToolAliasHandler(context) as express.RequestHandler);
  app.delete('/mcp/tool-aliases/:aliasName', removeToolAliasHandler(context) as express.RequestHandler);
  app.get('/mcp/tool-aliases/explicit', listExplicitToolAliasesHandler(context) as express.RequestHandler);
  app.get('/mcp/tool-aliases/auto-discovery', listAutoDiscoveryToolAliasesHandler(context) as express.RequestHandler);
  app.put('/mcp/tool-aliases/:aliasName', updateToolAliasHandler(context) as express.RequestHandler);
};
