// Suivi des encaissements Tempo pour le tableau de bord.
//
// Particularité de cette chaîne : on ne code en dur aucune adresse de
// stablecoin. Tempo n'a pas de jeton de gas natif et ses stablecoins TIP-20
// ne sont pas les contrats USDC canoniques des autres réseaux — les tester un
// par un n'a rien donné. On scanne donc les événements Transfer ENTRANTS vers
// le portefeuille de revenus, quel que soit le contrat émetteur : le jeton se
// découvre de lui-même au premier règlement, sans hypothèse à maintenir.

const RPC = process.env.TEMPO_RPC || "https://rpc.tempo.xyz";
const TOPIC_TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const PLAGE_MAX = 100_000; // limite imposée par le noeud public
const FENETRE = Number(process.env.TEMPO_FENETRE_BLOCS || 300_000); // ~ quelques jours

const pad32 = (a) => "0x" + a.replace("0x", "").toLowerCase().padStart(64, "0");

async function rpc(methode, params, timeout = 12000) {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: methode, params }),
    signal: AbortSignal.timeout(timeout),
  });
  return await r.json();
}

/** Décimales du jeton, lues une fois puis mémorisées. */
const decimalesConnues = new Map();
async function decimales(contrat) {
  if (decimalesConnues.has(contrat)) return decimalesConnues.get(contrat);
  let d = 6; // les stablecoins de paiement en utilisent 6 dans l'immense majorité
  try {
    const r = await rpc("eth_call", [{ to: contrat, data: "0x313ce567" }, "latest"], 8000);
    if (r.result && r.result !== "0x") d = Number(BigInt(r.result));
  } catch {
    /* on garde la valeur par défaut plutôt que d'échouer */
  }
  decimalesConnues.set(contrat, d);
  return d;
}

let cache = { v: null, t: 0 };

/**
 * Encaissements Tempo sur la fenêtre récente.
 * Le résultat est mémorisé 60 s : le tableau de bord interroge toutes les 6 s
 * et le scan coûte plusieurs appels RPC.
 */
export async function recettesTempo(adresse) {
  if (!adresse) return null;
  if (cache.v && Date.now() - cache.t < 60_000) return cache.v;

  try {
    const tete = parseInt((await rpc("eth_blockNumber", [])).result, 16);
    const depart = Math.max(0, tete - FENETRE);
    const recus = [];

    for (let b = depart; b < tete; b += PLAGE_MAX) {
      const r = await rpc("eth_getLogs", [
        {
          fromBlock: "0x" + b.toString(16),
          toBlock: "0x" + Math.min(b + PLAGE_MAX - 1, tete).toString(16),
          topics: [TOPIC_TRANSFER, null, pad32(adresse)],
        },
        // le scan complet peut prendre du temps sur une chaîne active
      ], 20000);
      if (Array.isArray(r.result)) recus.push(...r.result);
    }

    let total = 0;
    const jetons = new Set();
    for (const log of recus) {
      const d = await decimales(log.address);
      total += Number(BigInt(log.data)) / 10 ** d;
      jetons.add(log.address);
    }

    cache = {
      v: {
        reglements: recus.length,
        total,
        jetons: [...jetons],
        dernier: recus.length ? parseInt(recus[recus.length - 1].blockNumber, 16) : null,
        fenetre: FENETRE,
      },
      t: Date.now(),
    };
  } catch (e) {
    // Une chaîne injoignable ne doit pas casser le tableau de bord : on garde
    // la dernière valeur connue et on réessaiera au prochain cycle.
    cache.t = Date.now();
    if (!cache.v) cache.v = { reglements: 0, total: 0, jetons: [], erreur: String(e?.message || e).slice(0, 80) };
  }
  return cache.v;
}

export const TEMPO_ACTIF = () => !!process.env.TEMPO_PAY_TO;
