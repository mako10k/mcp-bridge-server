export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  provider: string;
  roles: string[];
}

export interface AuthSession {
  sessionId: string;
  userId: string;
  issuedAt: number;
  expiresAt: number;
}

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: number;
}
