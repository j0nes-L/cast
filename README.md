# Cast

Shows in the browser what people wearing a Meta Quest see, at `https://cast.nwdl.org`. Each headset casts its view with microphone and app sound; viewers sign in with a shared password.

| Folder | Part | Docs |
|---|---|---|
| `app/` | Android app for the headset, and the setup script that prepares each headset once | [app/README.md](app/README.md) |
| `web/` | Website and token API (Astro on Vercel) | below |
| `server/` | LiveKit media server on `server.nwdl.org` | [server/README.md](server/README.md) |

The headset app and the browser both connect to LiveKit (`wss://live.nwdl.org`). The website only hands out access tokens: headsets get one with their credentials from the setup script, viewers with the password.

## Website (`web/`)

| Page | |
|---|---|
| `/` | Live view, one tile per casting headset. Only the focused tile (or the only one) plays sound. Buttons per tile: focus, mute, fullscreen, end cast. |
| `/headsets` | Registered headsets and whether they are casting. "Remove" takes a headset off the list and ends its cast. Its credentials stay valid: it shows up again when it casts or is set up again. |
| `/codes` | The QR codes that start and stop casting when held in front of a headset in standby, one at a time and as large as the screen allows: swipe, or the arrows and arrow keys (no sign-in) |
| `/privacy` | Privacy policy in English and German (no sign-in; also linked from the Meta Horizon Store) |
| `/dev/test-publisher` | Development only: a fake headset with a test picture and beeps |

The pages follow the style of newworkdesignlab.org (Inter and Playfair Display, served from the site itself, Lucide icons) and are in English and German: the flag in the side bar switches, otherwise the browser language decides. Texts live in `src/lib/i18n.ts`. If the app, the website or the servers start processing other data, update `/privacy` too.

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
cp .env.example .env                     # then set VIEWER_PASSWORD_HASH:
npm run hash-password -- "<password>"
npm run dev                              # http://localhost:4321
npm test
```

LiveKit runs locally with `server/livekit-dev.ps1`; `.env.example` already matches it. Registered headsets are stored in `web/.data/store.json`. The test publisher needs a static device: `npm run new-device -- test01`, then add the printed entry to `DEVICES`.

### Deployment (Vercel)

The Vercel project uses `web` as root directory, region `fra1` (`vercel.json`) and the domain `cast.nwdl.org`.

| Variable | Value |
|---|---|
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Same as in `livekit.yaml` on the server |
| `LIVEKIT_PUBLIC_URL` | `wss://live.nwdl.org` |
| `VIEWER_PASSWORD_HASH` | `npm run hash-password -- "<password>"` |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Set by the Upstash Redis integration (Vercel Marketplace, prefix `KV`) |
| `DEVICES` | Optional static devices, usually unset |

Changes to variables take effect after a redeploy. A new password also signs out everyone who chose "Stay signed in". Recommended: a Vercel firewall rate limit on paths starting with `/api/token/` (for example 20 requests per 60 s per IP, answer 429).
