import dns from "node:dns/promises";
import net from "node:net";

// Anti-SSRF : on ne visite que du web public. Sans ça, un agent pourrait nous faire
// requêter localhost, le métadata endpoint du cloud ou le réseau interne du VPS.
//
// ⚠️ Ce module ne suffit PAS à lui seul. Il valide l'URL de DÉPART ; Chromium résout
// ensuite le DNS lui-même et suit les redirections. La deuxième ligne de défense est
// dans lib/browser.js (interception + vérification de l'IP réellement contactée).
const PRIVATE_V4 = [
  /^0\./,                                       // « this network »
  /^10\./,                                      // RFC1918
  /^127\./,                                     // loopback
  /^169\.254\./,                                // lien-local + métadonnées cloud
  /^172\.(1[6-9]|2\d|3[01])\./,                 // RFC1918
  /^192\.168\./,                                // RFC1918
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,   // CGNAT RFC6598
  /^192\.0\.0\./,                               // IETF protocol assignments
  /^192\.0\.2\./,                               // TEST-NET-1
  /^198\.1[89]\./,                              // banc d'essai RFC2544
  /^198\.51\.100\./,                            // TEST-NET-2
  /^203\.0\.113\./,                             // TEST-NET-3
  /^(22[4-9]|23\d)\./,                          // multicast 224-239
  /^(24\d|25[0-5])\./,                          // réservé 240-255 + broadcast
];

// ::ffff:10.0.0.1 et 0:0:0:0:0:ffff:a00:1 désignent 10.0.0.1. Sans cette normalisation,
// un serveur DNS hostile renvoyant un AAAA IPv4-mapped traversait le garde d'un seul coup,
// sans même avoir besoin de rebinding.
function mappedV4(ip) {
  const low = ip.toLowerCase().replace(/^:+/, "");
  let m = /^(?:0{1,4}:)*ffff:((?:\d{1,3}\.){3}\d{1,3})$/.exec(low);
  if (m) return m[1];
  m = /^(?:0{1,4}:)*ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(low);
  if (m) {
    const a = parseInt(m[1], 16), b = parseInt(m[2], 16);
    return `${(a >> 8) & 255}.${a & 255}.${(b >> 8) & 255}.${b & 255}`;
  }
  return null;
}

export function isPrivateIp(ip) {
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    const v4 = mappedV4(low);
    if (v4) return PRIVATE_V4.some((re) => re.test(v4));
    if (low === "::" || low === "::1") return true;
    if (/^fe[89ab]/.test(low)) return true;   // fe80::/10 lien-local
    if (/^f[cd]/.test(low)) return true;      // fc00::/7 unique-local
    if (/^ff/.test(low)) return true;         // multicast
    return false;
  }
  if (net.isIPv4(ip)) return PRIVATE_V4.some((re) => re.test(ip));
  return true; // format inconnu -> on refuse
}

// new URL() garde les crochets des littéraux IPv6 dans hostname, et net.isIP() les rejette.
// Sans ce déballage, « http://[::ffff:10.0.0.1]/ » n'était bloqué que par accident, parce
// que la résolution DNS de la chaîne entre crochets échouait.
export function bareHost(hostname) {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

export async function assertPublicUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw Object.assign(new Error("invalid_url"), { status: 400 });
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw Object.assign(new Error("protocol_not_allowed"), { status: 400 });
  }
  const host = bareHost(url.hostname);
  if (net.isIP(host)) {
    if (isPrivateIp(host)) {
      throw Object.assign(new Error("private_address_blocked"), { status: 400 });
    }
    return url;
  }
  let addrs;
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw Object.assign(new Error("dns_resolution_failed"), { status: 400 });
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw Object.assign(new Error("private_address_blocked"), { status: 400 });
  }
  return url;
}
