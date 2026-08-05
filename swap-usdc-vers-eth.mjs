// Obtenir de l'ETH de gaz sur Base en partant d'un portefeuille qui n'en a AUCUN.
//
// Le problème. Boundless (dépôt de caution ZKC, verrouillage d'ordres) tourne sur
// Base et exige du gaz. Le portefeuille de revenus détient des USDC sur Base mais
// zéro ETH — et échanger USDC contre ETH SUR Base réclame d'abord une approbation
// ERC-20, qui est une transaction, donc qui coûte le gaz qu'on cherche à obtenir.
//
// La sortie. Les routes INTER-CHAÎNES de relay.link se règlent en signature seule
// (EIP-3009 : le relayeur avance le gaz et se paie sur le montant). On sort donc
// vers Optimism sans gaz, puis on revient sur Base en payant le gaz avec l'ETH
// qu'on vient de recevoir. Deux sauts, mais le premier débloque le second.
//
//   node swap-usdc-vers-eth.mjs <montant_usdc> [--executer]
//   Sans --executer : devis seulement, rien n'est signé.

import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";

const MONTANT = process.argv[2] || "5";
const EXECUTER = process.argv.includes("--executer");
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const NATIF = "0x0000000000000000000000000000000000000000";
const OPTIMISM = 10;

const pk = readFileSync(".wallet.secret", "utf8").match(/(?:PRIVATE_KEY|WALLET_PRIVATE_KEY)=(0x[0-9a-fA-F]+)/)[1];
const account = privateKeyToAccount(pk);
const brut = String(Math.round(Number(MONTANT) * 1e6));

console.log(`Portefeuille ${account.address}`);
console.log(`Échange ${MONTANT} USDC (Base) -> ETH (Optimism), sans gaz\n`);

const q = await (await fetch("https://api.relay.link/quote", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    user: account.address, recipient: account.address,
    originChainId: 8453, destinationChainId: OPTIMISM,
    originCurrency: USDC_BASE, destinationCurrency: NATIF,
    amount: brut, tradeType: "EXACT_INPUT",
    usePermit: true, explicitDeposit: true,
  }),
})).json();

if (!q.steps) { console.error("Pas de devis :", JSON.stringify(q).slice(0, 400)); process.exit(1); }

// Garde-fou : si une étape "transaction" apparaît, la route n'est plus gratuite.
// Signer quand même ferait échouer l'opération après avoir engagé les fonds.
const enChaine = q.steps.filter((s) => s.kind === "transaction");
if (enChaine.length) {
  console.error(`⛔ La route exige ${enChaine.length} transaction(s) on-chain — impossible sans ETH.`);
  console.error("   Étapes :", q.steps.map((s) => s.kind + "/" + s.id).join(", "));
  process.exit(1);
}

const recu = q.details?.currencyOut?.amountFormatted;
console.log(`Reçu estimé  : ${recu} ETH sur Optimism`);
console.log(`Frais relayeur: ${q.fees?.relayer?.amountFormatted ?? "0"} · impact ${q.details?.totalImpact?.percent ?? "?"} %`);

if (!EXECUTER) { console.log("\n(devis seul — relancer avec --executer pour signer)"); process.exit(0); }

const item = q.steps.find((s) => s.kind === "signature").items[0].data;
const types = { ...item.sign.types };
delete types.EIP712Domain;
const signature = await account.signTypedData({
  domain: item.sign.domain, types,
  primaryType: item.sign.primaryType,
  message: item.sign.value || item.sign.message,
});
console.log("\nAutorisation signée — aucun gaz payé.");

const post = item.post;
const url = `https://api.relay.link${post.endpoint}${post.endpoint.includes("?") ? "&" : "?"}signature=${signature}`;
const res = await fetch(url, {
  method: post.method || "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(post.body),
});
console.log(`Soumission : HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
if (!res.ok) process.exit(1);

const statusUrl = `https://api.relay.link/intents/status?requestId=${post.body.requestId}`;
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const st = await (await fetch(statusUrl)).json();
  const s = st.status || st.state || "?";
  console.log(`  [${i}] ${s}${st.txHashes ? " tx=" + JSON.stringify(st.txHashes) : ""}`);
  if (["success", "complete"].includes(s)) { console.log("\n✅ ETH reçu sur Optimism."); break; }
  if (s === "refund") { console.log("\n⚠️ remboursé — rien n'a été perdu."); break; }
}
