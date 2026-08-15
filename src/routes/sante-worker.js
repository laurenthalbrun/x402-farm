// Surveillance du Mac mini — vérifie qu'il RÉPOND, pas qu'il tourne.
//
// Pourquoi cette route existe. Le 06/08, le proxy résidentiel est resté
// injoignable pendant des jours : `resi-proxy` affichait « online », le
// surveillant UPnP annonçait son rafraîchissement toutes les 30 min, et le port
// était fermé. Tous les signaux disaient « sain » parce qu'aucun ne regardait
// depuis l'extérieur. La ferme a continué de vendre dans le vide.
//
// Le mini porte désormais TROIS sources de revenu : le rendu résidentiel des
// actors Apify, le proxy vendu par la ferme, et /v1/transcribe. S'il tombe, les
// trois tombent ensemble.
//
// Deux principes, tirés de cette panne :
//   1. La sonde tourne AILLEURS que sur la machine surveillée — un veilleur
//      hébergé sur ce qu'il surveille ne peut pas signaler sa propre panne.
//   2. On vérifie la CAPACITÉ de bout en bout, pas un /health. Un service peut
//      répondre « ok » et être incapable de faire son travail : c'est
//      exactement ce qui s'est produit quand yt-dlp était introuvable dans le
//      PATH de launchd — le worker démarrait sain et échouait à la première
//      transcription.

import { Router } from "express";
import net from "node:net";
// On réutilise la sonde du chemin de vente lui-même : une copie de la vérification
// de signature dériverait, et la surveillance finirait par valider ce que la vente refuse.
import { santePublication } from "./proxy.js";

const router = Router();

const WORKER_URL = (process.env.WORKER_URL || "").replace(/\/+$/, "");
const WORKER_SECRET = process.env.WORKER_SECRET || "";
const NTFY = process.env.NTFY_TOPIC || "";

// Clip court et stable : la preuve doit coûter presque rien. 30 s d'audio
// représentent ~0,0003 $ chez Groq, soit quelques centimes par mois même en
// contrôlant tous les quarts d'heure.
const TEMOIN = "https://www.tiktok.com/@nasa/video/7670721000471891214";

async function sonder(nom, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    return { nom, ok: true, ms: Date.now() - t0, ...detail };
  } catch (e) {
    return { nom, ok: false, ms: Date.now() - t0, erreur: String(e.message || e).slice(0, 160) };
  }
}

function portOuvert(hote) {
  const i = hote.lastIndexOf(":");
  const ip = hote.slice(0, i);
  const port = Number(hote.slice(i + 1));
  return new Promise((res, rej) => {
    const s = new net.Socket();
    let fait = false;
    const fin = (ok) => { if (fait) return; fait = true; try { s.destroy(); } catch {} ok ? res(true) : rej(new Error("injoignable")); };
    s.setTimeout(4000);
    s.once("connect", () => fin(true));
    s.once("timeout", () => fin(false));
    s.once("error", () => fin(false));
    s.connect(port, ip);
  });
}

