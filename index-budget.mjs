// Indexeur Bazaar avec plafond de prix et suivi de solde.
import { readFileSync } from "node:fs";
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
// catalogue lu depuis la prod : couvre les routes absentes de src/catalog.js

const BASE = "https://api.x-402.online";
const CATALOG = (await (await fetch(BASE + "/")).json()).endpoints;
const NETWORK = "eip155:8453";
const MAXPRICE = parseFloat(process.env.MAXPRICE || "0.2");
const LIMIT = parseInt(process.env.LIMIT || "999", 10);

const pk = readFileSync("/Users/yggucci/x402-farm/.buyer.secret", "utf8").match(/BUYER_PRIVATE_KEY=(0x[0-9a-fA-F]+)/)[1];
const account = privateKeyToAccount(pk);

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
async function solde(addr) {
  const d = "0x70a08231" + "0".repeat(24) + addr.slice(2).toLowerCase();
  const r = await (await fetch("https://mainnet.base.org", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: USDC, data: d }, "latest"] }) })).json();
  return parseInt(r.result, 16) / 1e6;
}

const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: NETWORK, client: new ExactEvmScheme(account) }],
});
const qs = (o) => Object.entries(o || {}).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");

const prix = (e) => parseFloat(String(e.price).replace("$", ""));
const ONLY = (process.env.ROUTES || "").split(",").filter(Boolean);
const cibles = CATALOG.filter(e => ONLY.length ? ONLY.includes(e.route.split(" ")[1]) : prix(e) <= MAXPRICE).sort((a, b) => prix(a) - prix(b)).slice(0, LIMIT);

const avant = await solde(account.address);
console.log(`Acheteur ${account.address}  solde ${avant.toFixed(4)} USDC`);
console.log(`${cibles.length} routes <= $${MAXPRICE}  (coût théorique $${cibles.reduce((s,e)=>s+prix(e),0).toFixed(3)})\n`);

let payees = 0, echecs = [];
for (const entry of cibles) {
  const [method, path] = entry.route.split(" ");
  const b = entry.bazaar || {};
  let url = `${BASE}${path}`;
  const init = { method, signal: AbortSignal.timeout(45000) };
  if (method === "GET") { const q = qs(b.input); if (q) url += `?${q}`; }
  else { init.headers = { "content-type": "application/json" }; init.body = JSON.stringify(b.input || {}); }
  try {
    const res = await fetchWithPayment(url, init);
    const h = res.headers.get("payment-response") || res.headers.get("x-payment-response");
    let tx = null; if (h) { try { tx = decodePaymentResponseHeader(h)?.transaction; } catch {} }
    if (tx) { payees++; console.log(`✅ ${path.padEnd(32)} $${prix(entry).toFixed(3)}  ${tx.slice(0,14)}…`); }
    else { echecs.push([path, res.status]); console.log(`⚠️  ${path.padEnd(32)} ${res.status} sans tx`); }
  } catch (e) {
    const m = String(e).slice(0, 70); echecs.push([path, m]);
    console.log(`❌ ${path.padEnd(32)} ${m}`);
    if (/insufficient|balance|fund/i.test(m)) { console.log("\n>>> FONDS ÉPUISÉS, arrêt."); break; }
  }
  await new Promise(r => setTimeout(r, 400));
}
const apres = await solde(account.address);
console.log(`\n=== ${payees}/${cibles.length} payées — dépensé ${(avant-apres).toFixed(4)} USDC, reste ${apres.toFixed(4)} ===`);
if (echecs.length) console.log("Échecs : " + echecs.map(e => e[0]+"("+e[1]+")").join(", "));
