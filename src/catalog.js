// Le catalogue : 10 APIs, leur prix, leur description (sert aussi de page d'accueil découvrable)
const urlBody = { bodyType: "json", method: "POST", input: { url: "https://example.com" } };
export const CATALOG = [
  { route: "GET /v1/weather", price: "$0.003", desc: "Worldwide weather: current conditions + 3-day forecast by lat/lon or city name. Query: ?city= or ?lat=&lon=",
    bazaar: { method: "GET", input: { city: "Paris" }, output: { example: { current: { temperature_2m: 21.4, wind_speed_10m: 12 }, daily: { temperature_2m_max: [24] } } } } },
  { route: "GET /v1/crypto/price", price: "$0.003", desc: "Spot prices + 24h change for any CoinGecko-listed tokens, multi-currency. Query: ?ids=bitcoin,ethereum&vs=usd,eur",
    bazaar: { method: "GET", input: { ids: "bitcoin,ethereum", vs: "usd" }, output: { example: { prices: { bitcoin: { usd: 97250, usd_24h_change: 1.2 } } } } } },
  { route: "GET /v1/crypto/token", price: "$0.004", desc: "Live token market data by contract address across 7 chains (Ethereum, Base, Arbitrum, Optimism, Polygon, BSC, Avalanche): price USD, 24h volume, liquidity, FDV, market cap, price change. Picks the deepest-liquidity pair. Query: ?address=0x…&chain=base",
    bazaar: { method: "GET", input: { address: "0x4200000000000000000000000000000000000006", chain: "base" }, output: { example: { symbol: "WETH", priceUsd: 3200.5, liquidityUsd: 5200000, volume24hUsd: 1800000, fdvUsd: 0 } } } },
  { route: "GET /v1/crypto/security", price: "$0.006", desc: "Token SECURITY / honeypot / rug-pull check before you trade. Detects honeypot, cannot-sell, blacklist, hidden owner, mintable, ownership-takeback, high buy/sell tax, closed-source — returns a verdict (OK/CAUTION/HIGH_RISK/AVOID) + flags. 7 chains. Essential pre-trade safety for autonomous agents. Query: ?address=0x…&chain=ethereum",
    bazaar: { method: "GET", input: { address: "0x…", chain: "ethereum" }, output: { example: { verdict: "AVOID", isHoneypot: true, sellTaxPct: 99, flags: [{ f: "honeypot", sev: "critical" }] } } } },
  { route: "GET /v1/defi/yields", price: "$0.005", desc: "Best DeFi APY/yield opportunities, filtered by token and/or chain with a min-TVL floor, sorted by APY. Base + reward APY, TVL, IL risk, stablecoin flag. Aggregates 16k+ pools. Query: ?token=USDC&chain=base&min_tvl=100000",
    bazaar: { method: "GET", input: { token: "USDC", chain: "base" }, output: { example: { count: 15, pools: [{ project: "aave-v3", symbol: "USDC", apy: 6.2, tvlUsd: 42000000 }] } } } },
  { route: "GET /v1/defi/protocol", price: "$0.005", desc: "DeFi protocol TVL & info by slug: total TVL, TVL per chain, category, chains, mcap. Query: ?protocol=aave",
    bazaar: { method: "GET", input: { protocol: "aave" }, output: { example: { name: "Aave", category: "Lending", totalTvlUsd: 12000000000, chains: ["Ethereum", "Base"] } } } },
  { route: "GET /v1/crypto/gas", price: "$0.003", desc: "Live gas price (gwei) across 7 EVM chains (Ethereum, Base, Arbitrum, Optimism, Polygon, BSC, Avalanche) in one call, or a single chain. Query: ?chain=base (optional)",
    bazaar: { method: "GET", input: { chain: "base" }, output: { example: { gas: { base: { gwei: 0.006 }, ethereum: { gwei: 12.3 } } } } } },
  { route: "GET /v1/crypto/trending", price: "$0.004", desc: "Trending tokens/pools on a chain right now (hottest by momentum): name, price, 24h volume, 24h change, liquidity. 8 chains incl. Solana. What agents watch to catch moves. Query: ?chain=base",
    bazaar: { method: "GET", input: { chain: "base" }, output: { example: { chain: "base", pools: [{ name: "TOKEN / WETH", priceUsd: 0.013, volume24hUsd: 840000, priceChange24h: -33.7 }] } } } },
  { route: "GET /v1/crypto/new-pools", price: "$0.004", desc: "Freshest token launches / newest liquidity pools on a chain, newest first — for sniper/discovery agents hunting early. Name, price, volume, liquidity, created-at. 8 chains incl. Solana. Query: ?chain=base",
    bazaar: { method: "GET", input: { chain: "base" }, output: { example: { chain: "base", pools: [{ name: "NEWCOIN / WETH", createdAt: "2026-07-28T…", liquidityUsd: 42000 }] } } } },
  { route: "GET /v1/crypto/sentiment", price: "$0.003", desc: "Crypto market sentiment in one call: Fear & Greed index (0-100 + label), total market cap, 24h volume, BTC & ETH dominance, 24h market-cap change. Macro signal agents use before trading. No params.",
    bazaar: { method: "GET", input: {}, output: { example: { fearGreedIndex: 29, fearGreedLabel: "Fear", totalMarketCapUsd: 2274000000000, btcDominancePct: 56.4 } } } },
  { route: "GET /v1/proxy/1gb", price: "$3.50", desc: "Buy 1 GB of residential proxy bandwidth for scraping and agent traffic, delivered as a ready-to-use key in the form http://buyer:KEY@host, valid 30 days and metered per gigabyte. Traffic exits through a real residential IP, reaching sites that reject datacenter ranges outright. Built for crawlers and autonomous agents that need a trustworthy exit rather than a cloud address.",
    bazaar: { method: "GET", input: {}, output: { example: { key: "rp1.1.1790000000.xxxx", gb: 1, proxy: "http://buyer:rp1.1.…@host:8899" } } } },
  { route: "GET /v1/proxy/5gb", price: "$15.00", desc: "Buy 5 GB of residential proxy bandwidth at 2.40 USD per gigabyte and receive a proxy key valid for 30 days. Traffic exits through a real residential IP address, reaching sites that reject datacenter ranges. Cheaper per gigabyte than Browserbase at 8 USD or Bright Data at comparable tiers, with no account to open and no monthly commitment. Suited to agents running sustained crawling or data-collection jobs where a datacenter IP would be blocked on the first request.",
    bazaar: { method: "GET", input: {}, output: { example: { key: "rp1.5.1790000000.xxxx", gb: 5 } } } },
  { route: "GET /v1/proxy/20gb", price: "$52.00", desc: "Buy 20 GB of residential proxy bandwidth at 2 USD per gigabyte, the best rate in the range, delivered as a proxy key valid for 30 days. Traffic exits through a real residential IP address able to reach sites that refuse datacenter ranges. Designed for agents running long crawling campaigns or continuous monitoring, where bandwidth is consumed steadily over weeks. No account, no subscription: one payment, one key, metered per gigabyte until exhausted.",
    bazaar: { method: "GET", input: {}, output: { example: { key: "rp1.20.1790000000.xxxx", gb: 20 } } } },
  { route: "GET /v1/proxy/port/30d", price: "$129.00", desc: "Rent a dedicated mobile port for 30 days on a real 4G/5G carrier IP (Orange, France and Guadeloupe, AS16028), up to 100 GB included. You rent the line itself, not access to a shared pool: one physical SIM, one client on it, one address that stays yours for the whole term, so logged-in sessions and long crawls remain coherent. Rotating pools reassign you by design.",
    bazaar: { method: "GET", input: {}, output: { example: { key: "rp1.100.1790000000.xxxx", gb: 100, valid_days: 30, tier: "mobile" } } } },
  { route: "GET /v1/proxy/port/7d", price: "$39.00", desc: "Rent a dedicated mobile port for 7 days on a real 4G/5G carrier IP (Orange, France and Guadeloupe, AS16028), up to 25 GB included. You rent the line, not a slice of a shared pool: one physical SIM, one client, a sticky address for the full term. Mobile carrier IPs are shared by thousands of subscribers, so blocking one cuts off real customers too. Carrier, ASN and uptime checked live at purchase.",
    bazaar: { method: "GET", input: {}, output: { example: { key: "rp1.25.1790000000.xxxx", gb: 25, valid_days: 7, tier: "mobile" } } } },
  { route: "GET /v1/mobile-proxy/1gb", price: "$7.00", desc: "Buy 1 GB of mobile proxy bandwidth on a real 4G/5G carrier IP address (Orange, France and Guadeloupe, AS16028) and receive a proxy key valid for 30 days. Mobile carrier addresses are shared by thousands of subscribers, which makes them the hardest class of IP for a site to block without collateral damage. Carrier and ASN are verified live and returned with the key.",
    bazaar: { method: "GET", input: {}, output: { example: { key: "rp1.1.1790000000.xxxx", gb: 1, tier: "mobile", exit: { carrier: "Orange S.A.", asn: "AS16028", mobile: true, country: "GP" } } } } },
  { route: "GET /v1/mobile-proxy/5gb", price: "$30.00", desc: "Buy 5 GB of mobile proxy bandwidth on a real 4G/5G carrier IP address (Orange, France and Guadeloupe, AS16028), delivered as a proxy key valid for 30 days. Mobile addresses are shared by thousands of subscribers, making them the hardest class of IP to block without hitting legitimate users. Carrier, ASN and uptime verified live at purchase. Suited to agents running sustained collection against sites that already reject residential exits.",
    bazaar: { method: "GET", input: {}, output: { example: { key: "rp1.5.1790000000.xxxx", gb: 5, tier: "mobile" } } } },
  { route: "GET /v1/proxy/mobile/1gb", price: "$7.00", desc: "Buy 1 GB of rotating mobile proxy bandwidth for scraping and agent traffic, on a real 4G/5G carrier IP (Orange, France and Guadeloupe, AS16028). The carrier reassigns the address by itself: six distinct IPs observed within one hour, no rotation logic to write. Mobile addresses are shared by thousands of subscribers, so blocking one means blocking real customers, which is why they survive where residential and datacenter exits fail.",
    bazaar: { method: "GET", input: {}, output: { example: { key: "rp1.1.1790000000.xxxx", gb: 1, tier: "mobile" } } } },
  { route: "GET /v1/proxy/mobile/5gb", price: "$30.00", desc: "Buy 5 GB of mobile proxy bandwidth on a real 4G/5G carrier IP address (Orange, France and Guadeloupe, AS16028), delivered as a proxy key valid 30 days and metered per gigabyte. Mobile carrier IPs are shared by thousands of subscribers, so sites cannot block them without cutting off real customers. Carrier, ASN and uptime verified live. For agents whose collection jobs are already failing on residential exits.",
    bazaar: { method: "GET", input: {}, output: { example: { key: "rp1.5.1790000000.xxxx", gb: 5, tier: "mobile" } } } },
  { route: "POST /v1/extract",       price: "$0.005", desc: "Send a URL and receive the main content of the page as clean markdown, stripped of navigation, advertising and boilerplate. The page is fetched through a French residential IP with a real Chromium browser, so JavaScript-rendered content is fully resolved and sites that reject datacenter traffic are still reachable.",
    bazaar: { ...urlBody, output: { example: { url: "https://example.com/", title: "Example Domain", markdown: "# Example Domain…" } } } },
  { route: "POST /v1/render",        price: "$0.005", desc: "Send a URL and receive the complete HTML of the page after JavaScript execution, exactly as a browser would see it. The request goes through a French residential IP driving a real Chromium instance, which resolves single-page applications and gets past defences that block datacenter ranges.",
    bazaar: { ...urlBody, output: { example: { url: "https://example.com/", html: "<html>…</html>" } } } },
  { route: "POST /v1/screenshot",    price: "$0.01",  desc: "Send a URL and receive a PNG screenshot of the fully rendered page, captured by a real Chromium browser exiting through a French residential IP. JavaScript is executed and lazy-loaded content resolved before capture, so the image matches what a human visitor would see. Useful for agents that must verify a page visually, archive evidence of a listing or a price, or hand a rendered view to a vision model for analysis.",
    bazaar: { bodyType: "json", method: "POST", input: { url: "https://example.com", fullPage: false } } },
  { route: "POST /v1/pdf",           price: "$0.01",  desc: "Send a URL and receive the page as a PDF document, rendered by a real Chromium browser exiting through a French residential IP. JavaScript runs before printing, so single-page applications and dynamically loaded sections appear in the output. Useful for agents that need an archivable, shareable record of a web page: a quotation, a legal notice, a listing or any document that must be kept exactly as it was published on a given day.",
    bazaar: urlBody },
  { route: "POST /v1/links",        price: "$0.005", desc: "Send a URL and receive every hyperlink found on the page, resolved to absolute addresses and returned with its anchor text. The page is rendered by a real browser first, so links injected by JavaScript are included rather than missed.",
    bazaar: { ...urlBody, output: { example: { url: "https://example.com/", count: 1, internal: [], external: [{ href: "https://iana.org", text: "Learn more" }] } } } },
  { route: "POST /v1/meta",          price: "$0.005", desc: "Send a URL and receive its metadata: title, description, Open Graph and Twitter card fields, canonical address, language and favicon. The page is rendered by a real browser, so tags injected client-side are captured too.",
    bazaar: { ...urlBody, output: { example: { url: "https://example.com/", title: "Example Domain", meta: {}, jsonLd: [] } } } },
  { route: "GET /v1/fr/entreprise",  price: "$0.02",  desc: "French company lookup by name or SIREN/SIRET: officers, NAF, HQ, status. Query: ?q=",
    bazaar: { method: "GET", input: { q: "Decathlon" }, output: { example: { query: "Decathlon", total: 151, results: [{ siren: "306138900", nom: "DECATHLON" }] } } } },
  { route: "GET /v1/fr/geocode",     price: "$0.005", desc: "Geocode any French address incl. overseas territories (lat/lon, score). Query: ?q=",
    bazaar: { method: "GET", input: { q: "Pointe-à-Pitre" }, output: { example: { results: [{ label: "Pointe-à-Pitre", lat: 16.23619, lon: -61.537759 }] } } } },
  { route: "GET /v1/dns",            price: "$0.005", desc: "Full DNS records for a domain: A, AAAA, MX, TXT, NS, SPF. Query: ?domain=",
    bazaar: { method: "GET", input: { domain: "example.com" }, output: { example: { domain: "example.com", a: ["1.2.3.4"], mx: [] } } } },
  { route: "GET /v1/email/validate", price: "$0.005", desc: "Email validation: syntax + domain MX check, no email sent. Query: ?email=",
    bazaar: { method: "GET", input: { email: "test@gmail.com" }, output: { example: { email: "test@gmail.com", valid: true, mx: "gmail-smtp-in.l.google.com" } } } },

  // ===== Données publiques françaises (le fossé défensif) =====
  { route: "GET /v1/fr/tva", price: "$0.005", desc: "Compute French intra-EU VAT number from a SIREN (offline, instant). Query: ?siren=",
    bazaar: { method: "GET", input: { siren: "306138900" }, output: { example: { siren: "306138900", tva: "FR51306138900" } } } },
  { route: "GET /v1/fr/vat-eu", price: "$0.02", desc: "Validate any EU VAT number via the official VIES service, returns trader name/address. Query: ?vat=",
    bazaar: { method: "GET", input: { vat: "FR40306138900" }, output: { example: { vat: "FR40306138900", valid: true, name: "DECATHLON", country: "FR" } } } },
  { route: "GET /v1/fr/commune", price: "$0.005", desc: "French commune info: population, INSEE code, postal codes, EPCI, department, region, coords. Query: ?q= or ?cp=",
    bazaar: { method: "GET", input: { q: "Basse-Terre" }, output: { example: { results: [{ nom: "Basse-Terre", insee: "97105", population: 9417, region: "Guadeloupe" }] } } } },
  { route: "GET /v1/fr/reverse-geocode", price: "$0.005", desc: "Reverse geocode lat/lon to a French address (incl. overseas). Query: ?lat=&lon=",
    bazaar: { method: "GET", input: { lat: "16.24", lon: "-61.53" }, output: { example: { label: "Pointe-à-Pitre", cp: "97110", ville: "Pointe-à-Pitre" } } } },
  { route: "GET /v1/fr/jours-feries", price: "$0.005", desc: "French public holidays for a year and zone (metropole, alsace-moselle, guadeloupe, etc.). Query: ?annee=&zone=",
    bazaar: { method: "GET", input: { annee: "2026", zone: "metropole" }, output: { example: { annee: "2026", jours: [{ date: "2026-01-01", nom: "1er janvier" }] } } } },
  { route: "GET /v1/fr/georisques", price: "$0.02", desc: "Natural & technological risks for a French commune (flood, seismic, industrial...). Query: ?insee=",
    bazaar: { method: "GET", input: { insee: "97120" }, output: { example: { insee: "97120", risques: [{ libelle: "Séisme" }] } } } },
  { route: "GET /v1/fr/carburants", price: "$0.01", desc: "Live fuel prices at stations near a French postal code (gazole, SP95/98, E85, GPL). Query: ?cp=",
    bazaar: { method: "GET", input: { cp: "97110" }, output: { example: { cp: "97110", stations: [{ nom: "Station", prix: { gazole: 1.7 } }] } } } },
  { route: "GET /v1/fr/etablissements", price: "$0.02", desc: "French company HQ + establishment counts by SIREN (SIRET, address, status). Query: ?siren=",
    bazaar: { method: "GET", input: { siren: "306138900" }, output: { example: { siren: "306138900", nb_etablissements: 385, siege: { siret: "30613890001294" } } } } },
  { route: "GET /v1/fr/association", price: "$0.02", desc: "Search French associations (RNA) by name: SIREN, RNA id, creation date, city. Query: ?q=",
    bazaar: { method: "GET", input: { q: "Croix Rouge" }, output: { example: { total: 42, results: [{ nom: "CROIX ROUGE FRANCAISE" }] } } } },
  { route: "GET /v1/fr/dpe", price: "$0.02", desc: "Energy performance diagnostics (DPE/GES labels) for dwellings in a French area. Query: ?insee= or ?cp=",
    bazaar: { method: "GET", input: { cp: "97110" }, output: { example: { results: [{ adresse: "...", etiquette_dpe: "D", etiquette_ges: "B" }] } } } },
  { route: "GET /v1/fr/vacances-scolaires", price: "$0.005", desc: "French school holidays by zone and year. Query: ?zone=&annee=",
    bazaar: { method: "GET", input: { zone: "Zone A", annee: "2025-2026" }, output: { example: { zone: "Zone A", vacances: [{ description: "Vacances de la Toussaint" }] } } } },
  { route: "GET /v1/fr/ecoles", price: "$0.01", desc: "French schools directory lookup by name or postal code (type, status, address, phone). Query: ?q= or ?cp=",
    bazaar: { method: "GET", input: { cp: "97110" }, output: { example: { results: [{ nom: "Lycée", type: "Lycée", ville: "Pointe-à-Pitre" }] } } } },
  { route: "GET /v1/fr/iban", price: "$0.005", desc: "Validate an IBAN (mod-97 checksum), returns country and French bank code. Query: ?iban=",
    bazaar: { method: "GET", input: { iban: "FR7630006000011234567890189" }, output: { example: { iban: "FR76...", valid: true, pays: "FR" } } } },
  { route: "GET /v1/fr/codes-postaux", price: "$0.005", desc: "Map a French postal code to its communes (name + INSEE code). Query: ?cp=",
    bazaar: { method: "GET", input: { cp: "97110" }, output: { example: { cp: "97110", communes: [{ nom: "Pointe-à-Pitre", insee: "97120" }] } } } },
  { route: "GET /v1/fr/cadastre", price: "$0.01", desc: "French cadastral parcel at given coordinates: parcel id, section, number, surface (IGN). Query: ?lat=&lon=",
    bazaar: { method: "GET", input: { lat: "48.8606", lon: "2.3364" }, output: { example: { idu: "75101000AI0002", section: "AI", contenance_m2: 4322 } } } },
  { route: "GET /v1/fr/valeurs-foncieres", price: "$0.02", desc: "Real French real-estate sale prices (DVF) for a commune: date, price, surface, type. Query: ?insee=&annee=",
    bazaar: { method: "GET", input: { insee: "75101", annee: "2023" }, output: { example: { insee: "75101", total: 478, mutations: [{ date: "2023-06-01", valeur_fonciere: 258000, surface_bati_m2: 22 }] } } } },
  { route: "GET /v1/fr/insee-commune", price: "$0.01", desc: "INSEE commune stats: population, area, computed density, department, region, EPCI. Query: ?insee=",
    bazaar: { method: "GET", input: { insee: "97120" }, output: { example: { insee: "97120", nom: "Pointe-à-Pitre", population: 15040, densite_hab_km2: 5419 } } } },
  { route: "GET /v1/fr/meteo", price: "$0.005", desc: "Current weather + up to 7-day forecast for any coordinates (France & overseas), French descriptions. Query: ?lat=&lon=&jours=",
    bazaar: { method: "GET", input: { lat: "16.24", lon: "-61.53", jours: "3" }, output: { example: { actuel: { temperature: 30.7, description: "Principalement clair" }, previsions: [{ date: "2026-07-22", tmax: 31 }] } } } },
  { route: "GET /v1/fr/rge", price: "$0.02", desc: "RGE-certified renovation contractors near a French postal code (name, trade, phone, email). Query: ?cp=&domaine=",
    bazaar: { method: "GET", input: { cp: "97110", domaine: "Isolation" }, output: { example: { cp: "97110", artisans: [{ nom: "EURL X", domaine: "Isolation", telephone: "0590..." }] } } } },
  { route: "GET /v1/fr/rge-check", price: "$0.01", desc: "Check whether a French company (by SIRET) is RGE-certified, with its qualifications. Query: ?siret=",
    bazaar: { method: "GET", input: { siret: "49974034800028" }, output: { example: { siret: "49974034800028", rge: true, qualifications: [{ domaine: "Architecte" }] } } } },
  { route: "GET /v1/fr/transport", price: "$0.01", desc: "Public-transit & mobility open datasets for a French area with GTFS/NeTEx/GBFS feed URLs. Query: ?q=",
    bazaar: { method: "GET", input: { q: "Guadeloupe" }, output: { example: { query: "Guadeloupe", datasets: [{ titre: "...", type: "public-transit", feeds: [{ format: "GTFS", url: "https://..." }] }] } } } },
  { route: "GET /v1/fr/irve", price: "$0.01", desc: "EV charging stations in a French commune: operator, power, connectors, access, coords (IRVE). Query: ?insee=",
    bazaar: { method: "GET", input: { insee: "75101" }, output: { example: { insee: "75101", bornes: [{ station: "QPARK RIVOLI", operateur: "IZIVIA", puissance_kw: 22 }] } } } },
  { route: "GET /v1/fr/bodacc", price: "$0.02", desc: "BODACC legal announcements for a French company by SIREN (filings, sales, insolvency, changes). Query: ?siren=",
    bazaar: { method: "GET", input: { siren: "306138900" }, output: { example: { siren: "306138900", total: 98, annonces: [{ date: "2026-07-09", type: "Avis initial", famille: "Dépôts des comptes" }] } } } },
  { route: "GET /v1/fr/bio", price: "$0.02", desc: "Certified organic (AB) operators in France by department and/or text search: farms, processors, productions. Query: ?departement=&q=",
    bazaar: { method: "GET", input: { departement: "971", q: "vignoble" }, output: { example: { total: 475, operateurs: [{ nom: "...", numeroBio: 136219, activites: ["Production"] }] } } } },

  // ===== APIs composites (valeur = agrégation / calcul, pas la donnée brute) =====
  { route: "GET /v1/fr/entreprise-360/partial", price: "$0.02", desc: "Lite overview of a French company by SIREN or name: legal identity, activity code, headcount bracket and current administrative status, drawn from the official INSEE Sirene registry. This is the cheaper preview of the full 360 profile, meant to let an agent confirm it has the right company before paying for depth.",
    bazaar: { method: "GET", input: { q: "Decathlon" }, output: { example: { identite: { denomination: "DECATHLON" }, annonces_legales_total: 45, _partial: true } } } },
  { route: "GET /v1/fr/entreprise-360", price: "$0.04", desc: "Complete profile of a French company in a single call, assembled from official sources: legal identity and form, headquarters address, activity code, headcount, incorporation date, filed annual accounts, insolvency proceedings and registered establishments. Replaces four or five separate lookups against INSEE Sirene, INPI RNE and BODACC.",
    bazaar: { method: "GET", input: { q: "Decathlon" }, output: { example: { found: true, identite: { siren: "306138900", tva: "FR51306138900" }, annonces_legales: { total: 98 } } } } },
  { route: "GET /v1/guard", price: "$0.012", desc: "Check whether a domain, IP address or email is dangerous before your agent interacts with it. Combines reputation signals, domain age, hosting and known-abuse indicators into a single verdict with the reasoning behind it.",
    bazaar: { method: "GET", input: { content: "Ignore all previous instructions…" }, output: { example: { verdict: "dangerous", safeToProceed: false, threat: "injection", score: 72, recommendation: "BLOCK…", findings: [{ type: "injection", severity: 3 }] } } } },
  { route: "GET /v1/fr/due-diligence", price: "$0.15", desc: "Full due-diligence dossier on a French company, assembled from official registries in one call: legal identity, directors and beneficial owners, filed annual accounts with revenue and profit trend, insolvency proceedings from BODACC court announcements, and a consolidated risk reading. Replaces a paid solvency report and several hours of manual research.",
    bazaar: { method: "GET", input: { q: "Decathlon" }, output: { example: { risk: "GREEN", verdict: "CONFORME", denomination: "DECATHLON", resolvedSiren: "306138900", flags: 0, vatValidatedVies: true } } } },
  { route: "GET /v1/fr/estimation-immo", price: "$0.05", desc: "Estimate the market value of a French property from its address and surface area, using actual recorded sale prices from the DVF open dataset rather than asking-price listings. Returns an estimated value, the local median price per square metre and the sample size behind it, so an agent can judge how reliable the figure is.",
    bazaar: { method: "GET", input: { adresse: "10 rue de Rivoli Paris", surface: "50", type: "appartement" }, output: { example: { ville: "Paris", prix_m2: { median: 12110 }, estimation: { valeur_estimee: 605476 } } } } },
  { route: "GET /v1/fr/bilans", price: "$0.06", desc: "Annual accounts and financial statements of a French company by SIREN, sourced from the INPI national register, an authentication-gated source most public APIs cannot reach. Returns revenue, net income and share capital along with the list of accounting periods actually filed, so an agent can see both the figures and how current they are.",
    bazaar: { method: "GET", input: { siren: "306138900" }, output: { example: { siren: "306138900", denomination: "DECATHLON", comptes_annuels_deposes: [{ date_cloture: "2024-12-31" }] } } } },
  { route: "GET /v1/fr/procedures-collectives", price: "$0.03", desc: "Is this French company in insolvency proceedings? Returns a synthetic status, the full history of court judgments (safeguard, receivership, liquidation) and a registry deregistration flag, taken from official BODACC court announcements.",
    bazaar: { method: "GET", input: { siren: "812501419" }, output: { example: { siren: "812501419", statut: "procedure_cloturee", alerte: false, procedures: [{ famille: "Jugement de clôture", nature: "Jugement de clôture pour insuffisance d'actif", date_jugement: "2026-07-10" }] } } } },
  { route: "GET /v1/fr/score-entreprise/partial", price: "$0.02", desc: "Lite solidity score for a French company: a rating from 0 to 100, its qualitative level and the count of insolvency proceedings on record. Enough for an agent to triage a list of companies cheaply and decide which ones deserve a closer look. Upgrade to /v1/fr/score-entreprise for the factor-by-factor breakdown and the underlying financials.",
    bazaar: { method: "GET", input: { q: "Decathlon" }, output: { example: { siren: "306138900", score: 82, niveau: "solide", _partial: true } } } },
  { route: "GET /v1/fr/score-entreprise", price: "$0.08", desc: "Solidity and risk score from 0 to 100 for a French company, computed by crossing INPI financial accounts (revenue and profit trend), BODACC insolvency proceedings, company age and current administrative status. Returns the score, its qualitative level and the factors that drove it, so an agent can explain the verdict rather than merely report it. Replaces a paid solvency report for supplier vetting and credit decisions.",
    bazaar: { method: "GET", input: { q: "Decathlon" }, output: { example: { siren: "306138900", score: 82, niveau: "solide" } } } },
  { route: "GET /v1/fr/analyse-immo/partial", price: "$0.03", desc: "Lite property analysis for a French address: median price per square metre in the area, estimated value and an investment score. Enough to screen a shortlist of addresses cheaply before committing to depth. Upgrade to /v1/fr/analyse-immo for energy performance, environmental risks, local demographics and expected rental yield.",
    bazaar: { method: "GET", input: { adresse: "10 rue de Rivoli Paris", surface: "50" }, output: { example: { prix_m2_median: 12110, valeur_estimee: 605476, score_investissement: 73, _partial: true } } } },
  { route: "GET /v1/fr/analyse-immo", price: "$0.08", desc: "Full investment analysis of a French property from its address: estimated value against recorded sale prices, median price per square metre, energy performance rating, environmental and natural risk exposure, local demographics and expected rental yield. Assembled from DVF, DPE and INSEE open data in one call.",
    bazaar: { method: "GET", input: { adresse: "10 rue de Rivoli Paris", surface: "50" }, output: { example: { ville: "Paris", estimation: { prix_m2_median: 12110 }, score_investissement: 73 } } } },
  { route: "GET /v1/fr/kyb/partial", price: "$0.03", desc: "Lite know-your-business check on a French company: legal existence, current administrative status and any insolvency flag. The minimum an agent needs to decide whether a counterparty is real and active before going further. Upgrade to /v1/fr/kyb for directors, beneficial owners and the full compliance dossier.",
    bazaar: { method: "GET", input: { q: "Decathlon" }, output: { example: { siren: "306138900", verdict: "CONFORME", tva_validee_vies: true, _partial: true } } } },
  { route: "GET /v1/fr/kyb", price: "$0.10", desc: "Know-your-business dossier on a French company, assembled from official registries for compliance and onboarding: verified legal identity, company form and registration, directors and beneficial owners, current administrative status, and insolvency proceedings from BODACC. Returns a structured file an agent can attach to a compliance record.",
    bazaar: { method: "GET", input: { q: "Decathlon" }, output: { example: { siren: "306138900", verdict: "CONFORME", fiscal: { tva_validee_vies: true } } } } },
  { route: "GET /v1/fr/etude-implantation", price: "$0.12", desc: "Location study for opening a business at a French address: local demographics, purchasing power, existing competition in the same activity, footfall drivers and how the surrounding area is evolving. Assembled from INSEE and official open data.",
    bazaar: { method: "GET", input: { activite: "boulangerie", commune: "Pointe-à-Pitre" }, output: { example: { commune: "Pointe-à-Pitre", concurrents_actifs: 56, habitants_par_concurrent: 268, score_opportunite: 45 } } } },
  { route: "GET /v1/fr/reseau-dirigeant", price: "$0.08", desc: "Map the network of a French company director: every other company where the same person holds or held a mandate, with each entity's status and activity. Reveals group structures, related parties and conflicts of interest that a single-company lookup will never surface. For agents running compliance checks, fraud detection or acquisition research on French counterparties.",
    bazaar: { method: "GET", input: { nom: "Arnault", prenom: "Bernard" }, output: { example: { total_societes: 40, cessees: 2, niveau_alerte: "modérée" } } } },
  { route: "GET /v1/fr/concurrents", price: "$0.08", desc: "Identify the competitors of a French company: businesses sharing the same activity code within the relevant geographic area, returned with their size, age and current status so the list can be ranked rather than merely read. For agents preparing market analysis, competitive benchmarking or a sales territory plan on the French market.",
    bazaar: { method: "GET", input: { q: "Decathlon", zone: "departement" }, output: { example: { total_marche: 297, top_concurrents: [{ nom: "...", finances: { ca: 1000000 } }] } } } },
  { route: "GET /v1/fr/verif-artisan", price: "$0.08", desc: "Verify a French craftsman or building trade professional before hiring: legal existence, trade registration, activity code, company age and any insolvency proceedings on record. Answers the question a marketplace or an insurer must settle before letting someone quote for work. For agents vetting contractors, onboarding trades on a platform, or checking a quotation is signed by a real registered business.",
    bazaar: { method: "GET", input: { q: "EURL LAURENT LAVALL" }, output: { example: { confiance: "élevée", certifie_rge: true, procedures_collectives: 0 } } } },
  { route: "GET /v1/fr/valorisation", price: "$0.10", desc: "Estimate the value of a French company from its filed financial accounts, applying sector multiples to revenue and earnings and returning the resulting range with the assumptions behind it. Draws on INPI accounting data rather than declarations. For agents screening acquisition targets, preparing a negotiation, or giving an owner an order-of-magnitude answer before engaging a formal valuation.",
    bazaar: { method: "GET", input: { q: "Decathlon" }, output: { example: { chiffre_affaires: 16207285000, valorisation: { estimation_centrale: 15000000000 } } } } },
  { route: "GET /v1/uk/company", price: "$0.02", desc: "Full profile of a UK company from Companies House: registered name and number, company type, incorporation date, registered office address, SIC activity codes, accounts and confirmation-statement filing dates, and current status. The authoritative record rather than a scraped copy. For agents vetting British counterparties, onboarding suppliers or enriching a CRM with verified company data.",
    bazaar: { method: "GET", input: { q: "Tesco PLC" }, output: { example: { company_number: "00445790", name: "TESCO PLC", status: "active" } } } },
  { route: "GET /v1/uk/officers", price: "$0.02", desc: "Directors and officers of a UK company from Companies House: names, roles, appointment and resignation dates, nationality, country of residence and occupation. Shows who currently runs the company and who has left, which matters as much as the present board when assessing stability. For agents running compliance checks, mapping decision-makers or detecting recent governance changes.",
    bazaar: { method: "GET", input: { number: "00445790" }, output: { example: { total: 12, officers: [{ name: "...", role: "director" }] } } } },
  { route: "GET /v1/uk/psc", price: "$0.03", desc: "Persons with significant control of a UK company from Companies House: the beneficial owners, the nature of their control, their ownership bands and the date each interest was registered. This is the ultimate-beneficial-owner record that anti-money-laundering checks require. For agents running KYB and compliance onboarding on British entities.",
    bazaar: { method: "GET", input: { number: "00445790" }, output: { example: { total: 1, controllers: [{ name: "...", nature_of_control: ["ownership-of-shares-75-to-100-percent"] }] } } } },
  { route: "GET /v1/uk/company-check", price: "$0.08", desc: "Consolidated risk check on a UK company in one call: registry identity and status, directors, persons with significant control, filing history and overdue filings, plus any insolvency indicator. Replaces four separate Companies House lookups and the work of reconciling them. For agents vetting a British supplier or client before a contract is signed.",
    bazaar: { method: "GET", input: { q: "Tesco PLC" }, output: { example: { name: "TESCO PLC", verdict: "PASS", active_officers: 12 } } } },
  { route: "GET /v1/us/company", price: "$0.02", desc: "Profile of a US public company from SEC EDGAR: legal name, central index key, ticker symbols, exchange listings, standard industrial classification, business address and filer status. The authoritative regulatory record rather than an aggregator's copy. For agents resolving a company name to its regulatory identity before pulling financials or filings.",
    bazaar: { method: "GET", input: { ticker: "AAPL" }, output: { example: { cik: "0000320193", name: "Apple Inc.", exchanges: ["Nasdaq"] } } } },
  { route: "GET /v1/us/financials", price: "$0.05", desc: "Financial statements of a US public company from SEC EDGAR XBRL data: revenue, net income, assets, liabilities and equity across reported periods, as filed with the regulator. Structured numbers rather than a document to parse. For agents doing fundamental screening, comparing reported performance across periods, or feeding audited figures into a model.",
    bazaar: { method: "GET", input: { ticker: "AAPL" }, output: { example: { name: "Apple Inc.", net_income: [{ end: "2025-09-27", value: 112010000000 }] } } } },
  { route: "GET /v1/us/filings", price: "$0.02", desc: "Recent regulatory filings of a US public company from SEC EDGAR: form type, filing and reporting dates, accession number and a direct link to each document. Covers annual and quarterly reports, current reports and insider transactions. For agents monitoring disclosure, detecting material events as they are filed, or retrieving the source document behind a figure.",
    bazaar: { method: "GET", input: { ticker: "AAPL", type: "10-K" }, output: { example: { name: "Apple Inc.", filings: [{ form: "10-K", filed: "2025-11-01" }] } } } },
  { route: "GET /v1/us/snapshot", price: "$0.06", desc: "One-call snapshot of a US public company combining SEC EDGAR identity, latest reported financials and most recent filings. Replaces three separate lookups and the work of joining them on the right identifiers. For agents that need a company's regulatory and financial position in a single structured answer, for screening or for briefing before deeper research.",
    bazaar: { method: "GET", input: { ticker: "AAPL" }, output: { example: { name: "Apple Inc.", revenue_growth_pct: 6.2, net_margin_pct: 24.3 } } } },
];

