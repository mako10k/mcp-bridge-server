import express from 'express';
import { logger } from '../utils/logger.js';

/**
 * Get logs handler
 */
export const getLogsHandler = async (req: express.Request, res: express.Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const logs = logger.getLogs(limit);
    res.json({ logs });
  } catch (error) {
    logger.error('Error retrieving logs:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
};

/**
 * Clear logs handler
 */
export const clearLogsHandler = async (req: express.Request, res: express.Response) => {
  try {
    logger.clearLogs();
    logger.info('Logs cleared via API');
    res.json({ success: true, message: 'Logs cleared successfully' });
  } catch (error) {
    logger.error('Error clearing logs:', error);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
};

/**
 * Register log management routes
 */
export interface AuthHandlers {
  requireAuth: express.RequestHandler;
  requirePermission: (permission: string) => express.RequestHandler;
}

export const registerLogRoutes = (
  app: express.Application,
  auth?: AuthHandlers
): void => {
  const requireAuth = auth?.requireAuth ?? ((_req, _res, next) => next());
  const requirePerm = auth?.requirePermission ?? (() => (_req, _res, next) => next());

  app.get('/mcp/logs', requireAuth, requirePerm('read'), getLogsHandler as express.RequestHandler);
  app.delete('/mcp/logs', requireAuth, requirePerm('write'), clearLogsHandler as express.RequestHandler);
};
