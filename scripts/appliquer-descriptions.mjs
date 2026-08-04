// Injecte les descriptions longues dans src/catalog.js, en refusant toute
// valeur qui ferait franchir au payload de paiement la falaise du facilitateur.
//
// Usage :  node scripts/appliquer-descriptions.mjs [--ecrire]
// Sans --ecrire, le script ne fait que rapporter ce qu'il changerait.

import fs from "node:fs";
import { CATALOG } from "../src/catalog.js";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { DESCRIPTIONS } from "./descriptions-bazaar.mjs";

const PLAFOND = Number(process.env.X402_PAYLOAD_CEILING || 1900);
const ENVELOPPE = 480; // mesuré en production, haut de fourchette
const MARGE = 12; // on ne colle jamais au budget exact
const MAX_BAZAAR = 500; // limite documentée par Coinbase

// Le budget dépend du nombre de réseaux annoncés : on prend la configuration
// de production (la plus large), sinon le calcul serait optimiste.
// Relevés sur la réponse 402 de production : Base + Solana.
const NETWORKS = (process.env.NETWORKS || "eip155:8453,solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function budgetPour(e) {
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
  return PLAFOND - overhead;
}

/** Coupe sur une frontière de phrase, jamais au milieu d'un mot. */
function ajuster(texte, budgetOctets) {
  const cible = Math.min(MAX_BAZAAR, budgetOctets - MARGE);
  if (Buffer.byteLength(texte) <= cible) return texte;
  let coupe = texte;
  while (Buffer.byteLength(coupe) > cible) {
    const dernierPoint = coupe.lastIndexOf(". ", coupe.length - 2);
    if (dernierPoint > cible * 0.55) coupe = coupe.slice(0, dernierPoint + 1);
    else coupe = coupe.slice(0, Math.floor(coupe.length * 0.94));
  }
  return coupe.replace(/[\s,;:—-]+$/, "").replace(/\.?$/, ".");
}

const ecrire = process.argv.includes("--ecrire");
let source = fs.readFileSync(new URL("../src/catalog.js", import.meta.url), "utf8");

const rapport = { appliquees: 0, ajustees: [], manquantes: [], inchangees: 0 };

for (const e of CATALOG) {
  const nouvelle = DESCRIPTIONS[e.route];
  if (!nouvelle) {
    rapport.manquantes.push(`${e.route} (${e.desc.length} car.)`);
    continue;
  }
  const budget = budgetPour(e);
  const finale = ajuster(nouvelle, budget);
  if (finale.length < nouvelle.length) {
    rapport.ajustees.push({ route: e.route, de: nouvelle.length, a: finale.length, budget });
  }
  if (finale === e.desc) {
    rapport.inchangees++;
    continue;
  }

  // Ancrage sur la route (l'alignement des colonnes varie d'une entrée à
  // l'autre), puis sur le premier `desc:` qui suit.
  const marqueur = `route: ${JSON.stringify(e.route)}`;
  const iRoute = source.indexOf(marqueur);
  if (iRoute < 0) {
    console.error(`⛔ route introuvable dans le fichier : ${e.route}`);
    continue;
  }
  const iDesc = source.indexOf("desc:", iRoute);
  const iOuvre = source.indexOf('"', iDesc);
  if (iDesc < 0 || iOuvre < 0) {
    console.error(`⛔ desc introuvable pour ${e.route}`);
    continue;
  }
  // fin du littéral : première guillemet non échappée
  let iFerme = iOuvre + 1;
  while (iFerme < source.length) {
    if (source[iFerme] === "\\") { iFerme += 2; continue; }
    if (source[iFerme] === '"') break;
    iFerme++;
  }
  source = source.slice(0, iOuvre) + JSON.stringify(finale) + source.slice(iFerme + 1);
  rapport.appliquees++;
}

console.log(`descriptions réécrites : ${rapport.appliquees}`);
console.log(`déjà à jour            : ${rapport.inchangees}`);
if (rapport.ajustees.length) {
  console.log(`\nramenées sous le budget de leur route (${rapport.ajustees.length}) :`);
  for (const a of rapport.ajustees) {
    console.log(`  ${a.route.padEnd(38)} ${a.de} → ${a.a} car. (budget ${a.budget} o)`);
  }
}
if (rapport.manquantes.length) {
  console.log(`\nsans nouvelle description (${rapport.manquantes.length}) :`);
  rapport.manquantes.forEach((m) => console.log(`  ${m}`));
}

if (ecrire) {
  fs.writeFileSync(new URL("../src/catalog.js", import.meta.url), source);
  console.log("\n✓ src/catalog.js mis à jour");
} else {
  console.log("\n(simulation — relancer avec --ecrire pour appliquer)");
}
