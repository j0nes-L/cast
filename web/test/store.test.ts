import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256Hex, verifyDevice } from '../src/lib/auth.ts';
import { registerDevice } from '../src/lib/devices.ts';
import { fileStore } from '../src/lib/store.ts';

const newStore = async () => fileStore(join(await mkdtemp(join(tmpdir(), 'cast-store-')), 'store.json'));

test('a new headset is stored under its name with a random ID', async () => {
  const store = await newStore();
  const device = await registerDevice(store, '2G0YC1ZF8G0CY3', 'Quest 3 - Empfang');
  assert.equal(device.name, 'Quest 3 - Empfang');
  assert.match(device.deviceId, /^[A-Z2-9]{6}$/);
  const stored = await store.getDevice(device.deviceId);
  assert.equal(stored?.name, 'Quest 3 - Empfang');
  assert.equal(stored?.serialSha256, sha256Hex('2G0YC1ZF8G0CY3'));
  assert.equal(verifyDevice([stored!], device.deviceId, device.deviceSecret), true);
});

test('setting up the same headset again keeps its ID, takes the new name and replaces the secret', async () => {
  const store = await newStore();
  const first = await registerDevice(store, 'SERIAL1', 'Quest 3 - Lab');
  const again = await registerDevice(store, 'SERIAL1', 'Quest 3 - Empfang');
  assert.equal(again.deviceId, first.deviceId);
  assert.equal(again.name, 'Quest 3 - Empfang');
  assert.notEqual(again.deviceSecret, first.deviceSecret);
  const stored = (await store.getDevice(first.deviceId))!;
  assert.equal(verifyDevice([stored], first.deviceId, first.deviceSecret), false);
  assert.equal(verifyDevice([stored], again.deviceId, again.deviceSecret), true);
  assert.equal((await store.listDevices()).length, 1);
});

test('different headsets get different devices', async () => {
  const store = await newStore();
  const a = await registerDevice(store, 'SERIAL1', 'Quest 3 - Lab');
  const b = await registerDevice(store, 'SERIAL2', 'Quest 3 - Lab');
  assert.notEqual(a.deviceId, b.deviceId);
  assert.equal((await store.listDevices()).length, 2);
});

test('a removed headset is gone and its credentials stop working', async () => {
  const store = await newStore();
  const device = await registerDevice(store, 'SERIAL1', 'Quest 3 - Lab');
  assert.equal(await store.deleteDevice(device.deviceId), true);
  assert.equal(await store.getDevice(device.deviceId), null);
  assert.equal((await store.listDevices()).length, 0);
  assert.equal(await store.deleteDevice(device.deviceId), false);
});
