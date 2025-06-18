import { BaseProvider, OAuthProviderConfig } from './base-provider.js';
import { PKCECodes } from '../utils/pkce-utils.js';
import { OIDCProviderMetadata, OIDCUserInfo } from '../types/oidc-types.js';

export interface AzureProviderConfig extends OAuthProviderConfig {
  tenantId: string;
}

/**
 * Microsoft Azure AD OAuth2 provider implementation.
 */
export class AzureProvider extends BaseProvider {
  private readonly tenantId: string;

  constructor(config: AzureProviderConfig) {
    const metadata: OIDCProviderMetadata = {
      issuer: `https://login.microsoftonline.com/${config.tenantId}/v2.0`,
      authorizationEndpoint: `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize`,
      tokenEndpoint: `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
      userInfoEndpoint: 'https://graph.microsoft.com/oidc/userinfo',
      jwksUri: `https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`
    };
    super('azure', metadata, config);
    this.tenantId = config.tenantId;
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
      sub: data.sub || data.id,
      name: data.name || data.displayName,
      email: data.email || data.userPrincipalName || data.mail,
      picture: data.picture
    };
  }
}
