# Cast

Shows in the browser what people wearing a Meta Quest see. Each headset casts its view with microphone and app sound; viewers sign in with a shared password. Cast can be set up as often as needed: every instance has its own website, streaming server and headsets, configured by parameters, and all use the same app from the Meta Horizon Store.

| Folder | Part | Docs |
|---|---|---|
| `app/` | Android app for the headset, and the setup script that prepares each headset once | [app/README.md](app/README.md) |
| `web/` | Website and token API (Astro on Vercel) | below |
| `server/` | LiveKit streaming server and its setup script | [server/README.md](server/README.md) |

The headset app and the browser both connect to the instance's LiveKit server. The website only hands out access tokens: headsets get one with their credentials from the setup script, viewers with the password.

## New instance

1. **Streaming server:** run `server/setup.sh --domain live.example.org --turn-domain turn.example.org` on a Linux host with Docker, then do what it lists (DNS, HTTPS site, firewall). Details: [server/README.md](server/README.md).
2. **Website:** a new Vercel project from this repo with `web` as root directory, the variables below (the LiveKit ones are in the server's `vercel.env`) and the Upstash Redis integration, then the domain, e.g. `cast.example.org`.
3. **Headsets:** install Cast, connect the headset over USB and set it up on the website's `/headsets` (Chrome or Edge), or run `app\setup.ps1 -Server https://cast.example.org -Name <name>`. Details: [app/README.md](app/README.md).

The running instance: website `cast.nwdl.org`, streaming server `live.nwdl.org` / `turn.nwdl.org` on `server.nwdl.org`.

## Website (`web/`)

| Page | |
|---|---|
| `/` | Live view, one tile per casting headset. Only the focused tile (or the only one) plays sound. Icon buttons per tile: focus, mute, fullscreen, end cast; a circle shows the connection (green good, yellow poor, red lost). |
| `/headsets` | Set up a headset connected over USB, right in the browser (WebUSB with Tango ADB, `src/lib/pair.ts`; Chrome or Edge). Registered headsets: green circle casting, yellow not casting, the date of setup. Removing takes a headset off the list and ends its cast; its credentials stay valid, so it shows up again when it casts or is set up again. |
| `/privacy` | Privacy policy in English and German with the instance's operator and servers (no sign-in; also linked from the Meta Horizon Store) |
| `/dev/test-publisher` | Development only: a fake headset with a test picture and beeps |

Style: minimal neo-brutalism (paper white, black ink, 2 px borders, hard shadows), Space Grotesk and Lucide icons, all served from the site itself; icons instead of words wherever an icon is clear, circles in green, yellow and red for status. The app uses the same look. Pages are in English and German: the flag in the side bar switches, otherwise the browser language decides. Texts live in `src/lib/i18n.ts`. If the app, the website or the servers start processing other data, update `/privacy` too.

| API | |
|---|---|
| `POST /api/token/viewer` | Password, or the "Stay signed in" cookie → viewer token |
| `POST /api/token/logout` | Deletes the "Stay signed in" cookie |
| `POST /api/token/device` | Headset credentials → token for casting |
| `GET /api/devices` | Registered headsets (viewer token) |
| `POST /api/devices` | Registers a headset or renews its credentials (viewer token, used by `app/setup.ps1`) |
| `POST /api/devices/remove` | Takes a headset off the list and ends its cast (viewer token) |
| `POST /api/cast/stop` | Ends the cast of a headset (viewer token) |

### Local development

```sh
cd web
npm install
cp .env.example .env                     # then fill in the instance values and VIEWER_PASSWORD_HASH:
npm run hash-password -- "<password>"
npm run dev                              # http://localhost:4321
npm test
```

LiveKit runs locally with `server/livekit-dev.ps1`; `.env.example` already matches it. Registered headsets are stored in `web/.data/store.json`. The test publisher needs a static device: `npm run new-device -- test01`, then add the printed entry to `DEVICES`.

### Deployment (Vercel)

One Vercel project per instance, with `web` as root directory and region `fra1` (`vercel.json`). The build fails while a required variable is missing.

| Variable | Value |
|---|---|
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_PUBLIC_URL` | From the streaming server's `vercel.env` (`server/setup.sh`) |
| `VIEWER_PASSWORD_HASH` | `npm run hash-password -- "<password>"` |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Set by the Upstash Redis integration (Vercel Marketplace, prefix `KV`) |
| `OPERATOR_NAME`, `OPERATOR_EMAIL` | Who runs this instance: controller on `/privacy` and contact for data requests |
| `OPERATOR_URL`, `LEGAL_URL` | Optional: the operator's website and legal notice, linked in the footer and on `/privacy` |
| `SERVER_PROVIDER`, `SERVER_COUNTRY` | Where the streaming server runs, e.g. `IONOS SE` and `DE` |
| `SIGNALLING_VIA_CLOUDFLARE` | `true` if the streaming server's domain is proxied by Cloudflare (named on `/privacy`) |
| `DEVICES` | Optional static devices, usually unset |

Changes to variables take effect after a redeploy. A new password also signs out everyone who chose "Stay signed in". Recommended: a Vercel firewall rate limit on paths starting with `/api/token/` (for example 20 requests per 60 s per IP, answer 429).
