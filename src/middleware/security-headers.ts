import { RequestHandler } from 'express';
import helmet, { HelmetOptions } from 'helmet';

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: HelmetOptions['contentSecurityPolicy'];
  hsts?: HelmetOptions['hsts'];
  frameguard?: HelmetOptions['frameguard'];
}

/**
 * Create a security headers middleware using Helmet.
 * Content Security Policy, HSTS, and X-Frame-Options are enabled by default.
 */
export function createSecurityHeadersMiddleware(config: SecurityHeadersConfig = {}): RequestHandler {
  const options = {
    contentSecurityPolicy: config.contentSecurityPolicy ?? true,
    hsts: config.hsts ?? true,
    frameguard: config.frameguard ?? { action: 'deny' },
  } as Parameters<typeof helmet>[0];
  return helmet(options);
}
