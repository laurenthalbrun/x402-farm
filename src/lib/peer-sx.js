// Suivi du peer proxies.sx (vente de bande passante) pour le tableau de bord.
//
// Pourquoi ce module existe. Le peer tourne sur le Mac mini et encaisse à part
// de la ferme : sans lui, ce revenu n'apparaît nulle part et on ne peut pas
// dire s'il rapporte quoi que ce soit. Les gains se lisent sur l'API du réseau,
// qui est la seule source faisant autorité.
//
// Le module reste INERTE sans SX_DEVICE_ID + SX_REFRESH_TOKEN : pas de device,
// pas de tuile.

const API = "https://api.proxies.sx";

export function PEER_SX_ACTIF() {
  return !!(process.env.SX_DEVICE_ID && process.env.SX_REFRESH_TOKEN);
}

// Le JWT ne vit qu'une heure. On le garde en mémoire entre deux appels : la
// route de renouvellement est plafonnée à 10 requêtes/min/IP, et un tableau de
// bord rafraîchi souvent la saturerait sans ce cache.
const cache = { jwt: null, expire: 0, valeur: null, lu: 0 };

async function jeton(deviceId, refreshToken) {
  if (cache.jwt && Date.now() < cache.expire) return cache.jwt;
  const r = await fetch(`${API}/v1/peer/agents/${deviceId}/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return null;
  const j = await r.json();
  // ⚠️ Cette route rend un jeton de type `peer_agent`, seul accepté par
  // /earnings et /status. La variante /peer/token/{id}/refresh rend un
  // `peer_device` que le relais accepte mais que ces routes REFUSENT en 401 —
  // la panne est alors invisible côté client.
  cache.jwt = j.jwt || j.token || null;
  cache.expire = Date.now() + 50 * 60 * 1000;   // 50 min, marge sur l'heure
  return cache.jwt;
}

/**
 * Gains et trafic du peer. Renvoie null si inactif ou injoignable — le tableau
 * de bord doit rester affichable même quand une source tierce tombe.
 */
export async function gainsPeerSx() {
  if (!PEER_SX_ACTIF()) return null;
  if (cache.valeur && Date.now() - cache.lu < 300000) return cache.valeur;

  const id = process.env.SX_DEVICE_ID;
  try {
    const t = await jeton(id, process.env.SX_REFRESH_TOKEN);
    if (!t) return cache.valeur;
    const h = { authorization: `Bearer ${t}` };
    const [ge, st] = await Promise.all([
      fetch(`${API}/v1/peer/agents/${id}/earnings`, { headers: h, signal: AbortSignal.timeout(8000) })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${API}/v1/peer/agents/${id}/status`, { headers: h, signal: AbortSignal.timeout(8000) })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    if (!ge) return cache.valeur;

    const v = {
      deviceId: id,
      statut: st?.status || "inconnu",
      ipType: ge.ipType || null,
      go: Number(ge.totalTrafficGB || 0),
      gagne: Number(ge.totalEarnedCents || 0) / 100,
      enAttente: Number(ge.pendingPayoutCents || 0) / 100,
      verse: Number(ge.totalPaidOutCents || 0) / 100,
      seuil: Number(ge.minimumPayoutCents || 0) / 100,
      // Le taux affiché à l'inscription (2,40 $) n'est PAS le taux effectif :
      // le compte applique une commission de plateforme. On montre celui qu'on
      // constate, pas celui qu'on nous annonce.
      parGo: ge.totalTrafficGB > 0
        ? Number(ge.totalEarnedCents || 0) / 100 / Number(ge.totalTrafficGB)
        : null,
    };
    cache.valeur = v;
    cache.lu = Date.now();
    return v;
  } catch {
    return cache.valeur;
  }
}