// Google Maps local business scraper — via IP résidentielle FR (Google bloque les datacenters).
// Un appel = une recherche activité+lieu -> jusqu'à 120 fiches. Attention : le feed Maps
// ne porte ni téléphone, ni site, ni nombre d'avis ; ces champs viennent d'une 2e passe
// (une navigation par fiche) plafonnée par detailsMax -> d'où le champ `enriched`.
CATALOG.push({
  route: "GET /v1/maps", price: "$0.03",
  desc: "Search local businesses on a map by activity and location: name, address, coordinates, rating, review count, category and opening status. Returns the structured result set an agent needs to build a prospect list or verify a physical presence, without scraping a mapping site directly.",
  bazaar: { method: "GET", input: { q: "plombier", location: "Bordeaux" }, output: { example: { source: "gmaps", count: 20, results: [{ name: "JFS Plombier", rating: 4.9, reviews: 120, category: "Plombier", address: "12 Rue Sainte-Catherine", phone: "0648566503", website: "https://…" }] } } },
});

CATALOG.push({
  route: "GET /v1/fr/enrich", price: "$0.08",
  desc: "Enrich a French company record from a name, a SIREN or a website: returns verified legal identity, activity code, headcount bracket, headquarters address and current status. Turns a partial CRM row into a complete, registry-backed record.",
  bazaar: { method: "GET", input: { name: "Decathlon", city: "Lille" }, output: { example: { company: { siren: "306138900", legalName: "DECATHLON", dirigeants: [{ nom: "...", qualite: "President" }] }, risk: { insolvency: false }, contact: { phone: "03…", website: "https://…" } } } },
});

