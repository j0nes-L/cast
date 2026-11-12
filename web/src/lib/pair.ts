// Sets up a headset over ADB, as app/setup.ps1 does: registers it with this website, puts its credentials on it,
// allows capture without the share dialog and starts the app. In the browser the ADB connection runs over WebUSB.
import type { Adb } from '@yume-chan/adb';

export const APP_PACKAGE = 'dev.jonasludorf.cast';

export type Credentials = { deviceId: string; deviceSecret: string; name: string };

export class AppMissingError extends Error {}

/** [register] gets serial number and model and returns the credentials from POST /api/devices. */
export async function setUpHeadset(
  adb: Adb,
  serial: string,
  server: string,
  register: (serial: string, model: string) => Promise<Credentials>,
): Promise<Credentials> {
  const shell = (command: string) => adb.subprocess.noneProtocol.spawnWaitText(command);
  if (!(await shell(`pm path ${APP_PACKAGE}`)).includes('package:')) throw new AppMissingError();
  const model = (await shell('getprop ro.product.model')).trim();
  const credentials = await register(serial, model);

  // The app moves the file into its private storage and deletes it
  const folder = `/sdcard/Android/data/${APP_PACKAGE}/files`;
  await shell(`mkdir -p ${folder}`);
  const bytes = new TextEncoder().encode(JSON.stringify({ server, ...credentials }));
  const sync = await adb.sync();
  try {
    await sync.write({
      filename: `${folder}/cast.json`,
      file: new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
    });
  } finally {
    await sync.dispose();
  }

  for (const command of [
    `pm grant ${APP_PACKAGE} android.permission.RECORD_AUDIO`,
    `pm grant ${APP_PACKAGE} android.permission.POST_NOTIFICATIONS`,
    `appops set ${APP_PACKAGE} PROJECT_MEDIA allow`, // screen capture without the share dialog
    `am force-stop ${APP_PACKAGE}`,
    `am start -n ${APP_PACKAGE}/.MainActivity`,
  ]) {
    await shell(command);
  }
  return credentials;
}
