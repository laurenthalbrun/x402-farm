#!/data/data/com.termux/files/usr/bin/bash
# ============================================================================
#  SORTIE MOBILE SUR TÉLÉPHONE — côté TÉLÉPHONE (Termux)
# ============================================================================
# Installe un proxy HTTP sur le téléphone. Le trafic qui le traverse sort par
# la 4G/5G du téléphone, donc par une IP d'opérateur : c'est ça qu'on vend.
#
# ARCHITECTURE (et pourquoi celle-là)
#   Le téléphone doit SORTIR en 4G mais rester JOIGNABLE depuis le Mac. Ces deux
#   exigences se contredisent :
#     • en Wi-Fi, Android fait tout sortir par le Wi-Fi → IP fibre, pas mobile ;
#     • en 4G seule, le NAT opérateur le rend injoignable depuis le LAN.
#   La sortie est le CÂBLE USB avec `adb forward` : le port du proxy est exposé
#   sur le Mac en 127.0.0.1, la connexion voyage par l'USB, et le téléphone
#   n'utilise que sa 4G pour sortir. On n'active PAS le partage de connexion USB
#   (il mettrait tous les téléphones en 192.168.42.x → collision au 2e appareil).
#
# PRÉREQUIS SUR LE TÉLÉPHONE
#   1. Wi-Fi COUPÉ, données mobiles ACTIVES (sinon on vend une IP fibre)
#   2. Options développeur → débogage USB activé
#   3. Termux installé (déjà le cas : il fait tourner l'agent SMS)
#
# USAGE : bash phone-exit.sh
# ============================================================================
set -euo pipefail

PORT="${PHONE_PROXY_PORT:-8080}"
CONF="$PREFIX/etc/tinyproxy/tinyproxy.conf"

echo "→ Installation de tinyproxy…"
pkg install -y tinyproxy >/dev/null 2>&1 || { echo "❌ échec pkg install"; exit 1; }

echo "→ Configuration (écoute locale uniquement, atteinte par adb)…"
mkdir -p "$(dirname "$CONF")"
cat > "$CONF" <<EOF
# Écoute sur la boucle locale UNIQUEMENT : personne ne peut l'atteindre par le
# réseau mobile ni par le Wi-Fi. Le seul chemin d'accès est le câble USB via
# \`adb forward\`, donc physiquement la machine branchée au téléphone.
Listen 127.0.0.1
Port $PORT
Timeout 600
MaxClients 100
StartServers 5
# Pas d'en-têtes qui trahissent le proxy : l'intérêt commercial de l'IP mobile
# est qu'elle soit indiscernable d'un vrai téléphone.
DisableViaHeader Yes
LogLevel Warning
EOF

echo "→ Démarrage…"
pkill -f tinyproxy 2>/dev/null || true
tinyproxy -c "$CONF"
sleep 1

if pgrep -f tinyproxy >/dev/null; then
  echo "✅ proxy actif sur 127.0.0.1:$PORT"
else
  echo "❌ tinyproxy n'a pas démarré"; exit 1
fi

echo
echo "→ Vérification de la voie de sortie…"
IP=$(curl -s --max-time 15 -x "http://127.0.0.1:$PORT" https://api.ipify.org || echo "")
if [ -z "$IP" ]; then
  echo "❌ pas de sortie internet à travers le proxy"; exit 1
fi
echo "   IP de sortie : $IP"

INFO=$(curl -s --max-time 15 "http://ip-api.com/json/$IP?fields=isp,as,mobile,countryCode" || echo "{}")
echo "   $INFO"
case "$INFO" in
  *'"mobile":true'*) echo "✅ IP d'opérateur MOBILE — c'est bien ce qu'on vend." ;;
  *) echo "⚠️  Cette IP n'est PAS détectée comme mobile."
     echo "    Coupe le Wi-Fi du téléphone et relance : tu es en train de sortir par la fibre." ;;
esac

echo
echo "Sur le Mac qui fait tourner resi-proxy, branche le câble puis lance :"
echo "    bash attach-phone-exit.sh"
