import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEVICE_ID, deviceCode, deviceName, hashPassword, isRememberToken, parseDevices, rememberToken, sha256Hex, verifyDevice, verifyPassword } from '../src/lib/auth.ts';

test('password hash round trip', async () => {
  const hash = await hashPassword('correct horse');
  assert.match(hash, /^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.equal(await verifyPassword('correct horse', hash), true);
  assert.equal(await verifyPassword('wrong', hash), false);
});

test('a malformed password hash throws instead of letting anyone in', async () => {
  await assert.rejects(verifyPassword('x', ''));
  await assert.rejects(verifyPassword('x', 'scrypt$abc$def'));
});

test('device check', () => {
  const devices = parseDevices(JSON.stringify([{ deviceId: 'quest01', secretSha256: sha256Hex('s3cret') }]));
  assert.equal(verifyDevice(devices, 'quest01', 's3cret'), true);
  assert.equal(verifyDevice(devices, 'quest01', 'wrong'), false);
  assert.equal(verifyDevice(devices, 'unknown', 's3cret'), false);
});

test('invalid DEVICES config throws', () => {
  assert.throws(() => parseDevices('{}'));
  assert.throws(() => parseDevices('[{"deviceId":"quest01"}]'));
  assert.throws(() => parseDevices(JSON.stringify([{ deviceId: 'bad id', secretSha256: sha256Hex('x') }])));
});

test('stay-signed-in token: valid until expiry or password change, not forgeable', async () => {
  const hash = await hashPassword('dev');
  const token = rememberToken('secret', hash, 30);
  assert.equal(isRememberToken('secret', hash, token), true);
  assert.equal(isRememberToken('other-secret', hash, token), false);
  assert.equal(isRememberToken('secret', await hashPassword('new password'), token), false);
  assert.equal(isRememberToken('secret', hash, token, Date.now() + 31 * 86_400_000), false);
  const [payload] = token.split('.');
  assert.equal(isRememberToken('secret', hash, `${payload}.forged`), false);
  assert.equal(isRememberToken('secret', hash, ''), false);
});

test('headset IDs are readable random codes', () => {
  const code = deviceCode();
  assert.match(code, /^[A-HJKMNP-Z2-9]{6}$/);
  assert.equal(DEVICE_ID.test(code), true);
});

test('headset names: model plus the typed label', () => {
  assert.equal(deviceName('Quest 3', 'Empfang'), 'Quest 3 - Empfang');
  assert.equal(deviceName('Quest 3', '  Raum   Süd 2 '), 'Quest 3 - Raum Süd 2');
  assert.equal(deviceName('Quest 3', "Jonas' Brille"), "Quest 3 - Jonas' Brille");
  assert.equal(deviceName('Quest 3S<script>', '<b>Lab</b>'), 'Quest 3Sscript - bLabb');
  assert.equal(deviceName(undefined, 'Lab'), 'Quest - Lab');
  assert.equal(deviceName('x'.repeat(100), 'y'.repeat(100)), `${'x'.repeat(24)} - ${'y'.repeat(32)}`);
  assert.equal(deviceName('Quest 3', '<>'), '');
  assert.equal(deviceName('Quest 3', undefined), '');
});
