import express from 'express';
import { RBACConfig } from '../auth/types/rbac-types.js';
import { AuthenticatedRequest } from './auth-middleware.js';

export function createRBACMiddleware(rbac: RBACConfig) {
  return function requirePermission(permission: string): express.RequestHandler {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const user = (req as AuthenticatedRequest).user;
      if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const roles = user.roles && user.roles.length > 0 ? user.roles : [rbac.defaultRole];
      for (const roleName of roles) {
        const role = rbac.roles[roleName];
        if (!role) continue;
        if (role.permissions.includes('*') || role.permissions.includes(permission)) {
          next();
          return;
        }
      }

      res.status(403).json({ error: 'Insufficient permissions' });
    };
  };
}
