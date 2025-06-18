export interface QueryResult<T = any> {
  rows: T[];
}

export interface Database {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
}

import { UserSettingsStore } from './user-settings-store.js';

/**
 * Database-backed implementation of UserSettingsStore.
 */
export class DatabaseSettingsStore implements UserSettingsStore {
  constructor(private readonly db: Database) {}

  async getSettings(userId: string): Promise<string | null> {
    const result = await this.db.query<{ settings_json: string }>(
      'SELECT settings_json FROM user_settings WHERE user_id = ?',
      [userId]
    );
    return result.rows[0]?.settings_json ?? null;
  }

  async saveSettings(userId: string, encryptedSettings: string): Promise<void> {
    await this.db.query(
      `INSERT INTO user_settings (user_id, settings_json)
       VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         settings_json = excluded.settings_json,
         updated_at = CURRENT_TIMESTAMP,
         version = COALESCE(user_settings.version, 0) + 1`,
      [userId, encryptedSettings]
    );
  }

  async deleteSettings(userId: string): Promise<void> {
    await this.db.query('DELETE FROM user_settings WHERE user_id = ?', [userId]);
  }

  async listUsers(): Promise<string[]> {
    const result = await this.db.query<{ user_id: string }>(
      'SELECT user_id FROM user_settings ORDER BY created_at'
    );
    return result.rows.map((r) => r.user_id);
  }
}
