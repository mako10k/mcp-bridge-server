import express from 'express';

export interface HealthRouteContext {
  currentPort: number;
}

/**
 * Health check endpoint handler
 */
export const healthCheckHandler = (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
};

/**
 * Get server information (port, status, etc.) handler
 */
export const getServerInfoHandler = (context: HealthRouteContext) => 
  (req: express.Request, res: express.Response) => {
    try {
      res.json({ 
        port: context.currentPort,
        status: 'running',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting server info:', error);
      res.status(500).json({ error: 'Failed to get server info' });
    }
  };

/**
 * Register health and server info routes
 */
export const registerHealthRoutes = (
  app: express.Application, 
  context: HealthRouteContext
): void => {
  app.get('/health', healthCheckHandler);
  app.get('/mcp/server-info', getServerInfoHandler(context));
};
