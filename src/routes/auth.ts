import express from 'express';
import crypto from 'crypto';
import { AuthManager } from '../auth/managers/auth-manager.js';
import { logger } from '../utils/logger.js';
import { PKCECodes } from '../auth/utils/pkce-utils.js';

export interface AuthRouteContext {
  authManager: AuthManager;
}

// In-memory store for PKCE codes per state
const pkceStore = new Map<string, PKCECodes>();

export const loginHandler = (context: AuthRouteContext): express.RequestHandler =>
  (req: express.Request, res: express.Response) => {
    try {
      const { provider } = req.params;
      const state = crypto.randomUUID();
      const result = context.authManager.beginLogin(provider, state);
      pkceStore.set(state, result.pkce);
      res.json({ url: result.url, state });
      return;
    } catch (error) {
      logger.error('Login initiation failed:', error);
      res.status(500).json({ error: 'Login failed' });
      return;
    }
  };

export const callbackHandler = (context: AuthRouteContext): express.RequestHandler =>
  async (req: express.Request, res: express.Response) => {
    const { provider } = req.params;
    const { code, state } = req.query;
    if (typeof code !== 'string' || typeof state !== 'string') {
      res.status(400).json({ error: 'Missing code or state' });
      return;
    }
    const pkce = pkceStore.get(state);
    if (!pkce) {
      res.status(400).json({ error: 'Invalid state' });
      return;
    }
    try {
      const tokens = await context.authManager.handleCallback(provider, code, pkce);
      pkceStore.delete(state);
      res.json(tokens);
      } catch (error) {
        logger.error('Callback processing failed:', error);
        res.status(500).json({ error: 'Callback failed' });
      }
    };

export const logoutHandler: express.RequestHandler = (_req, res) => {
  // Stateless logout placeholder
  res.json({ success: true });
};

export const userInfoHandler = (context: AuthRouteContext): express.RequestHandler =>
  async (req: express.Request, res: express.Response) => {
    const { provider } = req.query;
    let token = req.query.token as string | undefined;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring('Bearer '.length);
    }
    if (typeof provider !== 'string' || !token) {
      res.status(400).json({ error: 'Missing provider or token' });
      return;
    }
    try {
      const info = await context.authManager.getUserInfo(provider, token);
      res.json(info ?? {});
      return;
    } catch (error) {
      logger.error('Failed to get user info:', error);
      res.status(500).json({ error: 'Failed to get user info' });
      return;
    }
  };

export const registerAuthRoutes = (
  app: express.Application,
  context: AuthRouteContext
): void => {
  app.get('/auth/login/:provider', loginHandler(context));
  app.get('/auth/callback/:provider', callbackHandler(context));
  app.post('/auth/logout', logoutHandler);
  app.get('/auth/user', userInfoHandler(context));
};
