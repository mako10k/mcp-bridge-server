import crypto from 'crypto';
import { logger } from '../../utils/logger.js';

/**
 * Generate a random hexadecimal string.
 * @param length number of bytes
 */
export function generateRandomString(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate SHA-256 hash of input.
 */
export function hashSHA256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Encrypt plaintext using AES-256-CBC. Returns a string in the form iv:cipher.
 */
export function encrypt(text: string, key: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const keyHash = crypto.createHash('sha256').update(key).digest();
    const cipher = crypto.createCipheriv('aes-256-cbc', keyHash, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (err) {
    logger.error('Encryption failed', err);
    throw err;
  }
}

/**
 * Decrypt ciphertext produced by {@link encrypt}.
 */
export function decrypt(data: string, key: string): string {
  try {
    const [ivHex, encryptedHex] = data.split(':');
    if (!ivHex || !encryptedHex) {
      throw new Error('Invalid encrypted data format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const keyHash = crypto.createHash('sha256').update(key).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyHash, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    logger.error('Decryption failed', err);
    throw err;
  }
}
