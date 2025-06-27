import { describe, it, expect } from 'vitest';
import { AuthConfigSchema, loadAuthConfigFromObject } from '../../src/config/auth-config';

// Sample valid authentication configuration
const validConfig = {
  enabled: true,
  mode: 'required',
  providers: [
    {
      type: 'google',
      clientId: 'test-client-id',
      clientSecret: 'test-secret',
      redirectUri: 'https://example.com/callback',
      scope: 'openid email profile'
    }
  ],
  rbac: {
    defaultRole: 'viewer',
    roles: {
      viewer: { permissions: ['read'] },
      admin: { permissions: ['*'] }
    }
  },
  jwt: {
    issuer: 'test-issuer',
    audience: 'test-audience',
    expiresIn: '1h'
  }
};

describe('AuthConfigSchema', () => {
  it('should validate a valid config', () => {
    expect(() => AuthConfigSchema.parse(validConfig)).not.toThrow();
  });

  it('should throw on missing required provider fields', () => {
    const invalid = { ...validConfig, providers: [{ type: 'google' }] };
    expect(() => AuthConfigSchema.parse(invalid)).toThrow();
  });

  it('should expand environment variables', () => {
    process.env.TEST_CLIENT_ID = 'env-client-id';
    const configWithEnv = {
      ...validConfig,
      providers: [
        {
          ...validConfig.providers[0],
          clientId: '${TEST_CLIENT_ID}'
        }
      ]
    };
    const parsed = loadAuthConfigFromObject(configWithEnv);
    expect(parsed.providers[0].clientId).toBe('env-client-id');
  });
});
