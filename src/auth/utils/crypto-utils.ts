import crypto from 'crypto';

export function generateRandomBytes(size = 32): Buffer {
  return crypto.randomBytes(size);
}

export function generateRandomString(size = 32): string {
  return generateRandomBytes(size).toString('hex');
}

export function hashSHA256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export interface EncryptedData {
  iv: string;
  tag: string;
  data: string;
}

export function encryptAESGCM(plaintext: string, key: string): EncryptedData {
  const iv = crypto.randomBytes(12);
  const keyBuf = crypto.createHash('sha256').update(key).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: enc.toString('hex')
  };
}

export function decryptAESGCM(encrypted: EncryptedData, key: string): string {
  const iv = Buffer.from(encrypted.iv, 'hex');
  const tag = Buffer.from(encrypted.tag, 'hex');
  const data = Buffer.from(encrypted.data, 'hex');
  const keyBuf = crypto.createHash('sha256').update(key).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}

export function generateKey(length = 32): string {
  return generateRandomBytes(length).toString('hex');
}
