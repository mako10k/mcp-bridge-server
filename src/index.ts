#!/usr/bin/env node

import express from 'express';
import { createCorsMiddleware } from './middleware/cors-middleware.js';
import { loadMCPConfig } from './config/mcp-config.js';
import { listenAddressSecurityManager } from './config/listen-address-security.js';
import { MCPBridgeManager } from './mcp-bridge-manager.js';
import { BridgeToolRegistry } from './bridge-tool-registry.js';
import { MCPHttpServer } from './mcp-http-server.js';
import { logger } from './utils/logger.js';
import { Server } from 'http';
import net from 'net';
import { generateKeyPairSync } from 'crypto';

// Import route handlers
import { registerHealthRoutes } from './routes/health.js';
import { registerMCPServerRoutes } from './routes/mcp-servers.js';
import { registerToolRoutes } from './routes/tools.js';
import { registerToolAliasRoutes } from './routes/tool-aliases.js';
import { registerResourceRoutes } from './routes/resources.js';
import { registerConfigRoutes } from './routes/config.js';
import { registerLogRoutes } from './routes/logs.js';
import { registerServerManagementRoutes } from './routes/server-management.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerUserConfigRoutes } from './routes/user-config.js';
import { AuthManager } from './auth/managers/auth-manager.js';
import { UserConfigManager } from './config/user-config-manager.js';
import { registerErrorHandler } from './middleware/error-handler.js';
import { AuthConfigManager, type AuthConfig } from './config/auth-config.js';
import { JWTUtils } from './auth/utils/jwt-utils.js';
import { requireAuth } from './middleware/auth-middleware.js';
import { createAuthContextMiddleware } from './middleware/auth-context.js';
import { AuthContextManager } from './auth/context/auth-context.js';
import { requestLogger } from './middleware/request-logger.js';
import { createRBACMiddleware } from './middleware/rbac-middleware.js';
import { PermissionManager } from './auth/permissions/permission-manager.js';
import { GoogleProvider } from './auth/providers/google-provider.js';
import { AzureProvider } from './auth/providers/azure-provider.js';
import { GitHubProvider } from './auth/providers/github-provider.js';
import { GenericOIDCProvider } from './auth/providers/generic-oidc.js';

// Server instance reference for restart functionality
let server: Server | null = null;
let currentPort: number = 3000;

// Get configuration file path from command line arguments
const configPath = process.argv[2] || './mcp-config.json';
logger.info(`Using configuration file: ${configPath}`);

const app = express();
// Load MCP configuration first to get port setting
const mcpConfig = loadMCPConfig(configPath);
// Apply security configuration
if (mcpConfig.security) {
  listenAddressSecurityManager.applyConfig(mcpConfig.security);
}
const port = Number(process.env.PORT || mcpConfig.global?.httpPort || 3000);
currentPort = port;

// Middleware
const corsConf = mcpConfig.security?.cors || { allowedOrigins: ['*'], allowCredentials: false };
app.use(createCorsMiddleware(corsConf));
app.use(express.json());

// Initialize MCP Bridge Manager and Tool Registry
const mcpManager = new MCPBridgeManager();
const toolRegistry = new BridgeToolRegistry(mcpManager, mcpConfig, configPath);
const authManager = new AuthManager();
const authContextManager = new AuthContextManager();
app.use(createAuthContextMiddleware(authContextManager));
app.use(requestLogger);
const userConfigManager = new UserConfigManager();
const authConfigManager = new AuthConfigManager(configPath);
let authConfig = authConfigManager.getConfig();
const permissionManager = new PermissionManager(
  (authConfig.rbac as any) || {
    defaultRole: 'viewer',
    roles: {
      viewer: { id: 'viewer', name: 'Viewer', permissions: ['read'], isSystemRole: true },
      admin: { id: 'admin', name: 'Admin', permissions: ['*'], isSystemRole: true }
    }
  }
);

// Initialize JWT utilities
let privateKey = process.env.JWT_PRIVATE_KEY;
let publicKey = process.env.JWT_PUBLIC_KEY;
if (!privateKey || !publicKey) {
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  privateKey = keys.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
  publicKey = keys.publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();
  logger.warn('JWT keys not provided; generated temporary keys');
}
const jwtConf = {
  issuer: 'mcp-bridge',
  audience: 'mcp-bridge-api',
  expiresIn: '1h',
  ...authConfig.jwt
};
const jwtUtils = new JWTUtils(jwtConf as any, privateKey, publicKey);

const requireAuthMiddleware = requireAuth({ jwtUtils, mode: authConfig.mode });
const requirePermission = createRBACMiddleware(
  (authConfig.rbac as any) || {
    defaultRole: 'viewer',
    roles: {
      viewer: { id: 'viewer', name: 'Viewer', permissions: ['read'], isSystemRole: true },
      admin: { id: 'admin', name: 'Admin', permissions: ['*'], isSystemRole: true }
    }
  },
  { checkPermission: (u, p, r) => permissionManager.checkPermission(u as any, p, r) }
);

const authHandlers = { requireAuth: requireAuthMiddleware, requirePermission };

