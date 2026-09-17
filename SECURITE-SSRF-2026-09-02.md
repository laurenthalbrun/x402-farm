# SSRF — audit et correctifs, 2 septembre 2026

Point de départ : un rapport externe de **Syed Anas Mohiuddin**, chercheur indépendant, signalant un contournement du garde anti-SSRF par DNS rebinding. Vérifié au commit `347fea3`.

## Verdict sur le rapport reçu

**Fondé.** Les trois fichiers cités correspondent au code, et le mécanisme décrit est réel : `assertPublicUrl` résolvait le DNS, jetait le résultat et rendait l'URL avec le nom d'hôte intact ; Chromium le résolvait à nouveau, seul, quelques secondes plus tard. Aucun épinglage entre les deux.

**Une inexactitude, mineure.** Le rapport explique que les formes IPv6 entre crochets échouaient parce que « l'analyseur d'URL de Node normalise ces formats avant que `isPrivateIp()` ne les traite ». Ce n'est pas le mécanisme. `new URL()` **conserve** les crochets dans `hostname`, `net.isIP("[::1]")` renvoie donc 0, le code partait en résolution DNS de la chaîne entre crochets et celle-ci échouait. Les littéraux IPv6 étaient bloqués **par accident**, pas par le contrôle voulu. La distinction compte, voir la faille n°4.

## Failles retenues

| # | Faille | Gravité | Trouvée par |
|---|---|---|---|
| 1 | DNS rebinding TOCTOU entre le garde et Chromium | élevée | le rapport |
| 2 | Redirection non revalidée : une 302 vers une IP privée rend le contenu interne | **élevée, plus facile que la n°1** | audit interne |
| 3 | `/v1/amazon?url=` n'appelait aucun garde | **élevée, exploitation triviale** | audit interne |
| 4 | `isPrivateIp` laissait passer les IPv4-mapped IPv6 | élevée | audit interne |
| 5 | Plages absentes : 198.18/15, 192.0.0/24, 224/4, 240/4, `::` | faible | audit interne |

### 2. Redirection non revalidée
Le garde ne voit que l'URL de départ. `page.goto` suit les redirections. Une page publique renvoyant `302 Location: http://169.254.169.254/` fait atterrir le document sur la cible interne, et `/v1/render` en rend le contenu via `page.content()`. **Aucun contrôle du DNS n'est nécessaire**, un simple redirecteur public suffit. Prouvé localement avec deux serveurs sur la boucle locale : le secret interne remontait bien dans la réponse.

⚠️ Le correctif proposé dans le rapport (`--host-resolver-rules="MAP <hostname> <ip-validée>"`) **ne ferme pas cette faille** : la règle ne porte que sur le nom d'hôte validé, et une redirection vers un littéral d'IP ou vers un autre nom d'hôte y échappe.

### 3. `/v1/amazon` sans garde
`scrapeProduct` acceptait toute URL absolue et la passait directement à `withStealthPage`. `/v1/amazon?url=http://169.254.169.254/` suffisait, sur le worker du mini, donc sur le LAN.

### 4. IPv4-mapped IPv6
`isPrivateIp("::ffff:10.0.0.1")` renvoyait `false`. Comme `dns.lookup(host, { all: true })` remonte aussi les enregistrements **AAAA**, un serveur DNS hostile répondant `AAAA ::ffff:169.254.169.254` traversait le garde **d'un seul coup, sans rebinding ni course**.

## Correctifs appliqués

`src/lib/guard.js`
- Normalisation des IPv4-mapped IPv6 (`::ffff:10.0.0.1` et `0:0:0:0:0:ffff:a00:1`) avant contrôle.
- Déballage explicite des crochets IPv6 : le blocage devient intentionnel.
- Plages ajoutées : 192.0.0/24, 192.0.2/24, 198.18/15, 198.51.100/24, 203.0.113/24, multicast 224-239, réservé 240-255, `::`, `fe80::/10` élargi, multicast v6.
- Refus par défaut sur un format inconnu et sur une résolution vide.
- `isPrivateIp` et `bareHost` exportés pour réemploi.

`src/lib/browser.js`
- `assertNavigationStayedPublic(response)` après chaque `page.goto`, dans `withPage` **et** `withStealthPage` : remonte toute la chaîne de redirections et vérifie l'IP **réellement contactée** via `response.serverAddr()`. Ferme la n°2 et neutralise la n°1, puisque le rebinding est détecté à l'IP réelle, que la vérification DNS ne peut pas voir.

`src/routes/amazon.js`
- `?url=` passe par `assertPublicUrl` **et** doit être un domaine Amazon.
- L'ASIN, concaténé dans un chemin, est borné à `[A-Za-z0-9]{6,16}`.

## Ce qui a été écarté, et pourquoi

Une interception `context.route("**/*")` bloquant avant connexion a été implémentée puis **retirée après mesure** : +225 % sur une page lourde (lemonde.fr, 2 734 ms → 8 947 ms). Le coût vient de l'aller-retour Playwright lui-même, pas du filtre : restreindre l'interception aux seules navigations donne 8 947 ms également. Inacceptable pour un produit vendu à la requête.

## Résiduel assumé

- Pendant une attaque par rebinding ou par redirection, **un GET aveugle peut encore atteindre un hôte interne** avant que le contrôle d'IP ne rejette la réponse. Aucune donnée ne remonte à l'appelant, mais un effet de bord côté cible reste possible.
- Les **sous-ressources** (images, XHR) ne sont pas vérifiées. La same-origin policy empêche d'en lire la réponse en JS, donc pas d'exfiltration, mais un GET aveugle sur le LAN reste possible.
- **Fermeture propre de ces deux points** : une ACL réseau sur le squid déjà présent sur le mini (`http_access deny to_localnet` et `to_linklocal`), qui coûte zéro par requête, plutôt qu'un filtre applicatif.

## Vérifications

| Cas | Avant | Après |
|---|---|---|
| 19 encodages d'IP privée sur le garde | 4 passaient | 0 |
| `isPrivateIp` sur IPv4-mapped IPv6 | 4 sur 7 « publics » | 0 |
| Redirection 302 vers IP privée | contenu interne rendu | `private_address_blocked` |
| Redirection 302 vers nom d'hôte privé | contenu interne rendu | `private_address_blocked` |
| `/v1/amazon?url=` vers métadonnées, LAN, tiers | passait | bloqué |
| github.com, wikipedia.org, httpbin/redirect/2 | OK | OK |
| example.com, lemonde.fr | OK | OK, 2 904 ms contre 2 734 ms |

## État de déploiement

🔴 **Non déployé.** Les correctifs sont sur le disque. Le worker `com.x402farm.worker` tourne toujours l'ancien code en mémoire, et Vercel sert toujours l'ancienne version. Le worker est la surface la plus exposée : il importe `web.js` et `amazon.js`, tourne sur le LAN derrière le tunnel Cloudflare.

Pour mettre en service : `launchctl kickstart -k gui/$(id -u)/com.x402farm.worker` côté mini, et un redéploiement côté Vercel.
