export interface SessionData {
  pkce?: import('./utils/pkce-utils.js').PKCECodes;
  state?: string;
  providerId?: string;
  user?: import('./types/oidc-types.js').OIDCUserInfo;
  tokens?: import('./types/oidc-types.js').OIDCTokenResponse;
}

export class SessionStore {
  private store = new Map<string, SessionData>();

  get(sessionId: string): SessionData | undefined {
    return this.store.get(sessionId);
  }

  set(sessionId: string, data: SessionData): void {
    this.store.set(sessionId, data);
  }

  delete(sessionId: string): void {
    this.store.delete(sessionId);
  }
}

export const sessionStore = new SessionStore();
