/**
 * MCP Server Configuration Module
 */

import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';

// Zod schema for MCP server configuration
export const MCPServerConfigSchema = z.object({
  name: z.string(),
  transport: z.enum(['stdio', 'sse', 'http']).default('stdio'),
  // STDIO transport options
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
  // HTTP/SSE transport options
  url: z.string().optional(),
  headers: z.record(z.string()).optional(),
  // Common options
  enabled: z.boolean().default(true),
  timeout: z.number().default(30000),
  restartOnFailure: z.boolean().default(true),
  maxRestarts: z.number().default(3),
}).refine((data) => {
  // Validation: STDIO transport requires command
  if (data.transport === 'stdio') {
    return !!data.command;
  }
  // HTTP/SSE transport requires URL
  if (data.transport === 'sse' || data.transport === 'http') {
    return !!data.url;
  }
  return true;
}, {
  message: "STDIO transport requires 'command', HTTP/SSE transport requires 'url'",
});

export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;

// Schema for the complete MCP configuration file
export const MCPConfigSchema = z.object({
  servers: z.array(MCPServerConfigSchema),
  global: z.object({
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    maxConcurrentConnections: z.number().default(10),
    requestTimeout: z.number().default(30000),
  }).optional(),
});

export type MCPConfig = z.infer<typeof MCPConfigSchema>;

/**
 * Load MCP configuration from a file
 * @param configPath Path to the configuration file
 * @returns Parsed and validated MCP configuration
 */
export function loadMCPConfig(configPath: string): MCPConfig {
  try {
    if (!fs.existsSync(configPath)) {
      logger.warn(`Configuration file not found: ${configPath}. Using default configuration.`);
      return getDefaultConfig();
    }

    const configData = fs.readFileSync(configPath, 'utf-8');
    const parsedConfig = JSON.parse(configData);
    
    // 設定内の環境変数を展開
    const expandedConfig = expandEnvVarsInObject(parsedConfig);
    
    // Validate configuration using Zod
    const validatedConfig = MCPConfigSchema.parse(expandedConfig);
    
    logger.info(`Loaded MCP configuration from ${configPath} with environment variables expanded`);
    return validatedConfig;
  } catch (error) {
    logger.error(`Failed to load MCP configuration from ${configPath}:`, error);
    throw new Error(`Invalid MCP configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get default MCP configuration
 * @returns Default configuration with sample servers
 */
export function getDefaultConfig(): MCPConfig {
  return {
    servers: [
      {
        name: 'filesystem',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        enabled: true,
        timeout: 30000,
        restartOnFailure: true,
        maxRestarts: 3,
      },
      {
        name: 'brave-search',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        env: {
          BRAVE_API_KEY: process.env.BRAVE_API_KEY || '',
        },
        enabled: !!process.env.BRAVE_API_KEY,
        timeout: 30000,
        restartOnFailure: true,
        maxRestarts: 3,
      },
      {
        name: 'example-sse-server',
        transport: 'sse',
        url: 'http://localhost:3001/sse',
        enabled: false,
        timeout: 30000,
        restartOnFailure: true,
        maxRestarts: 3,
      },
      {
        name: 'example-http-server',
        transport: 'http',
        url: 'http://localhost:3002/mcp',
        headers: {
          'Authorization': 'Bearer your-token-here',
        },
        enabled: false,
        timeout: 30000,
        restartOnFailure: true,
        maxRestarts: 3,
      },
    ],
    global: {
      logLevel: 'info',
      maxConcurrentConnections: 10,
      requestTimeout: 30000,
    },
  };
}

/**
 * Save MCP configuration to a file
 * @param config Configuration to save
 * @param configPath Path where to save the configuration
 */
export function saveMCPConfig(config: MCPConfig, configPath: string): void {
  try {
    // Validate configuration before saving
    const validatedConfig = MCPConfigSchema.parse(config);
    
    // Ensure directory exists
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Write configuration file with pretty formatting
    fs.writeFileSync(configPath, JSON.stringify(validatedConfig, null, 2), 'utf-8');
    
    logger.info(`Saved MCP configuration to ${configPath}`);
  } catch (error) {
    logger.error(`Failed to save MCP configuration to ${configPath}:`, error);
    throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get enabled server configurations
 * @param config MCP configuration
 * @returns Array of enabled server configurations
 */
export function getEnabledServers(config: MCPConfig): MCPServerConfig[] {
  return config.servers.filter(server => server.enabled);
}

/**
 * 環境変数を展開する関数
 * ${VAR} 形式の文字列を環境変数の値に置き換えます
 * @param value 展開する文字列
 * @returns 環境変数展開後の文字列
 */
export function expandEnvVars(value: string): string {
  return value.replace(/\${([^}]+)}/g, (match, varName) => {
    return process.env[varName] || match; // 環境変数が存在しない場合は元の文字列をそのまま返す
  });
}

/**
 * オブジェクト内の環境変数を再帰的に展開
 * @param obj 展開するオブジェクト
 * @returns 環境変数展開後のオブジェクト
 */
export function expandEnvVarsInObject(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = expandEnvVars(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item => 
        typeof item === 'string' ? expandEnvVars(item) : 
        typeof item === 'object' && item !== null ? expandEnvVarsInObject(item) : 
        item
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = expandEnvVarsInObject(value);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}