router.get("/free/sante/mini", async (req, res) => {
  if (!WORKER_URL) return res.status(503).json({ error: "worker_url_absent" });

  const complet = req.query.full !== "0";
  const controles = [];

  controles.push(await sonder("worker_health", async () => {
    const r = await fetch(`${WORKER_URL}/health`, {
      headers: { "x-worker-secret": WORKER_SECRET }, signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw new Error(`http_${r.status}`);
    return {};
  }));

  // La preuve réelle : une transcription complète. C'est le seul contrôle qui
  // couvre le tunnel, yt-dlp, ffmpeg, le PATH, la clé Groq et le réseau.
  if (complet) {
    controles.push(await sonder("transcription_bout_en_bout", async () => {
      const r = await fetch(`${WORKER_URL}/v1/transcribe?url=${encodeURIComponent(TEMOIN)}`, {
        headers: { "x-worker-secret": WORKER_SECRET }, signal: AbortSignal.timeout(120000),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ? `${j.error}: ${(j.detail || "").slice(0, 80)}` : `http_${r.status}`);
      const n = (j.transcript || "").length;
      // Un texte vide est un échec silencieux : la requête aboutit, le service
      // paraît sain, et le client reçoit du vide.
      if (n < 20) throw new Error(`texte trop court (${n} caractères)`);
      return { caracteres: n, langue: j.language || null };
    }));
  }

  if (process.env.PROXY_PUBLIC_HOST) {
    controles.push(await sonder("proxy_port", async () => {
      await portOuvert(process.env.PROXY_PUBLIC_HOST);
      return { hote: process.env.PROXY_PUBLIC_HOST };
    }));
  }

  // Depuis le 13/08, la ferme ne joint plus le mini pour savoir si elle peut vendre :
  // le mini PUBLIE son état, la ferme lit la ligne. Ce chemin peut mourir en silence —
  // le publieur s'arrête, la ferme retombe sur l'appel direct, la vente continue mais
  // par le chemin fragile qui refusait 14 % des requêtes. Rien ne le signalerait.
  // On mesure donc ce qui compte vraiment : la ferme peut-elle lire MAINTENANT un état
  // frais et correctement signé ?
  controles.push(await sonder("publication_sorties", async () => await santePublication()));

  const echecs = controles.filter((c) => !c.ok);
  const sain = echecs.length === 0;

  // Alerte seulement sur les échecs, et seulement si un canal est configuré.
  // La répétition à chaque tour finirait par être ignorée : c'est au déclencheur
  // extérieur d'espacer, pas à cette route de se taire.
  //
  // ⚠️ L'envoi est ATTENDU avant de répondre. En « oublie-et-continue », il ne
  // partait jamais : la fonction serverless est gelée dès la réponse envoyée,
  // et la requête sortante meurt avec elle. C'est exactement ce qui s'est passé
  // du 06 au 11/08 — le port 8899 est resté fermé, le cron a constaté l'échec
  // toutes les 30 min, et pas une alerte n'est arrivée. Une surveillance qui
  // détecte sans prévenir ne vaut pas mieux que pas de surveillance.
  let alerte = null;
  if (!sain && NTFY && req.query.alert !== "0") {
    try {
      // ⚠️ Le titre PASSAIT PAR UN EN-TÊTE HTTP, qui n'accepte que des octets.
      // « Mac mini — capacité dégradée » contient un tiret cadratin (U+2014) en
      // position 9 : fetch levait « Cannot convert argument to a ByteString » et
      // AUCUNE alerte ne partait. La panne était détectée toutes les 30 minutes
      // et signalée à personne — exactement le défaut que le commentaire
      // ci-dessus prétendait avoir corrigé, déplacé de l'envoi vers l'encodage.
      //
      // On passe donc par la publication JSON de ntfy : le corps est encodé en
      // UTF-8, aucun texte accentué ne transite plus par un en-tête.
      const r = await fetch("https://ntfy.sh/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: NTFY,
          title: "Mac mini — capacité dégradée",
          priority: 4,
          message:
            echecs.map((e) => `${e.nom} : ${e.erreur}`).join("\n")
            + "\n\nImpact : rendu résidentiel des actors Apify, proxy vendu par la ferme, /v1/transcribe."
            + (echecs.some((e) => e.nom === "publication_sorties")
              ? "\n⚠️ publication_sorties : la vente des bundles proxy repasse par l'appel direct au mini (chemin fragile). Relancer : launchctl kickstart -k gui/$(id -u)/com.x402farm.publish-exits"
              : ""),
        }),
        signal: AbortSignal.timeout(8000),
      });
      alerte = r.ok ? "envoyee" : `echec_http_${r.status}`;
    } catch (e) {
      alerte = `echec: ${String(e.message || e).slice(0, 80)}`;
    }
  }

  res.status(sain ? 200 : 503).json({
    sain,
    verifie_le: new Date().toISOString(),
    controles,
    alerte,
    porte: ["apify_residential_render", "proxy_bundles", "/v1/transcribe"],
  });
});

export default router;