CATALOG.push({
  route: "GET /v1/fr/leboncoin", price: "$0.02",
  desc: "Search Leboncoin listings by keyword, category and location, returning title, price, location, publication date and listing link as structured data. The site blocks datacenter traffic outright, so the request is routed through a French residential IP with a real browser.",
  bazaar: { method: "GET", input: { text: "iphone", city: "Bordeaux" }, output: { example: { source: "leboncoin.fr", total: 1240, count: 20, ads: [{ id: "2812345678", title: "iPhone 13", price: 420, city: "Bordeaux", url: "https://www.leboncoin.fr/ad/..." }] } } },
});

CATALOG.push({
  route: "GET /v1/fr/seloger", price: "$0.03",
  desc: "Search SeLoger property listings by location, budget and type, returning price, surface area, room count, address and listing link as structured data. The site rejects datacenter traffic, so requests exit through a French residential IP driving a real browser.",
  bazaar: { method: "GET", input: { city: "Bordeaux", cp: "33000" }, output: { example: { source: "seloger.com", count: 25, summary: { medianAskingPricePerM2: 5200 }, listings: [{ type: "Appartement", rooms: 4, surface: 132, price: 1370000, pricePerM2: 8422 }] } } },
});

CATALOG.push({
  route: "GET /v1/unblock", price: "$0.02",
  desc: "Fetch a page that blocks you, and get the HTML back. The request is routed through a French residential IP with a real Chromium browser, resolving JavaScript and passing the defences that reject datacenter ranges and plain HTTP clients. Use it as a fallback whenever your own fetch returns a challenge page, an empty shell or an access-denied response.",
  bazaar: { method: "GET", input: { url: "https://www.leboncoin.fr" }, output: { example: { url: "https://…", format: "html", bytes: 1050000, html: "<html>…</html>" } } },
});

