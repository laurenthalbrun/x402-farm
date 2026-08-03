#!/usr/bin/env bash
# ============================================================================
#  SORTIE MOBILE SUR TÉLÉPHONE — côté MAC (nœud resi-proxy)
# ============================================================================
# Rattache un téléphone Android, déjà préparé par phone-exit.sh, comme SORTIE
# SUPPLÉMENTAIRE du proxy. À lancer sur la machine qui fait tourner proxy.mjs.
#
# CE QUE ÇA FAIT
#   1. vérifie que le téléphone est vu par adb ;
#   2. `adb forward` : expose le proxy du téléphone en 127.0.0.1:<PORT_LOCAL> ;
#   3. vérifie que la sortie est bien une IP d'OPÉRATEUR MOBILE avant de la
#      déclarer (on ne vend jamais une sortie non vérifiée) ;
#   4. ajoute l'entrée dans exits.json en mode `upstream`.
#
# POURQUOI AUCUN REDÉMARRAGE
#   proxy.mjs relit exits.json à chaque connexion (exitsConfig() fait un
#   readFileSync par appel). Écrire le fichier SUFFIT. On ne redémarre pas un
#   service qui peut avoir un client payant en cours — règle maison.
#
# MULTI-TÉLÉPHONES
#   Chaque téléphone reçoit un port local distinct (8801, 8802, …) et un nom
#   d'exit distinct (mobile2, mobile3, …). Pas de partage de connexion USB,
#   donc pas de collision 192.168.42.x entre appareils.
#
# USAGE : bash attach-phone-exit.sh [nom_exit] [port_local]
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")"

EXIT_NAME="${1:-mobile2}"
LOCAL_PORT="${2:-8801}"
PHONE_PORT="${PHONE_PROXY_PORT:-8080}"
EXITS_FILE="exits.json"

command -v adb >/dev/null || { echo "❌ adb absent — installe-le : brew install android-platform-tools"; exit 1; }

echo "→ Téléphones vus par adb :"
adb devices | sed '1d;/^$/d' | sed 's/^/   /'
COUNT=$(adb devices | sed '1d;/^$/d' | grep -c "device$" || true)
if [ "$COUNT" -eq 0 ]; then
  echo "❌ aucun téléphone autorisé."
  echo "   Branche le câble, puis accepte « Autoriser le débogage USB » sur l'écran du téléphone."
  exit 1
fi
if [ "$COUNT" -gt 1 ]; then
  echo "⚠️  plusieurs appareils : précise lequel avec ANDROID_SERIAL=<serial> avant la commande."
fi

echo "→ Redirection USB 127.0.0.1:$LOCAL_PORT → téléphone:$PHONE_PORT"
adb forward --remove "tcp:$LOCAL_PORT" 2>/dev/null || true
adb forward "tcp:$LOCAL_PORT" "tcp:$PHONE_PORT" >/dev/null

echo "→ Vérification de la sortie (on ne déclare rien sans preuve)…"
IP=$(curl -s --max-time 20 -x "http://127.0.0.1:$LOCAL_PORT" https://api.ipify.org || echo "")
[ -n "$IP" ] || { echo "❌ pas de réponse à travers le téléphone. tinyproxy tourne-t-il ? (relance phone-exit.sh)"; exit 1; }

INFO=$(curl -s --max-time 20 "http://ip-api.com/json/$IP?fields=isp,as,mobile,countryCode,status")
echo "   IP $IP → $INFO"
case "$INFO" in
  *'"mobile":true'*) : ;;
  *) echo "❌ REFUS : cette sortie n'est pas une IP mobile. Coupe le Wi-Fi du téléphone."
     echo "   La déclarer quand même reviendrait à vendre de la fibre au prix du mobile."
     adb forward --remove "tcp:$LOCAL_PORT" 2>/dev/null || true
     exit 1 ;;
esac
echo "   ✅ IP d'opérateur mobile confirmée"

echo "→ Déclaration de « $EXIT_NAME » dans $EXITS_FILE (config à chaud, pas de redémarrage)…"
[ -f "$EXITS_FILE" ] || echo '{}' > "$EXITS_FILE"
cp "$EXITS_FILE" "$EXITS_FILE.bak-$(date +%s)"
python3 - "$EXITS_FILE" "$EXIT_NAME" "$LOCAL_PORT" <<'PY'
import json,sys
f,name,port=sys.argv[1],sys.argv[2],sys.argv[3]
try: cfg=json.load(open(f))
except Exception: cfg={}
cfg[name]={"upstream":f"http://127.0.0.1:{port}"}
json.dump(cfg,open(f,"w"),indent=2)
print("   exits.json :", json.dumps(cfg))
PY

echo
echo "✅ « $EXIT_NAME » rattaché."
echo
echo "La sonde le publiera au prochain cycle (~10 min). Ensuite, côté vente :"
echo "  • mobileCapacity() comptera 2 sorties mobiles vérifiées ;"
echo "  • un DEUXIÈME port dédié à 129 \$ devient vendable, automatiquement ;"
echo "  • aucun redéploiement n'est nécessaire."
echo
echo "Vérifier :  curl -s https://api.x-402.online/free/proxy/status | python3 -m json.tool"
echo
echo "⚠️  La redirection adb ne survit pas à un débranchement ni à un reboot du Mac."
echo "    Une fois la sortie validée, dis-le moi : je la rends persistante par LaunchDaemon."
