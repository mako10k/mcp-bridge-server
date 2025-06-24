# 🛠️ ユーザー設定カスタマイズ機能 - 詳細実装設計

## 📋 概要

エンタープライズ環境におけるマルチユーザー MCP Bridge Server で、管理者が制御しつつユーザーが設定をカスタマイズできる機能の詳細実装設計。

## 🎯 核心的な要件

### 1. 権限分離と制御
- **管理者**: サーバーテンプレート作成、セキュリティポリシー定義、ユーザー権限管理
- **ユーザー**: 許可された範囲内での設定カスタマイズ、個人環境管理

### 2. 設定継承とオーバーライド
- **継承**: 管理者定義のベース設定とセキュリティポリシー
- **オーバーライド**: ユーザーが変更可能な設定項目のみ

### 3. リアルタイム適用
- **即座反映**: 設定変更後のMCPサーバーインスタンス自動再起動
- **ゼロダウンタイム**: 他のユーザーへの影響なし

## 🏗️ 詳細アーキテクチャ

### 1. 設定管理コアシステム

#### A. 設定テンプレートエンジン
```typescript
// src/config/config-template-engine.ts
export interface ServerConfigTemplate {
  id: string;
  name: string;
  description: string;
  category: 'filesystem' | 'api' | 'database' | 'custom';
  
  // 管理者制御部分（ユーザー変更不可）
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
  
  // ユーザーカスタマイズ可能部分
  userCustomizable: {
    [settingKey: string]: SettingDefinition;
  };
  
  // 環境変数管理
  environmentVariables: {
    adminControlled: Record<string, string>;
    userCustomizable: Record<string, SettingDefinition>;
  };
  
  // 依存関係と制約
  dependencies?: string[];
  conflicts?: string[];
  minimumUserRole?: string;
}

export interface SettingDefinition {
  type: 'boolean' | 'string' | 'integer' | 'float' | 'enum' | 'path' | 'json';
  description: string;
  default: any;
  
  // 型別制約
  constraints?: {
    // string/path
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    allowedPatterns?: string[];  // path injection 防止
    
    // integer/float
    min?: number;
    max?: number;
    
    // enum
    values?: string[];
    
    // path
    mustExist?: boolean;
    permissions?: string;  // 'read' | 'write' | 'execute'
    
    // json
    schema?: object;  // JSON Schema
  };
  
  // 動的制約（他の設定値に依存）
  dynamicConstraints?: {
    dependsOn: string;
    rules: ConstraintRule[];
  };
}

export interface ConstraintRule {
  when: any;  // 依存設定の値
  then: Partial<SettingDefinition>;  // 適用される制約
}

export class ConfigTemplateEngine {
  private templates: Map<string, ServerConfigTemplate> = new Map();
  private validator: ConfigValidator;
  
  async loadTemplate(templateId: string): Promise<ServerConfigTemplate> {
    // テンプレートファイルまたはDBから読み込み
    const template = await this.loadFromStorage(templateId);
    
    // テンプレート検証
    await this.validator.validateTemplate(template);
    
    this.templates.set(templateId, template);
    return template;
  }
  
  async renderUserConfig(
    templateId: string,
    userSettings: UserConfigOverrides,
    authContext: AuthContext
  ): Promise<MCPServerConfig> {
    const template = await this.getTemplate(templateId);
    
    // ユーザー設定マージ
    const mergedConfig = await this.mergeUserSettings(
      template,
      userSettings,
      authContext
    );
    
    // 最終検証
    await this.validator.validateFinalConfig(mergedConfig, authContext);
    
    return mergedConfig;
  }
  
  private async mergeUserSettings(
    template: ServerConfigTemplate,
    userSettings: UserConfigOverrides,
    authContext: AuthContext
  ): Promise<MCPServerConfig> {
    const result: MCPServerConfig = {
      name: template.name,
      command: template.adminControlled.command,
      args: [...template.adminControlled.baseArgs],
      lifecycle: template.adminControlled.lifecycle,
      requireAuth: template.adminControlled.requireAuth,
      env: { ...template.environmentVariables.adminControlled }
    };
    
    // ユーザー設定の適用
    for (const [key, userValue] of Object.entries(userSettings)) {
      const settingDef = template.userCustomizable[key];
      if (!settingDef) {
        throw new ValidationError(`Unknown setting: ${key}`);
      }
      
      // 設定値検証
      await this.validator.validateUserSetting(
        key,
        userValue,
        settingDef,
        authContext
      );
      
      // パラメータ展開とマージ
      await this.applyUserSetting(result, key, userValue, settingDef, authContext);
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
    // テンプレート変数展開
    const expandedValue = this.expandTemplateVariables(value, authContext);
    
    switch (definition.type) {
      case 'path':
        // パス設定をargや環境変数に適用
        if (key.endsWith('_PATH') || key.endsWith('_DIR')) {
          config.args.push(`--${key.toLowerCase()}=${expandedValue}`);
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
        // 複雑な設定は環境変数経由
        config.env![`CONFIG_${key.toUpperCase()}`] = JSON.stringify(expandedValue);
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
```

