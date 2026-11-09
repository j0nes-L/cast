import type { APIRoute } from 'astro';
import { LIVEKIT_PUBLIC_URL } from 'astro:env/server';
import { DEVICE_ID } from '../../../lib/auth';
import { badRequest, isViewer, keys, store, unauthorized } from '../../../lib/server';
import { removeDevice } from '../../../lib/tokens';

export const prerender = false;

// A signed-in viewer removes a headset: its credentials stop working and a running cast ends right away.
export const POST: APIRoute = async ({ request }) => {
  if (!(await isViewer(request))) return unauthorized();
  const body = await request.json().catch(() => null);
  const deviceId = body?.deviceId;
  if (typeof deviceId !== 'string' || !DEVICE_ID.test(deviceId)) return badRequest();
  if (!(await store.deleteDevice(deviceId))) return Response.json({ error: 'not found' }, { status: 404 });
  await removeDevice(keys, LIVEKIT_PUBLIC_URL, deviceId); // false when it was not casting
  return Response.json({ ok: true });
};
