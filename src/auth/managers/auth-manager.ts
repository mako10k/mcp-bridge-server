import { BaseProvider } from '../providers/base-provider.js';
import { PKCECodes, generatePKCECodes } from '../utils/pkce-utils.js';
import { OIDCTokenResponse, OIDCUserInfo } from '../types/oidc-types.js';

export interface LoginResult {
  url: string;
  pkce: PKCECodes;
}

export class AuthManager {
  private providers = new Map<string, BaseProvider>();

  registerProvider(provider: BaseProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: string): BaseProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Provider ${id} not registered`);
    }
    return provider;
  }

  beginLogin(providerId: string, state: string): LoginResult {
    const provider = this.getProvider(providerId);
    const pkce = generatePKCECodes();
    const url = provider.getAuthorizationUrl(state, pkce);
    return { url, pkce };
  }

  async handleCallback(
    providerId: string,
    code: string,
    pkce: PKCECodes
  ): Promise<OIDCTokenResponse> {
    const provider = this.getProvider(providerId);
    return provider.exchangeCode(code, pkce);
  }

  async getUserInfo(
    providerId: string,
    accessToken: string
  ): Promise<OIDCUserInfo | undefined> {
    const provider = this.getProvider(providerId);
    return provider.getUserInfo(accessToken);
  }
}
