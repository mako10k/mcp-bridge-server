export interface OIDCProviderMetadata {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint?: string;
  jwksUri: string;
}

export interface OIDCAuthCodePayload {
  code: string;
  state?: string;
}

export interface OIDCTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

export interface OIDCUserInfo {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
  roles?: string[];
}
