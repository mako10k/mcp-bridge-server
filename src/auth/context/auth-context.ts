import crypto from "crypto";
import express from 'express';
import { MCPInstanceContext } from '../../mcp/lifecycle/types.js';
import { OIDCUserInfo } from '../types/oidc-types.js';

export interface AuthenticatedUser extends OIDCUserInfo {
  id: string;
  roles: string[];
  sessionId: string;
}

export class AuthContextManager {
  extractContext(req: express.Request): MCPInstanceContext {
    const user = (req as any).user as AuthenticatedUser | undefined;
    return {
      lifecycleMode: 'user',
      userId: user?.id,
      userEmail: user?.email,
      sessionId: (req as any).sessionID,
      authInfo: user,
      requestId:
        (req.headers['x-request-id'] as string) || crypto.randomUUID(),
      timestamp: new Date()
    };
  }
}
