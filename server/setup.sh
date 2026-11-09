#!/usr/bin/env bash
# Sets up one Cast streaming server (LiveKit in Docker) on a Linux host. Run it once per instance; run it again with
# the same --name/--dir to update an instance: its settings (instance.conf) and its API key are kept. See README.md.
#
#   ./setup.sh --domain live.example.org --turn-domain turn.example.org
#   ./setup.sh --name second --domain live.second.org --turn-domain turn.second.org \
#     --http-port 7890 --tcp-port 7891 --udp-ports 61000-61999 --turn-port 3479 --relay-ports 41000-41999
#
# Options: --name (default cast) --dir (default ~/apps/<name>) --http-port 7880 --tcp-port 7881
#          --udp-ports 50000-60000 --turn-port 3478 --relay-ports 40000-40999 --image livekit/livekit-server:<tag>
#          --dry-run (write the files, do not start the container)
set -euo pipefail

SETTINGS='domain turn_domain http_port tcp_port udp_ports turn_port relay_ports image'
declare -A DEFAULTS=([http_port]=7880 [tcp_port]=7881 [udp_ports]=50000-60000 [turn_port]=3478
  [relay_ports]=40000-40999 [image]=livekit/livekit-server:v1.13.11)
name=cast dir='' dry_run=false
for key in $SETTINGS; do declare "$key="; done

usage() {
  sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}
while [ $# -gt 0 ]; do
  case "$1" in
    --name) name=$2; shift 2 ;;
    --domain) domain=$2; shift 2 ;;
    --turn-domain) turn_domain=$2; shift 2 ;;
    --dir) dir=$2; shift 2 ;;
    --http-port) http_port=$2; shift 2 ;;
    --tcp-port) tcp_port=$2; shift 2 ;;
    --udp-ports) udp_ports=$2; shift 2 ;;
    --turn-port) turn_port=$2; shift 2 ;;
    --relay-ports) relay_ports=$2; shift 2 ;;
    --image) image=$2; shift 2 ;;
    --dry-run) dry_run=true; shift ;;
    -h | --help) usage ;;
    *) echo "Unknown option: $1" >&2; usage ;;
  esac
done

fail() { echo "setup.sh: $*" >&2; exit 1; }
[[ $name =~ ^[a-z0-9][a-z0-9-]*$ ]] || fail "--name: lowercase letters, digits and -"
dir=${dir:-${HOME%/}/apps/$name}

# Settings not given on the command line: from the last run of this instance, else the defaults
if [ -f "$dir/instance.conf" ]; then
  while IFS='=' read -r key value; do
    [[ " $SETTINGS " == *" $key "* ]] && [ -z "${!key}" ] && printf -v "$key" '%s' "$value"
  done <"$dir/instance.conf"
fi
for key in $SETTINGS; do [ -n "${!key}" ] || printf -v "$key" '%s' "${DEFAULTS[$key]:-}"; done
[ -n "$domain" ] && [ -n "$turn_domain" ] || usage
for host in "$domain" "$turn_domain"; do [[ $host =~ ^[A-Za-z0-9.-]+$ ]] || fail "not a host name: $host"; done
for port in "$http_port" "$tcp_port" "$turn_port"; do [[ $port =~ ^[0-9]+$ ]] || fail "not a port: $port"; done
range() { [[ $1 =~ ^([0-9]+)-([0-9]+)$ ]] && [ "${BASH_REMATCH[1]}" -lt "${BASH_REMATCH[2]}" ] || fail "not a port range: $1"; }
range "$udp_ports"
range "$relay_ports"

# Keep the key of an existing instance: the website signs its tokens with it
api_key='' api_secret=''
if [ -f "$dir/livekit.yaml" ]; then
  line=$(awk '/^keys:/ { getline; print; exit }' "$dir/livekit.yaml")
  api_key=$(echo "$line" | sed -n 's/^ *\([^:]*\): *\(.*\)$/\1/p')
  api_secret=$(echo "$line" | sed -n 's/^ *\([^:]*\): *\(.*\)$/\2/p')
