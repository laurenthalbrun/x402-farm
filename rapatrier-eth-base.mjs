// Second saut : ramener l'ETH d'Optimism vers Base, où tourne Boundless.
//
// Ce saut-ci n'a pas besoin d'être gratuit : on vient de recevoir de l'ETH sur
// Optimism, donc on peut y payer le gaz. On garde volontairement une réserve pour
// que la transaction de départ soit finançable — envoyer la totalité échouerait.
//
//   node rapatrier-eth-base.mjs [--executer]

import { readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, createPublicClient, http } from "viem";
import { optimism } from "viem/chains";

const EXECUTER = process.argv.includes("--executer");
const RESERVE_GAZ = 300_000_000_000_000n; // 0,0003 ETH laissés pour le gaz d'Optimism

const pk = readFileSync(".wallet.secret", "utf8").match(/(?:PRIVATE_KEY|WALLET_PRIVATE_KEY)=(0x[0-9a-fA-F]+)/)[1];
const account = privateKeyToAccount(pk);
const pub = createPublicClient({ chain: optimism, transport: http("https://mainnet.optimism.io") });

const solde = await pub.getBalance({ address: account.address });
console.log(`Optimism : ${Number(solde) / 1e18} ETH`);
if (solde <= RESERVE_GAZ) { console.error("⛔ solde insuffisant après réserve de gaz"); process.exit(1); }

const envoi = solde - RESERVE_GAZ;
console.log(`À rapatrier : ${Number(envoi) / 1e18} ETH (réserve de gaz conservée sur Optimism)\n`);

const NATIF = "0x0000000000000000000000000000000000000000";
const q = await (await fetch("https://api.relay.link/quote", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    user: account.address, recipient: account.address,
    originChainId: 10, destinationChainId: 8453,
    originCurrency: NATIF, destinationCurrency: NATIF,
    amount: envoi.toString(), tradeType: "EXACT_INPUT",
  }),
})).json();

if (!q.steps) { console.error("Pas de devis :", JSON.stringify(q).slice(0, 400)); process.exit(1); }
console.log(`Reçu estimé sur Base : ${q.details?.currencyOut?.amountFormatted} ETH`);
console.log(`Frais : ${q.fees?.relayer?.amountFormatted ?? "?"} · impact ${q.details?.totalImpact?.percent ?? "?"} %`);

if (!EXECUTER) { console.log("\n(devis seul — relancer avec --executer)"); process.exit(0); }

const wallet = createWalletClient({ account, chain: optimism, transport: http("https://mainnet.optimism.io") });
for (const step of q.steps) {
  for (const it of step.items || []) {
    const d = it.data;
    const hash = await wallet.sendTransaction({ to: d.to, data: d.data, value: BigInt(d.value || 0) });
    console.log(`  ${step.id} -> tx ${hash}`);
    await pub.waitForTransactionReceipt({ hash });
  }
}

const id = q.steps.flatMap((s) => s.items || []).map((i) => i.checkStatus || i.check?.endpoint).find(Boolean);
console.log("\nSuivi du relais…");
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const base = createPublicClient({ chain: { ...optimism, id: 8453 }, transport: http("https://mainnet.base.org") });
  const b = await base.getBalance({ address: account.address }).catch(() => 0n);
  console.log(`  [${i}] Base : ${Number(b) / 1e18} ETH`);
  if (b > 0n) { console.log("\n✅ ETH disponible sur Base."); break; }
}
