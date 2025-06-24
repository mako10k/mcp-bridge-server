import express from 'express';
import { MCPBridgeManager } from '../mcp-bridge-manager.js';
import { logger } from '../utils/logger.js';

export interface ResourceRouteContext {
  mcpManager: MCPBridgeManager;
}

export interface AuthHandlers {
  requireAuth: express.RequestHandler;
  requirePermission: (permission: string) => express.RequestHandler;
}

/**
 * List resources from a specific MCP server handler
 */
export const listServerResourcesHandler = (context: ResourceRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const { serverId } = req.params;
      const resources = await context.mcpManager.listResources(serverId);
      res.json({ resources });
    } catch (error) {
      logger.error(`Error listing resources for server ${req.params.serverId}:`, error);
      res.status(500).json({ error: 'Failed to list resources' });
    }
  };

/**
 * Read a resource from a specific MCP server handler
 */
export const readServerResourceHandler = (context: ResourceRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const { serverId, resourceUri } = req.params;
      const resource = await context.mcpManager.readResource(serverId, decodeURIComponent(resourceUri));
      res.json({ resource });
    } catch (error) {
      logger.error(`Error reading resource from server ${req.params.serverId}:`, error);
      res.status(500).json({ error: 'Failed to read resource' });
    }
  };

/**
 * Register resource management routes
 */
export const registerResourceRoutes = (
  app: express.Application,
  context: ResourceRouteContext,
  auth?: AuthHandlers
): void => {
  const requireAuth = auth?.requireAuth ?? ((_req, _res, next) => next());
  const requirePerm = auth?.requirePermission ?? (() => (_req, _res, next) => next());

  app.get(
    '/mcp/servers/:serverId/resources',
    requireAuth,
    requirePerm('read'),
    listServerResourcesHandler(context)
  );
  app.get(
    '/mcp/servers/:serverId/resources/:resourceUri',
    requireAuth,
    requirePerm('read'),
    readServerResourceHandler(context)
  );
};
