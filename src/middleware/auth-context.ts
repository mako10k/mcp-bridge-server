import express from 'express';
import { AuthContextManager } from '../auth/context/auth-context.js';
import { MCPInstanceContext } from '../mcp/lifecycle/types.js';

export interface AuthContextRequest extends express.Request {
  authContext?: MCPInstanceContext;
}

export function createAuthContextMiddleware(manager: AuthContextManager): express.RequestHandler {
  return (req: AuthContextRequest, _res: express.Response, next: express.NextFunction) => {
    try {
      req.authContext = manager.extractContext(req);
    } catch {
      req.authContext = undefined;
    }
    next();
  };
}
