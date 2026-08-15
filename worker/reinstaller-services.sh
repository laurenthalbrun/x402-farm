#!/bin/bash
# reinstaller-services.sh — remet les services du mini sous launchd.
#
#   bash worker/reinstaller-services.sh
#
# POURQUOI CE SCRIPT EXISTE
# Le 15/08/2026, worker, tunnel, proxy et publieur étaient tous à l'arrêt en même
# temps. Cause commune : resi-proxy tournait sous pm2, et pm2 a disparu avec la
# montée de node en v26 (les paquets npm globaux ne survivent pas à un changement
# de version majeure). Rien ne supervisait le reste.
#
# On supprime donc la dépendance à pm2 : chaque service devient un LaunchAgent
# avec KeepAlive, qui redémarre seul au boot et après un crash.
#
# Les secrets sont lus depuis Vercel (source de vérité), jamais régénérés :
# régénérer WORKER_SECRET couperait l'authentification entre Vercel et le mini.
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
PLIST_DIR="$HOME/Library/LaunchAgents"
NODE_BIN="$(command -v node)"
CFD_BIN="$(command -v cloudflared)"
mkdir -p "$PLIST_DIR"

echo "== x402-farm — réinstallation des services =="
echo "   repo   : $ROOT"
echo "   node   : $NODE_BIN ($(node -v))"
echo "   tunnel : $CFD_BIN"
echo

# --- 1. Secrets depuis Vercel -------------------------------------------------
ENVF=/tmp/x402.env
if [ ! -f "$ENVF" ]; then
  echo "-- récupération des variables de production Vercel"
  vercel env pull "$ENVF" --environment=production --yes >/dev/null 2>&1 \
    || { echo "❌ impossible de lire l'env Vercel"; exit 1; }
fi
val() { grep -E "^$1=" "$ENVF" | head -1 | sed -E 's/^[^=]+=//; s/^"//; s/"$//'; }

WORKER_SECRET="$(val WORKER_SECRET)"
PROXY_HMAC_SECRET="$(val PROXY_HMAC_SECRET)"
SUPABASE_URL="$(val SUPABASE_URL)"
SUPABASE_ANON_KEY="$(val SUPABASE_ANON_KEY)"

[ -n "$WORKER_SECRET" ] || { echo "❌ WORKER_SECRET introuvable"; exit 1; }
[ -n "$PROXY_HMAC_SECRET" ] || { echo "❌ PROXY_HMAC_SECRET introuvable"; exit 1; }

# worker/.env est relu par worker/index.js. On le reconstitue depuis Vercel et
# .envprod. ⚠️ GROQ_API_KEY n'existe NULLE PART ailleurs : elle ne vivait que
# dans ce fichier, perdu le 15/08. Sans elle, /v1/transcribe répond
# « engine_unavailable » — tout le reste du worker fonctionne.
INPI_USERNAME="$(grep -E '^INPI_USERNAME=' .envprod 2>/dev/null | head -1 | sed -E 's/^[^=]+=//; s/^"//; s/"$//')"
INPI_PASSWORD="$(grep -E '^INPI_PASSWORD=' .envprod 2>/dev/null | head -1 | sed -E 's/^[^=]+=//; s/^"//; s/"$//')"
GROQ_API_KEY="$(grep -E '^GROQ_API_KEY=' worker/.env 2>/dev/null | head -1 | sed -E 's/^[^=]+=//; s/^"//; s/"$//')"

if [ ! -f worker/.env ] || ! grep -q '^GROQ_API_KEY=' worker/.env 2>/dev/null; then
  {
    printf 'WORKER_PORT=4020\n'
    printf 'WORKER_SECRET=%s\n' "$WORKER_SECRET"
    [ -n "$INPI_USERNAME" ] && printf 'INPI_USERNAME=%s\n' "$INPI_USERNAME"
    [ -n "$INPI_PASSWORD" ] && printf 'INPI_PASSWORD=%s\n' "$INPI_PASSWORD"
    printf '# À RENSEIGNER — console.groq.com/keys. Sans elle, /v1/transcribe est HS.\n'
    printf 'GROQ_API_KEY=%s\n' "$GROQ_API_KEY"
  } > worker/.env
  chmod 600 worker/.env
  echo "-- worker/.env reconstitué"
  [ -z "$GROQ_API_KEY" ] && echo "   ⚠️  GROQ_API_KEY vide : la transcription restera indisponible"
fi

TOKEN_FILE="$ROOT/.tunnel-connector.token"
[ -f "$TOKEN_FILE" ] || { echo "❌ .tunnel-connector.token absent"; exit 1; }
TUNNEL_TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"