CATALOG.push({
  route: "GET /v1/fr/biens-sous-cotes", price: "$0.05",
  desc: "Find undervalued French properties in an area: listings whose asking price sits below the median price per square metre recorded in actual DVF sales nearby, returned with the gap expressed in percent. Crosses live listings against real transaction data so the comparison is against what sold, not what was asked.",
  bazaar: { method: "GET", input: { city: "Bordeaux", cp: "33000" }, output: { example: { soldMedianPerM2: 4778, candidatesCount: 6, candidates: [{ type: "Appartement", surface: 70, price: 243000, pricePerM2: 3307, gapPct: -31, url: "https://..." }] } } },
});

// MARCHÉS PUBLICS : l'agent trouve des OPPORTUNITÉS DE REVENU (contrats à remporter), pas des
// clients. Nouveau type d'acheteur : le bot business-dev / veille appels d'offres, en boucle.
CATALOG.push({
  route: "GET /v1/fr/marches-publics", price: "$0.02",
  desc: "Search French public procurement notices by keyword, buyer or region: object of the contract, buyer, estimated value, deadline and notice link, returned as structured data from official sources.",
  bazaar: { method: "GET", input: { q: "informatique", departement: "33" }, output: { example: { source: "BOAMP", total: 173, count: 20, tenders: [{ id: "26-61505", buyer: "CD33", object: "Équipement…", depts: ["33"], deadline: "2026-07-27T10:00:00Z", daysLeft: 3, url: "https://…" }] } } },
});

