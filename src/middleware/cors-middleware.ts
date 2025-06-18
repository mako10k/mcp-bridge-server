import { RequestHandler } from 'express';
import cors, { CorsOptions } from 'cors';

export interface CorsConfig {
  allowedOrigins?: string[];
  allowCredentials?: boolean;
}

/**
 * Create a CORS middleware based on the given configuration.
 * If an origin is not allowed, a 403 response is returned.
 */
export function createCorsMiddleware(config: CorsConfig = {}): RequestHandler {
  const allowed = config.allowedOrigins ?? ['*'];
  const allowCreds = config.allowCredentials ?? false;

  const options: CorsOptions = {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowed.includes('*') || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: allowCreds
  };

  const corsMiddleware = cors(options);
  return (req, res, next) => {
    corsMiddleware(req, res, (err) => {
      if (err) {
        res.status(403).json({ error: 'CORS origin not allowed' });
      } else {
        next();
      }
    });
  };
}

