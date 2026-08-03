// La route LIVRE-T-ELLE après paiement ? La clé interne traverse le paywall et exécute
// le vrai handler : ce qui casse ici casserait aussi APRÈS encaissement (le pire cas,
// on facture et on ne livre pas).
//
// ⚠️ La liste des routes vient de la PROD (/.well-known/x402), PAS du catalogue local :
// catalog.js n'ajoute une route que si sa clé d'API est dans l'env, donc un audit lancé
// sans les clés (Serper, LLM, ZenRows) énumérait 53 routes quand la prod en sert 58.
// Le catalogue local ne fournit plus que les paramètres d'exemple (bazaar.input) ; une
// route qu'il ne connaît pas est testée SANS paramètres et signalée comme telle, car un
// 400 « paramètre manquant » n'y serait alors pas un vrai défaut de livraison.
import { CATALOG } from "./src/catalog.js";

const BASE = process.env.AUDIT_BASE || "https://api.x-402.online";
const KEY = process.env.IKEY;
if (!KEY) { console.error("IKEY manquante (clé interne qui traverse le paywall)."); process.exit(1); }

const manifest = await fetch(`${BASE}/.well-known/x402`).then((r) => r.json());
const pathOf = (u) => { try { return new URL(u).pathname; } catch { return u; } };
const localByPath = new Map(CATALOG.map((e) => [e.route.split(" ")[1], e]));
const targets = [...new Map(manifest.resources.map((r) => [pathOf(r.url), r])).values()];

const out = [];
for (const res of targets) {
  const path = pathOf(res.url);
  // Exclues : elles créent de vraies clés de proxy à chaque appel.
  if (path.startsWith("/v1/proxy") || path.startsWith("/v1/mobile-proxy")) continue;
  const local = localByPath.get(path);
  const method = (res.method || "GET").toUpperCase();
  const input = local?.bazaar?.input || null;
  const qs = input && method === "GET"
    ? "?" + new URLSearchParams(Object.fromEntries(Object.entries(input).map(([k, v]) => [k, String(v)]))).toString() : "";
  const init = { method, headers: { "x-api-key": KEY } };
  if (method === "POST") { init.headers["content-type"] = "application/json"; init.body = JSON.stringify(input || {}); }
  let status = 0, note = "";
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 40000);
    const r = await fetch(BASE + path + qs, { ...init, signal: ctl.signal });
    clearTimeout(t);
    status = r.status;
    const txt = await r.text();
    if (status === 200) {
      if (txt.length < 15) note = "réponse vide";
      else { try { const j = JSON.parse(txt); if (j.error) note = "erreur: " + String(j.error).slice(0, 45); } catch { /* non-JSON (png/pdf) = ok */ } }
    } else note = txt.slice(0, 90).replace(/\s+/g, " ");
  } catch (ex) { status = 0; note = "timeout/exception: " + String(ex.message).slice(0, 40); }
  out.push({ path, method, price: res.price, status, note, blind: !local });
  process.stdout.write(status === 200 && !note ? "." : "!");
}
console.log("\n");

const ko = out.filter((r) => r.status !== 200 || r.note);
const koKnown = ko.filter((r) => !r.blind);
const koBlind = ko.filter((r) => r.blind);
console.log(`${out.length} routes testées en livraison réelle — ${out.length - ko.length} OK`);
if (koKnown.length) {
  console.log("\n⚠️  ROUTES QUI ENCAISSERAIENT SANS LIVRER CORRECTEMENT :");
  for (const r of koKnown) console.log(`  ${String(r.status).padEnd(4)} ${r.path.padEnd(36)} ${String(r.price).padEnd(8)} ${r.note}`);
}
if (koBlind.length) {
  console.log("\n(testées sans paramètres — absentes du catalogue local, à confirmer à la main) :");
  for (const r of koBlind) console.log(`  ${String(r.status).padEnd(4)} ${r.path.padEnd(36)} ${r.note}`);
}
