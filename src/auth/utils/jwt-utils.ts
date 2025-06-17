import jwt, { SignOptions, VerifyOptions, JwtPayload } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { logger } from '../../utils/logger.js';

export interface JWTConfig {
  issuer: string;
  audience: string;
  expiresIn: StringValue | number;
}

export interface TokenPayload extends JwtPayload {
  sub: string;
  email?: string;
  roles?: string[];
}

export class JWTUtils {
  constructor(private config: JWTConfig, private privateKey: string, private publicKey: string) {}

  sign(payload: TokenPayload, options: SignOptions = {}): string {
    try {
      const signOptions: SignOptions = {
        algorithm: 'RS256',
        issuer: this.config.issuer,
        audience: this.config.audience,
        expiresIn: this.config.expiresIn,
        ...options
      };
      return jwt.sign(payload, this.privateKey, signOptions);
    } catch (err) {
      logger.error('Failed to sign JWT', err);
      throw err;
    }
  }

  verify(token: string, options: VerifyOptions = {}): TokenPayload {
    try {
      return jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
        issuer: this.config.issuer,
        audience: this.config.audience,
        ...options
      }) as TokenPayload;
    } catch (err) {
      logger.warn('JWT verification failed');
      throw err;
    }
  }

  decode(token: string): null | TokenPayload {
    try {
      return jwt.decode(token) as TokenPayload | null;
    } catch (err) {
      logger.warn('Failed to decode JWT');
      return null;
    }
  }
}
