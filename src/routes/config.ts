import express from 'express';
import { BridgeToolRegistry } from '../bridge-tool-registry.js';
import { MCPBridgeManager } from '../mcp-bridge-manager.js';
import { logger } from '../utils/logger.js';

export interface ConfigRouteContext {
  toolRegistry: BridgeToolRegistry;
  mcpManager: MCPBridgeManager;
  restartServerOnNewPort: (port: number) => Promise<void>;
}

export interface AuthHandlers {
  requireAuth: express.RequestHandler;
  requirePermission: (permission: string) => express.RequestHandler;
}

/**
 * Get all server configurations handler
 */
export const getAllServerConfigsHandler = (context: ConfigRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const configManager = context.toolRegistry.getConfigManager();
      const currentConfig = configManager.getCurrentConfig();
      res.json({ servers: currentConfig.servers || [] });
    } catch (error) {
      logger.error('Error getting server configurations:', error);
      res.status(500).json({ error: 'Failed to get server configurations' });
    }
  };

/**
 * Get specific server configuration handler
 */
export const getServerConfigHandler = (context: ConfigRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const { serverId } = req.params;
      const configManager = context.toolRegistry.getConfigManager();
      const currentConfig = configManager.getCurrentConfig();
      const server = currentConfig.servers?.find((s: any) => s.name === serverId);
      
      if (!server) {
        return res.status(404).json({ error: 'Server configuration not found' });
      }
      
      res.json({ server });
    } catch (error) {
      logger.error(`Error getting server configuration for ${req.params.serverId}:`, error);
      res.status(500).json({ error: 'Failed to get server configuration' });
    }
  };

/**
 * Add server configuration handler
 */
export const addServerConfigHandler = (context: ConfigRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const { serverId, config } = req.body;
      if (!serverId || !config) {
        return res.status(400).json({ error: 'serverId and config are required' });
      }
      
      const result = await context.toolRegistry.handleAddServerConfig({ serverId, config });
      res.json(result);
    } catch (error) {
      logger.error('Error adding server configuration:', error);
      res.status(500).json({ error: 'Failed to add server configuration' });
    }
  };

/**
 * Update server configuration handler
 */
export const updateServerConfigHandler = (context: ConfigRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const { serverId } = req.params;
      const { config } = req.body;
      if (!config) {
        return res.status(400).json({ error: 'config is required' });
      }
      
      const result = await context.toolRegistry.handleUpdateServerConfig({ serverId, config });
      res.json(result);
    } catch (error) {
      logger.error(`Error updating server configuration for ${req.params.serverId}:`, error);
      res.status(500).json({ error: 'Failed to update server configuration' });
    }
  };

/**
 * Remove server configuration handler
 */
export const removeServerConfigHandler = (context: ConfigRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const { serverId } = req.params;
      const result = await context.toolRegistry.handleRemoveServerConfig({ serverId });
      res.json(result);
    } catch (error) {
      logger.error(`Error removing server configuration for ${req.params.serverId}:`, error);
      res.status(500).json({ error: 'Failed to remove server configuration' });
    }
  };

/**
 * Get global configuration handler
 */
export const getGlobalConfigHandler = (context: ConfigRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const configManager = context.toolRegistry.getConfigManager();
      const currentConfig = configManager.getCurrentConfig();
      res.json({ config: currentConfig.global || {} });
    } catch (error) {
      logger.error('Error getting global configuration:', error);
      res.status(500).json({ error: 'Failed to get global configuration' });
    }
  };

/**
 * Update global configuration handler
 */
export const updateGlobalConfigHandler = (context: ConfigRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const { config } = req.body;
      if (!config) {
        return res.status(400).json({ error: 'config is required' });
      }
      
      // Check if httpPort is being changed
      const currentConfig = context.toolRegistry.getConfigManager().getCurrentConfig();
      const currentHttpPort = currentConfig.global?.httpPort || 3000;
      const newHttpPort = config.httpPort;
      
      const result = await context.toolRegistry.handleUpdateGlobalConfig({ config });
      
      // If httpPort changed and update was successful, restart server on new port
      if (result.success && newHttpPort && newHttpPort !== currentHttpPort) {
        logger.info(`HTTP port changed from ${currentHttpPort} to ${newHttpPort}, restarting server...`);
        
        // Send response first before restarting
        res.json({ 
          ...result, 
          message: `${result.message}. Server restarting on port ${newHttpPort}...` 
        });
        
        // Restart server with new port after short delay
        setTimeout(() => {
          context.restartServerOnNewPort(newHttpPort);
        }, 500);
        
        return;
      }
      
      res.json(result);
    } catch (error) {
      logger.error('Error updating global configuration:', error);
      res.status(500).json({ error: 'Failed to update global configuration' });
    }
  };

