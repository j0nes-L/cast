import { defineConfig, envField } from 'astro/config';
import vercel from '@astrojs/vercel';

const secret = (optional = false) => envField.string({ context: 'server', access: 'secret', optional });
// Not secret, read at build time: set them per instance (Vercel project) and redeploy after a change
const setting = (optional = false) => envField.string({ context: 'server', access: 'public', optional });

export default defineConfig({
  adapter: vercel(),
  // IPv4 loopback, so that a headset reaches the dev server through adb reverse
  server: { host: '127.0.0.1' },
  env: {
    schema: {
      LIVEKIT_API_KEY: secret(),
      LIVEKIT_API_SECRET: secret(),
      LIVEKIT_PUBLIC_URL: setting(), // wss://… of this instance's streaming server, also named on /privacy
      VIEWER_PASSWORD_HASH: secret(),
      // Static devices, e.g. the test publisher's; headsets registered by app/setup.ps1 live in the store
      DEVICES: secret(true),
      // Upstash Redis (Vercel Marketplace) for registered headsets; without it a local file is used in development
      KV_REST_API_URL: secret(true),
      KV_REST_API_TOKEN: secret(true),

      // Operator of this instance: controller on /privacy and in the footer
      OPERATOR_NAME: setting(),
      OPERATOR_EMAIL: setting(),
      OPERATOR_URL: setting(true),
      LEGAL_URL: setting(true),
      // Where the streaming server runs (server/setup.sh), for /privacy
      SERVER_PROVIDER: setting(), // e.g. "Hetzner Online GmbH"
      SERVER_COUNTRY: setting(), // ISO 3166 code, e.g. "DE"
      SIGNALLING_VIA_CLOUDFLARE: envField.boolean({ context: 'server', access: 'public', default: false }),
    },
  },
});
