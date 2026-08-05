// Contrôle avant déploiement : le script inline du tableau de bord doit PARSER.
//
// Pourquoi ce garde-fou existe. La page est produite depuis un template literal
// JavaScript. Un `\n` écrit simplement au lieu de `\\n` est donc interprété à la
// GÉNÉRATION : il injecte un vrai retour à la ligne au milieu d'une chaîne, le
// script entier cesse de parser, et la page se charge normalement — coquille,
// styles, tuiles — mais AUCUN code ne s'exécute. Pas d'erreur console côté
// serveur, pas de requête réseau, pas même l'overlay de saisie du token : un
// tableau de bord parfaitement muet. C'est arrivé le 2026-08-04 et il a fallu
// remonter jusqu'au DOM pour le voir.
//
// Usage :  node scripts/verifier-dashboard.mjs
// Sort en code 1 si le script ne parse pas.

import dashboardRoutes from "../src/routes/dashboard.js";

// On rejoue la route sans démarrer de serveur : un faux couple req/res suffit,
// le handler se contente de res.type(...).send(html).
function rendreHtml() {
  const couche = dashboardRoutes.stack.find(
    (l) => l.route?.path === "/dashboard" && l.route.methods.get
  );
  if (!couche) throw new Error("route GET /dashboard introuvable dans le router");

  let html = null;
  const res = {
    type() { return res; },
    set() { return res; },
    status() { return res; },
    send(corps) { html = corps; return res; },
  };
  couche.route.stack[0].handle({ query: {}, headers: {}, get: () => undefined }, res, () => {});
  if (html == null) throw new Error("le handler n'a rien envoyé");
  return String(html);
}

const html = rendreHtml();
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

if (!scripts.length) {
  console.error("⛔ aucun script inline dans /dashboard — la page serait inerte");
  process.exit(1);
}

let casse = 0;
scripts.forEach((js, i) => {
  try {
    new Function(js);
    console.log(`✓ script ${i + 1} : ${js.length} caractères, syntaxe valide`);
  } catch (e) {
    casse++;
    // On situe l'erreur : le message seul ("Invalid or unexpected token") ne dit
    // pas où regarder dans 19 000 caractères.
    const lignes = js.split("\n");
    const suspecte = lignes.findIndex((l) => (l.match(/"/g) || []).length % 2 === 1);
    console.error(`⛔ script ${i + 1} NE PARSE PAS : ${e.message}`);
    if (suspecte >= 0) {
      console.error(`   ligne ${suspecte + 1} a un nombre impair de guillemets :`);
      console.error(`   ${lignes[suspecte].trim().slice(0, 120)}`);
      console.error(`   → cherche un \\n (ou \\t, \\u…) qui aurait dû être écrit \\\\n dans src/routes/dashboard.js`);
    }
  }
});

if (casse) process.exit(1);
console.log("\n✓ le tableau de bord s'exécutera");
