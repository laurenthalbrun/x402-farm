// Contrôle avant déploiement : aucune route ne doit approcher la falaise du
// facilitateur CDP, au-delà de laquelle un 402 continue de partir mais n'est
// plus jamais réglé — une panne silencieuse, sans erreur ni log.
//
// Usage :  node scripts/verifier-payloads.mjs
// Sort en code 1 si une route dépasse, 0 sinon. Utilisable en pré-commit ou CI.

import { CATALOG } from "../src/catalog.js";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";

const PLAFOND = Number(process.env.X402_PAYLOAD_CEILING || 1900);
const ENVELOPPE = 480; // enveloppe du middleware, haut de fourchette mesuré
const ALERTE = Number(process.env.X402_MARGE_ALERTE || 150);

// Par défaut la configuration de production. En ajouter un ici, c'est simuler
// l'effet qu'aurait son ajout réel sur toutes les routes.
const NETWORKS = (process.env.NETWORKS || "eip155:8453,solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const DESC_FLOOR = 80; // en dessous, la description ne vend plus rien

// L'application tronque la description au budget disponible avant d'émettre le
// 402 : mesurer le texte brut ferait crier au dépassement là où le code se
// protège tout seul. On reproduit donc sa logique, et le vrai danger devient
// visible — les routes dont l'EXTENSION seule sature, que rien ne peut sauver.
const lignes = CATALOG.map((e) => {
  const accepts = NETWORKS.map((n) => ({
    scheme: "exact",
    price: e.price,
    network: n,
    payTo: "0x2c871C2b8876dc35e9E19646FDa5ABF1cd27735F",
  }));
  const ext = e.bazaar ? declareDiscoveryExtension({ ...e.bazaar, discoverable: true }) : null;
  const overhead =
    Buffer.byteLength(JSON.stringify({ accepts, description: "", ...(ext ? { extensions: ext } : {}) })) +
    ENVELOPPE;
  const budget = PLAFOND - overhead;

  // Description effectivement servie, après la troncature qu'appliquerait l'app
  let servie = e.desc;
  if (Buffer.byteLength(servie) > budget) {
    if (budget < DESC_FLOOR) servie = e.desc.slice(0, 60);
    else {
      let cut = Math.min(e.desc.length, budget);
      while (cut > 0 && Buffer.byteLength(e.desc.slice(0, cut)) > budget - 3) cut--;
      servie = e.desc.slice(0, cut);
    }
  }
  const taille = overhead + Buffer.byteLength(servie);
  return {
    route: e.route,
    taille,
    marge: PLAFOND - taille,
    desc: e.desc.length,
    servie: servie.length,
    etouffee: budget < DESC_FLOOR, // l'extension seule sature : cas irrattrapable
  };
}).sort((a, b) => a.marge - b.marge);

const rouges = lignes.filter((l) => l.marge < 0 || l.etouffee);
const oranges = lignes.filter((l) => !rouges.includes(l) && l.marge < ALERTE);
const bridees = lignes.filter((l) => l.servie < l.desc && !l.etouffee);

console.log(`plafond ${PLAFOND} o · ${NETWORKS.length} réseau(x) · seuil d'alerte ${ALERTE} o\n`);
console.log("les 12 routes les plus chargées :");
for (const l of lignes.slice(0, 12)) {
  const etat = l.marge < 0 ? "⛔" : l.marge < ALERTE ? "⚠ " : "  ";
  const suffixe = l.servie < l.desc ? `desc ${l.desc} → ${l.servie} car.` : `desc ${l.desc} car.`;
  console.log(`  ${etat} ${l.route.padEnd(36)} ${String(l.taille).padStart(4)} o — marge ${String(l.marge).padStart(4)} o (${suffixe})`);
}

console.log(`\nirrattrapables (extension saturante) : ${rouges.length}`);
console.log(`en zone d'alerte                     : ${oranges.length}`);
console.log(`descriptions bridées par le budget   : ${bridees.length}`);

if (rouges.length) {
  console.error("\n⛔ Leur schéma bazaar sature le payload à lui seul : aucune troncature");
  console.error("   de description ne les sauvera. Allège leur exemple de sortie.");
  for (const l of rouges) console.error(`     ${l.route}`);
  process.exit(1);
}
if (oranges.length) {
  console.warn(
    `\n⚠  ${oranges.length} route(s) sous ${ALERTE} o de marge : ajouter un réseau de paiement`
  );
  console.warn("   ou enrichir un exemple de sortie les ferait basculer.");
}
console.log("\n✓ aucune route au-delà du plafond");
