// Le proxy résidentiel répond-il DEPUIS L'INTERNET ?
//
// Pourquoi ce module existe. Le 06/08, le port 8899 était fermé de l'extérieur
// — redirection de port disparue, l'UPnP de la box étant désactivé — pendant
// que `resi-proxy` affichait « online » et que les sorties étaient marquées
// vérifiées. La ferme a donc continué de vendre 3,50 $, 7 $ et 10 $ un accès
// vers un port injoignable : l'acheteur payait et recevait une clé valide vers
// le vide.
//
// Le garde existant vérifie l'état LOCAL des sorties. Aucun contrôle local ne
// peut voir un blocage situé ENTRE l'internet et la machine.
//
// La sonde est une simple ouverture TCP depuis la fonction elle-même, et non
// un service tiers : c'est instantané, sans dépendance, et le raisonnement est
// imparable — si le serveur qui vend n'atteint pas le port, aucun acheteur ne
// l'atteindra. Une vérification passant par un tiers demandait plus de vingt
// secondes, dépassait le budget d'une fonction serverless, et rendait donc
// toujours « indéterminé » : le garde laissait vendre.

import net from "node:net";

// ⚠️ 13/08 : la sonde traitait un aléa réseau comme un verdict. Une seule ouverture TCP
// ratée depuis une lambda Vercel vers la ligne domestique en Guadeloupe suffisait à
// marquer le port « fermé » et à refuser toute vente pendant 5 minutes, alors que le port
// répond normalement en ~70 ms. Désormais : deux échecs consécutifs pour conclure, et une
// grâce sur le dernier succès pour ne pas fermer sur un hoquet. La panne LONGUE — celle du
// 06/08, le port fermé pendant des jours — reste attrapée : passé la grâce, on ferme.
const FRAIS_MS = 5 * 60 * 1000;      // un port vu ouvert reste réputé ouvert 5 min
const GRACE_MS = 15 * 60 * 1000;     // au-delà d'un quart d'heure sans succès, on ferme
const REESSAI_MS = 30 * 1000;        // intervalle minimum entre deux séries de sondes
const DELAI_MS = 6000;

let cache = { ok: null, t: 0, verifieLe: null, hote: null };
let dernierSucces = 0;
let derniereTentative = 0;

function hote() {
  const h = process.env.PROXY_PUBLIC_HOST || "";
  const i = h.lastIndexOf(":");
  if (i < 1) return null;
  const ip = h.slice(0, i);
  const port = Number(h.slice(i + 1));
  return ip && port ? { ip, port } : null;
}

function connexionPossible(ip, port) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    let fini = false;
    const terminer = (ok) => {
      if (fini) return;
      fini = true;
      try { s.destroy(); } catch {}
      resolve(ok);
    };
    s.setTimeout(DELAI_MS);
    s.once("connect", () => terminer(true));
    // Un délai dépassé signifie que les paquets se perdent (port fermé au
    // niveau du routeur ou filtré) ; un refus explicite signifie qu'on atteint
    // bien la machine mais que rien n'écoute. Les deux empêchent de livrer.
    s.once("timeout", () => terminer(false));
    s.once("error", () => terminer(false));
    s.connect(port, ip);
  });
}

export async function proxyJoignable() {
  const h = hote();
  if (!h) return { ok: null, raison: "PROXY_PUBLIC_HOST absent" };
  const now = Date.now();
  const hoteStr = `${h.ip}:${h.port}`;

  // Verdict positif encore frais : rien à refaire.
  if (cache.ok === true && !cache.grace && now - cache.t < FRAIS_MS) return cache;
  // On vient de sonder : ne pas repayer le timeout à chaque requête pendant une panne.
  if (cache.verifieLe && now - derniereTentative < REESSAI_MS) return cache;

  derniereTentative = now;
  // Un échec isolé peut être un paquet perdu ; deux d'affilée, c'est un verdict.
  let ok = await connexionPossible(h.ip, h.port);
  if (!ok) ok = await connexionPossible(h.ip, h.port);

  if (ok) {
    dernierSucces = now;
    cache = { ok: true, t: now, verifieLe: new Date(now).toISOString(), hote: hoteStr };
    return cache;
  }
  // Le port ne répond pas. S'il répondait il y a peu, on laisse la grâce courir plutôt
  // que de fermer sur un hoquet de la ligne — la fermeture arrive si ça persiste.
  if (dernierSucces && now - dernierSucces < GRACE_MS) {
    cache = {
      ok: true, t: dernierSucces, verifieLe: new Date(dernierSucces).toISOString(),
      hote: hoteStr, grace: true, derniere_sonde_ratee: new Date(now).toISOString(),
    };
    return cache;
  }
  cache = { ok: false, t: now, verifieLe: new Date(now).toISOString(), hote: hoteStr };
  return cache;
}
