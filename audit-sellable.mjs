// Chaque route réellement SERVIE est-elle vendable ?
// Sans paiement, on DOIT recevoir 402. Tout le reste est un bug commercial :
//   200 = fuite gratuite (revenu perdu — l'essai gratuit a été supprimé le 2026-08-03)
//   404/405 = route annoncée mais pas servie (l'agent part)
//   5xx = casse (et pire : encaissement possible avant l'échec)
// On mesure aussi la taille du payload de paiement (falaise ~2 ko côté facilitateur CDP).
//
// ⚠️ La liste des routes vient de la PROD (/.well-known/x402), PAS du catalogue local.
// Raison : catalog.js n'ajoute une route que si sa clé d'API est présente dans l'env
// (Serper, LLM, ZenRows…). Un audit lancé depuis un poste sans ces clés énumérait 53
// routes quand la prod en sert 58 — /v1/search, /v1/search/news, /v1/llm, /v1/llm/pro et
// /v1/extract-structured n'ont jamais été testées. Le catalogue local ne sert plus qu'à
// récupérer les paramètres d'exemple (bazaar.input).
import { CATALOG } from "./src/catalog.js";

const BASE = process.env.AUDIT_BASE || "https://api.x-402.online";

const manifest = await fetch(`${BASE}/.well-known/x402`).then((r) => r.json());
const pathOf = (u) => { try { return new URL(u).pathname; } catch { return u; } };
const localByPath = new Map(CATALOG.map((e) => [e.route.split(" ")[1], e]));

// Dédoublonne par chemin (la prod annonce GET et POST pour la même ressource).
const targets = [...new Map(manifest.resources.map((r) => [pathOf(r.url), r])).values()];

const rows = [];
for (const res of targets) {
  const path = pathOf(res.url);
  const local = localByPath.get(path);
  const method = (res.method || "GET").toUpperCase();
  const input = local?.bazaar?.input || null;
  const url = BASE + path + (input && method === "GET"
    ? "?" + new URLSearchParams(Object.fromEntries(Object.entries(input).map(([k, v]) => [k, String(v)]))).toString()
    : "");
  const init = { method };
  if (method === "POST") { init.headers = { "content-type": "application/json" }; init.body = JSON.stringify(input || {}); }
  let status = 0, size = 0, err = "";
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 25000);
    const r = await fetch(url, { ...init, signal: ctl.signal });
    clearTimeout(t);
    status = r.status;
    const h = r.headers.get("payment-required");
    if (h) size = Buffer.from(h, "base64").length;
  } catch (ex) { err = String(ex.message).slice(0, 40); }
  rows.push({ path, method, price: res.price, status, size, err, blind: !local });
}

const bad = rows.filter((r) => r.status !== 402);
console.log(`${rows.length} routes servies en prod — ${rows.length - bad.length} en 402 (vendables)\n`);
if (bad.length) {
  console.log("⚠️  ANOMALIES :");
  for (const r of bad) console.log(`  ${String(r.status || r.err).padEnd(6)} ${r.method.padEnd(5)} ${r.path.padEnd(38)} ${r.price}`);
} else console.log("Aucune anomalie de statut.");

const blind = rows.filter((r) => r.blind);
if (blind.length) {
  console.log(`\n${blind.length} route(s) absente(s) du catalogue local (clé d'API manquante ici) —`);
  console.log(`testées sans paramètres d'exemple, le 402 reste probant :`);
  for (const r of blind) console.log(`  ${r.path}`);
}

const big = rows.filter((r) => r.size > 1700).sort((a, b) => b.size - a.size);
console.log(`\nPayloads de paiement les plus lourds (falaise empirique ~2000 o) :`);
for (const r of big.slice(0, 8)) console.log(`  ${String(r.size).padStart(5)} o  ${r.path}`);
const over = rows.filter((r) => r.size > 1900);
if (over.length) console.log(`\n⛔ ${over.length} route(s) au-dessus du plafond de 1900 o — risque de ne plus encaisser en silence.`);
