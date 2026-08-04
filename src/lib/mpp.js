// Machine Payments Protocol (Stripe + Tempo) branché À CÔTÉ de x402.
//
// Pourquoi : x402 exige de l'agent un portefeuille USDC approvisionné. La
// plupart des agents qui tournent en entreprise n'en ont pas. MPP ouvre deux
// autres portes sur EXACTEMENT les mêmes routes — la carte bancaire (via les
// Shared Payment Tokens de Stripe) et le stablecoin sur Tempo — sans rien
// retirer à x402.
//
// Comment les deux protocoles cohabitent sur une seule réponse 402 :
//   • x402 décrit son paiement dans le CORPS JSON de la réponse ;
//   • MPP le décrit dans des en-têtes `WWW-Authenticate: Payment …`, un par
//     méthode acceptée.
// Un agent lit ce qu'il sait lire et ignore le reste. On enrichit donc le 402
// déjà produit par le middleware x402 plutôt que d'en émettre un second.
//
// Le module est INERTE tant que STRIPE_SECRET_KEY (ou TEMPO_PAY_TO) est absent :
// aucune régression possible sur l'existant.

import { Mppx, stripe as stripeMethod, tempo as tempoMethod } from 'mppx/server';

// Stripe refuse les débits carte en dessous de ce seuil. En dessous, seule la
// voie stablecoin est annoncée — inutile de proposer un paiement qui échouera.
const MINIMUM_CARTE_USD = 0.5;

const SECRET_STRIPE = process.env.STRIPE_SECRET_KEY || '';
const PROFIL_STRIPE = process.env.STRIPE_PROFILE_ID || 'internal';
const TEMPO_PAY_TO = process.env.TEMPO_PAY_TO || '';

let mppx = null;
let methodes = [];

/** Le paiement MPP est-il configuré ? */
export function mppActif() {
  return !!(SECRET_STRIPE || TEMPO_PAY_TO);
}

function instance() {
  if (mppx) return mppx;
  methodes = [];
  if (TEMPO_PAY_TO) methodes.push(tempoMethod({ recipient: TEMPO_PAY_TO }));
  if (SECRET_STRIPE) {
    methodes.push(
      stripeMethod({
        secretKey: SECRET_STRIPE,
        networkId: PROFIL_STRIPE,
        paymentMethodTypes: ['card', 'link'],
        decimals: 2,
      }),
    );
  }
  mppx = Mppx.create({ methods: methodes });
  return mppx;
}

/** Méthodes réellement proposables pour un prix donné. */
function methodesPour(prixUsd) {
  const noms = [];
  if (TEMPO_PAY_TO) noms.push('tempo');
  if (SECRET_STRIPE && prixUsd >= MINIMUM_CARTE_USD) noms.push('stripe');
  return noms;
}

/**
 * Montant annoncé. Le catalogue descend sous le centime (/v1/render vaut
 * 0,005 $) : arrondir à deux décimales ferait payer le double. Le stablecoin
 * accepte six décimales, la carte s'arrête au cent — mais elle n'est proposée
 * qu'au-dessus de 0,50 $, où l'arrondi ne coûte rien.
 */
function montantPour(methode, prixUsd) {
  if (methode === 'stripe') return prixUsd.toFixed(2);
  return String(Number(prixUsd.toFixed(6)));
}

/* ------------------------------------------------------------------ pont */
// mppx raisonne en Request/Response de la Fetch API ; Express 4 raisonne en
// req/res Node. Deux traductions, volontairement minimales : on ne transporte
// que ce dont la vérification de paiement a besoin.

function versRequeteWeb(req) {
  const base = `${req.protocol}://${req.get('host') || 'localhost'}`;
  const entetes = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') entetes.set(k, v);
    else if (Array.isArray(v)) entetes.set(k, v.join(', '));
  }
  return new Request(new URL(req.originalUrl || req.url, base), {
    method: req.method,
    headers: entetes,
    // le corps n'entre pas dans la vérification du paiement
  });
}

/* --------------------------------------------------------- vérification */

/**
 * Tente d'encaisser via MPP. Ne se déclenche que si l'agent a présenté un
 * justificatif ; sinon on rend la main sans rien faire, et c'est x402 qui
 * répondra 402.
 *
 * @returns {Promise<{paye: boolean, recu?: any, erreur?: string}>}
 */
export async function verifierPaiementMpp(req, prixUsd) {
  if (!mppActif()) return { paye: false };
  const credential = req.get('authorization') || req.get('x-payment-credential');
  if (!credential) return { paye: false };

  const noms = methodesPour(prixUsd);
  if (!noms.length) return { paye: false };

  try {
    const m = instance();
    const intents = [];
    if (noms.includes('tempo')) {
      intents.push(m.tempo.charge({ amount: montantPour('tempo', prixUsd), recipient: TEMPO_PAY_TO }));
    }
    if (noms.includes('stripe')) {
      intents.push(m.stripe.charge({ amount: montantPour('stripe', prixUsd), currency: 'usd' }));
    }

    const reponse = await Mppx.compose(...intents)(versRequeteWeb(req));
    // 402 = justificatif absent ou refusé : on laisse x402 prendre la suite.
    if (!reponse || reponse.status === 402) return { paye: false };
    return { paye: true, recu: reponse.receipt ?? null };
  } catch (e) {
    // Un incident chez Stripe ne doit jamais fermer la route : x402 reste ouvert.
    return { paye: false, erreur: String(e?.message || e).slice(0, 200) };
  }
}

/* ------------------------------------------- annonce sur la réponse 402 */

/**
 * En-têtes `WWW-Authenticate` décrivant les moyens de paiement MPP acceptés.
 * Ils s'ajoutent au 402 de x402 sans en modifier le corps.
 */
export function entetesDefi(prixUsd, ressource) {
  const noms = methodesPour(prixUsd);
  if (!noms.length) return [];
  const id = `chal_${Buffer.from(`${ressource}:${prixUsd}`).toString('base64url').slice(0, 24)}`;
  return noms.map((methode) =>
    [
      `Payment id="${id}"`,
      `method="${methode}"`,
      'intent="charge"',
      `amount="${montantPour(methode, prixUsd)}"`,
      methode === 'stripe' ? 'currency="usd"' : `recipient="${TEMPO_PAY_TO}"`,
    ].join(', '),
  );
}

export const MPP = { MINIMUM_CARTE_USD, mppActif, methodesPour };
