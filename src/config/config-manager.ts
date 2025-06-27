/**
 * Configuration Manager
 * 
 * Manages MCP Bridge configuration with advanced features:
 * - Hot reloading of configuration files
 * - Multi-platform configuration support
 * - Configuration inheritance and merging
 * - Validation and error reporting
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { MCPConfig, MCPConfigSchema, getDefaultConfig } from './mcp-config.js';
import { expandEnvVarsInObject } from './env-expand.js';

// Event types for configuration changes
export enum ConfigEventType {
  LOADED = 'config-loaded',
  RELOADED = 'config-reloaded',
  ERROR = 'config-error',
}

// Configuration source information
interface ConfigSource {
  path: string;
  priority: number;
  platform?: string;
}

/**
 * Configuration Manager for MCP Bridge
 * Handles loading, watching, and hot reloading of configuration
 */
export class ConfigManager extends EventEmitter {
  private config: MCPConfig;
  private configSources: ConfigSource[] = [];
  private watchers: chokidar.FSWatcher[] = [];
  private reloadInProgress: boolean = false;
  private lastLoadTime: number = 0;
  private defaultConfigPath: string = './mcp-config.json';

  /**
   * Create a new ConfigManager
   * @param initialConfigPath Path to initial configuration file
   */
  constructor(initialConfigPath?: string) {
    super();
    
    // Set default config path if provided
    if (initialConfigPath) {
      this.defaultConfigPath = initialConfigPath;
    }
    
    // Initialize with default config
    this.config = getDefaultConfig();
    
    // Detect platform
    const platform = os.platform();
    logger.info(`Detected platform: ${platform}`);
  }

  /**
   * Initialize configuration manager
   * Loads configuration and sets up watchers
   */
  public async initialize(): Promise<MCPConfig> {
    // Add default configuration sources based on platform
    this.addDefaultConfigSources();
    
    // Load configuration from all sources
    await this.loadConfig();
    
    // Setup watchers for hot reloading
    this.setupWatchers();
    
    return this.config;
  }

  /**
   * Get current configuration
   */
  public getConfig(): MCPConfig {
    return this.config;
  }

  /**
   * Add a configuration source
   * @param configPath Path to configuration file
   * @param priority Priority (higher number = higher priority)
   * @param platform Optional platform restriction (win32, darwin, linux)
   */
  public addConfigSource(configPath: string, priority: number = 1, platform?: string): void {
    // Check if path exists
    if (!fs.existsSync(configPath)) {
      logger.warn(`Configuration source not found: ${configPath}, will be skipped`);
    }
    
    this.configSources.push({
      path: configPath,
      priority,
      platform
    });
    
    // Sort sources by priority (descending)
    this.configSources.sort((a, b) => b.priority - a.priority);
    
    logger.info(`Added configuration source: ${configPath} with priority ${priority}`);
  }

  /**
   * Setup file watchers for configuration files
   */
  private setupWatchers(): void {
    // Close any existing watchers
    this.closeWatchers();
    
    // Setup watchers for each config source
    for (const source of this.configSources) {
      if (fs.existsSync(source.path)) {
        const watcher = chokidar.watch(source.path, {
          persistent: true,
          ignoreInitial: true,
          awaitWriteFinish: {
            stabilityThreshold: 300,
            pollInterval: 100
          }
        });
        
        watcher.on('change', async () => {
          logger.info(`Configuration file changed: ${source.path}`);
          await this.reloadConfig();
        });
        
        this.watchers.push(watcher);
        logger.info(`Watching configuration file: ${source.path}`);
      }
    }
  }

  /**
   * Close all file watchers
   */
  private closeWatchers(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
  }

  /**
   * Add default configuration sources based on platform and conventions
   */
  private addDefaultConfigSources(): void {
    const platform = os.platform();
    const homeDir = os.homedir();
    
    // Global configuration
    if (fs.existsSync('/etc/mcp-bridge/config.json')) {
      this.addConfigSource('/etc/mcp-bridge/config.json', 10);
    }
    
    // User configuration in home directory
    const userConfigPath = path.join(homeDir, '.mcp-bridge', 'config.json');
    if (fs.existsSync(userConfigPath)) {
      this.addConfigSource(userConfigPath, 20);
    }
    
    // Platform-specific configurations
    if (platform === 'win32') {
      // Windows-specific paths
      const appDataPath = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
      const winConfigPath = path.join(appDataPath, 'mcp-bridge', 'config.json');
      if (fs.existsSync(winConfigPath)) {
        this.addConfigSource(winConfigPath, 15, 'win32');
      }
    } else if (platform === 'darwin') {
      // macOS-specific paths
      const macConfigPath = path.join(homeDir, 'Library', 'Application Support', 'mcp-bridge', 'config.json');
      if (fs.existsSync(macConfigPath)) {
        this.addConfigSource(macConfigPath, 15, 'darwin');
      }
    } else if (platform === 'linux') {
      // Linux-specific paths
      const linuxConfigPath = path.join(homeDir, '.config', 'mcp-bridge', 'config.json');
      if (fs.existsSync(linuxConfigPath)) {
        this.addConfigSource(linuxConfigPath, 15, 'linux');
      }
    }
    
    // Local project configuration (highest priority)
    this.addConfigSource(this.defaultConfigPath, 100);
  }