// LEADS QUALIFIÉS : croise Google Maps résidentiel (contact) + registre officiel des entreprises
// (SIREN, dirigeants, ancienneté, santé) + scoring. Infaisable pour un dev seul (IP résidentielle +
// registre + orchestration). Un appel = jusqu'à 30 leads B2B enrichis et notés HOT/WARM/COLD.
CATALOG.push({
  route: "GET /v1/fr/qualified-leads", price: "$0.12",
  desc: "Build a list of qualified French company leads from an activity and a territory, each row returned with verified registry identity, headcount bracket, age and solvency signals so the list arrives already filtered.",
  bazaar: { method: "GET", input: { activity: "plombier", location: "Bordeaux" }, output: { example: { count: 12, summary: { matched: 9, hot: 5 }, leads: [{ name: "…", phone: "05…", website: "https://…", company: { siren: "…", dateCreation: "2012-05-02", ageYears: 14 }, score: 85, tier: "HOT" }] } } },
});

// Amazon product & search via IP résidentielle + navigateur furtif (Amazon fingerprinte les bots datacenter).
CATALOG.push({
  route: "GET /v1/amazon", price: "$0.02",
  desc: "Look up an Amazon product by ASIN or search term: title, current price, availability, rating, review count and main image, returned as structured data. Requests exit through a residential IP with a real browser, since Amazon rejects datacenter traffic. For agents tracking prices, monitoring competitors or verifying a listing before a purchase decision.",
  bazaar: { method: "GET", input: { asin: "B09XS7JWHH" }, output: { example: { source: "amazon.fr", mode: "product", product: { title: "Sony WH-1000XM5", price: "€204.92", priceValue: 204.92, rating: 4.3, reviews: 12614 } } } },
});
// Immobilier FR (annonces / prix affichés) via Bien'ici — source protégée anti-bot (datacenters bloqués).
CATALOG.push({
  route: "GET /v1/fr/immo", price: "$0.03",
  desc: "Recorded French property transactions around an address from the official DVF dataset: actual sale prices, dates, surface areas and property types for comparable sales nearby. These are prices that were really paid, not asking prices.",
  bazaar: { method: "GET", input: { city: "Bordeaux", cp: "33000" }, output: { example: { source: "bienici.com", count: 25, summary: { medianAskingPricePerM2: 4602 }, listings: [{ type: "Appartement", rooms: 4, surface: 132, price: 635000, pricePerM2: 4602, postalCode: "33100" }] } } },
});

