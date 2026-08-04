// Visibilité au Bazaar : combien de nos routes sont indexées, et où elles
// sortent sur les requêtes qui comptent.
//
// C'est l'indicateur qui manquait. Le tableau de bord mesurait l'encaissement,
// pas la découvrabilité — or un catalogue invisible n'encaisse rien. Coinbase
// borne la recherche à 20 résultats : au-delà du 20e rang, on n'existe pas.

const CDP = "https://api.cdp.coinbase.com/platform/v2/x402/discovery";
const NOTRE_HOTE = process.env.BAZAAR_HOTE || "api.x-402.online";

// Les requêtes qu'un agent taperait pour trouver ce que nous vendons.
// Le rang sur ces phrases vaut plus que le nombre de routes publiées.
const REQUETES = (process.env.BAZAAR_REQUETES ||
  "french company data siren|extract structured data web page|render javascript page html|residential proxy bandwidth|due diligence company report france|screenshot website"
).split("|");

let cache = { v: null, t: 0 };

export async function visibiliteBazaar() {
  // Le classement Coinbase se recalcule toutes les 6 h : inutile d'interroger
  // plus souvent que toutes les 30 min.
  if (cache.v && Date.now() - cache.t < 30 * 60_000) return cache.v;

  try {
    const rangs = [];
    for (const q of REQUETES) {
      const r = await fetch(`${CDP}/search?query=${encodeURIComponent(q)}&limit=20`, {
        signal: AbortSignal.timeout(15000),
      }).catch(() => null);
      if (!r?.ok) {
        rangs.push({ requete: q, rang: null, sur: null });
        continue;
      }
      const res = (await r.json()).resources || [];
      const i = res.findIndex((x) => String(x.resource || "").includes(NOTRE_HOTE));
      rangs.push({
        requete: q,
        rang: i < 0 ? null : i + 1, // null = absent des 20 premiers
        sur: res.length,
        tete: res[0] ? String(res[0].resource).replace(/^https?:\/\//, "").split("/")[0] : null,
      });
    }

    const places = rangs.filter((x) => x.rang);
    cache = {
      v: {
        rangs,
        classees: places.length,
        surTotal: rangs.length,
        meilleurRang: places.length ? Math.min(...places.map((x) => x.rang)) : null,
      },
      t: Date.now(),
    };
  } catch (e) {
    cache.t = Date.now();
    if (!cache.v) cache.v = { rangs: [], classees: 0, surTotal: REQUETES.length, erreur: String(e?.message || e).slice(0, 80) };
  }
  return cache.v;
}
