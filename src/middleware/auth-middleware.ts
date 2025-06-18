import express from 'express';
import { JWTUtils, TokenPayload } from '../auth/utils/jwt-utils.js';

export interface AuthMiddlewareOptions {
  jwtUtils: JWTUtils;
  mode: 'disabled' | 'optional' | 'required';
}

export interface AuthenticatedRequest extends express.Request {
  user?: TokenPayload;
}

export function requireAuth(options: AuthMiddlewareOptions): express.RequestHandler {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (options.mode === 'disabled') {
      return next();
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (!token) {
      if (options.mode === 'required') {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      return next();
    }

    try {
      const payload = options.jwtUtils.verify(token);
      (req as AuthenticatedRequest).user = payload;
      next();
    } catch (err) {
      if (options.mode === 'required') {
        res.status(401).json({ error: 'Invalid token' });
      } else {
        next();
      }
    }
  };
}
