import type { APIRoute } from 'astro';
import { DEVICES, LIVEKIT_PUBLIC_URL } from 'astro:env/server';
import { parseDevices, verifyDevice } from '../../../lib/auth';
import { badRequest, keys, store, unauthorized } from '../../../lib/server';
import { deviceToken } from '../../../lib/tokens';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const deviceId = body?.deviceId;
  const deviceSecret = body?.deviceSecret;
  if (typeof deviceId !== 'string' || typeof deviceSecret !== 'string') return badRequest();

  const paired = await store.getDevice(deviceId);
  const candidates = [...parseDevices(DEVICES ?? '[]'), ...(paired ? [paired] : [])];
  if (!verifyDevice(candidates, deviceId, deviceSecret)) return unauthorized();
  if (paired?.removed) await store.putDevice({ ...paired, removed: false }); // removed on /headsets, back now

  const token = await deviceToken(keys, deviceId, paired?.name);
  return Response.json({ url: LIVEKIT_PUBLIC_URL, token });
};
