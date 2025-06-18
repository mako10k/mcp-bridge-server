import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { UserConfigManager } from '../../src/config/user-config-manager.js';
import { MCPLifecycleManager } from '../../src/mcp/lifecycle/mcp-lifecycle-manager.js';
import { ConfigTemplateEngine } from '../../src/config/config-template-engine.js';
import { ConfigValidator, AuthContext } from '../../src/config/config-validation.js';
import { FileBasedSettingsStore } from '../../src/storage/user-settings-store.js';
import { SettingsEncryption } from '../../src/storage/settings-encryption.js';

function createManager(tmpDir: string): UserConfigManager {
  return new UserConfigManager({
    templateEngine: new ConfigTemplateEngine(new ConfigValidator(), path.resolve('src/config/templates')),
    settingsStore: new FileBasedSettingsStore(tmpDir),
    validator: new ConfigValidator(),
    encryptor: new SettingsEncryption()
  });
}

test('user settings persist and generate config', async () => {
  const dir = await fs.mkdtemp(path.join(process.cwd(), 'usettings-'));
  const manager = createManager(dir);
  const ctx: AuthContext = { userId: 'u1', roles: ['user'] };

  const updated = await manager.updateUserSettings('u1', {
    serverSettings: {
      'user-filesystem': {
        templateId: 'user-filesystem',
        enabled: true,
        customization: { maxFileSize: 2097152 },
        lastModified: new Date(),
        version: 1
      }
    }
  }, ctx);

  assert(updated.serverSettings['user-filesystem']);
  const loaded = await manager.getUserSettings('u1');
  assert.equal(
    loaded.serverSettings['user-filesystem'].customization.maxFileSize,
    2097152
  );

  const configs = await manager.generateMCPConfig('u1', ctx);
  assert.equal(configs.length, 0);

  const lifecycle = MCPLifecycleManager.getInstance();
  lifecycle.stopCleanupTask();
  lifecycle.stopMonitoring();
});
