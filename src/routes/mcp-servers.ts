import express from 'express';
import { MCPBridgeManager } from '../mcp-bridge-manager.js';
import { logger } from '../utils/logger.js';

export interface MCPServerRouteContext {
  mcpManager: MCPBridgeManager;
}

/**
 * Get available MCP servers (with status information) handler
 */
export const getMCPServersHandler = (context: MCPServerRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const servers = context.mcpManager.getDetailedServerInfo();
      res.json({ servers });
    } catch (error) {
      logger.error('Error getting MCP servers:', error);
      res.status(500).json({ error: 'Failed to get MCP servers' });
    }
  };

/**
 * Get server status for a specific server handler
 */
export const getServerStatusHandler = (context: MCPServerRouteContext) => 
  (req: express.Request, res: express.Response) => {
    try {
      const { serverId } = req.params;
      const status = context.mcpManager.getServerStatus(serverId);
      if (!status) {
        return res.status(404).json({ error: 'Server not found' });
      }
      res.json({ status });
    } catch (error) {
      logger.error(`Error getting server status for ${req.params.serverId}:`, error);
      res.status(500).json({ error: 'Failed to get server status' });
    }
  };

/**
 * Force retry connection for a specific server handler
 */
export const retryServerHandler = (context: MCPServerRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const { serverId } = req.params;
      await context.mcpManager.forceRetryServer(serverId);
      res.json({ success: true, message: 'Retry initiated' });
    } catch (error) {
      logger.error(`Error retrying server ${req.params.serverId}:`, error);
      res.status(500).json({ error: 'Failed to retry server' });
    }
  };

/**
 * Force retry connection for all failed servers handler
 */
export const retryAllServersHandler = (context: MCPServerRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const results = await context.mcpManager.forceRetryAllServers();
      res.json({ results });
    } catch (error) {
      logger.error('Error retrying all servers:', error);
      res.status(500).json({ error: 'Failed to retry all servers' });
    }
  };

/**
 * Register MCP server management routes
 */
export interface AuthHandlers {
  requireAuth: express.RequestHandler;
  requirePermission: (permission: string) => express.RequestHandler;
}

export const registerMCPServerRoutes = (
  app: express.Application,
  context: MCPServerRouteContext,
  auth?: AuthHandlers
): void => {
  const requireAuth = auth?.requireAuth ?? ((_req, _res, next) => next());
  const requirePerm = auth?.requirePermission ?? (() => (_req, _res, next) => next());

  app.get(
    '/mcp/servers',
    requireAuth,
    requirePerm('read'),
    getMCPServersHandler(context)
  );
  app.get(
    '/mcp/servers/:serverId/status',
    requireAuth,
    requirePerm('read'),
    getServerStatusHandler(context) as express.RequestHandler
  );
  app.post(
    '/mcp/servers/:serverId/retry',
    requireAuth,
    requirePerm('execute'),
    retryServerHandler(context)
  );
  app.post(
    '/mcp/servers/retry-all',
    requireAuth,
    requirePerm('execute'),
    retryAllServersHandler(context)
  );
};
