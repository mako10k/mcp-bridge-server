import { BaseProvider, OAuthProviderConfig } from './base-provider.js';
import { PKCECodes } from '../utils/pkce-utils.js';
import { OIDCProviderMetadata, OIDCUserInfo } from '../types/oidc-types.js';

/**
 * Google OAuth2 provider implementation.
 */
export class GoogleProvider extends BaseProvider {
  constructor(config: OAuthProviderConfig) {
    const metadata: OIDCProviderMetadata = {
      issuer: 'https://accounts.google.com',
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
      jwksUri: 'https://www.googleapis.com/oauth2/v3/certs'
    };
    super('google', metadata, config);
  }

  getAuthorizationUrl(state: string, pkce: PKCECodes): string {
    const url = new URL(this.metadata.authorizationEndpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('scope', this.config.scope || 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', pkce.codeChallenge);
    url.searchParams.set('code_challenge_method', pkce.method);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    return url.toString();
  }

  async getUserInfo(accessToken: string): Promise<OIDCUserInfo | undefined> {
    if (!this.metadata.userInfoEndpoint) return undefined;
    const res = await fetch(this.metadata.userInfoEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch user info: ${res.status}`);
    }
    const data: any = await res.json();
    return {
      sub: data.sub,
      name: data.name,
      email: data.email,
      picture: data.picture
    };
  }
}