# --- 2. Fabrique un LaunchAgent ----------------------------------------------
# agent <label> <log> <clé=valeur…> -- <argv…>
agent() {
  local label="$1" log="$2"; shift 2
  local envxml="" arg
  while [ "$1" != "--" ]; do
    envxml="$envxml    <key>${1%%=*}</key><string>${1#*=}</string>\n"
    shift
  done
  shift
  local argsxml=""
  for arg in "$@"; do argsxml="$argsxml    <string>$arg</string>\n"; done

  cat > "$PLIST_DIR/$label.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key><array>
$(printf "$argsxml")  </array>
  <key>EnvironmentVariables</key><dict>
$(printf "$envxml")  </dict>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>/tmp/$log.log</string>
  <key>StandardErrorPath</key><string>/tmp/$log.err</string>
</dict></plist>
EOF
  # bootout puis bootstrap. La pause est nécessaire : enchaînés trop vite, le
  # bootstrap échoue en silence et le service reste absent — c'est ce qui est
  # arrivé au tunnel et au publieur d'actors le 15/08.
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null
  sleep 2
  launchctl bootstrap "gui/$(id -u)" "$PLIST_DIR/$label.plist" 2>/dev/null \
    || launchctl load "$PLIST_DIR/$label.plist" 2>/dev/null
  echo "-- $label chargé"
}

# --- 3. Les quatre services ---------------------------------------------------
# PATH doit contenir /opt/homebrew/bin : la transcription appelle yt-dlp et
# ffmpeg, absents du PATH minimal de launchd.
agent com.x402farm.worker x402farm-worker \
  "WORKER_PORT=4020" "WORKER_SECRET=$WORKER_SECRET" \
  "GROQ_API_KEY=$GROQ_API_KEY" \
  "INPI_USERNAME=$INPI_USERNAME" "INPI_PASSWORD=$INPI_PASSWORD" \
  "PATH=/opt/homebrew/bin:/usr/bin:/bin" \
  -- "$NODE_BIN" "$ROOT/worker/index.js"

agent com.x402farm.tunnel x402farm-tunnel \
  "TUNNEL_TRANSPORT_PROTOCOL=auto" \
  -- "$CFD_BIN" tunnel --no-autoupdate run --token "$TUNNEL_TOKEN"

# Remplace pm2 : le proxy vendu, supervisé par launchd.
agent com.x402farm.proxy x402farm-proxy \
  "PROXY_PORT=8899" "PROXY_BIND=0.0.0.0" "PROXY_HMAC_SECRET=$PROXY_HMAC_SECRET" \
  "PATH=/opt/homebrew/bin:/usr/bin:/bin" \
  -- "$NODE_BIN" "$ROOT/resi-proxy/proxy.mjs"

# Le publieur d'état : il n'avait AUCUN superviseur, d'où sa disparition muette.
agent com.x402farm.publish-exits x402farm-publish-exits \
  "PROXY_HMAC_SECRET=$PROXY_HMAC_SECRET" "SUPABASE_URL=$SUPABASE_URL" \
  "SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" "PUBLISH_INTERVAL_MS=60000" \
  "PATH=/opt/homebrew/bin:/usr/bin:/bin" \
  -- "$NODE_BIN" "$ROOT/resi-proxy/publish-exits.mjs"

# Le veilleur de redirection de port. Sans lui, le proxy écoute en local mais
# reste FERMÉ depuis l'internet dès que la box perd son bail UPnP — le service
# paraît sain et n'est joignable par aucun client. C'est le symptôme des
# incidents des 06 et 11/08, et encore celui du 15/08.
LAN_HOST="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)"
agent com.x402farm.upnpkeep x402farm-upnpkeep \
  "PROXY_PORT=8899" "LAN_HOST=$LAN_HOST" "NTFY_TOPIC=$(val NTFY_TOPIC)" \
  "PATH=/opt/homebrew/bin:/usr/bin:/bin" \
  -- "$NODE_BIN" "$ROOT/resi-proxy/upnpkeep.mjs"

# Job préexistant (publication des actors Apify), simplement rechargé.
if [ -f "$PLIST_DIR/com.x402farm.publish.plist" ]; then
  launchctl bootout "gui/$(id -u)/com.x402farm.publish" 2>/dev/null
  sleep 2
  launchctl bootstrap "gui/$(id -u)" "$PLIST_DIR/com.x402farm.publish.plist" 2>/dev/null \
    || launchctl load "$PLIST_DIR/com.x402farm.publish.plist" 2>/dev/null
  echo "-- com.x402farm.publish rechargé"
fi

echo
echo "== état launchd =="
launchctl list | grep -E "x402farm" | awk '{printf "   %-34s pid=%-8s exit=%s\n", $3, $1, $2}'
echo
echo "Astuce : le mini doit rester éveillé —  sudo pmset -a sleep 0 disksleep 0 womp 1"
