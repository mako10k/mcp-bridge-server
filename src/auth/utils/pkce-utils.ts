import crypto from 'crypto';

export interface PKCECodes {
  codeVerifier: string;
  codeChallenge: string;
  method: 'S256';
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function generateCodeVerifier(length = 128): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const random = crypto.randomBytes(length);
  let verifier = '';
  for (const byte of random) {
    verifier += charset[byte % charset.length];
  }
  return verifier;
}

export function generateCodeChallenge(codeVerifier: string): string {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  return base64UrlEncode(hash);
}

export function generatePKCECodes(length = 64): PKCECodes {
  const codeVerifier = generateCodeVerifier(length);
  const codeChallenge = generateCodeChallenge(codeVerifier);
  return { codeVerifier, codeChallenge, method: 'S256' };
}

export function verifyCodeChallenge(codeVerifier: string, expectedChallenge: string): boolean {
  const actual = generateCodeChallenge(codeVerifier);
  return actual === expectedChallenge;
}
