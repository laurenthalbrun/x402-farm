// Publie l'état vérifié des sorties proxy vers Supabase, depuis le mini.
//
// POURQUOI. Jusqu'au 13/08, la ferme (lambda Vercel) devait JOINDRE le mini en
// Guadeloupe pour savoir si elle avait le droit de vendre un bundle : un fetch
// vers `WORKER_URL/proxy-exits` dans le chemin critique de la vente, avec un
// budget de quelques secondes. Mesuré sur 14 jours : ~14 % des requêtes proxy
// refusées (2 194 sur 15 463), non pas parce que le proxy était tombé — il avait
// 332 h d'uptime — mais parce que l'aller-retour longue distance échouait.
//
// Le sens de la circulation est donc inversé : le mini POUSSE son état, la ferme
// se contente de LIRE une ligne dans sa propre région. Plus aucun appel vers la
// Guadeloupe au moment où un agent veut payer.
//
// Ce script ne touche NI resi-proxy NI le worker : il lit le fichier que
// resi-proxy écrit déjà (`exits-state.json`) et l'envoie. Aucun service payant
// n'a besoin d'être redémarré pour l'installer ou le retirer.
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ICI = dirname(fileURLToPath(import.meta.url));

// Secrets dans un fichier dédié (600) plutôt que dans le plist launchd : le
// publieur n'a aucune raison de partager l'environnement du worker.
try {
  for (const ligne of readFileSync(join(ICI, ".publish.env"), "utf8").split("\n")) {
    const m = ligne.match(/^([A-Z_][A-Z0-9_]*)=("?)(.*)\2$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[3];
  }
} catch {}

const SB_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SB_KEY = process.env.SUPABASE_ANON_KEY || "";
const SECRET = process.env.PROXY_HMAC_SECRET || "";
const INTERVALLE_MS = Number(process.env.PUBLISH_INTERVAL_MS || 60_000);

if (!SB_URL || !SB_KEY || !SECRET) {
  console.error("[publish-exits] SUPABASE_URL, SUPABASE_ANON_KEY et PROXY_HMAC_SECRET sont requis");
  process.exit(1);
}

const b64url = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const signer = (texte) => b64url(createHmac("sha256", SECRET).update(texte).digest()).slice(0, 43);

async function publier() {
  let etat;
  try {
    etat = JSON.parse(readFileSync(join(ICI, "exits-state.json"), "utf8"));
  } catch (e) {
    // Fichier absent ou illisible : on ne publie RIEN. Surtout pas un état vide,
    // qui serait lu comme « aucune sortie vérifiée » et fermerait la boutique.
    // Sans publication, la ligne vieillit et la ferme retombe d'elle-même sur
    // l'appel direct au mini — la dégradation reste sûre.
    console.error(`[publish-exits] etat illisible, rien publie: ${e.message}`);
    return false;
  }

  // On signe les OCTETS EXACTS qu'on stocke, et la ferme vérifiera sur ces mêmes
  // octets. D'où le stockage en `text` : un jsonb réordonnerait les clés et
  // invaliderait la signature.
  const stateJson = JSON.stringify(etat);
  const ligne = {
    id: "current",
    published_at: new Date().toISOString(),
    checked_at: etat.checkedAt || null,
    state_json: stateJson,
    sig: signer(stateJson),
  };

  const r = await fetch(`${SB_URL}/rest/v1/proxy_exit_state?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: SB_KEY,
      authorization: `Bearer ${SB_KEY}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(ligne),
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) {
    console.error(`[publish-exits] HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return false;
  }
  return true;
}

async function tour() {
  try {
    const ok = await publier();
    if (ok) console.log(`[publish-exits] publie ${new Date().toISOString()}`);
  } catch (e) {
    // Une panne réseau ne doit jamais tuer le publieur : le prochain tour réessaiera.
    console.error(`[publish-exits] echec: ${e.message}`);
  }
}

await tour();
setInterval(tour, INTERVALLE_MS);