/**
 * Get tool discovery rules handler
 */
export const getToolDiscoveryRulesHandler = (context: ConfigRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const configManager = context.toolRegistry.getConfigManager();
      const currentConfig = configManager.getCurrentConfig();
      res.json({ 
        rules: currentConfig.toolDiscoveryRules || currentConfig.registrationPatterns || [] 
      });
    } catch (error) {
      logger.error('Error getting tool discovery rules:', error);
      res.status(500).json({ error: 'Failed to get tool discovery rules' });
    }
  };

/**
 * Update tool discovery rules handler
 */
export const updateToolDiscoveryRulesHandler = (context: ConfigRouteContext) => 
  async (req: express.Request, res: express.Response) => {
    try {
      const { rules } = req.body;
      if (!Array.isArray(rules)) {
        return res.status(400).json({ error: 'rules must be an array' });
      }
      
      // Validate each rule
      const validatedRules = rules.map(rule => {
        if (!rule.serverPattern || !rule.toolPattern) {
          throw new Error('Each rule must have serverPattern and toolPattern');
        }
        return {
          serverPattern: rule.serverPattern,
          toolPattern: rule.toolPattern,
          exclude: Boolean(rule.exclude)
        };
      });
      
      const configManager = context.toolRegistry.getConfigManager();
      
      // Update discovery rules
      const result = await configManager.updateToolDiscoveryRules(validatedRules);
      if (!result.success) {
        return res.status(500).json({ error: result.message });
      }
      
      // Notify MCP Manager of configuration changes
      const updatedConfig = configManager.getCurrentConfig();
      await context.mcpManager.reloadConfiguration(updatedConfig);
      
      // Apply new discovery rules
      context.toolRegistry.setDiscoveryRules(validatedRules);
      await context.toolRegistry.applyDiscoveryRules();
      
      logger.info(`Updated tool discovery rules: ${validatedRules.length} rules`);
      res.json({ 
        success: true, 
        message: 'Tool discovery rules updated successfully',
        rules: validatedRules
      });
    } catch (error) {
      logger.error('Error updating tool discovery rules:', error);
      res.status(500).json({ error: 'Failed to update tool discovery rules' });
    }
  };

/**
 * Register configuration management routes
 */
export const registerConfigRoutes = (
  app: express.Application,
  context: ConfigRouteContext,
  auth?: AuthHandlers
): void => {
  const requireAuth = auth?.requireAuth ?? ((_req, _res, next) => next());
  const requirePerm = auth?.requirePermission ?? (() => (_req, _res, next) => next());

  // Server configuration routes
  app.get(
    '/mcp/config/servers',
    requireAuth,
    requirePerm('config'),
    getAllServerConfigsHandler(context) as express.RequestHandler
  );
  app.get(
    '/mcp/config/servers/:serverId',
    requireAuth,
    requirePerm('config'),
    getServerConfigHandler(context) as express.RequestHandler
  );
  app.post(
    '/mcp/config/servers',
    requireAuth,
    requirePerm('config'),
    addServerConfigHandler(context) as express.RequestHandler
  );
  app.put(
    '/mcp/config/servers/:serverId',
    requireAuth,
    requirePerm('config'),
    updateServerConfigHandler(context) as express.RequestHandler
  );
  app.delete(
    '/mcp/config/servers/:serverId',
    requireAuth,
    requirePerm('config'),
    removeServerConfigHandler(context) as express.RequestHandler
  );

  // Global configuration routes
  app.get(
    '/mcp/config/global',
    requireAuth,
    requirePerm('config'),
    getGlobalConfigHandler(context) as express.RequestHandler
  );
  app.put(
    '/mcp/config/global',
    requireAuth,
    requirePerm('config'),
    updateGlobalConfigHandler(context) as express.RequestHandler
  );

  // Tool discovery rules routes
  app.get(
    '/mcp/config/discovery-rules',
    requireAuth,
    requirePerm('config'),
    getToolDiscoveryRulesHandler(context) as express.RequestHandler
  );
  app.put(
    '/mcp/config/discovery-rules',
    requireAuth,
    requirePerm('config'),
    updateToolDiscoveryRulesHandler(context) as express.RequestHandler
  );
};