#### B. 設定検証システム
```typescript
// src/config/config-validation.ts
export class ConfigValidator {
  private pathValidator: PathValidator;
  private securityValidator: SecurityValidator;
  
  async validateTemplate(template: ServerConfigTemplate): Promise<void> {
    // テンプレート構造検証
    if (!template.id || !template.name || !template.adminControlled) {
      throw new ValidationError('Invalid template structure');
    }
    
    // セキュリティレベル検証
    await this.securityValidator.validateSecurityLevel(template);
    
    // 設定定義検証
    for (const [key, definition] of Object.entries(template.userCustomizable)) {
      await this.validateSettingDefinition(key, definition);
    }
  }
  
  async validateUserSetting(
    key: string,
    value: any,
    definition: SettingDefinition,
    authContext: AuthContext
  ): Promise<void> {
    // 型検証
    await this.validateType(value, definition.type);
    
    // 制約検証
    await this.validateConstraints(value, definition.constraints);
    
    // 動的制約検証
    if (definition.dynamicConstraints) {
      await this.validateDynamicConstraints(value, definition.dynamicConstraints, authContext);
    }
    
    // セキュリティ検証
    await this.securityValidator.validateUserValue(key, value, definition, authContext);
  }
  
  async validateFinalConfig(
    config: MCPServerConfig,
    authContext: AuthContext
  ): Promise<void> {
    // 最終設定の整合性チェック
    await this.validateConfigIntegrity(config);
    
    // リソース制限チェック
    await this.validateResourceLimits(config, authContext);
    
    // セキュリティポリシー適合チェック
    await this.securityValidator.validateFinalConfig(config, authContext);
  }
  
  private async validateType(value: any, type: string): Promise<void> {
    switch (type) {
      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new ValidationError(`Expected boolean, got ${typeof value}`);
        }
        break;
        
      case 'string':
        if (typeof value !== 'string') {
          throw new ValidationError(`Expected string, got ${typeof value}`);
        }
        break;
        
      case 'integer':
        if (!Number.isInteger(value)) {
          throw new ValidationError(`Expected integer, got ${typeof value}`);
        }
        break;
        
      case 'path':
        if (typeof value !== 'string') {
          throw new ValidationError(`Expected path string, got ${typeof value}`);
        }
        await this.pathValidator.validatePath(value);
        break;
        
      case 'json':
        try {
          if (typeof value === 'string') {
            JSON.parse(value);
          }
        } catch (error) {
          throw new ValidationError(`Invalid JSON: ${error.message}`);
        }
        break;
    }
  }
  
  private async validateConstraints(
    value: any,
    constraints?: SettingDefinition['constraints']
  ): Promise<void> {
    if (!constraints) return;
    
    // 範囲チェック
    if (constraints.min !== undefined && value < constraints.min) {
      throw new ValidationError(`Value ${value} is below minimum ${constraints.min}`);
    }
    
    if (constraints.max !== undefined && value > constraints.max) {
      throw new ValidationError(`Value ${value} is above maximum ${constraints.max}`);
    }
    
    // 長さチェック
    if (typeof value === 'string') {
      if (constraints.minLength && value.length < constraints.minLength) {
        throw new ValidationError(`String too short: ${value.length} < ${constraints.minLength}`);
      }
      
      if (constraints.maxLength && value.length > constraints.maxLength) {
        throw new ValidationError(`String too long: ${value.length} > ${constraints.maxLength}`);
      }
      
      // パターンチェック
      if (constraints.pattern) {
        const regex = new RegExp(constraints.pattern);
        if (!regex.test(value)) {
          throw new ValidationError(`Value doesn't match pattern: ${constraints.pattern}`);
        }
      }
    }
    
    // 列挙値チェック
    if (constraints.values && !constraints.values.includes(value)) {
      throw new ValidationError(`Invalid value: ${value}. Allowed: ${constraints.values.join(', ')}`);
    }
  }
}

