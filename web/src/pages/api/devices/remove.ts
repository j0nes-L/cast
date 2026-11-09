import type { APIRoute } from 'astro';
import { LIVEKIT_PUBLIC_URL } from 'astro:env/server';
import { DEVICE_ID } from '../../../lib/auth';
import { badRequest, isViewer, keys, store, unauthorized } from '../../../lib/server';
import { removeDevice } from '../../../lib/tokens';

export const prerender = false;

// A signed-in viewer removes a headset from /headsets and ends its cast. Its credentials stay valid, so that it
// shows up again when it casts again (the headset is never asked, which would cost a request per minute).
export const POST: APIRoute = async ({ request }) => {
  if (!(await isViewer(request))) return unauthorized();
  const body = await request.json().catch(() => null);
  const deviceId = body?.deviceId;
  if (typeof deviceId !== 'string' || !DEVICE_ID.test(deviceId)) return badRequest();
  const device = await store.getDevice(deviceId);
  if (!device) return Response.json({ error: 'not found' }, { status: 404 });
  await store.putDevice({ ...device, removed: true });
  await removeDevice(keys, LIVEKIT_PUBLIC_URL, deviceId); // false when it was not casting
  return Response.json({ ok: true });
};
