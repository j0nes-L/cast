import { randomBytes } from 'node:crypto';
import { deviceCode, sha256Hex } from './auth.ts';
import type { Store } from './store.ts';

/**
 * Registers a headset from the setup script under [name] (see deviceName). The serial number identifies it: setting
 * it up again keeps its ID, takes the new name and replaces the secret, so old credentials stop working.
 */
export async function registerDevice(store: Store, serial: string, name: string) {
  const serialSha256 = sha256Hex(serial);
  const existing = (await store.listDevices()).find((d) => d.serialSha256 === serialSha256);
  let deviceId = existing?.deviceId ?? deviceCode();
  while (!existing && (await store.getDevice(deviceId))) deviceId = deviceCode();

  const deviceSecret = randomBytes(32).toString('base64url');
  await store.putDevice({
    deviceId,
    name,
    secretSha256: sha256Hex(deviceSecret),
    serialSha256,
    createdAt: new Date().toISOString(),
  });
  return { deviceId, deviceSecret, name };
}
