# Candidature partenaire AdsPower — prête à soumettre

**Formulaire** : https://forms.gle/JxLMUctDnP7DB96R9 (lien « Apply now » de adspower.com/partner-plan)
**Logo** : `ghost-proxy-logo-232x105.png` (232×105 px, généré le 04/08/2026 — à copier depuis le scratchpad de session vers le repo avant envoi)
**Délai annoncé par AdsPower** : réponse sous 3 jours ouvrés.

> ⛔ **NE PAS SOUMETTRE tant que `api.x-402.online/rent` renvoie 402 DEPLOYMENT_DISABLED.**
> AdsPower examine le site sous 3 jours ouvrés et tomberait sur une page d'erreur. C'est le seul programme partenaire antidetect réel qu'on ait trouvé — on ne le grille pas sur un lien mort.

## Réponses préparées

| Champ | Valeur |
|---|---|
| **Brand name*** | Ghost Proxy FR |
| **Website*** | https://api.x-402.online/rent |
| **Email*** | l.halbrunpro@gmail.com |
| **HQ location*** | Basse-Terre, France |
| **Partner type*** | Solution provider |
| **Service offered*** | Network services |
| **Region serviced*** | Europe |

**Introduction to your brand***
> Ghost Proxy FR provides dedicated 4G mobile proxies on real French carrier IPs (Orange, AS16028), including mainland France and Guadeloupe — a geography almost no provider covers. Each port is a physical SIM on its own radio, never a shared datacenter range.

**Service description*** (bullets)
> - Dedicated 4G mobile ports on Orange France (AS16028) — one physical SIM and one radio per port, never shared
> - Guadeloupe / French Caribbean exit IPs — a geography almost no competitor offers
> - Carrier-grade NAT IPs that pass where datacenter and residential ranges are blocked
> - Live public status page: real-time operator, ASN, current IP, uptime and measured throughput before you buy
> - Measured 28-32 Mbit/s down, 370 ms TTFB through the mobile exit
> - Crypto-native billing: USDC on Base and Solana, plus per-GB metered access
> - Clear AUP: no private targets, ports 22/23/25/135/139/445/3389 blocked by policy

**Discount for AdsPower's users** (optionnel)
> Free 72-hour test port for AdsPower users, then 20% off the first month with code ADSPOWER20. No card required for the trial.

## Pourquoi AdsPower et personne d'autre

Recherche Perplexity du 04/08/2026 : **AdsPower est le seul antidetect avec un programme partenaire réel et documenté**, et il liste déjà des fournisseurs indépendants (IPRoyal, Webshare, PapaProxy, ProxyCoupons, proxys.io). GoLogin, Dolphin Anty, Multilogin, Octo Browser, Undetectable, BitBrowser et Incogniton **n'ont aucun programme vérifiable** — les pitches envoyés à GoLogin et Dolphin le 01/08 étaient des impasses.

## À vérifier avant d'envoyer

- [ ] `curl -s -o /dev/null -w "%{http_code}" https://api.x-402.online/rent` → doit renvoyer **200**, pas 402
- [ ] La page /rent affiche bien le statut d'exit en direct (elle lit `/free/proxy/status`)
- [ ] Le worker Mac mini est joignable (sinon le statut live affiche une sortie morte)