async function configureAuth(config: AuthConfig): Promise<void> {
  authConfig = config;
  requireAuthMiddleware.update({ jwtUtils, mode: config.mode });
  requirePermission.update(
    (config.rbac as any) || {
      defaultRole: 'viewer',
      roles: {
        viewer: { id: 'viewer', name: 'Viewer', permissions: ['read'], isSystemRole: true },
        admin: { id: 'admin', name: 'Admin', permissions: ['*'], isSystemRole: true }
      }
    },
    { checkPermission: (u, p, r) => permissionManager.checkPermission(u as any, p, r) }
  );
  permissionManager.updateConfig(
    (config.rbac as any) || {
      defaultRole: 'viewer',
      roles: {
        viewer: { id: 'viewer', name: 'Viewer', permissions: ['read'], isSystemRole: true },
        admin: { id: 'admin', name: 'Admin', permissions: ['*'], isSystemRole: true }
      }
    }
  );

  authManager.unregisterAllProviders();

  for (const provider of config.providers) {
    switch (provider.type) {
      case 'google':
        authManager.registerProvider(
          new GoogleProvider({
            clientId: provider.clientId,
            clientSecret: provider.clientSecret,
            redirectUri: provider.redirectUri || '',
            scope: provider.scope
          })
        );
        break;
      case 'azure':
        authManager.registerProvider(
          new AzureProvider({
            clientId: provider.clientId,
            clientSecret: provider.clientSecret,
            redirectUri: provider.redirectUri || '',
            scope: provider.scope,
            tenantId: provider.tenantId || ''
          })
        );
        break;
      case 'github':
        authManager.registerProvider(
          new GitHubProvider({
            clientId: provider.clientId,
            clientSecret: provider.clientSecret,
            redirectUri: provider.redirectUri || '',
            scope: provider.scope
          })
        );
        break;
      case 'oidc': {
        const p = new GenericOIDCProvider({
          clientId: provider.clientId,
          clientSecret: provider.clientSecret,
          redirectUri: provider.redirectUri || '',
          scope: provider.scope,
          issuer: (provider as any).issuer || '',
          discovery: true
        });
        await p.init().catch((err) => logger.error('OIDC provider init failed', err));
        authManager.registerProvider(p);
        break;
      }
    }
  }
}

await configureAuth(authConfig);

authConfigManager.on('reloaded', async (newConfig) => {
  const newJwtConf = {
    issuer: 'mcp-bridge',
    audience: 'mcp-bridge-api',
    expiresIn: '1h',
    ...newConfig.jwt
  } as any;
  jwtUtils.updateConfig(newJwtConf, privateKey!, publicKey!);
  await configureAuth(newConfig);
  logger.info('Authentication configuration reloaded');
});

// Set reference to the tool registry
mcpManager.setToolRegistry(toolRegistry);

/**
 * Restart server on new port
 */
