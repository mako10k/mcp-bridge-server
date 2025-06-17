import express from 'express';
import { logger } from '../utils/logger.js';

export interface ServerManagementRouteContext {
  currentPort: number;
  restartServerOnNewPort: (port: number) => Promise<void>;
  performGracefulShutdown: () => Promise<void>;
}

/**
 * Restart server handler
 */
export const restartServerHandler = (context: ServerManagementRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const newPort = req.body.port || context.currentPort;
      logger.info(`Server restart requested via API, port: ${newPort}`);
      
      res.json({ 
        success: true, 
        message: 'Server restart initiated',
        newPort: newPort
      });
      
      // Restart server after sending response
      setTimeout(async () => {
        try {
          await context.restartServerOnNewPort(newPort);
        } catch (error) {
          logger.error('Failed to restart server:', error);
        }
      }, 100);
      
    } catch (error) {
      logger.error('Error initiating server restart:', error);
      res.status(500).json({ error: 'Failed to initiate server restart' });
    }
  };

/**
 * Shutdown server handler
 */
export const shutdownServerHandler = (context: ServerManagementRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      logger.info('Server shutdown requested via API');
      res.json({ 
        success: true, 
        message: 'Server shutdown initiated'
      });
      
      // Shutdown server after sending response
      setTimeout(async () => {
        try {
          await context.performGracefulShutdown();
          process.exit(0);
        } catch (error) {
          logger.error('Failed to shutdown server gracefully:', error);
          process.exit(1);
        }
      }, 100);
      
    } catch (error) {
      logger.error('Error initiating server shutdown:', error);
      res.status(500).json({ error: 'Failed to initiate server shutdown' });
    }
  };

/**
 * Register server management routes
 */
export const registerServerManagementRoutes = (
  app: express.Application, 
  context: ServerManagementRouteContext
): void => {
  app.post('/mcp/server/restart', restartServerHandler(context) as express.RequestHandler);
  app.post('/mcp/server/shutdown', shutdownServerHandler(context) as express.RequestHandler);
};
