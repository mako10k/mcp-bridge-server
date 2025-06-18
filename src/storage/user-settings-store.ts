import fs from 'fs/promises';
import path from 'path';

/** Interface for persisting encrypted user settings. */
export interface UserSettingsStore {
  getSettings(userId: string): Promise<string | null>;
  saveSettings(userId: string, encryptedSettings: string): Promise<void>;
  deleteSettings(userId: string): Promise<void>;
  listUsers(): Promise<string[]>;
}

/** File-based implementation used for default persistence. */
export class FileBasedSettingsStore implements UserSettingsStore {
  constructor(private storageDir: string = './user-settings') {
    this.ensureStorageDir();
  }

  async getSettings(userId: string): Promise<string | null> {
    const filePath = this.getUserSettingsPath(userId);
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error: any) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async saveSettings(userId: string, encryptedSettings: string): Promise<void> {
    const filePath = this.getUserSettingsPath(userId);
    const tempPath = `${filePath}.tmp`;
    try {
      await fs.writeFile(tempPath, encryptedSettings, 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      try {
        await fs.unlink(tempPath);
      } catch {
        /* ignore */
      }
      throw error;
    }
  }

  async deleteSettings(userId: string): Promise<void> {
    const filePath = this.getUserSettingsPath(userId);
    await fs.unlink(filePath);
  }

  async listUsers(): Promise<string[]> {
    const files = await fs.readdir(this.storageDir);
    return files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
  }

  private getUserSettingsPath(userId: string): string {
    const safeUserId = userId.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.storageDir, `${safeUserId}.json`);
  }

  private async ensureStorageDir(): Promise<void> {
    await fs.mkdir(this.storageDir, { recursive: true }).catch(() => undefined);
  }
}
