import crypto from 'crypto';
import { UserSettings } from '../config/user-config-manager.js';

/**
 * Provides simple AES-256-CBC encryption for user settings using a shared key.
 */
export class SettingsEncryption {
  private encryptionKey: string;

  constructor() {
    this.encryptionKey = process.env.SETTINGS_ENCRYPTION_KEY || this.generateKey();
  }

  private generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async encryptSettings(settings: UserSettings): Promise<string> {
    const plaintext = JSON.stringify(settings);
    const key = Buffer.from(this.encryptionKey, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  async decryptSettings(encryptedSettings: string): Promise<UserSettings> {
    const [ivHex, dataHex] = encryptedSettings.split(':');
    const key = Buffer.from(this.encryptionKey, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8')) as UserSettings;
  }
}
