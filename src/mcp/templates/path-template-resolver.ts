/**
 * @fileoverview Path template resolver for MCP server configurations
 * Resolves template variables in file paths and command arguments
 */

import { TemplateVariables, ValidationResult } from '../lifecycle/types.js';
import { logger } from '../../utils/logger.js';
import path from 'path';

/**
 * Path template resolver with security validation
 */
export class PathTemplateResolver {
  private static readonly TEMPLATE_REGEX = /\{([^}]+)\}/g;
  private static readonly DANGEROUS_PATTERNS = [
    /\.\./,           // Directory traversal
    /\/\//,           // Double slashes
    /^\/(?:etc|proc|sys|dev)/,  // System directories
    /[<>"|*?]/,       // Invalid filename characters
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i  // Reserved Windows names
  ];

  /**
   * Resolve template variables in a string
   */
  resolveTemplate(template: string, variables: TemplateVariables): string {
    return template.replace(PathTemplateResolver.TEMPLATE_REGEX, (match, varName) => {
      const value = variables[varName];
      if (value === undefined) {
        logger.warn(`Template variable not found: ${varName}`);
        return match; // Keep original if not found
      }
      return this.sanitizeValue(value);
    });
  }

  /**
   * Resolve template variables in an array of strings
   */
  resolveTemplateArray(templates: string[], variables: TemplateVariables): string[] {
    return templates.map(template => this.resolveTemplate(template, variables));
  }

  /**
   * Resolve template variables in a record of strings
   */
  resolveTemplateRecord(
    templates: Record<string, string>, 
    variables: TemplateVariables
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, template] of Object.entries(templates)) {
      result[key] = this.resolveTemplate(template, variables);
    }
    return result;
  }

  /**
   * Validate a path for security issues
   */
  validatePath(resolvedPath: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for dangerous patterns
    for (const pattern of PathTemplateResolver.DANGEROUS_PATTERNS) {
      if (pattern.test(resolvedPath)) {
        errors.push(`Dangerous path pattern detected: ${pattern.source}`);
      }
    }

    // Check for absolute paths outside allowed directories
    if (path.isAbsolute(resolvedPath)) {
      const allowedPrefixes = [
        '/tmp/',
        '/var/tmp/',
        process.cwd(),
        process.env.HOME
      ].filter(Boolean);

      const isAllowed = allowedPrefixes.some(prefix => 
        resolvedPath.startsWith(prefix!)
      );

      if (!isAllowed) {
        errors.push(`Absolute path outside allowed directories: ${resolvedPath}`);
      }
    }

    // Check for path length
    if (resolvedPath.length > 255) {
      errors.push(`Path too long: ${resolvedPath.length} characters`);
    }

    // Check for null bytes
    if (resolvedPath.includes('\0')) {
      errors.push('Null byte detected in path');
    }

    // Warnings for suspicious patterns
    if (resolvedPath.includes('~')) {
      warnings.push('Tilde character in path may not expand as expected');
    }

    if (resolvedPath.includes('$')) {
      warnings.push('Dollar sign in path may indicate unresolved environment variable');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Sanitize a template variable value
   */
  private sanitizeValue(value: string): string {
    // Remove null bytes
    let sanitized = value.replace(/\0/g, '');
    
    // Replace dangerous characters with safe alternatives
    sanitized = sanitized.replace(/[<>"|*?]/g, '_');
    
    // Prevent directory traversal
    sanitized = sanitized.replace(/\.\./g, '__');
    
    // Limit length
    if (sanitized.length > 100) {
      sanitized = sanitized.substring(0, 100);
      logger.warn(`Template value truncated to 100 characters: ${value}`);
    }

    return sanitized;
  }

  /**
   * Create template variables from context
   */
  createTemplateVariables(context: {
    userId?: string;
    userEmail?: string;
    sessionId?: string;
    requestId: string;
    timestamp: Date;
  }): TemplateVariables {
    return {
      userId: context.userId,
      userEmail: context.userEmail ? this.sanitizeValue(context.userEmail) : undefined,
      sessionId: context.sessionId,
      timestamp: context.timestamp.toISOString().replace(/[:.]/g, '-'),
      requestId: context.requestId,
      // Add common derived variables
      userDir: context.userId ? `user_${this.sanitizeValue(context.userId)}` : undefined,
      sessionDir: context.sessionId ? `session_${this.sanitizeValue(context.sessionId)}` : undefined,
      dateDir: context.timestamp.toISOString().split('T')[0], // YYYY-MM-DD
      timeDir: context.timestamp.toTimeString().split(' ')[0].replace(/:/g, '-') // HH-MM-SS
    };
  }

  /**
   * Validate and resolve a complete server configuration
   */
  validateAndResolveConfig(
    config: {
      command: string;
      args: string[];
      env?: Record<string, string>;
      workingDirectory?: string;
      pathTemplates?: Record<string, string>;
    },
    variables: TemplateVariables
  ): { config: typeof config; validation: ValidationResult } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Resolve command
    const resolvedCommand = this.resolveTemplate(config.command, variables);
    const commandValidation = this.validatePath(resolvedCommand);
    errors.push(...commandValidation.errors);
    warnings.push(...commandValidation.warnings);

    // Resolve args
    const resolvedArgs = this.resolveTemplateArray(config.args, variables);
    
    // Resolve environment variables
    const resolvedEnv = config.env ? 
      this.resolveTemplateRecord(config.env, variables) : undefined;

    // Resolve working directory
    const resolvedWorkingDirectory = config.workingDirectory ?
      this.resolveTemplate(config.workingDirectory, variables) : undefined;

    if (resolvedWorkingDirectory) {
      const wdValidation = this.validatePath(resolvedWorkingDirectory);
      errors.push(...wdValidation.errors);
      warnings.push(...wdValidation.warnings);
    }

    // Resolve path templates
    const resolvedPathTemplates = config.pathTemplates ?
      this.resolveTemplateRecord(config.pathTemplates, variables) : undefined;

    if (resolvedPathTemplates) {
      for (const [key, resolvedPath] of Object.entries(resolvedPathTemplates)) {
        const pathValidation = this.validatePath(resolvedPath);
        if (!pathValidation.valid) {
          errors.push(`Invalid path template '${key}': ${pathValidation.errors.join(', ')}`);
        }
        warnings.push(...pathValidation.warnings);
      }
    }

    return {
      config: {
        command: resolvedCommand,
        args: resolvedArgs,
        env: resolvedEnv,
        workingDirectory: resolvedWorkingDirectory,
        pathTemplates: resolvedPathTemplates
      },
      validation: {
        valid: errors.length === 0,
        errors,
        warnings
      }
    };
  }
}
