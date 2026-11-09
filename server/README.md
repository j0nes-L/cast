# Cast server (LiveKit)

Each Cast instance has its own streaming server: LiveKit in Docker, set up by `setup.sh`. Several instances can share one Linux host when they use different ports. The website and its token API run on Vercel (`web/`), one project per instance.

| Part | Where |
|---|---|
| Signalling and server API | `127.0.0.1:<http-port>` → HTTPS reverse proxy → `wss://<domain>` (a proxy such as Cloudflare is fine) |
| Media (WebRTC) | public IP: UDP `<udp-ports>`, ICE over TCP `<tcp-port>` |
| TURN | UDP `<turn-port>`, relay ports UDP `<relay-ports>`, `<turn-domain>` without a proxy |

TURN over TLS is not set up: it would need port 443, which the web server uses. Clients behind strict firewalls fall back to ICE over TCP.

## New instance

Copy `setup.sh` to the server (needs Docker with Compose, `openssl`, `curl`) and run it:

```bash
./setup.sh --domain live.example.org --turn-domain turn.example.org            # instance "cast" in ~/apps/cast
./setup.sh --name second --domain live.second.org --turn-domain turn.second.org \
  --http-port 7890 --tcp-port 7891 --udp-ports 61000-61999 --turn-port 3479 --relay-ports 41000-41999
```

| Option | Default |
|---|---|
| `--name` | `cast` (container `<name>-livekit`) |
| `--dir` | `~/apps/<name>` |
| `--domain`, `--turn-domain` | required for a new instance |
| `--http-port`, `--tcp-port`, `--turn-port` | `7880`, `7881`, `3478` |
| `--udp-ports`, `--relay-ports` | `50000-60000`, `40000-40999` |
| `--image` | `livekit/livekit-server:v1.13.11` |
| `--dry-run` | write the files only |

The script writes into the instance folder (chmod 700): `livekit.yaml` with a new API key and secret, `docker-compose.yml` (log limited to 3 × 10 MB, as the privacy page says), `apache-vhost.conf`, `vercel.env` and `instance.conf`, and starts the container. It then lists what is left: DNS, the HTTPS site of the domain, the firewall ports and the variables for Vercel (`vercel.env`).

Update or change an instance: run the script again with the same `--name` (or `--dir`). Settings from the last run (`instance.conf`) and the API key are kept; only options given on the command line change, for example `--image livekit/livekit-server:<new tag>`. Docker only restarts the container when its configuration changes.

## server.nwdl.org

The instance `cast` (cast.nwdl.org) runs on `server.nwdl.org` (212.227.71.42, Ubuntu with KeyHelp) with the defaults, the script at `~/apps/cast-setup.sh`:

```bash
~/apps/cast-setup.sh --domain live.nwdl.org --turn-domain turn.nwdl.org
```

- **DNS (Cloudflare):** `live` proxied, `turn` DNS only, both A 212.227.71.42.
- **HTTPS site (KeyHelp):** domain `live.nwdl.org` for `nwdl-user` with Let's Encrypt. As admin, under Domains → "Customize view" show subdomains, edit `live.nwdl.org` → Apache settings, and paste `apache-vhost.conf` into the HTTPS field, plus a `<Location "/">` block with `Require ip 127.0.0.1`, `Require ip ::1` and `IncludeOptional /etc/apache2/keyhelp/cloudflare-ips.conf`, so that only Cloudflare reaches it.
- **Firewall:** KeyHelp → Firewall (and the IONOS cloud panel if a policy is active). Saving the KeyHelp firewall drops Docker's iptables rules, and the containers lose outbound network (bots stop answering). `docker-after-keyhelp-firewall.path` / `.service` restart Docker automatically after each change: copy both to `/etc/systemd/system`, then `sudo systemctl enable --now docker-after-keyhelp-firewall.path`. Without them, run `sudo systemctl restart docker`.

## Operation

```bash
cd ~/apps/<name>
docker compose ps
docker compose logs -f
curl http://127.0.0.1:<http-port>/   # "OK"
```

## Troubleshooting

- Viewers see "The streaming server is not reachable": check `https://<domain>` (answers "OK"), the HTTPS site and DNS.
- Video stays black or connects slowly: the UDP ports are blocked. Check the firewall; `docker compose logs` shows the external IP LiveKit found.
- Local development uses `livekit-dev.ps1` instead (dev keys, no TLS).
