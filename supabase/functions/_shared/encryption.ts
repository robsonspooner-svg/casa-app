// Field-level encryption utilities for sensitive data
// Mission 18: Security & Data Protection
// Uses Web Crypto API (available in Deno/Edge Functions)

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const TAG_LENGTH = 128;

// Derive encryption key from the ENCRYPTION_KEY env var
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyMaterial = Deno.env.get('DATA_ENCRYPTION_KEY');
  if (!keyMaterial) {
    throw new Error('DATA_ENCRYPTION_KEY environment variable not set');
  }

  // Import the base64-encoded key material
  const rawKey = Uint8Array.from(atob(keyMaterial), c => c.charCodeAt(0));

  // If key is exactly 32 bytes, use directly
  if (rawKey.length === 32) {
    return crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Otherwise, derive a key using PBKDF2
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(keyMaterial),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('casa-field-encryption-v1'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext string. Returns a base64-encoded string containing IV + ciphertext + tag.
 */
export async function encryptField(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    encoded
  );

  // Combine IV + ciphertext into a single buffer
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);

  // Encode as base64 with a prefix to identify encrypted values
  return 'enc:' + btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a base64-encoded encrypted string back to plaintext.
 */
export async function decryptField(encrypted: string): Promise<string> {
  if (!encrypted.startsWith('enc:')) {
    // Return as-is if not encrypted (allows gradual migration)
    return encrypted;
  }

  const key = await getEncryptionKey();
  const data = Uint8Array.from(atob(encrypted.slice(4)), c => c.charCodeAt(0));

  const iv = data.slice(0, IV_LENGTH);
  const ciphertext = data.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Check if a value is encrypted (has the enc: prefix)
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith('enc:');
}

/**
 * Mask a sensitive field for display (e.g., "****1234")
 */
export function maskField(value: string, visibleChars = 4): string {
  if (value.length <= visibleChars) {
    return '*'.repeat(value.length);
  }
  return '*'.repeat(value.length - visibleChars) + value.slice(-visibleChars);
}

/**
 * Mask an email address (e.g., "j***@example.com")
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return maskField(email);
  const maskedLocal = local.length <= 2
    ? '*'.repeat(local.length)
    : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  return `${maskedLocal}@${domain}`;
}

/**
 * Mask a phone number (e.g., "****567890")
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '*'.repeat(digits.length);
  return '*'.repeat(digits.length - 4) + digits.slice(-4);
}
