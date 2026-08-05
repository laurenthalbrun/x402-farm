// Suivi des gains de preuve Boundless (réseau ZK sur Base) pour le tableau de bord.
//
// Pourquoi ce module existe. Boundless paie les prouveurs **à l'ordre**, en ETH,
// directement on-chain — pas de seuil de retrait ni de versement groupé comme sur
// un pool de minage. Un gain se lit donc sur le solde du portefeuille prouveur,
// sans dépendre d'une API tierce.
//
// L'explorateur boundless.network n'expose AUCUNE API publique (/api/* → 404) et
// rend ses tableaux côté client : impossible de l'interroger en machine. On lit
// donc la seule source qui ne peut pas mentir — la chaîne Base elle-même.
//
// Le module reste INERTE sans BOUNDLESS_PROVER : pas d'adresse, pas de tuile.

const RPC = process.env.BASE_RPC || "https://mainnet.base.org";

async function soldeEth(adresse) {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [adresse, "latest"] }),
    signal: AbortSignal.timeout(8000),
  });
  const j = await r.json();
  return j.result ? Number(BigInt(j.result)) / 1e18 : null;
}

// Référence de départ : premier solde observé. Sans elle on afficherait un solde
// brut, qui ne dit rien des GAINS. Persistée en mémoire de process — au pire un
// redéploiement remet le compteur à la valeur du moment, jamais un faux gain.
let reference = null;
let cache = { v: null, t: 0 };

/**
 * Gains Boundless depuis la première observation.
 * Mémorisé 60 s : le tableau de bord interroge toutes les 6 s.
 */
export async function gainsBoundless(adresse, prixEth) {
  if (!adresse) return null;
  if (cache.v && Date.now() - cache.t < 60_000) return cache.v;

  try {
    const solde = await soldeEth(adresse);
    if (solde == null) throw new Error("solde illisible");
    if (reference == null) reference = { solde, depuis: Date.now() };

    const gagne = Math.max(0, solde - reference.solde);
    const heures = (Date.now() - reference.depuis) / 3_600_000;

    cache = {
      v: {
        adresse,
        soldeEth: solde,
        gagneEth: gagne,
        gagneUsd: prixEth ? gagne * prixEth : null,
        // Extrapolation quotidienne : n'a de sens qu'après quelques heures
        // d'observation, sinon un seul ordre reçu donnerait un « par jour » absurde.
        parJourUsd: heures >= 2 && prixEth ? (gagne / heures) * 24 * prixEth : null,
        heuresObservees: Number(heures.toFixed(2)),
      },
      t: Date.now(),
    };
  } catch (e) {
    // Un RPC injoignable ne doit pas casser le tableau de bord : on garde la
    // dernière valeur connue et on réessaiera au cycle suivant.
    cache.t = Date.now();
    if (!cache.v) cache.v = { adresse, erreur: String(e?.message || e).slice(0, 80) };
  }
  return cache.v;
}

export const BOUNDLESS_ACTIF = () => !!process.env.BOUNDLESS_PROVER;
