import type { APIRoute } from 'astro';
import { LIVEKIT_PUBLIC_URL } from 'astro:env/server';
import { deviceName } from '../../../lib/auth';
import { registerDevice } from '../../../lib/devices';
import { badRequest, isViewer, keys, store, unauthorized } from '../../../lib/server';
import { castingDevices } from '../../../lib/tokens';

export const prerender = false;

// Registered headsets for /headsets (without secrets), with whether they are casting right now.
export const GET: APIRoute = async ({ request }) => {
  if (!(await isViewer(request))) return unauthorized();
  const [devices, casting] = await Promise.all([store.listDevices(), castingDevices(keys, LIVEKIT_PUBLIC_URL)]);
  return Response.json(
    devices
      .map(({ deviceId, name, createdAt }) => ({ deviceId, name, createdAt, casting: casting.has(deviceId) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
};

// The setup script (app/setup.ps1) registers a headset or renews its credentials.
export const POST: APIRoute = async ({ request }) => {
  if (!(await isViewer(request))) return unauthorized();
  const body = await request.json().catch(() => null);
  const serial = body?.serial;
  const name = deviceName(body?.model, body?.name);
  if (typeof serial !== 'string' || !serial.trim() || serial.length > 64 || !name) return badRequest();
  return Response.json(await registerDevice(store, serial.trim(), name));
};
