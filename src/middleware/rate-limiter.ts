import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

/**
 * Create a rate limiting middleware using express-rate-limit.
 * Default: 100 requests per 15 minutes per IP.
 */
export function createRateLimiter(options?: {
  windowMs?: number;
  max?: number;
}): RequestHandler {
  return rateLimit({
    windowMs: options?.windowMs ?? 15 * 60 * 1000,
    max: options?.max ?? 100,
    standardHeaders: true,
    legacyHeaders: false
  });
}
