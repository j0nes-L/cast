# cast server (LiveKit)

LiveKit runs on `server.nwdl.org` (212.227.71.42) in `~/apps/cast`, next to the other apps on that server. The website and its token API run on Vercel (`web/`).

| Part | Where |
|---|---|
| Signalling and server API | `127.0.0.1:7880` → Apache/KeyHelp vhost `live.nwdl.org` → Cloudflare (proxied) → `wss://live.nwdl.org` |
| Media (WebRTC) | public IP: UDP 50000–60000, ICE over TCP 7881 |
| TURN | UDP 3478, relay ports UDP 40000–40999, `turn.nwdl.org` (Cloudflare "DNS only") |

TURN over TLS is not available: it would need port 443, which Apache uses. Clients behind strict firewalls fall back to ICE over TCP 7881.

## Files

- `docker-compose.prod.yml` → `~/apps/cast/docker-compose.yml`. It limits the LiveKit log (IP addresses, participant IDs) to 3 × 10 MB, as the privacy page says.
- `livekit.prod.example.yaml` → `~/apps/cast/livekit.yaml` (chmod 600) with the real API key and secret. They must match `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` on Vercel.
- `keyhelp-live.nwdl.org.conf`: individual HTTPS configuration of the KeyHelp domain `live.nwdl.org`

## One-time setup

1. **DNS (Cloudflare):** `live` A 212.227.71.42, proxied. `turn` A 212.227.71.42, **DNS only**.
2. **KeyHelp:** add the domain `live.nwdl.org` for `nwdl-user` with a Let's Encrypt certificate. As admin, under Domains → "Customize view" show subdomains, edit `live.nwdl.org` → Apache settings, and paste `keyhelp-live.nwdl.org.conf` into the HTTPS field. KeyHelp applies it within a few minutes; `https://live.nwdl.org` then answers "OK" instead of the KeyHelp default page.
3. **Firewall** (KeyHelp → Firewall, and the IONOS cloud panel if a policy is active): allow 7881/tcp, 3478/udp, 40000–40999/udp, 50000–60000/udp. Port 7880 stays closed.
   Saving the KeyHelp firewall drops Docker's iptables rules, and the containers lose outbound network (bots stop answering). `docker-after-keyhelp-firewall.path` / `.service` restart Docker automatically after each KeyHelp firewall change: copy both to `/etc/systemd/system`, then `sudo systemctl enable --now docker-after-keyhelp-firewall.path`. Without them, run `sudo systemctl restart docker`.
4. Copy the two files to `~/apps/cast` and start: `docker compose up -d`.

## Operation

```bash
cd ~/apps/cast
docker compose ps
docker compose logs -f
curl http://127.0.0.1:7880/       # "OK"
```

Update: change the image tag in `docker-compose.prod.yml`, copy it to the server, then `docker compose pull && docker compose up -d`.

## Troubleshooting

- Viewers see "The streaming server is not reachable": check `https://live.nwdl.org` (answers "OK"), the KeyHelp vhost and the Cloudflare record.
- Video stays black or connects slowly: the UDP ports are blocked. Check the firewall; `docker compose logs` shows the external IP LiveKit found.
- Local development uses `livekit-dev.ps1` instead (dev keys, no TLS).
