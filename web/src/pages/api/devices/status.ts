import type { APIRoute } from 'astro';
import { badRequest, unauthorized, verifyHeadset } from '../../../lib/server';

export const prerender = false;

// The headset asks in standby whether it is still registered; 401 once it was removed on /headsets.
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const deviceId = body?.deviceId;
  const deviceSecret = body?.deviceSecret;
  if (typeof deviceId !== 'string' || typeof deviceSecret !== 'string') return badRequest();
  return (await verifyHeadset(deviceId, deviceSecret)) ? Response.json({ ok: true }) : unauthorized();
};
