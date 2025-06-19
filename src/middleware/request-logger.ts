import express from 'express';
import { logger } from '../utils/logger.js';
import { auditLogger } from '../utils/audit-logger.js';
import { AuthContextRequest } from './auth-context.js';
import { AuthenticatedUser } from '../auth/context/auth-context.js';

/**
 * Express middleware that logs incoming requests with authentication context.
 */
export const requestLogger: express.RequestHandler = (
  req: AuthContextRequest,
  _res: express.Response,
  next: express.NextFunction
) => {
  const { method, originalUrl } = req;
  const user = req.authContext?.authInfo as AuthenticatedUser | undefined;
  const requestId = req.authContext?.requestId ?? 'n/a';
  const userId = user?.id || 'anonymous';
  const roles = user?.roles?.join(',') || '';
  logger.info(
    `Request ${method} ${originalUrl} [${requestId}] user=${userId} roles=${roles}`
  );
  auditLogger.log({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    message: `REQ ${method} ${originalUrl} user=${userId} roles=${roles}`
  });
  next();
};
