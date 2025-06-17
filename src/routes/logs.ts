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
export const registerLogRoutes = (app: express.Application): void => {
  app.get('/mcp/logs', getLogsHandler as express.RequestHandler);
  app.delete('/mcp/logs', clearLogsHandler as express.RequestHandler);
};