fi
[ -n "$api_key" ] || api_key=API$(openssl rand -hex 6)
[ -n "$api_secret" ] || api_secret=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | cut -c1-43)

umask 077
mkdir -p "$dir"
chmod 700 "$dir"
for key in $SETTINGS; do echo "$key=${!key}"; done >"$dir/instance.conf"

cat >"$dir/livekit.yaml" <<EOF
# Cast streaming server "$name", written by setup.sh. Signalling on 127.0.0.1:$http_port behind the reverse proxy
# of $domain; media directly on the server's public IP; $turn_domain must point at the server without a proxy.
port: $http_port
bind_addresses:
  - 127.0.0.1
rtc:
  tcp_port: $tcp_port
  port_range_start: ${udp_ports%-*}
  port_range_end: ${udp_ports#*-}
  use_external_ip: true
  ips:
    excludes:
      - 172.16.0.0/12 # Docker networks of other apps on this host
turn:
  enabled: true
  domain: $turn_domain
  udp_port: $turn_port # TURN over TLS would need port 443, which the web server uses
  relay_range_start: ${relay_ports%-*}
  relay_range_end: ${relay_ports#*-}
keys:
  $api_key: $api_secret
logging:
  level: info
EOF

cat >"$dir/docker-compose.yml" <<EOF
# Cast streaming server "$name", written by setup.sh
services:
  livekit:
    image: $image
    container_name: $name-livekit
    command: --config /etc/livekit.yaml
    restart: unless-stopped
    network_mode: host # many UDP ports for media; publishing them through Docker would be slow
    volumes:
      - ./livekit.yaml:/etc/livekit.yaml:ro
    logging: # the log holds IP addresses; the privacy page promises a limited size
      driver: json-file
      options:
        max-size: 10m
        max-file: "3"
EOF

cat >"$dir/apache-vhost.conf" <<EOF
# HTTPS virtual host directives for $domain (Apache with mod_proxy, mod_proxy_wstunnel, mod_headers).
# Behind Cloudflare, also allow only its addresses (KeyHelp: IncludeOptional /etc/apache2/keyhelp/cloudflare-ips.conf).
ProxyPreserveHost On
ProxyRequests Off
ProxyTimeout 120
RequestHeader set X-Forwarded-Proto "https"
RequestHeader set X-Forwarded-Port "443"
# Keeps the Let's Encrypt challenge with the web server, otherwise the certificate cannot be renewed
ProxyPass /.well-known/acme-challenge !
ProxyPass / http://127.0.0.1:$http_port/ upgrade=websocket
ProxyPassReverse / http://127.0.0.1:$http_port/
EOF

cat >"$dir/vercel.env" <<EOF
# Environment variables of this instance's Vercel project (web/). Keep this file private.
LIVEKIT_API_KEY=$api_key
LIVEKIT_API_SECRET=$api_secret
LIVEKIT_PUBLIC_URL=wss://$domain
EOF

if ! $dry_run; then
  (cd "$dir" && docker compose up -d)
  for _ in 1 2 3 4 5 6 7 8 9 10; do curl -fsS "http://127.0.0.1:$http_port/" >/dev/null 2>&1 && break; sleep 1; done
  curl -fsS "http://127.0.0.1:$http_port/" >/dev/null || fail "LiveKit does not answer on 127.0.0.1:$http_port, see: docker logs $name-livekit"
fi

cat <<EOF
Cast streaming server "$name" written to $dir$($dry_run && echo ' (dry run, not started)')

Still to do once:
  DNS:       $domain → this server (a proxy such as Cloudflare is fine)
             $turn_domain → this server, without a proxy
  Proxy:     HTTPS site for $domain with the directives in $dir/apache-vhost.conf
             (other web servers: proxy https://$domain to http://127.0.0.1:$http_port with WebSocket upgrade)
  Firewall:  allow $tcp_port/tcp, $turn_port/udp, $udp_ports/udp, $relay_ports/udp (not $http_port)
  Vercel:    set the variables in $dir/vercel.env in this instance's project and redeploy
  Check:     https://$domain answers "OK"
EOF