export class SecurityValidator {
  async validateUserValue(
    key: string,
    value: any,
    definition: SettingDefinition,
    authContext: AuthContext
  ): Promise<void> {
    // パスインジェクション攻撃防止
    if (definition.type === 'path') {
      await this.validatePathSecurity(value, definition.constraints?.allowedPatterns);
    }
    
    // コマンドインジェクション防止
    if (typeof value === 'string') {
      await this.validateCommandInjection(value);
    }
    
    // 権限チェック
    await this.validateUserPermission(key, definition, authContext);
  }
  
  private async validatePathSecurity(
    path: string,
    allowedPatterns?: string[]
  ): Promise<void> {
    // ディレクトリトラバーサル防止
    if (path.includes('..') || path.includes('./') || path.includes('/.')) {
      throw new SecurityError('Path traversal detected');
    }
    
    // 絶対パス強制（相対パス禁止）
    if (!path.startsWith('/')) {
      throw new SecurityError('Relative paths not allowed');
    }
    
    // 許可パターンチェック
    if (allowedPatterns) {
      const isAllowed = allowedPatterns.some(pattern => {
        const regex = new RegExp(pattern.replace('**', '.*').replace('*', '[^/]*'));
        return regex.test(path);
      });
      
      if (!isAllowed) {
        throw new SecurityError(`Path not allowed: ${path}`);
      }
    }
  }
  
  private async validateCommandInjection(value: string): Promise<void> {
    // 危険な文字の検出
    const dangerousChars = ['|', '&', ';', '$', '`', '(', ')', '{', '}', '[', ']'];
    
    for (const char of dangerousChars) {
      if (value.includes(char)) {
        throw new SecurityError(`Dangerous character detected: ${char}`);
      }
    }
  }
}

export class PathValidator {
  async validatePath(path: string): Promise<void> {
    // パス形式の基本検証
    if (!path || typeof path !== 'string') {
      throw new ValidationError('Invalid path');
    }
    
    // プラットフォーム固有の検証
    if (process.platform === 'win32') {
      await this.validateWindowsPath(path);
    } else {
      await this.validateUnixPath(path);
    }
  }
  
  private async validateUnixPath(path: string): Promise<void> {
    // Unix系パスの検証
    const invalidChars = ['<', '>', ':', '"', '|', '?', '*'];
    
    for (const char of invalidChars) {
      if (path.includes(char)) {
        throw new ValidationError(`Invalid character in path: ${char}`);
      }
    }
  }
}
```

### 2. ユーザー設定管理システム

#### A. ユーザー設定マネージャー
```typescript
// src/config/user-config-manager.ts
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

export class UserConfigManager {
  private templateEngine: ConfigTemplateEngine;
  private settingsStore: UserSettingsStore;
  private validator: ConfigValidator;
  private encryptor: SettingsEncryption;
  
  async getUserSettings(userId: string): Promise<UserSettings> {
    const encryptedSettings = await this.settingsStore.getSettings(userId);
    if (!encryptedSettings) {
      return this.createDefaultSettings(userId);
    }
    
    return this.encryptor.decryptSettings(encryptedSettings);
  }
  
  async updateUserSettings(
    userId: string,
    settings: Partial<UserSettings>,
    authContext: AuthContext
  ): Promise<UserSettings> {
    const currentSettings = await this.getUserSettings(userId);
    
    // 設定マージ
    const mergedSettings = this.mergeSettings(currentSettings, settings);
    
    // 検証
    await this.validateUserSettings(mergedSettings, authContext);
    
    // 保存
    const encryptedSettings = await this.encryptor.encryptSettings(mergedSettings);
    await this.settingsStore.saveSettings(userId, encryptedSettings);
    
    // MCP サーバーインスタンス更新
    await this.applySettingsToInstances(userId, mergedSettings);
    
    return mergedSettings;
  }
  