// Routes à clé amont : n'apparaissent (catalogue + paywall + MCP) que si la clé est configurée.
if (process.env.SERPER_API_KEY) {
  CATALOG.push({
    route: "GET /v1/search", price: "$0.003",
    desc: "Cheap web search (real Google results via Serper): top 10 organic results + answer box + knowledge graph. Cheaper than Exa /search on x402. Query: ?q=&gl=&hl=",
    bazaar: { method: "GET", input: { q: "x402 protocol" }, output: { example: { results: [{ title: "x402", url: "https://x402.org", snippet: "…" }] } } },
  });
  CATALOG.push({
    route: "GET /v1/search/news", price: "$0.003",
    desc: "Fresh news search (Google News via Serper): latest headlines with source, date, snippet. Great for crypto/market/current-events agents. Query: ?q=&gl=&hl=",
    bazaar: { method: "GET", input: { q: "bitcoin" }, output: { example: { news: [{ title: "…", link: "…", date: "1h ago", source: "…" }] } } },
  });
}
if (process.env.OPENAI_API_KEY || process.env.LLM_API_KEY) {
  CATALOG.push({
    route: "POST /v1/llm", price: "$0.002",
    desc: "Cheap LLM inference pay-per-call, no account, no API key: prompt in, completion out (DeepSeek v4, up to 2000 output tokens). Among the lowest $/call on x402. Body: {prompt, system?, max_tokens?}",
    bazaar: { bodyType: "json", method: "POST", input: { prompt: "Summarize x402 in one sentence" }, output: { example: { output: "x402 lets agents pay APIs per call in stablecoins.", usage: { output_tokens: 18 } } } },
  });
  CATALOG.push({
    route: "GET /v1/extract-structured", price: "$0.015",
    desc: "URL + wanted fields -> clean JSON. Scrapes the page from a residential IP (reaches sites that block datacenters) and uses an LLM to return exactly the fields you ask for. The 'scrape into this shape' call agents love (Firecrawl-extract territory), cheaper. Query: ?url=&fields=price,rating,stock (or ?schema=free-text)",
    bazaar: { method: "GET", input: { url: "https://example.com", fields: "title,price" }, output: { example: { url: "https://…", data: { title: "…", price: 19.9 } } } },
  });
  CATALOG.push({
    route: "POST /v1/llm/pro", price: "$0.006",
    desc: "Smart LLM inference (DeepSeek v4 Pro): stronger reasoning for hard prompts, up to 2000 output tokens, no account. Body: {prompt, system?, max_tokens?}",
    bazaar: { bodyType: "json", method: "POST", input: { prompt: "Explain the tradeoffs of x402 vs API keys" }, output: { example: { output: "…", usage: { output_tokens: 300 } } } },
  });
}