async function restartServerOnNewPort(newPort: number): Promise<void> {
  try {
    logger.info(`Restarting server on port ${newPort}...`);
    
    // Close current server if running
    if (server) {
      await new Promise<void>((resolve) => {
        server!.close(() => {
          logger.info(`Server stopped on port ${currentPort}`);
          resolve();
        });
      });
    }
    
    // Update current port
    currentPort = newPort;
    
    const listenAddress = listenAddressSecurityManager.getListenAddress();
    server = app.listen(newPort, listenAddress, () => {
      logger.info(`MCP Bridge Server restarted on port ${newPort} (${listenAddress})`);
      logger.info(`Health check: http://${listenAddress === '0.0.0.0' ? 'localhost' : listenAddress}:${newPort}/health`);
      logger.info(`Available servers: http://${listenAddress === '0.0.0.0' ? 'localhost' : listenAddress}:${newPort}/mcp/servers`);

      const status = listenAddressSecurityManager.getSecurityStatus();
      logger.info(
        `Security status: authEnabled=${status.authEnabled}, externalAccess=${status.allowExternalAccess}, effectiveAddress=${status.effectiveListenAddress}`
      );
      for (const rec of status.recommendations) {
        logger.warn(rec);
      }
    });
    
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${newPort} is already in use during restart. Cannot restart server.`);
      } else {
        logger.error(`Failed to start server on port ${newPort}:`, error);
      }
    });
    
  } catch (error) {
    logger.error(`Failed to restart server on port ${newPort}:`, error);
  }
}

/**
 * Perform graceful shutdown
 */
async function performGracefulShutdown(): Promise<void> {
  logger.info('Performing graceful shutdown...');
  
  // Close HTTP server
  if (server) {
    await new Promise<void>((resolve) => {
      server!.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });
  }
  
  // Shutdown MCP components
  await toolRegistry.shutdown();
  await mcpManager.shutdown();
  
  logger.info('Graceful shutdown completed');
}

// Register all routes
registerHealthRoutes(app, { currentPort });
registerMCPServerRoutes(app, { mcpManager }, authHandlers);
registerToolRoutes(app, { mcpManager }, authHandlers);
registerToolAliasRoutes(app, { toolRegistry }, authHandlers);
registerResourceRoutes(app, { mcpManager }, authHandlers);
registerAuthRoutes(app, { authManager, getRBACConfig: () => authConfig.rbac as any });
registerUserConfigRoutes(app, { userConfigManager }, authHandlers);
registerConfigRoutes(app, { toolRegistry, mcpManager, restartServerOnNewPort }, authHandlers);
registerLogRoutes(app, authHandlers);
registerServerManagementRoutes(app, {
  currentPort,
  restartServerOnNewPort,
  performGracefulShutdown
}, authHandlers);

// Register error handling middleware
registerErrorHandler(app);

// MCP HTTP Server using StreamableHTTPServerTransport from the SDK
const mcpHttpServer = new MCPHttpServer(mcpManager);
mcpHttpServer.registerWithApp(app);

// Start the server
async function startServer() {
  try {
    // Initialize MCP connections
    await mcpManager.initialize(configPath);
    
    // Set tool discovery rules if configured (new naming)
    if (mcpConfig.toolDiscoveryRules && mcpConfig.toolDiscoveryRules.length > 0) {
      logger.info(`Configuring ${mcpConfig.toolDiscoveryRules.length} tool discovery rules`);
      toolRegistry.setDiscoveryRules(mcpConfig.toolDiscoveryRules);
    }
    // Support legacy naming for backward compatibility
    else if (mcpConfig.registrationPatterns && mcpConfig.registrationPatterns.length > 0) {
      logger.info(`Configuring ${mcpConfig.registrationPatterns.length} tool discovery rules (legacy)`);
      toolRegistry.setDiscoveryRules(mcpConfig.registrationPatterns);
    }
    
    // Register tool aliases if configured in config (new naming)
    if (mcpConfig.toolAliases && mcpConfig.toolAliases.length > 0) {
      logger.info(`Registering ${mcpConfig.toolAliases.length} tool aliases from configuration`);
      for (const toolConfig of mcpConfig.toolAliases) {
        try {
          await toolRegistry.handleCreateToolAlias(toolConfig);
        } catch (error) {
          logger.error(`Failed to register tool alias ${toolConfig.serverId}:${toolConfig.toolName}:`, error);
        }
      }
    }
    // Support legacy naming for backward compatibility
    else if (mcpConfig.directTools && mcpConfig.directTools.length > 0) {
      logger.info(`Registering ${mcpConfig.directTools.length} tool aliases from configuration (legacy)`);
      for (const toolConfig of mcpConfig.directTools) {
        try {
          await toolRegistry.handleCreateToolAlias(toolConfig);
        } catch (error) {
          logger.error(`Failed to register tool alias ${toolConfig.serverId}:${toolConfig.toolName}:`, error);
        }
      }
    }
    
    // Execute automatic discovery based on tool discovery rules
    await toolRegistry.applyDiscoveryRules();
    
    // Check if configured port is available, otherwise find an available one
    let actualPort = port;
    if (!(await isPortAvailable(port))) {
      logger.warn(`Configured port ${port} is not available, searching for alternative...`);
      try {
        actualPort = await findAvailablePort(port);
        logger.info(`Using alternative port ${actualPort}`);
      } catch (error) {
        logger.error('No available ports found:', error);
        process.exit(1);
      }
    }
    
    const listenAddress = listenAddressSecurityManager.getListenAddress();
    server = app.listen(actualPort, listenAddress, () => {
      currentPort = actualPort; // Update current port
      logger.info(`MCP Bridge Server running on ${listenAddress}:${actualPort}`);
      logger.info(`Health check: http://${listenAddress === '0.0.0.0' ? 'localhost' : listenAddress}:${actualPort}/health`);
      logger.info(`Available servers: http://${listenAddress === '0.0.0.0' ? 'localhost' : listenAddress}:${actualPort}/mcp/servers`);

      const status = listenAddressSecurityManager.getSecurityStatus();
      logger.info(
        `Security status: authEnabled=${status.authEnabled}, externalAccess=${status.allowExternalAccess}, effectiveAddress=${status.effectiveListenAddress}`
      );
      for (const rec of status.recommendations) {
        logger.warn(rec);
      }
    });

    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${actualPort} is already in use. Please check if another MCP Bridge Server is running or use a different port.`);
        logger.error('To check for running processes: ps aux | grep "node dist/src/index.js"');
        logger.error('To kill existing processes: pkill -f "node dist/src/index.js"');
      } else {
        logger.error(`Server failed to start on port ${actualPort}:`, error);
      }
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start MCP Bridge Server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down MCP Bridge Server...');
  await toolRegistry.shutdown();
  await mcpManager.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down MCP Bridge Server...');
  await toolRegistry.shutdown();
  await mcpManager.shutdown();
  process.exit(0);
});

/**
 * Check if a port is available
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, listenAddressSecurityManager.getListenAddress(), () => {
      server.close(() => {
        resolve(true);
      });
    });
    
    server.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Find next available port starting from given port
 */
async function findAvailablePort(startPort: number): Promise<number> {
  for (let port = startPort; port <= startPort + 100; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available ports found in range ${startPort}-${startPort + 100}`);
}

startServer();
