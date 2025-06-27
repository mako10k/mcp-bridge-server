import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction, Application } from 'express';
import { UserConfigManager } from '../../src/config/user-config-manager';
import { registerUserConfigRoutes, AuthenticatedRequest } from '../../src/routes/user-config';

// Mock user and auth middleware
const mockUser = { id: 'user-1', email: 'user@example.com' };
const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  req.user = mockUser as any;
  next();
};
const requirePermission = () => (req: Request, res: Response, next: NextFunction) => next();

// Setup Express app with user config routes
function createApp(): Application {
  const app = express();
  app.use(express.json());
  const userConfigManager = new UserConfigManager();
  registerUserConfigRoutes(app, { userConfigManager }, { requireAuth, requirePermission });
  return app;
}

describe('UserConfig API', () => {
  let app: Application;
  beforeAll(() => {
    app = createApp();
  });

  it('should return user settings for authenticated user', async () => {
    const res = await request(app).get('/user-config/settings');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('settings');
  });

  it('should update user settings', async () => {
    const res = await request(app)
      .put('/user-config/settings')
      .send({ settings: { theme: 'dark' } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.settings).toHaveProperty('theme', 'dark');
  });

  it('should return 401 if not authenticated', async () => {
    // Remove auth middleware for this test
    const appNoAuth: Application = express();
    appNoAuth.use(express.json());
    const userConfigManager = new UserConfigManager();
    registerUserConfigRoutes(appNoAuth, { userConfigManager }, { requireAuth: (req: Request, res: Response, next: NextFunction) => next(), requirePermission });
    const res = await request(appNoAuth).get('/user-config/settings');
    expect(res.status).toBe(401);
  });
});
