// Maintien de la redirection de port du proxy résidentiel — et SURVEILLANCE.
//
// Pourquoi cette réécriture. La version précédente demandait la redirection
// toutes les 30 min, ignorait le résultat, et n'écrivait qu'une seule ligne au
// démarrage. Le 06/08, l'UPnP de la box s'est retrouvé désactivé : les demandes
// échouaient en silence, le service affichait « online » depuis 197 h, et le
// port 8899 était fermé depuis l'extérieur — donc le proxy que la ferme VEND
// était injoignable, sans que rien ne le signale. Un service qui annonce une
// action sans en vérifier l'effet ne surveille rien.
//
// Deuxième panne, le 11/08, même symptôme et autre cause : la box avait déplacé
// son point de contrôle UPnP. La bibliothèque `nat-upnp` s'obstinait sur
// l'ancien (192.168.1.1:37215, ECONNREFUSED) alors que le service réel était
// annoncé sur 192.168.1.1:1900 avec le controlURL /ctl/IPConn. Le veilleur
// tournait, échouait à chaque tour, et la redirection n'a jamais été reposée.
// On ne dépend donc plus d'une découverte figée : à chaque tour, on redemande à
// la box OÙ est son service (SSDP), puis on lui parle en SOAP directement.
//
// Ce fichier vérifie trois choses, de la plus proche à la plus lointaine :
//   1. la redirection existe-t-elle réellement dans la table du routeur ;
//   2. le port répond-il depuis l'INTERNET (seule preuve qui compte) ;
//   3. sinon, alerte — une fois, pas à chaque tour.

import dgram from "node:dgram";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.PROXY_PORT || 8899);
// Le point de contrôle trouvé est gardé sur disque : lancé par launchd, le
// processus n'obtient pas toujours le droit d'émettre en multicast, donc la
// découverte SSDP y échoue alors que le dialogue SOAP en unicast, lui, passe.
// Sans cette mémoire, le veilleur ne démarrerait qu'en session interactive.
const MEMOIRE = path.join(import.meta.dirname, ".upnp-controle.json");
const NTFY = process.env.NTFY_TOPIC || "";       // même canal que la surveillance de la ferme
const HOTE_LAN = process.env.LAN_HOST || "";     // vide = adresse locale détectée
const PERIODE_MS = 30 * 60 * 1000;

const log = (...a) => console.error(new Date().toLocaleTimeString("fr-FR"), "[upnp-keep]", ...a);

let dejaAlerte = false;
let controle = null;   // { url, type } — redécouvert dès qu'un appel échoue

async function alerter(texte) {
  // Une seule alerte par panne : répéter toutes les 30 min noie le signal et
  // finit par être ignoré, ce qui reproduit exactement le problème d'origine.
  if (dejaAlerte) return;
  dejaAlerte = true;
  if (!NTFY) return log("⚠ aucune alerte possible : NTFY_TOPIC absent de l'environnement");
  try {
    await fetch(`https://ntfy.sh/${NTFY}`, {
      method: "POST",
      headers: { Title: "Proxy résidentiel INJOIGNABLE", Priority: "high" },
      body: texte,
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    log("⚠ alerte non transmise :", e.message);
  }
}

const PASSERELLE = process.env.GATEWAY || "192.168.1.1";

/**
 * Adresse IP de cette machine sur le MÊME réseau que la box — la cible de la
 * redirection, et la source à imposer pour lui parler.
 *
 * On la déduit des interfaces plutôt que d'une socket UDP « connectée » : cette
 * machine porte aussi les modems 4G qui servent les sorties mobiles, et le
 * routage par défaut peut sortir par l'un d'eux. C'est ce qui a fait échouer le
 * veilleur sous launchd le 11/08 — EHOSTUNREACH vers la box, depuis une machine
 * pourtant branchée dessus.
 */
function adresseLocale() {
  if (HOTE_LAN) return HOTE_LAN;
  const prefixe = PASSERELLE.split(".").slice(0, 3).join(".") + ".";
  for (const cartes of Object.values(os.networkInterfaces())) {
    for (const c of cartes || []) {
      if (c.family === "IPv4" && !c.internal && c.address.startsWith(prefixe)) return c.address;
    }
  }
  return null;
}

/**
 * Requête HTTP vers la box, source imposée. `fetch` ne permet pas de choisir
 * l'interface de sortie ; sur une machine multi-interfaces c'est indispensable.
 */
function requeteLAN(url, { method = "GET", headers = {}, body = null, delai = 12000 } = {}) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: u.hostname,
        port: u.port || 80,
        path: u.pathname + u.search,
        method,
        headers: body ? { ...headers, "Content-Length": Buffer.byteLength(body) } : headers,
        localAddress: adresseLocale() || undefined,
        timeout: delai,
      },
      (res) => {
        let t = "";
        res.setEncoding("utf8");
        res.on("data", (c) => { t += c; });
        res.on("end", () => resolve({ status: res.statusCode, texte: t }));
      },
    );
    req.on("timeout", () => { req.destroy(new Error("délai dépassé")); });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Lit une description UPnP et en extrait le point de contrôle de redirection.
 * On part toujours de la description : deviner l'URL du service directement
 * n'est pas testable — la box répond 501 à un HEAD et 405 à un GET sur son
 * propre controlURL, donc aucun sondage ne distingue « existe » de « n'existe
 * pas ». Le seul document qui fasse foi est celui qu'elle publie.
 */
