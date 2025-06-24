import crypto from 'crypto';
import { logger } from '../../utils/logger.js';

/**
 * Generate random bytes
 * @param size number of bytes to generate
 */
export function generateRandomBytes(size = 32): Buffer {
  return crypto.randomBytes(size);
}

/**
 * Generate a random hexadecimal string
 * @param size number of bytes (default: 32)
 */
export function generateRandomString(size = 32): string {
  return generateRandomBytes(size).toString('hex');
}

/**
 * Generate SHA-256 hash of input
 * @param data input data to hash (string or Buffer)
 */
export function hashSHA256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a cryptographic key
 * @param length key length in bytes (default: 32)
 */
export function generateKey(length = 32): string {
  return generateRandomBytes(length).toString('hex');
}

// Modern AES-GCM encryption (recommended)
export interface EncryptedData {
  iv: string;
  tag: string;
  data: string;
}

/**
 * Encrypt plaintext using AES-256-GCM (recommended)
 * @param plaintext text to encrypt
 * @param key encryption key
 */
export function encryptAESGCM(plaintext: string, key: string): EncryptedData {
  try {
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
  } catch (err) {
    logger.error('AES-GCM encryption failed', err);
    throw err;
  }
}

/**
 * Decrypt data encrypted with AES-GCM
 * @param encrypted encrypted data object
 * @param key decryption key
 */
export function decryptAESGCM(encrypted: EncryptedData, key: string): string {
  try {
    const iv = Buffer.from(encrypted.iv, 'hex');
    const tag = Buffer.from(encrypted.tag, 'hex');
    const data = Buffer.from(encrypted.data, 'hex');
    const keyBuf = crypto.createHash('sha256').update(key).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return dec.toString('utf8');
  } catch (err) {
    logger.error('AES-GCM decryption failed', err);
    throw err;
  }
}

// Legacy AES-CBC encryption (for backward compatibility)
/**
 * Encrypt plaintext using AES-256-CBC (legacy)
 * Returns a string in the form iv:cipher
 * @param text text to encrypt
 * @param key encryption key
 */
export function encrypt(text: string, key: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const keyHash = crypto.createHash('sha256').update(key).digest();
    const cipher = crypto.createCipheriv('aes-256-cbc', keyHash, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (err) {
    logger.error('AES-CBC encryption failed', err);
    throw err;
  }
}

/**
 * Decrypt ciphertext produced by {@link encrypt} (legacy)
 * @param data encrypted data in iv:cipher format
 * @param key decryption key
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
    logger.error('AES-CBC decryption failed', err);
    throw err;
  }
}