  async getAvailableTemplates(authContext: AuthContext): Promise<ServerConfigTemplate[]> {
    const allTemplates = await this.templateEngine.getAllTemplates();
    
    // ユーザーの権限に基づいてフィルタリング
    return allTemplates.filter(template => 
      this.hasTemplateAccess(template, authContext)
    );
  }
  
  async generateMCPConfig(
    userId: string,
    authContext: AuthContext
  ): Promise<MCPServerConfig[]> {
    const userSettings = await this.getUserSettings(userId);
    const configs: MCPServerConfig[] = [];
    
    for (const [templateId, serverSettings] of Object.entries(userSettings.serverSettings)) {
      if (!serverSettings.enabled) continue;
      
      try {
        const config = await this.templateEngine.renderUserConfig(
          templateId,
          serverSettings.customization,
          authContext
        );
        
        configs.push(config);
      } catch (error) {
        console.error(`Failed to render config for template ${templateId}:`, error);
        // エラーログは記録するが、他の設定は継続
      }
    }
    
    return configs;
  }
  
  private async applySettingsToInstances(
    userId: string,
    settings: UserSettings
  ): Promise<void> {
    // 既存インスタンスの更新/再起動
    const lifecycleManager = MCPLifecycleManager.getInstance();
    
    for (const [templateId, serverSettings] of Object.entries(settings.serverSettings)) {
      if (serverSettings.enabled) {
        // インスタンス再起動（設定反映）
        await lifecycleManager.restartUserInstance(userId, templateId);
      } else {
        // インスタンス停止
        await lifecycleManager.terminateUserInstance(userId, templateId);
      }
    }
  }
  
  private createDefaultSettings(userId: string): UserSettings {
    return {
      userId,
      globalPreferences: {
        theme: 'light',
        language: 'en',
        timezone: 'UTC'
      },
      serverSettings: {},
      metadata: {
        created: new Date(),
        lastLogin: new Date(),
        version: 1
      }
    };
  }
  
  private mergeSettings(
    current: UserSettings,
    updates: Partial<UserSettings>
  ): UserSettings {
    return {
      ...current,
      ...updates,
      serverSettings: {
        ...current.serverSettings,
        ...updates.serverSettings
      },
      metadata: {
        ...current.metadata,
        lastLogin: new Date(),
        version: current.metadata.version + 1
      }
    };
  }
  
  private hasTemplateAccess(
    template: ServerConfigTemplate,
    authContext: AuthContext
  ): boolean {
    // 最小権限チェック
    if (template.minimumUserRole) {
      const userRoles = authContext.roles || [];
      const requiredRole = template.minimumUserRole;
      
      // 権限階層チェック（admin > operator > viewer > user）
      const roleHierarchy = ['user', 'viewer', 'operator', 'admin'];
      const userHighestRole = Math.max(
        ...userRoles.map(role => roleHierarchy.indexOf(role))
      );
      const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);
      
      return userHighestRole >= requiredRoleIndex;
    }
    
    return true;
  }
  
  private async validateUserSettings(
    settings: UserSettings,
    authContext: AuthContext
  ): Promise<void> {
    // 各サーバー設定の検証
    for (const [templateId, serverSettings] of Object.entries(settings.serverSettings)) {
      const template = await this.templateEngine.getTemplate(templateId);
      
      // ユーザーカスタマイズ設定の検証
      for (const [key, value] of Object.entries(serverSettings.customization)) {
        const settingDef = template.userCustomizable[key];
        if (!settingDef) {
          throw new ValidationError(`Unknown setting ${key} for template ${templateId}`);
        }
        
        await this.validator.validateUserSetting(key, value, settingDef, authContext);
      }
    }
  }
}
```

#### B. 設定永続化システム
```typescript
// src/storage/user-settings-store.ts
export interface UserSettingsStore {
  getSettings(userId: string): Promise<string | null>;
  saveSettings(userId: string, encryptedSettings: string): Promise<void>;
  deleteSettings(userId: string): Promise<void>;
  listUsers(): Promise<string[]>;
  backup(): Promise<string>;
  restore(backupData: string): Promise<void>;
}

