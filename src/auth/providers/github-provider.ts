import { BaseProvider, OAuthProviderConfig } from './base-provider.js';
import { PKCECodes } from '../utils/pkce-utils.js';
import { OIDCProviderMetadata, OIDCUserInfo, OIDCTokenResponse } from '../types/oidc-types.js';
import { logger } from '../../utils/logger.js';

/**
 * GitHub OAuth2 provider implementation.
 */
export class GitHubProvider extends BaseProvider {
  constructor(config: OAuthProviderConfig) {
    const metadata: OIDCProviderMetadata = {
      issuer: 'https://github.com',
      authorizationEndpoint: 'https://github.com/login/oauth/authorize',
      tokenEndpoint: 'https://github.com/login/oauth/access_token',
      userInfoEndpoint: 'https://api.github.com/user',
      jwksUri: '' // GitHub does not provide JWKS for OAuth apps
    };
    super('github', metadata, config);
  }

  getAuthorizationUrl(state: string, pkce: PKCECodes): string {
    const url = new URL(this.metadata.authorizationEndpoint);
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    if (this.config.scope) url.searchParams.set('scope', this.config.scope);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', pkce.codeChallenge);
    url.searchParams.set('code_challenge_method', pkce.method);
    return url.toString();
  }

  protected async requestToken(params: Record<string, string>): Promise<OIDCTokenResponse> {
    const body = new URLSearchParams(params).toString();
    const res = await fetch(this.metadata.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error(`Token request failed: ${res.status} ${text}`);
      throw new Error(`Token request failed with status ${res.status}`);
    }

    return res.json() as Promise<OIDCTokenResponse>;
  }

  async getUserInfo(accessToken: string): Promise<OIDCUserInfo | undefined> {
    if (!this.metadata.userInfoEndpoint) return undefined;
    const res = await fetch(this.metadata.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch user info: ${res.status}`);
    }
    const data: any = await res.json();
    return {
      sub: data.id?.toString(),
      name: data.name || data.login,
      email: data.email,
      picture: data.avatar_url
    };
  }
}
