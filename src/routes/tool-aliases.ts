import express from 'express';
import { z } from 'zod';
import { BridgeToolRegistry } from '../bridge-tool-registry.js';
import { logger } from '../utils/logger.js';
import { validateBody } from '../middleware/validation.js';

export interface ToolAliasRouteContext {
  toolRegistry: BridgeToolRegistry;
}

// Zod schemas for request validation
const CreateAliasSchema = z
  .object({
    serverId: z.string().min(1),
    toolName: z.string().min(1),
    newName: z.string().trim().optional()
  })
  .strict();

const UpdateAliasSchema = z
  .object({
    newName: z.string().trim().min(1)
  })
  .strict();

export interface AuthHandlers {
  requireAuth: express.RequestHandler;
  requirePermission: (permission: string) => express.RequestHandler;
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
      const { serverId, toolName, newName } = CreateAliasSchema.parse(req.body);
      const result = await context.toolRegistry.handleCreateToolAlias({ serverId, toolName, newName });
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request body', details: error.errors });
      }
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
      const { newName } = UpdateAliasSchema.parse(req.body);

      const result = await context.toolRegistry.handleUpdateToolAlias({ oldName: aliasName, newName });
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request body', details: error.errors });
      }
      logger.error(`Error updating tool alias ${req.params.aliasName}:`, error);
      res.status(500).json({ error: 'Failed to update tool alias' });
    }
  };

/**
 * Register tool alias management routes
 */
export const registerToolAliasRoutes = (
  app: express.Application,
  context: ToolAliasRouteContext,
  auth?: AuthHandlers
): void => {
  const requireAuth = auth?.requireAuth ?? ((_req, _res, next) => next());
  const requirePerm = auth?.requirePermission ?? (() => (_req, _res, next) => next());

  app.get(
    '/mcp/tool-aliases',
    requireAuth,
    requirePerm('read'),
    listToolAliasesHandler(context) as express.RequestHandler
  );
  app.post(
    '/mcp/tool-aliases',
    requireAuth,
    requirePerm('write'),
    validateBody(CreateAliasSchema),
    createToolAliasHandler(context) as express.RequestHandler
  );
  app.delete(
    '/mcp/tool-aliases/:aliasName',
    requireAuth,
    requirePerm('write'),
    removeToolAliasHandler(context) as express.RequestHandler
  );
  app.get(
    '/mcp/tool-aliases/explicit',
    requireAuth,
    requirePerm('read'),
    listExplicitToolAliasesHandler(context) as express.RequestHandler
  );
  app.get(
    '/mcp/tool-aliases/auto-discovery',
    requireAuth,
    requirePerm('read'),
    listAutoDiscoveryToolAliasesHandler(context) as express.RequestHandler
  );
  app.put(
    '/mcp/tool-aliases/:aliasName',
    requireAuth,
    requirePerm('write'),
    validateBody(UpdateAliasSchema),
    updateToolAliasHandler(context) as express.RequestHandler
  );
};
