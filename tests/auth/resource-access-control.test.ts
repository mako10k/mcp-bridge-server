import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ResourceAccessControl } from '../../src/auth/permissions/resource-access-control.js';
import { AuthenticatedUser } from '../../src/auth/context/auth-context.js';

class TestAccess extends ResourceAccessControl {
  constructor(private instanceOwner: string | null) { super(); }
  protected async getServerInstance(_id: string) {
    return this.instanceOwner ? { userId: this.instanceOwner } : null;
  }
}

function makeUser(id: string, roles: string[] = []): AuthenticatedUser {
  return { id, roles, sessionId: 's1', email: `${id}@ex`, name: id } as AuthenticatedUser;
}

test('user can access own user_config', async () => {
  const ac = new TestAccess(null);
  const user = makeUser('u1');
  assert.equal(await ac.checkAccess(user, 'read', 'user_config', 'u1'), true);
});

test('user cannot access other user_config', async () => {
  const ac = new TestAccess(null);
  const user = makeUser('u1');
  assert.equal(await ac.checkAccess(user, 'read', 'user_config', 'u2'), false);
});

test('admin can access any user_config', async () => {
  const ac = new TestAccess(null);
  const user = makeUser('u1', ['admin']);
  assert.equal(await ac.checkAccess(user, 'read', 'user_config', 'u2'), true);
});

test('user can access owned server instance', async () => {
  const ac = new TestAccess('u1');
  const user = makeUser('u1');
  assert.equal(await ac.checkAccess(user, 'read', 'server_instance', 'i1'), true);
});

test('user cannot access unowned server instance', async () => {
  const ac = new TestAccess('u2');
  const user = makeUser('u1');
  assert.equal(await ac.checkAccess(user, 'read', 'server_instance', 'i1'), false);
});