  /**
   * Load configuration from all sources
   */
  private async loadConfig(): Promise<void> {
    try {
      this.lastLoadTime = Date.now();
      let loadedConfig = getDefaultConfig();
      
      // Load and merge configurations from all sources
      for (const source of this.configSources) {
        // Skip if file doesn't exist
        if (!fs.existsSync(source.path)) {
          continue;
        }
        
        // Skip if platform-specific and not matching current platform
        if (source.platform && source.platform !== os.platform()) {
          continue;
        }
        
        try {
          const sourceData = fs.readFileSync(source.path, 'utf-8');
          const sourceConfig = JSON.parse(sourceData);
          
          // Expand environment variables
          const expandedConfig = expandEnvVarsInObject(sourceConfig);
          
          // Merge with already loaded configuration
          loadedConfig = this.mergeConfigs(loadedConfig, expandedConfig);
          
          logger.info(`Loaded configuration from ${source.path}`);
        } catch (error) {
          logger.error(`Error loading configuration from ${source.path}:`, error);
        }
      }
      
      try {
        // Validate merged configuration
        this.config = MCPConfigSchema.parse(loadedConfig);
        logger.info('Configuration successfully loaded and validated');
        this.emit(ConfigEventType.LOADED, this.config);
      } catch (error) {
        logger.error('Configuration validation error:');
        
        if (error instanceof z.ZodError) {
          // Log detailed validation errors
          error.errors.forEach((err: z.ZodIssue) => {
            logger.error(`- Path: ${err.path.join('.')} - ${err.message}`);
          });
        } else {
          logger.error(String(error));
        }
        
        logger.warn('Using default configuration due to validation errors');
        this.config = getDefaultConfig();
        this.emit(ConfigEventType.ERROR, error);
      }
    } catch (error) {
      logger.error('Failed to load configuration:', error);
      this.emit(ConfigEventType.ERROR, error);
      
      // Fallback to default configuration
      logger.warn('Using default configuration due to load failure');
      this.config = getDefaultConfig();
    }
  }

  /**
   * Reload configuration from all sources
   */
  private async reloadConfig(): Promise<void> {
    // Prevent multiple simultaneous reloads
    if (this.reloadInProgress) {
      return;
    }
    
    // Prevent reloads too close together
    const now = Date.now();
    if (now - this.lastLoadTime < 1000) {
      logger.debug('Skipping reload, too soon after last load');
      return;
    }
    
    this.reloadInProgress = true;
    
    try {
      // Store previous config in case we need to revert
      const previousConfig = this.config;
      
      // Load new configuration
      await this.loadConfig();
      
      // Notify listeners about reloaded configuration
      this.emit(ConfigEventType.RELOADED, this.config);
      logger.info('Configuration reloaded successfully');
    } catch (error) {
      logger.error('Failed to reload configuration:', error);
      this.emit(ConfigEventType.ERROR, error);
    } finally {
      this.reloadInProgress = false;
    }
  }

  /**
   * Merge two configurations
   * @param baseConfig Base configuration
   * @param overrideConfig Override configuration
   */
  private mergeConfigs(baseConfig: any, overrideConfig: any): any {
    // Deep merge two configuration objects
    // Override arrays completely rather than merging them
    const merged = { ...baseConfig };
    
    for (const [key, value] of Object.entries(overrideConfig)) {
      // If property exists in base and both are objects, merge recursively
      if (key in merged && 
          typeof merged[key] === 'object' && 
          merged[key] !== null &&
          typeof value === 'object' && 
          value !== null &&
          !Array.isArray(value)) {
        merged[key] = this.mergeConfigs(merged[key], value);
      } else {
        // Otherwise just override
        merged[key] = value;
      }
    }
    
    return merged;
  }

  /**
   * Shutdown configuration manager
   */
  public shutdown(): void {
    this.closeWatchers();
    logger.info('Configuration manager shutdown');
  }
}
