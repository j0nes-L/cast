import { createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEYLEN = 64;

export const DEVICE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export type Device = { deviceId: string; secretSha256: string };

// No 0/O, 1/I/L, so that the code can be read off and typed without mix-ups
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Random 6-character device ID of a headset, e.g. "K7M2QX". */
export function deviceCode(): string {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

const cleanText = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max) : '';

/**
 * "<model> - <label>", e.g. "Quest 3 - Empfang": the model comes from the headset, the label is typed in the setup
 * script. Empty when the label has nothing usable left after cleaning.
 */
export function deviceName(model: unknown, label: unknown): string {
  const cleanLabel = cleanText(label, 32);
  return cleanLabel && `${cleanText(model, 24) || 'Quest'} - ${cleanLabel}`;
}

// Format scrypt:<saltHex>:<hashHex>. ':' instead of '$', because .env loaders expand '$'.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEYLEN);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex ?? '', 'hex');
  if (scheme !== 'scrypt' || !saltHex || expected.length !== KEYLEN) {
    throw new Error('VIEWER_PASSWORD_HASH has an invalid format, create it with npm run hash-password');
  }
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), KEYLEN);
  return timingSafeEqual(actual, expected);
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function parseDevices(json: string): Device[] {
  const devices = JSON.parse(json);
  const valid = Array.isArray(devices) && devices.every(
    (d) => DEVICE_ID.test(d?.deviceId) && /^[0-9a-f]{64}$/.test(d?.secretSha256),
  );
  if (!valid) throw new Error('DEVICES must be a JSON array of { deviceId, secretSha256 }');
  return devices;
}

export function verifyDevice(devices: Device[], deviceId: string, deviceSecret: string): boolean {
  const device = devices.find((d) => d.deviceId === deviceId);
  if (!device) return false;
  return timingSafeEqual(Buffer.from(sha256Hex(deviceSecret), 'hex'), Buffer.from(device.secretSha256, 'hex'));
}

const hmac = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('base64url');
const passwordTag = (passwordHash: string) => sha256Hex(passwordHash).slice(0, 16);

/** "Stay signed in" cookie value: signed, valid for [days] or until the viewer password changes. */
export function rememberToken(secret: string, passwordHash: string, days = 30, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ exp: now + days * 86_400_000, pw: passwordTag(passwordHash) })).toString('base64url');
  return `${payload}.${hmac(secret, payload)}`;
}

export function isRememberToken(secret: string, passwordHash: string, value: string, now = Date.now()): boolean {
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return false;
  const expected = Buffer.from(hmac(secret, payload));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
  try {
    const { exp, pw } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return exp > now && pw === passwordTag(passwordHash);
  } catch {
    return false;
  }
}
