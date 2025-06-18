import express from 'express';
import { UserConfigManager } from '../config/user-config-manager.js';
import { ValidationError, SecurityError, AuthContext } from '../config/config-validation.js';

export interface UserConfigRouteContext {
  userConfigManager: UserConfigManager;
}

export interface AuthenticatedRequest extends express.Request {
  user?: { id: string; email?: string };
  authContext?: AuthContext;
}

export const getTemplatesHandler = (context: UserConfigRouteContext) =>
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const authCtx = req.authContext || { userId: req.user?.id };
      const templates = await context.userConfigManager.getAvailableTemplates(authCtx);
      res.json({ success: true, data: { templates } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

export const getUserSettingsHandler = (context: UserConfigRouteContext) =>
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
      const settings = await context.userConfigManager.getUserSettings(userId);
      res.json({ success: true, data: { settings } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

export const updateUserSettingsHandler = (context: UserConfigRouteContext) =>
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
      const authCtx = req.authContext || { userId };
      const { settings } = req.body;
      const updated = await context.userConfigManager.updateUserSettings(userId, settings, authCtx);
      res.json({ success: true, data: { settings: updated }, message: 'Settings updated successfully' });
    } catch (error: any) {
      if (error instanceof ValidationError) {
        res.status(400).json({ success: false, error: error.message, type: 'validation_error' });
      } else if (error instanceof SecurityError) {
        res.status(403).json({ success: false, error: error.message, type: 'security_error' });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };

export const updateServerSettingsHandler = (context: UserConfigRouteContext) =>
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
      const { templateId } = req.params;
      const { enabled, customization } = req.body;
      const authCtx = req.authContext || { userId };
      const current = await context.userConfigManager.getUserSettings(userId);
      const updated = await context.userConfigManager.updateUserSettings(
        userId,
        {
          serverSettings: {
            ...current.serverSettings,
            [templateId]: {
              templateId,
              enabled: enabled !== undefined ? enabled : true,
              customization: customization || {},
              lastModified: new Date(),
              version: (current.serverSettings[templateId]?.version || 0) + 1
            }
          }
        },
        authCtx
      );
      res.json({ success: true, data: { settings: updated }, message: `Server ${templateId} settings updated` });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

export const toggleServerHandler = (context: UserConfigRouteContext) =>
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
      const { templateId } = req.params;
      const { enabled } = req.body;
      const authCtx = req.authContext || { userId };
      const current = await context.userConfigManager.getUserSettings(userId);
      const serverSettings = current.serverSettings[templateId];
      if (!serverSettings) return res.status(404).json({ success: false, error: 'Server settings not found' });
      const updated = await context.userConfigManager.updateUserSettings(
        userId,
        {
          serverSettings: {
            ...current.serverSettings,
            [templateId]: {
              ...serverSettings,
              enabled,
              lastModified: new Date(),
              version: serverSettings.version + 1
            }
          }
        },
        authCtx
      );
      res.json({ success: true, data: { enabled }, message: `Server ${templateId} ${enabled ? 'enabled' : 'disabled'}` });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

export const previewConfigHandler = (context: UserConfigRouteContext) =>
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
      const authCtx = req.authContext || { userId };
      const configs = await context.userConfigManager.generateMCPConfig(userId, authCtx);
      res.json({ success: true, data: { configs } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

export const resetServerSettingsHandler = (context: UserConfigRouteContext) =>
  async (req: AuthenticatedRequest, res: express.Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });
      const { templateId } = req.params;
      const authCtx = req.authContext || { userId };
      const current = await context.userConfigManager.getUserSettings(userId);
      const { [templateId]: removed, ...remaining } = current.serverSettings;
      const updated = await context.userConfigManager.updateUserSettings(
        userId,
        { serverSettings: remaining },
        authCtx
      );
      res.json({ success: true, data: { settings: updated }, message: `Server ${templateId} settings reset` });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

export const registerUserConfigRoutes = (
  app: express.Application,
  context: UserConfigRouteContext
): void => {
  app.get('/user-config/templates', getTemplatesHandler(context) as express.RequestHandler);
  app.get('/user-config/settings', getUserSettingsHandler(context) as express.RequestHandler);
  app.put('/user-config/settings', updateUserSettingsHandler(context) as express.RequestHandler);
  app.put('/user-config/settings/:templateId', updateServerSettingsHandler(context) as express.RequestHandler);
  app.patch('/user-config/settings/:templateId/toggle', toggleServerHandler(context) as express.RequestHandler);
  app.get('/user-config/preview', previewConfigHandler(context) as express.RequestHandler);
  app.delete('/user-config/settings/:templateId', resetServerSettingsHandler(context) as express.RequestHandler);
};

