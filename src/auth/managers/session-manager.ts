// SessionManager: Handles session lifecycle, lookup, and expiration for authenticated users.
// See docs/mcp-lifecycle-detailed-design.md for integration details.

import { v4 as uuidv4 } from 'uuid';

export interface SessionInfo {
  sessionId: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  data?: Record<string, any>;
}

export class SessionManager {
  private sessions: Map<string, SessionInfo> = new Map();
  private defaultTtlMs: number;

  constructor(defaultTtlMinutes = 60) {
    this.defaultTtlMs = defaultTtlMinutes * 60 * 1000;
  }

  createSession(userId: string, data?: Record<string, any>): SessionInfo {
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.defaultTtlMs);
    const session: SessionInfo = { sessionId, userId, createdAt: now, expiresAt, data };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): SessionInfo | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    if (session.expiresAt < new Date()) {
      this.sessions.delete(sessionId);
      return undefined;
    }
    return session;
  }

  invalidateSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  invalidateUserSessions(userId: string): void {
    for (const [sid, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(sid);
      }
    }
  }

  cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [sid, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sid);
      }
    }
  }
}
