import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSettingsStore, Database, QueryResult } from '../../src/storage/user-settings-store.js';

class MockDatabase implements Database {
  private data = new Map<string, { settings_json: string; created_at: number; version: number }>();

  async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    if (sql.startsWith('SELECT settings_json')) {
      const userId = params[0];
      const record = this.data.get(userId);
      return { rows: record ? [{ settings_json: record.settings_json }] as T[] : [] };
    }
    if (sql.startsWith('INSERT INTO user_settings')) {
      const [userId, json] = params as [string, string];
      const existing = this.data.get(userId);
      this.data.set(userId, { settings_json: json, created_at: Date.now(), version: (existing?.version ?? 0) + 1 });
      return { rows: [] };
    }
    if (sql.startsWith('DELETE FROM user_settings')) {
      const userId = params[0];
      this.data.delete(userId);
      return { rows: [] };
    }
    if (sql.startsWith('SELECT user_id FROM user_settings')) {
      const rows = Array.from(this.data.keys()).sort().map(id => ({ user_id: id }));
      return { rows: rows as T[] };
    }
    throw new Error('Unsupported query: ' + sql);
  }
}

test('database settings store CRUD', async () => {
  const db = new MockDatabase();
  const store = new DatabaseSettingsStore(db);
  const userId = 'user1';

  const first = await store.getSettings(userId);
  assert.equal(first, null);

  await store.saveSettings(userId, '{"a":1}');
  assert.equal(await store.getSettings(userId), '{"a":1}');

  const users = await store.listUsers();
  assert.deepEqual(users, [userId]);

  await store.deleteSettings(userId);
  assert.equal(await store.getSettings(userId), null);
});