async function lireDescription(loc) {
  try {
    const r = await requeteLAN(loc, { delai: 6000 });
    if (r.status !== 200) return null;
    const xml = r.texte;
    // WANIPConnection d'abord, WANPPPConnection en secours (box en PPPoE).
    for (const type of [
      "urn:schemas-upnp-org:service:WANIPConnection:1",
      "urn:schemas-upnp-org:service:WANPPPConnection:1",
    ]) {
      const bloc = xml.split("<service>").find((b) => b.includes(type));
      const ctrl = bloc && (bloc.match(/<controlURL>([^<]+)<\/controlURL>/i) || [])[1];
      if (ctrl) return { url: new URL(ctrl, loc).toString(), type };
    }
  } catch {}
  return null;
}

/**
 * Où est le service de redirection de port, MAINTENANT ? On le redemande à
 * chaque besoin plutôt que de le figer : c'est précisément le déplacement de ce
 * point de contrôle qui a fait tomber la surveillance le 11/08.
 */
function decouvrirControle() {
  return new Promise((resolve) => {
    const req = Buffer.from([
      "M-SEARCH * HTTP/1.1",
      "HOST: 239.255.255.250:1900",
      'MAN: "ssdp:discover"',
      "MX: 3",
      "ST: upnp:rootdevice",
      "", "",
    ].join("\r\n"));

    const emplacements = new Set();
    const s = dgram.createSocket({ type: "udp4", reuseAddr: true });
    s.on("message", (m) => {
      const loc = (m.toString().match(/LOCATION:\s*(\S+)/i) || [])[1];
      if (loc) emplacements.add(loc);
    });
    s.bind(() => { s.setBroadcast(true); s.send(req, 0, req.length, 1900, "239.255.255.250"); });

    setTimeout(async () => {
      try { s.close(); } catch {}
      for (const loc of emplacements) {
        const trouve = await lireDescription(loc);
        if (trouve) return resolve(trouve);
      }
      resolve(null);
    }, 4000);
  });
}

function lireMemoire() {
  try { return JSON.parse(fs.readFileSync(MEMOIRE, "utf8")); } catch { return null; }
}

function ecrireMemoire(c) {
  try { fs.writeFileSync(MEMOIRE, JSON.stringify(c)); } catch {}
}

/**
 * Trois sources, de la plus fiable à la plus spéculative : ce qui a marché la
 * dernière fois, puis l'annonce SSDP, puis les descriptions publiées aux
 * emplacements habituels. Le troisième recours n'est pas décoratif : lancé par
 * launchd, le processus n'émet pas en multicast, donc le SSDP y échoue
 * systématiquement alors que tout le reste fonctionne.
 */
async function trouverControle() {
  const memorise = lireMemoire();
  if (memorise?.url) return memorise;

  const decouvert = await decouvrirControle();
  if (decouvert) { ecrireMemoire(decouvert); return decouvert; }

  for (const port of [1900, 5000, 49152, 80]) {
    for (const chemin of ["/rootDesc.xml", "/description.xml", "/igd.xml", "/gatedesc.xml"]) {
      const trouve = await lireDescription(`http://${PASSERELLE}:${port}${chemin}`);
      if (trouve) { ecrireMemoire(trouve); return trouve; }
    }
  }
  return null;
}