export class FileBasedSettingsStore implements UserSettingsStore {
  private storageDir: string;
  
  constructor(storageDir: string = './user-settings') {
    this.storageDir = storageDir;
    this.ensureStorageDir();
  }
  
  async getSettings(userId: string): Promise<string | null> {
    const filePath = this.getUserSettingsPath(userId);
    
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // ファイルが存在しない
      }
      throw error;
    }
  }
  
  async saveSettings(userId: string, encryptedSettings: string): Promise<void> {
    const filePath = this.getUserSettingsPath(userId);
    const tempPath = `${filePath}.tmp`;
    
    try {
      // 原子的書き込み（temp file → rename）
      await fs.writeFile(tempPath, encryptedSettings, 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // cleanup temp file on error
      try {
        await fs.unlink(tempPath);
      } catch {} // ignore cleanup errors
      throw error;
    }
  }
  
  async deleteSettings(userId: string): Promise<void> {
    const filePath = this.getUserSettingsPath(userId);
    await fs.unlink(filePath);
  }
  
  async listUsers(): Promise<string[]> {
    const files = await fs.readdir(this.storageDir);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  }
  
  private getUserSettingsPath(userId: string): string {
    // ファイルシステム安全な文字のみ使用
    const safeUserId = userId.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.storageDir, `${safeUserId}.json`);
  }
  
  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create storage directory:', error);
    }
  }
}

export class DatabaseSettingsStore implements UserSettingsStore {
  private db: Database;
  
  constructor(database: Database) {
    this.db = database;
  }
  
  async getSettings(userId: string): Promise<string | null> {
    const result = await this.db.query(
      'SELECT settings_json FROM user_settings WHERE user_id = ?',
      [userId]
    );
    
    return result.rows[0]?.settings_json || null;
  }
  
  async saveSettings(userId: string, encryptedSettings: string): Promise<void> {
    await this.db.query(`
      INSERT INTO user_settings (user_id, settings_json)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE 
        settings_json = VALUES(settings_json),
        updated_at = CURRENT_TIMESTAMP,
        version = version + 1
    `, [userId, encryptedSettings]);
  }
  
  async deleteSettings(userId: string): Promise<void> {
    await this.db.query(
      'DELETE FROM user_settings WHERE user_id = ?',
      [userId]
    );
  }
  
  async listUsers(): Promise<string[]> {
    const result = await this.db.query(
      'SELECT user_id FROM user_settings ORDER BY created_at'
    );
    
    return result.rows.map(row => row.user_id);
  }
}
```

### 3. API エンドポイント設計

#### A. ユーザー設定API
```typescript
// src/routes/user-config.ts
import express from 'express';
import { requireAuth, requirePermission } from '../middleware/auth-middleware';
import { UserConfigManager } from '../config/user-config-manager';
import { PERMISSIONS } from '../auth/permissions/permission-constants';

const router = express.Router();
const userConfigManager = new UserConfigManager();

