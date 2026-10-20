import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const VERSION = 'v1';

// AES-256-GCM for secrets that must be shown again (temporary passwords). Format: v1:iv:tag:data.
export class SecretBox {
  private readonly key: Buffer;

  // Key: CREDENTIALS_ENCRYPTION_KEY, else derived from the JWT secret (rotating it makes old values unreadable).
  constructor(configuredKey: string, fallbackSecret: string) {
    if (configuredKey) {
      this.key = Buffer.from(configuredKey, 'base64');
      if (this.key.length !== 32) {
        throw new Error(
          'CREDENTIALS_ENCRYPTION_KEY must be 32 bytes, base64-encoded. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
        );
      }
    } else {
      this.key = createHash('sha256').update(`ttc-credentials:${fallbackSecret}`).digest();
    }
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [VERSION, iv, cipher.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64'))).join(':');
  }

  /** null if malformed, tampered with, or written under another key. */
  decrypt(payload: string): string | null {
    try {
      const [version, iv, tag, data] = payload.split(':');
      if (version !== VERSION || !iv || !tag || !data) return null;
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }
}
