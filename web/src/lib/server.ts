// Shared server-side setup for the API routes: LiveKit keys, device store, viewer check.
import { KV_REST_API_TOKEN, KV_REST_API_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } from 'astro:env/server';
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

/** True if the request carries the token of a signed-in viewer (Authorization: Bearer <token>). */
export function isViewer(request: Request): Promise<boolean> {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  // shortcut: this is the viewer's join token (1 h); after that the viewer has to reload the page
  return isViewerToken(keys, token);
}

export const unauthorized = () => Response.json({ error: 'unauthorized' }, { status: 401 });
export const badRequest = () => Response.json({ error: 'bad request' }, { status: 400 });
