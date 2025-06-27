import fs from 'fs';
import { EventEmitter } from 'events';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { expandEnvVarsInObject } from './env-expand.js';

export const AuthProviderSchema = z.object({
  type: z.enum(['google', 'azure', 'github', 'oidc']),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url().optional(),
  tenantId: z.string().optional(),
  scope: z.string().optional()
});

export const RBACConfigSchema = z.object({
  defaultRole: z.string().default('viewer'),
  roles: z.record(z.object({ permissions: z.array(z.string()) })),
  userMappings: z.array(z.object({ email: z.string(), role: z.string() })).optional()
});

export const SessionConfigSchema = z.object({
  secret: z.string().min(1),
  maxAge: z.number().optional(),
  secure: z.boolean().optional(),
  httpOnly: z.boolean().optional()
});

export const JwtConfigSchema = z.object({
  issuer: z.string().optional(),
  audience: z.string().optional(),
  expiresIn: z.string().optional()
});

export const AuthConfigSchema = z.object({
  enabled: z.boolean().default(false),
  mode: z.enum(['disabled', 'optional', 'required']).default('optional'),
  providers: z.array(AuthProviderSchema).default([]),
  rbac: RBACConfigSchema.optional(),
  session: SessionConfigSchema.optional(),
  jwt: JwtConfigSchema.optional()
});
export type AuthConfig = z.infer<typeof AuthConfigSchema>;

export function loadAuthConfigFromObject(obj: any): AuthConfig {
  const expanded = expandEnvVarsInObject(obj || {});
  return AuthConfigSchema.parse(expanded);
}

export function loadAuthConfigFromFile(path: string): AuthConfig {
  const data = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf-8')) : {};
  return loadAuthConfigFromObject(data.auth || {});
}

export class AuthConfigManager extends EventEmitter {
  private config: AuthConfig;
  constructor(private path: string) {
    super();
    this.config = loadAuthConfigFromFile(this.path);
    fs.watchFile(this.path, { persistent: false }, () => {
      try {
        const newConfig = loadAuthConfigFromFile(this.path);
        this.config = newConfig;
        this.emit('reloaded', newConfig);
        logger.info('Auth configuration reloaded');
      } catch (err) {
        logger.error('Failed to reload auth configuration:', err);
      }
    });
  }

  getConfig(): AuthConfig {
    return this.config;
  }
}
