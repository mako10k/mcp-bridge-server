/**
 * @fileoverview Authentication route handlers for OIDC/OAuth2 providers
 * Implements login, callback, logout, and user info endpoints
 */

import express from 'express';
import { AuthManager, LoginResult } from '../auth/managers/auth-manager.js';
import { PKCECodes } from '../auth/utils/pkce-utils.js';
import { OIDCTokenResponse, OIDCUserInfo } from '../auth/types/oidc-types.js';
import { logger } from '../utils/logger.js';

export interface AuthRouteContext {
  authManager: AuthManager;
}

export interface AuthRequest extends express.Request {
  user?: OIDCUserInfo;
  sessionId?: string;
}

interface SessionData {
  pkce?: PKCECodes;
  state?: string;
  providerId?: string;
  user?: OIDCUserInfo;
  tokens?: OIDCTokenResponse;
}

// Store PKCE codes temporarily (in production, use Redis or database)
const sessionStore = new Map<string, SessionData>();

/**
 * Generate a simple session ID (in production, use proper session middleware)
 */
function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * GET /auth/login/:provider
 * Initiate OAuth2/OIDC login flow
 */
export const loginHandler = (context: AuthRouteContext) =>
  (req: express.Request, res: express.Response): void => {
    try {
      const { provider } = req.params;
      const sessionId = generateSessionId();
      const state = `${sessionId}_${Date.now()}`;

      logger.info(`Starting login flow for provider: ${provider}, session: ${sessionId}`);

      const loginResult: LoginResult = context.authManager.beginLogin(provider, state);
      
      // Store PKCE codes and session data
      sessionStore.set(sessionId, {
        pkce: loginResult.pkce,
        state,
        providerId: provider
      });

      // Set session cookie
      res.cookie('session_id', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 10 * 60 * 1000 // 10 minutes
      });

      res.json({
        authUrl: loginResult.url,
        sessionId
      });

    } catch (error) {
      logger.error('Login initiation failed:', error);
      res.status(500).json({ 
        error: 'Failed to initiate login',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

/**
 * GET /auth/callback/:provider
 * Handle OAuth2/OIDC callback
 */
export const callbackHandler = (context: AuthRouteContext) =>
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { provider } = req.params;
      const { code, state, error: oauthError } = req.query;

      if (oauthError) {
        logger.error(`OAuth error for provider ${provider}:`, oauthError);
        res.status(400).json({ 
          error: 'Authentication failed', 
          details: oauthError 
        });
        return;
      }

      if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
        res.status(400).json({ error: 'Missing code or state parameter' });
        return;
      }

      // Extract session ID from state
      const sessionId = state.split('_')[0];
      const sessionData = sessionStore.get(sessionId);

      if (!sessionData || sessionData.state !== state || sessionData.providerId !== provider) {
        logger.warn(`Invalid session or state for callback: ${sessionId}`);
        res.status(400).json({ error: 'Invalid session or state' });
        return;
      }

      if (!sessionData.pkce) {
        res.status(400).json({ error: 'Missing PKCE data' });
        return;
      }

      logger.info(`Processing callback for provider: ${provider}, session: ${sessionId}`);

      // Exchange authorization code for tokens
      const tokens: OIDCTokenResponse = await context.authManager.handleCallback(
        provider,
        code,
        sessionData.pkce
      );

      // Get user information
      const userInfo: OIDCUserInfo | undefined = await context.authManager.getUserInfo(
        provider,
        tokens.access_token
      );

      if (!userInfo) {
        res.status(500).json({ error: 'Failed to retrieve user information' });
        return;
      }

      // Update session with user info and tokens
      sessionData.user = userInfo;
      sessionData.tokens = tokens;
      sessionStore.set(sessionId, sessionData);

      logger.info(`User authenticated successfully: ${userInfo.email || userInfo.sub} via ${provider}`);

      // Redirect to admin UI or send success response
      const redirectUrl = req.query.redirect_uri as string || '/admin';
      res.redirect(`${redirectUrl}?auth=success&session=${sessionId}`);

    } catch (error) {
      logger.error('Authentication callback failed:', error);
      res.status(500).json({ 
        error: 'Authentication failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

/**
 * GET /auth/user
 * Get current user information
 */
export const getUserInfoHandler = (context: AuthRouteContext) =>
  (req: express.Request, res: express.Response): void => {
    try {
      const sessionId = req.cookies?.session_id || req.headers.authorization?.replace('Bearer ', '');

      if (!sessionId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const sessionData = sessionStore.get(sessionId);
      if (!sessionData || !sessionData.user) {
        res.status(401).json({ error: 'Invalid session' });
        return;
      }

      res.json({
        user: sessionData.user,
        provider: sessionData.providerId,
        authenticated: true
      });

    } catch (error) {
      logger.error('User info retrieval failed:', error);
      res.status(500).json({ 
        error: 'Failed to retrieve user information',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

/**
 * GET /auth/status
 * Check authentication status
 */
export const getStatusHandler = (context: AuthRouteContext) =>
  (req: express.Request, res: express.Response): void => {
    try {
      const sessionId = req.cookies?.session_id;

      if (!sessionId) {
        res.json({ authenticated: false });
        return;
      }

      const sessionData = sessionStore.get(sessionId);
      const authenticated = !!(sessionData && sessionData.user);

      res.json({
        authenticated,
        provider: authenticated ? sessionData!.providerId : undefined,
        user: authenticated ? {
          email: sessionData!.user!.email,
          name: sessionData!.user!.name,
          picture: sessionData!.user!.picture
        } : undefined
      });

    } catch (error) {
      logger.error('Status check failed:', error);
      res.json({ authenticated: false });
    }
  };

/**
 * POST /auth/logout
 * Logout user and clear session
 */
export const logoutHandler = (context: AuthRouteContext) =>
  (req: express.Request, res: express.Response): void => {
    try {
      const sessionId = req.cookies?.session_id;

      if (sessionId) {
        const sessionData = sessionStore.get(sessionId);
        if (sessionData && sessionData.user) {
          logger.info(`User logged out: ${sessionData.user.email || sessionData.user.sub}`);
        }
        sessionStore.delete(sessionId);
      }

      res.clearCookie('session_id');
      res.json({ success: true, message: 'Logged out successfully' });

    } catch (error) {
      logger.error('Logout failed:', error);
      res.status(500).json({ 
        error: 'Logout failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
export const refreshTokenHandler = (context: AuthRouteContext) =>
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const sessionId = req.cookies?.session_id;

      if (!sessionId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const sessionData = sessionStore.get(sessionId);
      if (!sessionData || !sessionData.tokens?.refresh_token) {
        res.status(401).json({ error: 'No refresh token available' });
        return;
      }

      const tokens = await context.authManager.refreshAccessToken(
        sessionData.providerId!,
        sessionData.tokens.refresh_token
      );
      sessionData.tokens = tokens;
      sessionStore.set(sessionId, sessionData);

      res.json({ tokens });

    } catch (error) {
      logger.error('Token refresh failed:', error);
      res.status(500).json({ 
        error: 'Token refresh failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

/**
 * Register authentication routes
 */
export const registerAuthRoutes = (
  app: express.Application,
  context: AuthRouteContext
): void => {
  app.get('/auth/login/:provider', loginHandler(context) as express.RequestHandler);
  app.get('/auth/callback/:provider', callbackHandler(context) as express.RequestHandler);
  app.get('/auth/user', getUserInfoHandler(context) as express.RequestHandler);
  app.get('/auth/status', getStatusHandler(context) as express.RequestHandler);
  app.post('/auth/logout', logoutHandler(context) as express.RequestHandler);
  app.post('/auth/refresh', refreshTokenHandler(context) as express.RequestHandler);
};
