import type { APIRoute } from 'astro';
import { LIVEKIT_PUBLIC_URL } from 'astro:env/server';
import { badRequest, keys, unauthorized, verifyHeadset } from '../../../lib/server';
import { deviceToken } from '../../../lib/tokens';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const deviceId = body?.deviceId;
  const deviceSecret = body?.deviceSecret;
  if (typeof deviceId !== 'string' || typeof deviceSecret !== 'string') return badRequest();

  const device = await verifyHeadset(deviceId, deviceSecret);
  if (!device) return unauthorized();

  const token = await deviceToken(keys, deviceId, device.name);
  return Response.json({ url: LIVEKIT_PUBLIC_URL, token });
};
