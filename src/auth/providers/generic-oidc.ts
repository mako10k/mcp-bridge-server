import { BaseProvider, OAuthProviderConfig } from './base-provider.js';
import { OIDCProviderMetadata, OIDCUserInfo } from '../types/oidc-types.js';
import { PKCECodes } from '../utils/pkce-utils.js';
import { logger } from '../../utils/logger.js';

export interface GenericOIDCConfig extends OAuthProviderConfig {
  issuer: string;
  discovery?: boolean;
  metadata?: Partial<OIDCProviderMetadata>;
}

/**
 * Generic OIDC provider which uses OpenID Connect Discovery if enabled.
 */
export class GenericOIDCProvider extends BaseProvider {
  private static async fetchMetadata(issuer: string): Promise<OIDCProviderMetadata> {
    const url = issuer.replace(/\/$/, '') + '/.well-known/openid-configuration';
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch OIDC metadata: ${res.status}`);
    }
    const data = (await res.json()) as any;
    return {
      issuer: data.issuer,
      authorizationEndpoint: data.authorization_endpoint,
      tokenEndpoint: data.token_endpoint,
      userInfoEndpoint: data.userinfo_endpoint,
      jwksUri: data.jwks_uri
    };
  }

  constructor(private readonly options: GenericOIDCConfig) {
    super(
      'generic-oidc',
      {
        issuer: options.issuer,
        authorizationEndpoint: options.metadata?.authorizationEndpoint || '',
        tokenEndpoint: options.metadata?.tokenEndpoint || '',
        userInfoEndpoint: options.metadata?.userInfoEndpoint || '',
        jwksUri: options.metadata?.jwksUri || ''
      },
      options
    );
  }

  async init(): Promise<void> {
    if (this.options.discovery) {
      logger.info(`Fetching OIDC discovery metadata from ${this.options.issuer}`);
      const meta = await GenericOIDCProvider.fetchMetadata(this.options.issuer);
      this.metadata.authorizationEndpoint = meta.authorizationEndpoint;
      this.metadata.tokenEndpoint = meta.tokenEndpoint;
      this.metadata.userInfoEndpoint = meta.userInfoEndpoint;
      this.metadata.jwksUri = meta.jwksUri;
    }
  }

  getAuthorizationUrl(state: string, pkce: PKCECodes): string {
    const url = new URL(this.metadata.authorizationEndpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', this.options.clientId);
    url.searchParams.set('redirect_uri', this.options.redirectUri);
    url.searchParams.set('scope', this.options.scope || 'openid profile email');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', pkce.codeChallenge);
    url.searchParams.set('code_challenge_method', pkce.method);
    return url.toString();
  }

  async getUserInfo(accessToken: string): Promise<OIDCUserInfo | undefined> {
    if (!this.metadata.userInfoEndpoint) return undefined;
    const res = await fetch(this.metadata.userInfoEndpoint, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch user info: ${res.status}`);
    }
    return res.json() as Promise<OIDCUserInfo>;
  }
}
