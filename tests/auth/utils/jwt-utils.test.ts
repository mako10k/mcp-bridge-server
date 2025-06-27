import { describe, it, expect } from 'vitest';
import { JWTUtils, TokenPayload } from '../../../src/auth/utils/jwt-utils';
import { generateKeyPairSync } from 'crypto';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

const jwtConfig = {
  issuer: 'test-issuer',
  audience: 'test-audience',
  expiresIn: 60 * 60, // 1 hour in seconds
};

describe('JWTUtils', () => {
  const jwtUtils = new JWTUtils(jwtConfig, privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(), publicKey.export({ type: 'pkcs1', format: 'pem' }).toString());

  const payload: TokenPayload = {
    sub: 'user-123',
    email: 'user@example.com',
    roles: ['admin']
  };

  it('should sign and verify a token', () => {
    const token = jwtUtils.sign(payload);
    const verified = jwtUtils.verify(token);
    expect(verified.sub).toBe(payload.sub);
    expect(verified.email).toBe(payload.email);
    expect(verified.roles).toEqual(payload.roles);
  });

  it('should throw on invalid token', () => {
    expect(() => jwtUtils.verify('invalid.token.value')).toThrow();
  });

  it('should decode a token without verifying', () => {
    const token = jwtUtils.sign(payload);
    const decoded = jwtUtils.decode(token);
    expect(decoded?.sub).toBe(payload.sub);
  });

  it('should return null for invalid decode', () => {
    expect(jwtUtils.decode('invalid.token.value')).toBeNull();
  });
});
