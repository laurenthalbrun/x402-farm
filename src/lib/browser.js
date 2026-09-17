import { isPrivateIp } from "./guard.js";

// ---------- Deuxième ligne de défense anti-SSRF ----------
// assertPublicUrl (lib/guard.js) ne valide que l'URL de DÉPART, et il la rend telle quelle,
// nom d'hôte intact. Chromium résout ensuite le DNS LUI-MÊME, plusieurs secondes plus tard,
// et suit les redirections. Deux trous en découlent, tous deux vérifiés :
//   1. redirection : une page publique renvoie une 302 vers 169.254.169.254 ou vers le LAN,
//      et page.content() rend le contenu interne à l'appelant. Aucun contrôle du DNS requis.
//   2. DNS rebinding : TTL=0, réponse publique au garde puis privée au navigateur.
// On vérifie donc, après navigation, l'IP RÉELLEMENT contactée sur toute la chaîne de
// redirections, et on refuse de rendre le contenu si l'un des sauts a atterri en privé.
//
// Pourquoi pas une interception context.route("**/*") : mesuré le 2026-09-02, elle coûte
// +225 % sur une page lourde (lemonde.fr : 2,7 s -> 8,9 s), et le coût vient de l'aller-
// retour Playwright lui-même, pas du filtre — le restreindre aux navigations ne change
// rien (8,9 s aussi). Le blocage AVANT connexion se fait donc au niveau réseau (ACL squid
// sur le mini), pas ici. Résiduel assumé : un GET aveugle peut atteindre un hôte interne,
// mais aucune donnée ne remonte à l'appelant.
// serverAddr() donne l'IP à laquelle Chromium s'est effectivement connecté : c'est ce qui
// attrape le rebinding, que la vérification DNS du garde ne peut pas voir.
async function assertNavigationStayedPublic(response) {
  const chain = [];
  let r = response;
  while (r) {
    chain.push(r);
    const from = r.request().redirectedFrom();
    r = from ? await from.response() : null;
  }
  for (const resp of chain) {
    const addr = await resp.serverAddr().catch(() => null);
    if (addr?.ipAddress && isPrivateIp(addr.ipAddress)) {
      throw Object.assign(new Error("private_address_blocked"), { status: 400 });
    }
  }
}

// Sur Vercel : chromium allégé @sparticuz + playwright-core. Ailleurs : Playwright complet.
const IS_VERCEL = !!process.env.VERCEL;

// Un seul navigateur partagé, un contexte jetable par requête,
// et un sémaphore pour ne pas mettre le VPS à genoux.
const MAX_CONCURRENT = Number(process.env.BROWSER_CONCURRENCY || 4);
const NAV_TIMEOUT_MS = Number(process.env.NAV_TIMEOUT_MS || 25000);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 x402-farm/0.1";

let browserPromise = null;
let active = 0;
const queue = [];

function acquire() {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  return new Promise((resolve) => queue.push(resolve));
}

function release() {
  const next = queue.shift();
  if (next) next();
  else active--;
}

// SORTIE MOBILE — le navigateur peut sortir par l'IP d'opérateur mobile (4G) au lieu de
// la fibre. Prouvé le 2026-07-30 : 193.251.162.192 / France Telecom au lieu de
// 109.62.35.111 / Outremer Telecom. On lance un navigateur DÉDIÉ derrière le proxy plutôt
// qu'un proxy par contexte : sur Chromium le proxy par contexte exige un proxy au niveau
// du lancement, autant être explicite.
const MOBILE_PROXY = process.env.MOBILE_PROXY_URL || "http://127.0.0.1:8899";
const MOBILE_USER = process.env.MOBILE_PROXY_USER || "mobile1";
const MOBILE_KEY = process.env.MOBILE_PROXY_KEY || "";
// Chemin RAPIDE pour notre propre scraping : squid, lié à l'IP du modem, sans
// authentification, en écoute sur la boucle locale du mini seulement. Notre proxy Node
// garde l'authentification et le comptage pour les CLIENTS, mais il ne tient pas une page
// à ~100 connexions parallèles (Google Maps expirait à travers lui). Si squid n'est pas
// configuré, on retombe sur le proxy client — jamais sur la fibre en silence.
const MOBILE_SQUID = process.env.MOBILE_PROXY_SQUID || "";
export const mobileExitConfigured = !!(MOBILE_KEY || MOBILE_SQUID);
const proxyCfg = () => (MOBILE_SQUID
  ? { server: MOBILE_SQUID }
  : { server: MOBILE_PROXY, username: MOBILE_USER, password: MOBILE_KEY });
// Demander la sortie mobile sans l'avoir configurée doit ÉCHOUER, jamais retomber en
// silence sur la fibre : on ne livre pas autre chose que ce qui est vendu.
function requireMobile() {
  if (!MOBILE_KEY && !MOBILE_SQUID) {
    throw Object.assign(new Error("mobile_exit_not_configured"), { status: 503 });
  }
}

