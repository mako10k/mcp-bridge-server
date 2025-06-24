import fs from 'fs/promises';
import path from 'path';
import { MCPServerConfig } from './mcp-config.js';
import { ConfigValidator, SettingDefinition, ValidationError, AuthContext } from './config-validation.js';
import { logger } from '../utils/logger.js';

export interface ServerConfigTemplate {
  id: string;
  name: string;
  description: string;
  category: 'filesystem' | 'api' | 'database' | 'custom';
  adminControlled: {
    command: string;
    baseArgs: string[];
    lifecycle: 'global' | 'user' | 'session';
    requireAuth: boolean;
    securityLevel: 'low' | 'medium' | 'high';
    resourceLimits: {
      maxMemoryMB: number;
      maxCpuPercent: number;
      timeoutSeconds: number;
    };
  };
  userCustomizable: Record<string, SettingDefinition>;
  environmentVariables: {
    adminControlled: Record<string, string>;
    userCustomizable: Record<string, SettingDefinition>;
  };
  dependencies?: string[];
  conflicts?: string[];
  minimumUserRole?: string;
}

export interface UserConfigOverrides {
  [settingKey: string]: any;
  environmentVariables?: Record<string, any>;
}

export class ConfigTemplateEngine {
  private templates = new Map<string, ServerConfigTemplate>();
  constructor(
    private validator: ConfigValidator = new ConfigValidator(),
    private templatesDir: string = path.resolve('src/config/templates')
  ) {}

  async getTemplate(id: string): Promise<ServerConfigTemplate> {
    if (this.templates.has(id)) {
      return this.templates.get(id)!;
    }
    return this.loadTemplate(id);
  }

  async getAllTemplates(): Promise<ServerConfigTemplate[]> {
    const files = await fs.readdir(this.templatesDir);
    const ids = files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
    const templates: ServerConfigTemplate[] = [];
    for (const id of ids) {
      templates.push(await this.getTemplate(id));
    }
    return templates;
  }

  private async loadTemplate(id: string): Promise<ServerConfigTemplate> {
    const filePath = path.join(this.templatesDir, `${id}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    const json = JSON.parse(data);
    await this.validator.validateTemplate(json);
    this.templates.set(id, json);
    logger.debug(`Loaded server template ${id}`);
    return json;
  }

  async renderUserConfig(
    templateId: string,
    userSettings: UserConfigOverrides,
    authContext: AuthContext
  ): Promise<MCPServerConfig> {
    const template = await this.getTemplate(templateId);
    const merged = await this.mergeUserSettings(template, userSettings, authContext);
    await this.validator.validateFinalConfig(merged, authContext);
    return merged;
  }

  private async mergeUserSettings(
    template: ServerConfigTemplate,
    userSettings: UserConfigOverrides,
    authContext: AuthContext
  ): Promise<MCPServerConfig> {
    const result: MCPServerConfig = {
      name: template.name,
      transport: 'stdio',
      command: template.adminControlled.command,
      args: template.adminControlled.baseArgs.map(a => this.expandTemplateVariables(a, authContext)),
      env: { ...template.environmentVariables.adminControlled },
      enabled: true,
      timeout: 30000,
      restartOnFailure: true,
      maxRestarts: 3
    };

    for (const [key, value] of Object.entries(userSettings)) {
      const def = template.userCustomizable[key];
      if (!def) {
        throw new ValidationError(`Unknown setting: ${key}`);
      }
      await this.validator.validateUserSetting(key, value, def, authContext, userSettings);
      await this.applyUserSetting(result, key, value, def, authContext);
    }

    for (const [key, def] of Object.entries(template.environmentVariables.userCustomizable)) {
      const val = (userSettings.environmentVariables && userSettings.environmentVariables[key]) ?? def.default;
      const envContext = userSettings.environmentVariables || {};
      await this.validator.validateUserSetting(key, val, def, authContext, envContext);
      const expanded = this.expandTemplateVariables(val, authContext);
      if (!result.env) result.env = {};
      result.env[key] = String(expanded);
    }

    return result;
  }

  private async applyUserSetting(
    config: MCPServerConfig,
    key: string,
    value: any,
    definition: SettingDefinition,
    authContext: AuthContext
  ): Promise<void> {
    if (!config.args) config.args = [];
    const expandedValue = this.expandTemplateVariables(value, authContext);
    switch (definition.type) {
      case 'path':
        if (key.endsWith('_PATH') || key.endsWith('_DIR')) {
          config.args.push(`--${key.toLowerCase()}=${expandedValue}`);
        } else {
          if (!config.env) config.env = {};
          config.env[key] = expandedValue;
        }
        break;
      case 'boolean':
        if (expandedValue) {
          config.args.push(`--${key.toLowerCase()}`);
        }
        break;
      case 'string':
      case 'integer':
      case 'float':
        config.args.push(`--${key.toLowerCase()}=${expandedValue}`);
        break;
      case 'json':
      case 'enum':
        if (!config.env) config.env = {};
        config.env[`CONFIG_${key.toUpperCase()}`] = JSON.stringify(expandedValue);
        break;
    }
  }

  private expandTemplateVariables(value: any, authContext: AuthContext): any {
    if (typeof value !== 'string') return value;
    return value
      .replace(/{userId}/g, authContext.userId || 'anonymous')
      .replace(/{userEmail}/g, authContext.userEmail || 'anonymous')
      .replace(/{sessionId}/g, authContext.sessionId || 'default')
      .replace(/{timestamp}/g, Date.now().toString())
      .replace(/{userRole}/g, authContext.primaryRole || 'user');
  }
}
