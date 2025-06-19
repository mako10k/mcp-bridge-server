/**
 * Dynamic Configuration Manager
 * Handles runtime configuration changes for MCP Bridge Server
 */

import { MCPConfig, MCPServerConfig, MCPConfigSchema, MCPServerConfigSchema, saveMCPConfig, loadMCPConfig } from './mcp-config.js';
import { logger } from '../utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';
import { listenAddressSecurityManager } from './listen-address-security.js';

export interface ConfigUpdateResult {
  success: boolean;
  message: string;
  config?: MCPConfig;
  errors?: string[];
}

export class DynamicConfigManager {
  private currentConfig: MCPConfig;
  private configPath: string;

  constructor(configPath: string, initialConfig: MCPConfig) {
    this.configPath = configPath;
    this.currentConfig = { ...initialConfig };
  }

  /**
   * Get current configuration
   */
  getCurrentConfig(): MCPConfig {
    return { ...this.currentConfig };
  }

  /**
   * Add a new MCP server configuration
   */
  async addServer(serverConfig: MCPServerConfig): Promise<ConfigUpdateResult> {
    try {
      // Validate server configuration
      const validatedConfig = MCPServerConfigSchema.parse(serverConfig);
      
      // Check if server with same name already exists
      if (this.currentConfig.servers.find(s => s.name === validatedConfig.name)) {
        return {
          success: false,
          message: `Server with name '${validatedConfig.name}' already exists`,
        };
      }

      // Add server to configuration
      const newConfig = {
        ...this.currentConfig,
        servers: [...this.currentConfig.servers, validatedConfig],
      };

      // Validate complete configuration
      const validatedFullConfig = MCPConfigSchema.parse(newConfig);

      // Save to file
      await this.saveConfig(validatedFullConfig);

      logger.info(`Added new server configuration: ${validatedConfig.name}`);
      return {
        success: true,
        message: `Server '${validatedConfig.name}' added successfully`,
        config: validatedFullConfig,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to add server configuration:`, error);
      return {
        success: false,
        message: `Failed to add server: ${errorMessage}`,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Update an existing MCP server configuration
   */
  async updateServer(serverName: string, updates: Partial<MCPServerConfig>): Promise<ConfigUpdateResult> {
    try {
      // Find server index
      const serverIndex = this.currentConfig.servers.findIndex(s => s.name === serverName);
      if (serverIndex === -1) {
        return {
          success: false,
          message: `Server '${serverName}' not found`,
        };
      }

      // Create updated server configuration
      const currentServer = this.currentConfig.servers[serverIndex];
      const updatedServer = { ...currentServer, ...updates };

      // Validate updated server configuration
      const validatedServer = MCPServerConfigSchema.parse(updatedServer);

      // Update configuration
      const newServers = [...this.currentConfig.servers];
      newServers[serverIndex] = validatedServer;

      const newConfig = {
        ...this.currentConfig,
        servers: newServers,
      };

      // Validate complete configuration
      const validatedFullConfig = MCPConfigSchema.parse(newConfig);

      // Save to file
      await this.saveConfig(validatedFullConfig);

      logger.info(`Updated server configuration: ${serverName}`);
      return {
        success: true,
        message: `Server '${serverName}' updated successfully`,
        config: validatedFullConfig,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to update server configuration:`, error);
      return {
        success: false,
        message: `Failed to update server: ${errorMessage}`,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Remove an MCP server configuration
   */
  async removeServer(serverName: string): Promise<ConfigUpdateResult> {
    try {
      // Find server
      const serverExists = this.currentConfig.servers.some(s => s.name === serverName);
      if (!serverExists) {
        return {
          success: false,
          message: `Server '${serverName}' not found`,
        };
      }

      // Remove server from configuration
      const newConfig = {
        ...this.currentConfig,
        servers: this.currentConfig.servers.filter(s => s.name !== serverName),
      };

      // Validate configuration
      const validatedConfig = MCPConfigSchema.parse(newConfig);

      // Save to file
      await this.saveConfig(validatedConfig);

      logger.info(`Removed server configuration: ${serverName}`);
      return {
        success: true,
        message: `Server '${serverName}' removed successfully`,
        config: validatedConfig,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to remove server configuration:`, error);
      return {
        success: false,
        message: `Failed to remove server: ${errorMessage}`,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Update global configuration settings
   */
  async updateGlobalSettings(globalUpdates: Partial<MCPConfig['global']>): Promise<ConfigUpdateResult> {
    try {
      // Update global configuration
      const newConfig = {
        ...this.currentConfig,
        global: {
          ...this.currentConfig.global,
          ...globalUpdates,
        },
      };

      // Validate configuration
      const validatedConfig = MCPConfigSchema.parse(newConfig);

      // Save to file
      await this.saveConfig(validatedConfig);

      logger.info(`Updated global configuration settings`);
      return {
        success: true,
        message: 'Global settings updated successfully',
        config: validatedConfig,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to update global configuration:`, error);
      return {
        success: false,
        message: `Failed to update global settings: ${errorMessage}`,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Update network security settings (listen address and external access)
   */
  async updateNetworkSecurity(
    updates: Partial<NonNullable<MCPConfig['security']>['network']>
  ): Promise<ConfigUpdateResult> {
    try {
      const newConfig = {
        ...this.currentConfig,
        security: {
          ...this.currentConfig.security,
          network: {
            ...this.currentConfig.security?.network,
            ...updates
          }
        }
      } as MCPConfig;

      const validatedConfig = MCPConfigSchema.parse(newConfig);

      await this.saveConfig(validatedConfig);
      listenAddressSecurityManager.applyConfig(validatedConfig.security!);

      logger.info(`Updated network security settings`);
      return { success: true, message: 'Network security updated', config: validatedConfig };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update network security settings:', error);
      return { success: false, message: `Failed to update network security: ${errMsg}`, errors: [errMsg] };
    }
  }

  getNetworkSecuritySettings(): NonNullable<MCPConfig['security']>['network'] {
    return {
      allowExternalAccess: this.currentConfig.security?.network.allowExternalAccess ?? false,
      listenAddress: this.currentConfig.security?.network.listenAddress ?? '127.0.0.1',
      trustedProxies: this.currentConfig.security?.network.trustedProxies ?? []
    };
  }

  /**
   * Update tool discovery rules
   */
  async updateToolDiscoveryRules(rules: Array<{ serverPattern: string; toolPattern: string; exclude: boolean }>): Promise<ConfigUpdateResult> {
    try {
      // Update tool discovery rules
      const newConfig = {
        ...this.currentConfig,
        toolDiscoveryRules: rules,
        // Remove legacy field if it exists
        registrationPatterns: undefined
      };

      // Validate configuration
      const validatedConfig = MCPConfigSchema.parse(newConfig);

      // Save to file
      await this.saveConfig(validatedConfig);

      logger.info(`Updated tool discovery rules: ${rules.length} rules`);
      return {
        success: true,
        message: 'Tool discovery rules updated successfully',
        config: validatedConfig,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to update tool discovery rules:`, error);
      return {
        success: false,
        message: `Failed to update tool discovery rules: ${errorMessage}`,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Reload configuration from file
   */
  async reloadConfig(): Promise<ConfigUpdateResult> {
    try {
      const newConfig = loadMCPConfig(this.configPath);
      this.currentConfig = newConfig;

      logger.info('Configuration reloaded from file');
      return {
        success: true,
        message: 'Configuration reloaded successfully',
        config: newConfig,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to reload configuration:`, error);
      return {
        success: false,
        message: `Failed to reload configuration: ${errorMessage}`,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Save configuration to file
   */
  private async saveConfig(config: MCPConfig): Promise<void> {
    saveMCPConfig(config, this.configPath);
    this.currentConfig = config;
  }

  /**
   * List all server configurations
   */
  listServers(): MCPServerConfig[] {
    return [...this.currentConfig.servers];
  }

  /**
   * Get specific server configuration
   */
  getServer(serverName: string): MCPServerConfig | null {
    return this.currentConfig.servers.find(s => s.name === serverName) || null;
  }

  /**
   * Get global configuration
   */
  getGlobalSettings(): NonNullable<MCPConfig['global']> {
    return {
      logLevel: this.currentConfig.global?.logLevel || 'info',
      httpPort: this.currentConfig.global?.httpPort || 3000,
      maxConcurrentConnections: this.currentConfig.global?.maxConcurrentConnections || 10,
      requestTimeout: this.currentConfig.global?.requestTimeout || 30000,
      fixInvalidToolSchemas: this.currentConfig.global?.fixInvalidToolSchemas || false,
    };
  }
}