async function launch(mobile = false) {
  if (IS_VERCEL) {
    const [{ chromium }, sparticuz] = await Promise.all([
      import("playwright-core"),
      import("@sparticuz/chromium"),
    ]);
    return chromium.launch({
      headless: true,
      executablePath: await sparticuz.default.executablePath(),
      args: [...sparticuz.default.args, "--disable-dev-shm-usage"],
      ...(mobile ? { proxy: proxyCfg() } : {}),
    });
  }
  const { chromium } = await import("playwright");
  return chromium.launch({
    headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"],
    ...(mobile ? { proxy: proxyCfg() } : {}),
  });
}
let mobileBrowserPromise = null;
let mobileStealthPromise = null;

async function getBrowser(mobile = false) {
  if (mobile) {
    requireMobile();
    if (!mobileBrowserPromise) {
      mobileBrowserPromise = launch(true);
      mobileBrowserPromise.then((b) => b.on("disconnected", () => (mobileBrowserPromise = null)));
    }
    return mobileBrowserPromise;
  }
  if (!browserPromise) {
    browserPromise = launch();
    browserPromise.then((b) => b.on("disconnected", () => (browserPromise = null)));
  }
  return browserPromise;
}

export async function withPage(url, fn, { fullPage = false, exit } = {}) {
  await acquire();
  let context;
  try {
    const browser = await getBrowser(exit === "mobile");
    context = await browser.newContext({
      userAgent: UA,
      viewport: { width: 1280, height: fullPage ? 720 : 800 },
      locale: "fr-FR",
    });
    // Cookies de consentement Google (évitent l'interstitiel consent.google.com sur Maps/Search).
    // Portée .google.com uniquement -> sans effet sur les autres domaines.
    await context.addCookies([
      { name: "SOCS", value: "CAISNQgQEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjQwMTA5LjA3X3AxGgJlbiACGgYIgLC_rQY", domain: ".google.com", path: "/" },
      { name: "CONSENT", value: "YES+cb.20210328-17-p0.en+FX+000", domain: ".google.com", path: "/" },
    ]).catch(() => {});
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    await assertNavigationStayedPublic(response);
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    return await fn(page);
  } finally {
    if (context) await context.close().catch(() => {});
    release();
  }
}

export async function closeBrowser() {
  if (browserPromise) (await browserPromise).close().catch(() => {});
}

// ---------- Mode furtif (anti-fingerprint) pour les sites à anti-bot (Amazon, immo…) ----------
// playwright-extra + stealth patchent ~20 vecteurs de détection (webdriver, plugins, WebGL…).
// Import DYNAMIQUE : ne charge QUE sur le worker (les routes concernées sont forcées sur le mini),
// jamais sur Vercel (qui n'a pas le playwright complet). UA Chrome récent + contexte FR réaliste.
const STEALTH_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
let stealthChromium = null;
let stealthBrowserPromise = null;
async function getStealthChromium() {
  if (stealthChromium) return stealthChromium;
  const { chromium } = await import("playwright-extra");
  const stealth = (await import("puppeteer-extra-plugin-stealth")).default;
  chromium.use(stealth());
  stealthChromium = chromium;
  return stealthChromium;
}
async function getStealthBrowser(mobile = false) {
  const args = ["--disable-blink-features=AutomationControlled", "--no-sandbox", "--disable-dev-shm-usage"];
  if (mobile) {
    requireMobile();
    if (!mobileStealthPromise) {
      const ch = await getStealthChromium();
      mobileStealthPromise = ch.launch({ headless: true, args, proxy: proxyCfg() });
      mobileStealthPromise.then((b) => b.on("disconnected", () => (mobileStealthPromise = null)));
    }
    return mobileStealthPromise;
  }
  if (!stealthBrowserPromise) {
    const ch = await getStealthChromium();
    stealthBrowserPromise = ch.launch({ headless: true, args });
    stealthBrowserPromise.then((b) => b.on("disconnected", () => (stealthBrowserPromise = null)));
  }
  return stealthBrowserPromise;
}
export async function withStealthPage(url, fn, { waitMs = 3500, cookies = [], exit } = {}) {
  await acquire();
  let context;
  try {
    const browser = await getStealthBrowser(exit === "mobile");
    context = await browser.newContext({
      userAgent: STEALTH_UA, locale: "fr-FR", timezoneId: "Europe/Paris",
      viewport: { width: 1366, height: 900 },
      extraHTTPHeaders: { "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8" },
    });
    if (cookies.length) await context.addCookies(cookies).catch(() => {});
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    await assertNavigationStayedPublic(response);
    if (waitMs) await page.waitForTimeout(waitMs);
    return await fn(page);
  } finally {
    if (context) await context.close().catch(() => {});
    release();
  }
}
