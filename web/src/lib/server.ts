// Shared server-side setup for the API routes: LiveKit keys, device store, viewer check.
import { DEVICES, KV_REST_API_TOKEN, KV_REST_API_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } from 'astro:env/server';
import { parseDevices, verifyDevice } from './auth';
import { fileStore, redisStore, type Store } from './store';
import { isViewerToken } from './tokens';

export const keys = { apiKey: LIVEKIT_API_KEY, apiSecret: LIVEKIT_API_SECRET };

export const REMEMBER_COOKIE = 'cast_remember';

function createStore(): Store {
  if (KV_REST_API_URL && KV_REST_API_TOKEN) return redisStore(KV_REST_API_URL, KV_REST_API_TOKEN);
  if (import.meta.env.PROD) throw new Error('KV_REST_API_URL and KV_REST_API_TOKEN are required in production');
  return fileStore('.data/store.json');
}

export const store = createStore();

/** Checks a headset's credentials against the static DEVICES and the registered headsets; null if they are wrong. */
export async function verifyHeadset(deviceId: string, deviceSecret: string): Promise<{ name?: string } | null> {
  const stored = await store.getDevice(deviceId);
  const candidates = [...parseDevices(DEVICES ?? '[]'), ...(stored ? [stored] : [])];
  return verifyDevice(candidates, deviceId, deviceSecret) ? { name: stored?.name } : null;
}

/** True if the request carries the token of a signed-in viewer (Authorization: Bearer <token>). */
export function isViewer(request: Request): Promise<boolean> {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  // shortcut: this is the viewer's join token (1 h); after that the viewer has to reload the page
  return isViewerToken(keys, token);
}

export const unauthorized = () => Response.json({ error: 'unauthorized' }, { status: 401 });
export const badRequest = () => Response.json({ error: 'bad request' }, { status: 400 });