async function soap(action, corps) {
  if (!controle) controle = await trouverControle();
  if (!controle) throw new Error("aucun service UPnP annoncé par la box");
  const body =
    '<?xml version="1.0"?>'
    + '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" '
    + 's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
    + `<s:Body><u:${action} xmlns:u="${controle.type}">${corps}</u:${action}></s:Body></s:Envelope>`;
  // Point de contrôle périmé, refusé ou injoignable : on oublie l'adresse
  // mémorisée, sinon le veilleur s'obstinerait dessus — c'est exactement la
  // panne du 11/08, où `nat-upnp` a rejoué pendant des jours un port que la box
  // n'exposait plus.
  const oublier = () => {
    controle = null;
    try { fs.unlinkSync(MEMOIRE); } catch {}
  };

  let r;
  try {
    r = await requeteLAN(controle.url, {
      method: "POST",
      headers: { "Content-Type": 'text/xml; charset="utf-8"', SOAPAction: `"${controle.type}#${action}"` },
      body,
    });
  } catch (e) {
    oublier();
    throw new Error(`${action} → ${e.message}`);
  }
  const texte = r.texte;
  if (r.status !== 200) {
    oublier();
    throw new Error(`${action} → HTTP ${r.status}`);
  }
  ecrireMemoire(controle);
  return texte;
}

async function demanderRedirection(cible) {
  await soap(
    "AddPortMapping",
    "<NewRemoteHost></NewRemoteHost>"
    + `<NewExternalPort>${PORT}</NewExternalPort>`
    + "<NewProtocol>TCP</NewProtocol>"
    + `<NewInternalPort>${PORT}</NewInternalPort>`
    + `<NewInternalClient>${cible}</NewInternalClient>`
    + "<NewEnabled>1</NewEnabled>"
    + "<NewPortMappingDescription>resi-proxy</NewPortMappingDescription>"
    + "<NewLeaseDuration>0</NewLeaseDuration>",
  );
}

/** La redirection est-elle réellement inscrite, et vers la bonne machine ? */
async function redirectionPresente() {
  const t = await soap(
    "GetSpecificPortMappingEntry",
    `<NewRemoteHost></NewRemoteHost><NewExternalPort>${PORT}</NewExternalPort><NewProtocol>TCP</NewProtocol>`,
  );
  const client = (t.match(/<NewInternalClient>([^<]*)</) || [])[1];
  const actif = (t.match(/<NewEnabled>([^<]*)</) || [])[1];
  return client ? { client, actif: actif !== "0" } : null;
}

/**
 * Le seul contrôle qui prouve quoi que ce soit : demander à un tiers, depuis
 * l'internet, si le port répond. Une redirection présente dans la table du
 * routeur ne garantit rien — le fournisseur peut filtrer en amont.
 */
async function joignableDepuisInternet(ip) {
  try {
    const r = await fetch(
      `https://check-host.net/check-tcp?host=${ip}:${PORT}&max_nodes=2`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) },
    );
    const { request_id: id } = await r.json();
    if (!id) return null;
    await new Promise((s) => setTimeout(s, 12000));
    const d = await (await fetch(`https://check-host.net/check-result/${id}`, {
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000),
    })).json();
    const res = Object.values(d || {}).map((v) => v && v[0]).filter(Boolean);
    if (!res.length) return null;
    return res.some((x) => x.time != null);
  } catch { return null; }
}

async function tour() {
  const cible = adresseLocale();
  if (!cible) return log("⚠ adresse LAN indéterminée, tour ignoré");

  let presente = null;
  try {
    await demanderRedirection(cible);
    presente = await redirectionPresente();
  } catch (e) {
    log("⚠ dialogue UPnP échoué :", e.message);
  }

  if (!presente || presente.client !== cible || !presente.actif) {
    log(`⛔ aucune redirection valable pour le port ${PORT}`, presente ? `(pointe vers ${presente.client})` : "");
    await alerter(
      `Aucune redirection UPnP exploitable pour le port ${PORT} vers ${cible}. `
      + `Le proxy vendu par la ferme est probablement injoignable. `
      + `Si l'UPnP de la box refuse durablement, créer une redirection manuelle ${PORT} TCP.`,
    );
    return;
  }

  let ip = null;
  try { ip = (await (await fetch("https://api.ipify.org", { signal: AbortSignal.timeout(8000) })).text()).trim(); } catch {}
  const ok = ip ? await joignableDepuisInternet(ip) : null;

  if (ok === false) {
    log(`⛔ redirection présente mais ${ip}:${PORT} ne répond pas depuis l'internet`);
    await alerter(`Redirection présente mais ${ip}:${PORT} injoignable depuis l'internet (filtrage opérateur ?).`);
  } else if (ok === true) {
    if (dejaAlerte) log("✅ port de nouveau joignable");
    dejaAlerte = false;
    log(`✅ ${ip}:${PORT} joignable · redirection vers ${cible}`);
  } else {
    log(`redirection présente vers ${cible} · vérification externe indisponible`);
  }
}

log(`démarrage · port ${PORT} · contrôle toutes les ${PERIODE_MS / 60000} min · alertes ${NTFY ? "actives" : "DÉSACTIVÉES (NTFY_TOPIC absent)"}`);
await tour();
setInterval(tour, PERIODE_MS);
