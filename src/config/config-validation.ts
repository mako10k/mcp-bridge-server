import { MCPServerConfig } from './mcp-config.js';

export class ValidationError extends Error {}
export class SecurityError extends Error {}

export interface AuthContext {
  userId?: string;
  userEmail?: string;
  sessionId?: string;
  primaryRole?: string;
  roles?: string[];
}

export interface ConstraintRule {
  when: any;
  then: Partial<SettingDefinition>;
}

export interface SettingDefinition {
  type: 'boolean' | 'string' | 'integer' | 'float' | 'enum' | 'path' | 'json';
  description: string;
  default: any;
  constraints?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    allowedPatterns?: string[];
    min?: number;
    max?: number;
    values?: string[];
    mustExist?: boolean;
    permissions?: string;
    schema?: object;
  };
  dynamicConstraints?: {
    dependsOn: string;
    rules: ConstraintRule[];
  };
}

export class PathValidator {
  async validatePath(path: string): Promise<void> {
    if (!path || typeof path !== 'string') {
      throw new ValidationError('Invalid path');
    }
    if (path.includes('..')) {
      throw new SecurityError('Path traversal detected');
    }
    if (process.platform === 'win32') {
      const invalid = /[<>:"|?*]/;
      if (invalid.test(path)) {
        throw new ValidationError('Invalid character in path');
      }
    }
  }
}

export class SecurityValidator {
  async validateUserValue(
    key: string,
    value: any,
    definition: SettingDefinition,
    _authContext: AuthContext
  ): Promise<void> {
    if (definition.type === 'path') {
      await this.validatePathSecurity(value, definition.constraints?.allowedPatterns);
    }
    if (typeof value === 'string') {
      await this.validateCommandInjection(value);
    }
  }

  async validateSecurityLevel(_template: any): Promise<void> {
    // placeholder for future checks
  }

  async validateFinalConfig(_config: MCPServerConfig, _authContext: AuthContext): Promise<void> {
    // placeholder
  }

  private async validatePathSecurity(path: string, allowedPatterns?: string[]): Promise<void> {
    if (path.includes('..')) {
      throw new SecurityError('Path traversal detected');
    }
    if (!path.startsWith('/')) {
      throw new SecurityError('Relative paths not allowed');
    }
    if (allowedPatterns) {
      const isAllowed = allowedPatterns.some(p => new RegExp(p.replace('**', '.*').replace('*', '[^/]*')).test(path));
      if (!isAllowed) {
        throw new SecurityError(`Path not allowed: ${path}`);
      }
    }
  }

  private async validateCommandInjection(value: string): Promise<void> {
    const dangerousChars = ['|', '&', ';', '$', '`', '(', ')', '{', '}', '[', ']'];
    for (const ch of dangerousChars) {
      if (value.includes(ch)) {
        throw new SecurityError(`Dangerous character detected: ${ch}`);
      }
    }
  }

  private async validateCommand(_command: string): Promise<void> {
    // placeholder
  }
}

export class ConfigValidator {
  private pathValidator = new PathValidator();
  private securityValidator = new SecurityValidator();

  async validateTemplate(template: any): Promise<void> {
    if (!template.id || !template.name || !template.adminControlled) {
      throw new ValidationError('Invalid template structure');
    }
    await this.securityValidator.validateSecurityLevel(template);
    if (template.userCustomizable) {
      for (const [key, def] of Object.entries<SettingDefinition>(template.userCustomizable)) {
        await this.validateSettingDefinition(key, def);
      }
    }
  }

  async validateUserSetting(
    key: string,
    value: any,
    definition: SettingDefinition,
    authContext: AuthContext,
    context: Record<string, any> = {}
  ): Promise<void> {
    await this.validateType(value, definition.type);
    await this.validateConstraints(value, definition.constraints);
    if (definition.dynamicConstraints) {
      await this.validateDynamicConstraints(value, definition.dynamicConstraints, context);
    }
    await this.securityValidator.validateUserValue(key, value, definition, authContext);
  }

  async validateFinalConfig(config: MCPServerConfig, authContext: AuthContext): Promise<void> {
    await this.validateConfigIntegrity(config);
    await this.securityValidator.validateFinalConfig(config, authContext);
  }

  private async validateSettingDefinition(_key: string, _definition: SettingDefinition): Promise<void> {
    // placeholder for definition structure checks
  }

  private async validateType(value: any, type: string): Promise<void> {
    switch (type) {
      case 'boolean':
        if (typeof value !== 'boolean') throw new ValidationError(`Expected boolean, got ${typeof value}`);
        break;
      case 'string':
        if (typeof value !== 'string') throw new ValidationError(`Expected string, got ${typeof value}`);
        break;
      case 'integer':
        if (!Number.isInteger(value)) throw new ValidationError(`Expected integer, got ${typeof value}`);
        break;
      case 'float':
        if (typeof value !== 'number') throw new ValidationError(`Expected number, got ${typeof value}`);
        break;
      case 'path':
        if (typeof value !== 'string') throw new ValidationError(`Expected path string, got ${typeof value}`);
        await this.pathValidator.validatePath(value);
        break;
      case 'json':
        try {
          if (typeof value === 'string') JSON.parse(value);
        } catch (err: any) {
          throw new ValidationError(`Invalid JSON: ${err.message}`);
        }
        break;
      case 'enum':
        if (typeof value !== 'string') throw new ValidationError('Expected enum string');
        break;
    }
  }

  private async validateConstraints(value: any, constraints?: SettingDefinition['constraints']): Promise<void> {
    if (!constraints) return;
    if (constraints.min !== undefined && value < constraints.min) {
      throw new ValidationError(`Value ${value} is below minimum ${constraints.min}`);
    }
    if (constraints.max !== undefined && value > constraints.max) {
      throw new ValidationError(`Value ${value} is above maximum ${constraints.max}`);
    }
    if (typeof value === 'string') {
      if (constraints.minLength && value.length < constraints.minLength) {
        throw new ValidationError(`String too short: ${value.length} < ${constraints.minLength}`);
      }
      if (constraints.maxLength && value.length > constraints.maxLength) {
        throw new ValidationError(`String too long: ${value.length} > ${constraints.maxLength}`);
      }
      if (constraints.pattern) {
        const regex = new RegExp(constraints.pattern);
        if (!regex.test(value)) throw new ValidationError(`Value doesn't match pattern: ${constraints.pattern}`);
      }
    }
    if (constraints.values && !constraints.values.includes(value)) {
      throw new ValidationError(`Invalid value: ${value}. Allowed: ${constraints.values.join(', ')}`);
    }
  }

  private async validateDynamicConstraints(
    value: any,
    dynamic: { dependsOn: string; rules: ConstraintRule[] },
    context: Record<string, any>
  ): Promise<void> {
    const dependsValue = context[dynamic.dependsOn];
    for (const rule of dynamic.rules) {
      if (rule.when === dependsValue) {
        if (rule.then.type) {
          await this.validateType(value, rule.then.type);
        }
        if (rule.then.constraints) {
          await this.validateConstraints(value, rule.then.constraints);
        }
      }
    }
  }

  private async validateConfigIntegrity(_config: MCPServerConfig): Promise<void> {
    // placeholder
  }
}
