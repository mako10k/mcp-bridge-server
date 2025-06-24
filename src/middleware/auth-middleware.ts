import express from 'express';
import { JWTUtils, TokenPayload } from '../auth/utils/jwt-utils.js';
import { sessionStore } from '../auth/session-store.js';

function parseCookieHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  header.split(';').forEach(part => {
    const [k, v] = part.trim().split('=');
    if (k) result[k] = decodeURIComponent(v || '');
  });
  return result;
}

export interface AuthMiddlewareOptions {
  jwtUtils: JWTUtils;
  mode: 'disabled' | 'optional' | 'required';
}

export interface AuthenticatedRequest extends express.Request {
  user?: TokenPayload;
}

export interface UpdatableAuthMiddleware extends express.RequestHandler {
  update(options: AuthMiddlewareOptions): void;
}

export function requireAuth(initialOptions: AuthMiddlewareOptions): UpdatableAuthMiddleware {
  let options = { ...initialOptions };
  const handler = ((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (options.mode === 'disabled') {
      return next();
    }

    const authHeader = req.headers.authorization;
    let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (!token) {
      const cookieHeader = (req as any).cookies?.session_id || parseCookieHeader(req.headers.cookie || '')['session_id'];
      if (cookieHeader) {
        const session = sessionStore.get(cookieHeader);
        token = session?.tokens?.access_token;
        if (!token && session?.user) {
          (req as AuthenticatedRequest).user = {
            sub: session.user.sub,
            email: session.user.email,
            roles: session.user.roles || []
          };
          return next();
        }
      }
    }

    if (!token) {
      if (options.mode === 'required') {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      return next();
    }

    try {
      const payload = options.jwtUtils.verify(token);
      (req as AuthenticatedRequest).user = {
        ...payload,
        roles: payload.roles || []
      };
      next();
    } catch (err) {
      if (options.mode === 'required') {
        res.status(401).json({ error: 'Invalid token' });
      } else {
        next();
      }
    }
  }) as UpdatableAuthMiddleware;

  handler.update = (newOptions: AuthMiddlewareOptions) => {
    options = { ...newOptions };
  };

  return handler;
}