// 利用可能なサーバーテンプレート取得
router.get('/templates', 
  requireAuth,
  requirePermission(PERMISSIONS.USER_CONFIG_READ),
  async (req, res) => {
    try {
      const authContext = req.authContext;
      const templates = await userConfigManager.getAvailableTemplates(authContext);
      
      res.json({
        success: true,
        data: { templates }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ユーザー設定取得
router.get('/settings',
  requireAuth,
  requirePermission(PERMISSIONS.USER_CONFIG_READ),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const settings = await userConfigManager.getUserSettings(userId);
      
      res.json({
        success: true,
        data: { settings }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ユーザー設定更新
router.put('/settings',
  requireAuth,
  requirePermission(PERMISSIONS.USER_CONFIG_WRITE),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const authContext = req.authContext;
      const { settings } = req.body;
      
      const updatedSettings = await userConfigManager.updateUserSettings(
        userId,
        settings,
        authContext
      );
      
      res.json({
        success: true,
        data: { settings: updatedSettings },
        message: 'Settings updated successfully'
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: error.message,
          type: 'validation_error'
        });
      } else if (error instanceof SecurityError) {
        res.status(403).json({
          success: false,
          error: error.message,
          type: 'security_error'
        });
      } else {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }
  }
);

// 特定サーバー設定更新
router.put('/settings/:templateId',
  requireAuth,
  requirePermission(PERMISSIONS.USER_CONFIG_WRITE),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { templateId } = req.params;
      const { enabled, customization } = req.body;
      const authContext = req.authContext;
      
      const currentSettings = await userConfigManager.getUserSettings(userId);
      
      const updatedSettings = await userConfigManager.updateUserSettings(
        userId,
        {
          serverSettings: {
            ...currentSettings.serverSettings,
            [templateId]: {
              templateId,
              enabled: enabled !== undefined ? enabled : true,
              customization: customization || {},
              lastModified: new Date(),
              version: (currentSettings.serverSettings[templateId]?.version || 0) + 1
            }
          }
        },
        authContext
      );
      
      res.json({
        success: true,
        data: { settings: updatedSettings },
        message: `Server ${templateId} settings updated`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// サーバー有効/無効切り替え
router.patch('/settings/:templateId/toggle',
  requireAuth,
  requirePermission(PERMISSIONS.USER_CONFIG_WRITE),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { templateId } = req.params;
      const { enabled } = req.body;
      const authContext = req.authContext;
      
      const currentSettings = await userConfigManager.getUserSettings(userId);
      const serverSettings = currentSettings.serverSettings[templateId];
      
      if (!serverSettings) {
        return res.status(404).json({
          success: false,
          error: 'Server settings not found'
        });
      }
      
      const updatedSettings = await userConfigManager.updateUserSettings(
        userId,
        {
          serverSettings: {
            ...currentSettings.serverSettings,
            [templateId]: {
              ...serverSettings,
              enabled,
              lastModified: new Date(),
              version: serverSettings.version + 1
            }
          }
        },
        authContext
      );
      
      res.json({
        success: true,
        data: { enabled },
        message: `Server ${templateId} ${enabled ? 'enabled' : 'disabled'}`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// 現在の有効なMCP設定プレビュー
router.get('/preview',
  requireAuth,
  requirePermission(PERMISSIONS.USER_CONFIG_READ),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const authContext = req.authContext;
      
      const mcpConfigs = await userConfigManager.generateMCPConfig(userId, authContext);
      
      res.json({
        success: true,
        data: { configs: mcpConfigs }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// 設定リセット
router.delete('/settings/:templateId',
  requireAuth,
  requirePermission(PERMISSIONS.USER_CONFIG_WRITE),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { templateId } = req.params;
      const authContext = req.authContext;
      
      const currentSettings = await userConfigManager.getUserSettings(userId);
      
      // 該当設定を削除
      const { [templateId]: removed, ...remainingSettings } = currentSettings.serverSettings;
      
      const updatedSettings = await userConfigManager.updateUserSettings(
        userId,
        {
          serverSettings: remainingSettings
        },
        authContext
      );
      
      res.json({
        success: true,
        data: { settings: updatedSettings },
        message: `Server ${templateId} settings reset`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

export default router;
```

### 4. フロントエンド（User UI）

#### A. ユーザー設定ページ
```typescript
// user-ui/src/pages/MySettings.tsx
import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardHeader, 
  CardContent, 
  Switch, 
  Button, 
  Input, 
  Select, 
  Textarea,
  Slider,
  Alert
} from '../components/ui';
import { useUserSettings } from '../hooks/useUserSettings';
import { ServerConfigTemplate, UserSettings } from '../types';

export const MySettingsPage: React.FC = () => {
  const {
    templates,
    userSettings,
    loading,
    error,
    updateServerSettings,
    toggleServer,
    resetServerSettings
  } = useUserSettings();
  
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;
  
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Settings</h1>
        <p className="text-gray-600 mt-2">
          Configure your personal MCP servers and environment
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="space-y-6">
            {templates.map(template => (
              <ServerSettingsCard
                key={template.id}
                template={template}
                userSettings={userSettings.serverSettings[template.id]}
                onSettingsUpdate={(settings) => updateServerSettings(template.id, settings)}
                onToggle={(enabled) => toggleServer(template.id, enabled)}
                onReset={() => resetServerSettings(template.id)}
                validationErrors={validationErrors[template.id] || {}}
              />
            ))}
          </div>
        </div>
        
        <div className="lg:col-span-1">
          <SettingsSidebar 
            userSettings={userSettings}
            templates={templates}
          />
        </div>
      </div>
    </div>
  );
};

const ServerSettingsCard: React.FC<{
  template: ServerConfigTemplate;
  userSettings?: UserServerSettings;
  onSettingsUpdate: (settings: any) => void;
  onToggle: (enabled: boolean) => void;
  onReset: () => void;
  validationErrors: Record<string, string>;
}> = ({ template, userSettings, onSettingsUpdate, onToggle, onReset, validationErrors }) => {
  const [localSettings, setLocalSettings] = useState(userSettings?.customization || {});
  const [isExpanded, setIsExpanded] = useState(false);
  
  const isEnabled = userSettings?.enabled ?? false;
  
  const handleSettingChange = (key: string, value: any) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onSettingsUpdate({ customization: newSettings });
  };
  
  return (
    <Card className={`transition-all ${isEnabled ? 'ring-2 ring-blue-500' : 'opacity-75'}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Switch
              checked={isEnabled}
              onCheckedChange={onToggle}
              className="mr-2"
            />
            <div>
              <h3 className="text-lg font-semibold">{template.name}</h3>
              <p className="text-sm text-gray-600">{template.description}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Collapse' : 'Configure'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              disabled={!userSettings}
            >
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && isEnabled && (
        <CardContent>
          <div className="space-y-4">
            {Object.entries(template.userCustomizable).map(([key, definition]) => (
              <SettingInput
                key={key}
                settingKey={key}
                definition={definition}
                value={localSettings[key] ?? definition.default}
                onChange={(value) => handleSettingChange(key, value)}
                error={validationErrors[key]}
              />
            ))}
            
            {Object.keys(template.environmentVariables.userCustomizable).length > 0 && (
              <div className="mt-6">
                <h4 className="text-md font-medium mb-3">Environment Variables</h4>
                <div className="space-y-3">
                  {Object.entries(template.environmentVariables.userCustomizable).map(([key, definition]) => (
                    <SettingInput
                      key={`env_${key}`}
                      settingKey={key}
                      definition={definition}
                      value={localSettings[`env_${key}`] ?? definition.default}
                      onChange={(value) => handleSettingChange(`env_${key}`, value)}
                      error={validationErrors[`env_${key}`]}
                      label={`${key} (Environment Variable)`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

const SettingInput: React.FC<{
  settingKey: string;
  definition: SettingDefinition;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  label?: string;
}> = ({ settingKey, definition, value, onChange, error, label }) => {
  const inputLabel = label || definition.description;
  
  const renderInput = () => {
    switch (definition.type) {
      case 'boolean':
        return (
          <Switch
            checked={value}
            onCheckedChange={onChange}
          />
        );
        
      case 'enum':
        return (
          <Select value={value} onValueChange={onChange}>
            {definition.constraints?.values?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
        );
        
      case 'integer':
        if (definition.constraints?.min !== undefined && definition.constraints?.max !== undefined) {
          return (
            <div className="space-y-2">
              <Slider
                value={[value]}
                onValueChange={([newValue]) => onChange(newValue)}
                min={definition.constraints.min}
                max={definition.constraints.max}
                step={1}
              />
              <div className="flex justify-between text-sm text-gray-500">
                <span>{definition.constraints.min}</span>
                <span className="font-medium">{value}</span>
                <span>{definition.constraints.max}</span>
              </div>
            </div>
          );
        }
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            min={definition.constraints?.min}
            max={definition.constraints?.max}
          />
        );
        
      case 'string':
      case 'path':
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={definition.default?.toString()}
          />
        );
        
      case 'json':
        return (
          <Textarea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange(parsed);
              } catch {
                onChange(e.target.value); // 無効なJSONでも一時的に保存
              }
            }}
            className="font-mono text-sm"
            rows={4}
          />
        );
        
      default:
        return (
          <Input
            type="text"
            value={value?.toString() || ''}
            onChange={(e) => onChange(e.target.value)}
          />
        );
    }
  };
  
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {inputLabel}
      </label>
      {renderInput()}
      {error && (
        <Alert variant="destructive" className="mt-1">
          {error}
        </Alert>
      )}
      {definition.constraints && (
        <div className="text-xs text-gray-500">
          {definition.constraints.min !== undefined && definition.constraints.max !== undefined && (
            <span>Range: {definition.constraints.min} - {definition.constraints.max}</span>
          )}
          {definition.constraints.pattern && (
            <span>Pattern: {definition.constraints.pattern}</span>
          )}
        </div>
      )}
    </div>
  );
};

const SettingsSidebar: React.FC<{
  userSettings: UserSettings;
  templates: ServerConfigTemplate[];
}> = ({ userSettings, templates }) => {
  const enabledServers = Object.values(userSettings.serverSettings).filter(s => s.enabled).length;
  const totalServers = templates.length;
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Overview</h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Active Servers</span>
              <span className="font-medium">{enabledServers}/{totalServers}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Updated</span>
              <span className="text-sm">{userSettings.metadata.lastLogin.toLocaleDateString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Quick Actions</h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Button variant="outline" className="w-full">
              Export Settings
            </Button>
            <Button variant="outline" className="w-full">
              Import Settings
            </Button>
            <Button variant="outline" className="w-full">
              Reset All
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
```

## 🚀 実装チェックリスト

### Phase 1: コア設定システム（2-3週間）

#### 週1: 設定テンプレートエンジン
- [ ] `ServerConfigTemplate` 型定義とスキーマ
- [ ] `ConfigTemplateEngine` クラス実装
- [ ] テンプレート検証システム
- [ ] パラメータ展開システム
- [ ] 基本的なテンプレートファイル作成

#### 週2-3: 設定検証・セキュリティ
- [ ] `ConfigValidator` クラス実装
- [ ] `SecurityValidator` 詳細実装
- [ ] `PathValidator` 実装
- [ ] パスインジェクション攻撃防止
- [ ] 動的制約検証システム

### Phase 2: ユーザー設定管理（2-3週間）

#### 週1: ユーザー設定マネージャー
- [ ] `UserConfigManager` クラス実装
- [ ] 設定マージ・オーバーライドロジック
- [ ] インスタンス更新・再起動連携
- [ ] 設定バリデーション統合

#### 週2: 永続化システム
- [ ] `UserSettingsStore` インターフェース
- [ ] `FileBasedSettingsStore` 実装
- [ ] `DatabaseSettingsStore` 実装
- [ ] 設定暗号化機能

#### 週3: API エンドポイント
- [ ] `/user-config` ルート実装
- [ ] 権限チェック統合
- [ ] エラーハンドリング
- [ ] API テスト

### Phase 3: フロントエンド（User UI）（2-3週間）

#### 週1: 基本UI コンポーネント
- [ ] `MySettingsPage` 実装
- [ ] `ServerSettingsCard` コンポーネント
- [ ] `SettingInput` 動的コンポーネント
- [ ] 基本的なフォーム機能

#### 週2: 高度なUI機能
- [ ] リアルタイム設定検証
- [ ] 設定プレビュー機能
- [ ] エクスポート/インポート機能
- [ ] 設定リセット機能

#### 週3: 統合とテスト
- [ ] Admin UI と User UI の分離
- [ ] 認証コンテキスト統合
- [ ] エンドツーエンドテスト
- [ ] パフォーマンス最適化

### Phase 4: 統合・最適化（1-2週間）

#### 統合テスト
- [ ] 全コンポーネント統合テスト
- [ ] セキュリティテスト
- [ ] パフォーマンステスト
- [ ] エラーハンドリングテスト

#### ドキュメント・最適化
- [ ] API ドキュメント作成
- [ ] ユーザーガイド作成
- [ ] パフォーマンス最適化
- [ ] 本番環境デプロイメント準備

---

**この実装により、エンタープライズレベルのユーザー設定カスタマイズ機能が完成します！** 🎯

**重要なポイント:**
1. **セキュリティ第一**: パスインジェクション、コマンドインジェクション防止
2. **ユーザビリティ**: 直感的なUI、リアルタイム検証
3. **管理性**: 管理者制御、監査ログ、設定テンプレート
4. **拡張性**: プラグイン可能な検証器、ストレージ抽象化

これで真のマルチテナント MCP Bridge が実現できます！ 🚀