CATALOG.push({
  route: "GET /v1/sms/number", price: "$0.05",
  desc: "Rent a real mobile phone number to receive an SMS or a one-time password. The number is a physical SIM in a handset we operate, not a virtual or VoIP line, so it passes the carrier checks that reject disposable numbers. Returns the number and a session identifier; read arriving messages with /v1/sms/inbox. For agents that must complete a phone verification step autonomously.",
  bazaar: { method: "GET", input: {}, output: { example: { phone: "+590690XXXXXX", carrier: "Orange", country: "GP", poll: "/v1/sms/inbox?phone=…&since=…" } } },
});
CATALOG.push({
  route: "GET /v1/sms/inbox", price: "$0.02",
  desc: "Read the messages received by a phone number rented through /v1/sms/number: sender, body, and reception time, returned as structured data so an agent can extract a verification code without human help. The number is a physical SIM in a handset we operate, so it receives from senders that refuse virtual lines.",
  bazaar: { method: "GET", input: { phone: "+590690XXXXXX", since: "2026-07-30T12:00:00Z" }, output: { example: { phone: "+590690XXXXXX", count: 1, otp: "483920", messages: [{ sender: "Google", body: "G-483920 is your code" }] } } },
});

// ===== MÉNAGE 2026-07-30 : on retire les DATA BRUTE passe-plat =====
// Un agent n'achète pas une info qu'il peut requêter lui-même. On ne garde que des
// CAPACITÉS (proxy, navigateur, LLM, déblocage) et des DÉCISIONS (dossiers agrégés).
// Ces routes sortent du catalogue (donc de la vente et de l'index) ; un middleware les
// fait répondre 410 en réorientant vers les capacités. Le code des handlers reste (réversible).
export const RETIRED_PATHS = new Set([
  // crypto / defi (CoinGecko, DexScreener, DefiLlama — gratuits, l'agent le fait seul)
  "/v1/crypto/price", "/v1/crypto/token", "/v1/crypto/security", "/v1/crypto/gas",
  "/v1/crypto/trending", "/v1/crypto/new-pools", "/v1/crypto/sentiment",
  "/v1/defi/yields", "/v1/defi/protocol",
  // divers passe-plats
  "/v1/weather", "/v1/dns", "/v1/email/validate", "/v1/fr/geocode",
  // data.gouv brute FR (l'agent appelle l'API publique lui-même)
  "/v1/fr/tva", "/v1/fr/vat-eu", "/v1/fr/commune", "/v1/fr/reverse-geocode",
  "/v1/fr/jours-feries", "/v1/fr/georisques", "/v1/fr/carburants", "/v1/fr/etablissements",
  "/v1/fr/association", "/v1/fr/dpe", "/v1/fr/vacances-scolaires", "/v1/fr/ecoles",
  "/v1/fr/iban", "/v1/fr/codes-postaux", "/v1/fr/cadastre", "/v1/fr/valeurs-foncieres",
  "/v1/fr/insee-commune", "/v1/fr/meteo", "/v1/fr/rge", "/v1/fr/rge-check",
  "/v1/fr/transport", "/v1/fr/irve", "/v1/fr/bodacc", "/v1/fr/bio", "/v1/fr/entreprise",
]);
for (let i = CATALOG.length - 1; i >= 0; i--) {
  if (RETIRED_PATHS.has(CATALOG[i].route.split(" ")[1])) CATALOG.splice(i, 1);
}
