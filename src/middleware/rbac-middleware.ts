import express from 'express';
import { RBACConfig } from '../auth/types/rbac-types.js';
import { AuthenticatedRequest } from './auth-middleware.js';

export type PermissionChecker = (
  user: any,
  permission: string,
  req: express.Request
) => Promise<boolean> | boolean;

export interface RBACMiddlewareOptions {
  checkPermission?: PermissionChecker;
}

export interface UpdatableRBACMiddleware {
  (permission: string): express.RequestHandler;
  update(rbac: RBACConfig, options?: RBACMiddlewareOptions): void;
}

export function createRBACMiddleware(
  initialRbac: RBACConfig,
  initialOptions: RBACMiddlewareOptions = {}
): UpdatableRBACMiddleware {
  let rbac = { ...initialRbac };
  let options = { ...initialOptions };

  const middleware = function requirePermission(permission: string): express.RequestHandler {
    return async (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      const user = (req as AuthenticatedRequest).user;
      if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const roles = user.roles && user.roles.length > 0 ? user.roles : [rbac.defaultRole];
      let allowedRbac = false;
      for (const roleName of roles) {
        const role = rbac.roles[roleName];
        if (!role) continue;
        if (role.permissions.includes('*') || role.permissions.includes(permission)) {
          allowedRbac = true;
          break;
        }
      }

      let allowed = allowedRbac;
      if (options.checkPermission) {
        try {
          const result = await options.checkPermission(user, permission, req);
          if (typeof result === 'boolean') {
            allowed = result;
          }
        } catch (err) {
          res.status(500).json({ error: 'Permission check failed' });
          return;
        }
      }

      if (!allowed) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      next();
    };
  } as UpdatableRBACMiddleware;

  middleware.update = (newRbac: RBACConfig, newOptions: RBACMiddlewareOptions = {}) => {
    rbac = { ...newRbac };
    options = { ...newOptions };
  };

  return middleware;
}
