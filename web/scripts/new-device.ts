import { randomBytes } from 'node:crypto';
import { DEVICE_ID, sha256Hex } from '../src/lib/auth.ts';

const deviceId = process.argv[2] ?? '';
if (!DEVICE_ID.test(deviceId)) {
  console.error('Usage: npm run new-device -- <deviceId>   (letters, digits, _ and -)');
  process.exit(1);
}
const deviceSecret = randomBytes(32).toString('base64url');
console.log('cast.json for the headset (/sdcard/Android/data/dev.jonasludorf.cast/files/):');
console.log(JSON.stringify({ deviceId, deviceSecret }, null, 2));
console.log('\nEntry for the DEVICES array:');
console.log(JSON.stringify({ deviceId, secretSha256: sha256Hex(deviceSecret) }));
