import { OIDCProviderMetadata, OIDCTokenResponse, OIDCUserInfo } from '../types/oidc-types.js';
import { PKCECodes } from '../utils/pkce-utils.js';
import { logger } from '../../utils/logger.js';

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string;
}

export abstract class BaseProvider {
  constructor(
    public readonly id: string,
    protected readonly metadata: OIDCProviderMetadata,
    protected readonly config: OAuthProviderConfig
  ) {}

  abstract getAuthorizationUrl(state: string, pkce: PKCECodes): string;

  protected async requestToken(params: Record<string, string>): Promise<OIDCTokenResponse> {
    const body = new URLSearchParams(params).toString();
    const res = await fetch(this.metadata.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error(`Token request failed: ${res.status} ${text}`);
      throw new Error(`Token request failed with status ${res.status}`);
    }

    return res.json() as Promise<OIDCTokenResponse>;
  }

  async exchangeCode(code: string, pkce: PKCECodes): Promise<OIDCTokenResponse> {
    const params = {
      grant_type: 'authorization_code',
      code,
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      code_verifier: pkce.codeVerifier
    };
    return this.requestToken(params);
  }

  async refreshToken(refreshToken: string): Promise<OIDCTokenResponse> {
    const params = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId
    };
    return this.requestToken(params);
  }

  abstract getUserInfo(accessToken: string): Promise<OIDCUserInfo | undefined>;
}
