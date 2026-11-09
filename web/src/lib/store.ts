import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type StoredDevice = { deviceId: string; name: string; secretSha256: string; serialSha256: string; createdAt: string };

/** Registered headsets. */
export interface Store {
  listDevices(): Promise<StoredDevice[]>;
  getDevice(deviceId: string): Promise<StoredDevice | null>;
  putDevice(device: StoredDevice): Promise<void>;
  /** False if there was no such headset. */
  deleteDevice(deviceId: string): Promise<boolean>;
}

/** Upstash Redis over its REST API (Vercel Marketplace), no client library needed. */
export function redisStore(url: string, token: string): Store {
  const call = async (...command: (string | number)[]) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(command),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) throw new Error(`Redis ${command[0]} failed: ${body.error ?? res.status}`);
    return body.result;
  };
  return {
    async listDevices() {
      const flat: string[] = (await call('HGETALL', 'devices')) ?? []; // [field, value, field, value, …]
      return flat.filter((_, i) => i % 2 === 1).map((value) => JSON.parse(value));
    },
    async getDevice(deviceId) {
      const value = await call('HGET', 'devices', deviceId);
      return value ? JSON.parse(value) : null;
    },
    async putDevice(device) {
      await call('HSET', 'devices', device.deviceId, JSON.stringify(device));
    },
    async deleteDevice(deviceId) {
      return (await call('HDEL', 'devices', deviceId)) === 1;
    },
  };
}

/** A JSON file, for local development only: Vercel has no writable file system. */
export function fileStore(path: string): Store {
  type Data = { devices: Record<string, StoredDevice> };
  const load = async (): Promise<Data> => {
    try {
      return { devices: {}, ...JSON.parse(await readFile(path, 'utf8')) };
    } catch {
      return { devices: {} };
    }
  };
  const save = async (data: Data) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(data, null, 2));
  };
  return {
    async listDevices() {
      return Object.values((await load()).devices);
    },
    async getDevice(deviceId) {
      return (await load()).devices[deviceId] ?? null;
    },
    async putDevice(device) {
      const data = await load();
      data.devices[device.deviceId] = device;
      await save(data);
    },
    async deleteDevice(deviceId) {
      const data = await load();
      if (!data.devices[deviceId]) return false;
      delete data.devices[deviceId];
      await save(data);
      return true;
    },
  };
}
