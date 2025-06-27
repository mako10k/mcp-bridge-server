import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from '../../../src/auth/managers/session-manager';

describe('SessionManager', () => {
  let manager: SessionManager;
  beforeEach(() => {
    manager = new SessionManager(0.001); // 0.001分=0.06秒でTTLテスト
  });

  it('should create and retrieve a session', () => {
    const session = manager.createSession('user1', { foo: 'bar' });
    const found = manager.getSession(session.sessionId);
    expect(found).toBeDefined();
    expect(found?.userId).toBe('user1');
    expect(found?.data?.foo).toBe('bar');
  });

  it('should expire sessions after TTL', async () => {
    const session = manager.createSession('user2');
    await new Promise(r => setTimeout(r, 100));
    const found = manager.getSession(session.sessionId);
    expect(found).toBeUndefined();
  });

  it('should invalidate a session', () => {
    const session = manager.createSession('user3');
    manager.invalidateSession(session.sessionId);
    expect(manager.getSession(session.sessionId)).toBeUndefined();
  });

  it('should invalidate all sessions for a user', () => {
    const s1 = manager.createSession('user4');
    const s2 = manager.createSession('user4');
    manager.invalidateUserSessions('user4');
    expect(manager.getSession(s1.sessionId)).toBeUndefined();
    expect(manager.getSession(s2.sessionId)).toBeUndefined();
  });

  it('should cleanup expired sessions', async () => {
    const s1 = manager.createSession('user5');
    await new Promise(r => setTimeout(r, 100));
    manager.cleanupExpiredSessions();
    expect(manager.getSession(s1.sessionId)).toBeUndefined();
  });
});
