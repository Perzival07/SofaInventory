/**
 * Encryption for stored credentials.
 *
 * Rules this module exists to enforce:
 *   - a secret is encrypted before it touches the database;
 *   - a stored secret is never returned to the browser in full, only masked;
 *   - tampering with the ciphertext is detected rather than silently decrypting
 *     to garbage (hence GCM, which authenticates as well as encrypts).
 *
 * The master key comes from APP_SECRET. Without it nothing is stored, because
 * writing credentials in plaintext would be worse than not offering the feature.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

export class MissingAppSecretError extends Error {
  constructor() {
    super(
      "APP_SECRET is not set. Credentials cannot be stored securely without it."
    );
    this.name = "MissingAppSecretError";
  }
}

export function hasAppSecret(): boolean {
  return Boolean(process.env.APP_SECRET && process.env.APP_SECRET.length >= 32);
}

function deriveKey(salt: Buffer): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) throw new MissingAppSecretError();
  // scrypt is deliberately slow, so a leaked database is expensive to attack.
  return scryptSync(secret, salt, KEY_LENGTH);
}

/**
 * Encrypt to a self-contained string: salt.iv.tag.ciphertext, base64url.
 * Every value gets its own salt and IV, so identical keys stored twice do not
 * produce identical ciphertext.
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) throw new Error("Nothing to encrypt");

  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(salt);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [salt, iv, tag, ciphertext].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4) throw new Error("Malformed encrypted value");

  const [salt, iv, tag, ciphertext] = parts.map((p) => Buffer.from(p, "base64url"));
  const key = deriveKey(salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  // Throws if the ciphertext or tag has been altered.
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * What the UI is allowed to see: enough to recognise which key is stored,
 * never enough to use it.
 */
export function maskSecret(plaintext: string): string {
  if (!plaintext) return "";
  if (plaintext.length <= 8) return "•".repeat(plaintext.length);

  // Keep a recognisable prefix plus the last four. Real provider keys namespace
  // across up to three underscore-separated words before the random part, so
  // match that many — but cap the length so the mask never reveals much.
  const prefixMatch = plaintext.match(/^((?:[A-Za-z]{2,8}[_-]){1,3})/);
  const prefix = prefixMatch && prefixMatch[1].length <= 12 ? prefixMatch[1] : "";
  const last4 = plaintext.slice(-4);
  const hiddenCount = Math.max(4, plaintext.length - prefix.length - 4);

  return `${prefix}${"•".repeat(Math.min(hiddenCount, 24))}${last4}`;
}

/** Constant-time comparison, for verifying a value without leaking timing. */
export function secretsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** A cryptographically strong APP_SECRET the owner can paste into Vercel. */
export function generateAppSecret(): string {
  return randomBytes(32).toString("base64url");
}
