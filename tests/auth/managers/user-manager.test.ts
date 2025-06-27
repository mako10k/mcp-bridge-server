import { describe, it, expect, beforeEach } from 'vitest';
import { UserManager } from '../../../src/auth/managers/user-manager';

describe('UserManager', () => {
  let manager: UserManager;
  beforeEach(() => {
    manager = new UserManager();
  });

  it('should create and retrieve a user', () => {
    const user = manager.createUser('u1', 'test@example.com', ['admin']);
    const found = manager.getUser('u1');
    expect(found).toBeDefined();
    expect(found?.email).toBe('test@example.com');
    expect(found?.roles).toContain('admin');
  });

  it('should update user roles', () => {
    manager.createUser('u2', 'a@b.com', ['viewer']);
    const updated = manager.updateUserRoles('u2', ['editor', 'admin']);
    expect(updated).toBe(true);
    const found = manager.getUser('u2');
    expect(found?.roles).toEqual(['editor', 'admin']);
  });

  it('should set last login date', () => {
    manager.createUser('u3', 'c@d.com');
    manager.setLastLogin('u3');
    const found = manager.getUser('u3');
    expect(found?.lastLogin).toBeInstanceOf(Date);
  });

  it('should list all users', () => {
    manager.createUser('u4', 'x@y.com');
    manager.createUser('u5', 'y@z.com');
    const users = manager.listUsers();
    expect(users.length).toBe(2);
    expect(users.map(u => u.userId)).toContain('u4');
    expect(users.map(u => u.userId)).toContain('u5');
  });
});
