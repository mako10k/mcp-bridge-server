import { ConfigTemplateEngine, ServerConfigTemplate } from './config-template-engine.js';
import { ConfigValidator, AuthContext, ValidationError } from './config-validation.js';
import { MCPServerConfig } from './mcp-config.js';
import { MCPLifecycleManager } from '../mcp/lifecycle/mcp-lifecycle-manager.js';
import { UserSettingsStore, FileBasedSettingsStore } from '../storage/user-settings-store.js';
import { SettingsEncryption } from '../storage/settings-encryption.js';

export interface UserConfigOverrides {
  [settingKey: string]: any;
}

export interface UserServerSettings {
  templateId: string;
  enabled: boolean;
  customization: UserConfigOverrides;
  lastModified: Date;
  version: number;
}

export interface UserSettings {
  userId: string;
  globalPreferences: {
    theme: 'light' | 'dark';
    language: string;
    timezone: string;
  };
  serverSettings: Record<string, UserServerSettings>;
  metadata: {
    created: Date;
    lastLogin: Date;
    version: number;
  };
}

/**
 * Manages per-user MCP server configuration and persistence.
 */
export class UserConfigManager {
  private templateEngine: ConfigTemplateEngine;
  private settingsStore: UserSettingsStore;
  private validator: ConfigValidator;
  private encryptor: SettingsEncryption;

  constructor(options: {
    templateEngine?: ConfigTemplateEngine;
    settingsStore?: UserSettingsStore;
    validator?: ConfigValidator;
    encryptor?: SettingsEncryption;
  } = {}) {
    this.templateEngine = options.templateEngine || new ConfigTemplateEngine();
    this.settingsStore = options.settingsStore || new FileBasedSettingsStore();
    this.validator = options.validator || new ConfigValidator();
    this.encryptor = options.encryptor || new SettingsEncryption();
  }

  async getUserSettings(userId: string): Promise<UserSettings> {
    const encrypted = await this.settingsStore.getSettings(userId);
    if (!encrypted) {
      return this.createDefaultSettings(userId);
    }
    return this.encryptor.decryptSettings(encrypted);
  }

  async updateUserSettings(
    userId: string,
    settings: Partial<UserSettings>,
    authContext: AuthContext
  ): Promise<UserSettings> {
    const current = await this.getUserSettings(userId);
    const merged = this.mergeSettings(current, settings);
    await this.validateUserSettings(merged, authContext);
    const encrypted = await this.encryptor.encryptSettings(merged);
    await this.settingsStore.saveSettings(userId, encrypted);
    await this.applySettingsToInstances(userId, merged);
    return merged;
  }

  async getAvailableTemplates(authContext: AuthContext): Promise<ServerConfigTemplate[]> {
    const all = await this.templateEngine.getAllTemplates?.() ?? [];
    return all.filter((t) => this.hasTemplateAccess(t, authContext));
  }

  async generateMCPConfig(userId: string, authContext: AuthContext): Promise<MCPServerConfig[]> {
    const userSettings = await this.getUserSettings(userId);
    const configs: MCPServerConfig[] = [];
    for (const [templateId, serverSettings] of Object.entries(userSettings.serverSettings)) {
      if (!serverSettings.enabled) continue;
      try {
        const cfg = await this.templateEngine.renderUserConfig(templateId, serverSettings.customization, authContext);
        configs.push(cfg);
      } catch (error) {
        console.error(`Failed to render config for template ${templateId}:`, error);
      }
    }
    return configs;
  }

  private async applySettingsToInstances(userId: string, settings: UserSettings): Promise<void> {
    const _ = MCPLifecycleManager.getInstance();
    // Instance restart/termination logic will be implemented in later phases.
    void _;
  }

  private createDefaultSettings(userId: string): UserSettings {
    return {
      userId,
      globalPreferences: { theme: 'light', language: 'en', timezone: 'UTC' },
      serverSettings: {},
      metadata: { created: new Date(), lastLogin: new Date(), version: 1 }
    };
  }

  private mergeSettings(current: UserSettings, updates: Partial<UserSettings>): UserSettings {
    return {
      ...current,
      ...updates,
      serverSettings: {
        ...current.serverSettings,
        ...(updates.serverSettings || {})
      },
      metadata: {
        ...current.metadata,
        lastLogin: new Date(),
        version: current.metadata.version + 1
      }
    };
  }

  private hasTemplateAccess(template: ServerConfigTemplate, authContext: AuthContext): boolean {
    if (template.minimumUserRole) {
      const userRoles = authContext.roles || [];
      const requiredRole = template.minimumUserRole;
      const hierarchy = ['user', 'viewer', 'operator', 'admin'];
      const userHighest = Math.max(...userRoles.map((r) => hierarchy.indexOf(r)));
      const requiredIndex = hierarchy.indexOf(requiredRole);
      return userHighest >= requiredIndex;
    }
    return true;
  }

  private async validateUserSettings(settings: UserSettings, authContext: AuthContext): Promise<void> {
    for (const [templateId, serverSettings] of Object.entries(settings.serverSettings)) {
      const template = await this.templateEngine.getTemplate(templateId);
      for (const [key, value] of Object.entries(serverSettings.customization)) {
        const def = template.userCustomizable[key];
        if (!def) {
          throw new ValidationError(`Unknown setting ${key} for template ${templateId}`);
        }
        await this.validator.validateUserSetting(key, value, def, authContext);
      }
    }
  }
}
