// ─── AES-256-GCM Encryption for sensitive fields ─────────────────────
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt plaintext using AES-256-GCM.
 * @param text - plaintext to encrypt
 * @param keyHex - 64 hex chars (32 bytes) encryption key
 * @returns "iv:tag:ciphertext" hex string
 */
export function encrypt(text: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt AES-256-GCM encrypted string.
 * @param encoded - "iv:tag:ciphertext" hex string
 * @param keyHex - 64 hex chars (32 bytes) encryption key
 * @returns decrypted plaintext
 */
export function decrypt(encoded: string, keyHex: string): string {
  const parts = encoded.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const [ivHex, tagHex, encryptedHex] = parts;
  const key = Buffer.from(keyHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex!, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex!, 'hex'));
  return decipher.update(Buffer.from(encryptedHex!, 'hex')) + decipher.final('utf8');
}
