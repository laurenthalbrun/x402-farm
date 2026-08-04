// Descriptions longues pour le classement du Bazaar.
//
// Coinbase note à ZÉRO la dimension « qualité des métadonnées » quand la
// description est générique ou courte ; la limite haute est de 500 caractères.
// Nos descriptions plafonnaient à 377, médiane 159 — d'où une absence pure et
// simple sur nos requêtes les plus stratégiques.
//
// Contrainte croisée : la description part AUSSI dans le payload de paiement,
// dont le facilitateur CDP rejette les dépassements (falaise mesurée à ~1931 o).
// Chaque texte est donc calibré sur le budget réel de sa route, calculé par
// `scripts/appliquer-descriptions.mjs` — jamais au-delà.
//
// Rédaction : phrases complètes en anglais, ce que fait la route, ce qu'elle
// renvoie, et pour quel besoin d'agent. Aucune fonctionnalité inventée : tout
// provient de la description d'origine et du schéma de sortie.

export const DESCRIPTIONS = {
  /* ------------------------------------------------------------- réseau */
  "GET /v1/proxy/1gb":
    "Buy 1 GB of residential proxy bandwidth for scraping and agent traffic, delivered as a ready-to-use key in the form http://buyer:KEY@host, valid 30 days and metered per gigabyte. Traffic exits through a real residential IP, reaching sites that reject datacenter ranges outright. Built for crawlers and autonomous agents that need a trustworthy exit rather than a cloud address. No account, no subscription, no minimum: pay once, use the key until the gigabyte is spent.",

  "GET /v1/proxy/5gb":
    "Buy 5 GB of residential proxy bandwidth at 2.40 USD per gigabyte and receive a proxy key valid for 30 days. Traffic exits through a real residential IP address, reaching sites that reject datacenter ranges. Cheaper per gigabyte than Browserbase at 8 USD or Bright Data at comparable tiers, with no account to open and no monthly commitment. Suited to agents running sustained crawling or data-collection jobs where a datacenter IP would be blocked on the first request.",

  "GET /v1/proxy/20gb":
    "Buy 20 GB of residential proxy bandwidth at 2 USD per gigabyte, the best rate in the range, delivered as a proxy key valid for 30 days. Traffic exits through a real residential IP address able to reach sites that refuse datacenter ranges. Designed for agents running long crawling campaigns or continuous monitoring, where bandwidth is consumed steadily over weeks. No account, no subscription: one payment, one key, metered per gigabyte until exhausted.",

  "GET /v1/proxy/port/30d":
    "Rent a dedicated mobile port for 30 days on a real 4G/5G carrier IP address (Orange, France and Guadeloupe, AS16028), with up to 100 GB of traffic included. A France and overseas-departments mobile IP is the hardest class of address to block and almost no provider offers it. Carrier, ASN and uptime are verified live at purchase and returned alongside the key, so you know exactly what you are getting. Reserved for agents that must reach the most defensive sites.",

  "GET /v1/proxy/port/7d":
    "Rent a dedicated mobile port for 7 days on a real 4G/5G carrier IP address (Orange, France and Guadeloupe, AS16028). A mobile carrier IP is the hardest class of address for a site to block, and a French or overseas-departments one is rarely offered anywhere. Carrier, ASN and uptime are checked live at purchase and returned with the key. The short duration suits a one-off campaign or an evaluation before committing to the 30-day port.",

  "GET /v1/mobile-proxy/1gb":
    "Buy 1 GB of mobile proxy bandwidth on a real 4G/5G carrier IP address (Orange, France and Guadeloupe, AS16028) and receive a proxy key valid for 30 days. Mobile carrier addresses are shared by thousands of subscribers, which makes them the hardest class of IP for a site to block without collateral damage. Carrier and ASN are verified live and returned with the key. For agents that residential exits are no longer enough to get through.",

  "GET /v1/mobile-proxy/5gb":
    "Buy 5 GB of mobile proxy bandwidth on a real 4G/5G carrier IP address (Orange, France and Guadeloupe, AS16028), delivered as a proxy key valid for 30 days. Mobile addresses are shared by thousands of subscribers, making them the hardest class of IP to block without hitting legitimate users. Carrier, ASN and uptime verified live at purchase. Suited to agents running sustained collection against sites that already reject residential exits.",

  "GET /v1/proxy/mobile/1gb":
    "Buy 1 GB of rotating mobile proxy bandwidth for scraping and agent traffic, on a real 4G/5G carrier IP (Orange, France and Guadeloupe, AS16028). The carrier reassigns the address by itself: six distinct IPs observed within one hour, no rotation logic to write. Mobile addresses are shared by thousands of subscribers, so blocking one means blocking real customers, which is why they survive where residential and datacenter exits fail. Key valid 30 days, carrier and ASN verified live.",

  "GET /v1/proxy/mobile/5gb":
    "Buy 5 GB of mobile proxy bandwidth on a real 4G/5G carrier IP address (Orange, France and Guadeloupe, AS16028), delivered as a proxy key valid 30 days and metered per gigabyte. Mobile carrier IPs are shared by thousands of subscribers, so sites cannot block them without cutting off real customers. Carrier, ASN and uptime verified live. For agents whose collection jobs are already failing on residential exits.",

  /* --------------------------------------------------------- navigateur */
  "POST /v1/extract":
    "Send a URL and receive the main content of the page as clean markdown, stripped of navigation, advertising and boilerplate. The page is fetched through a French residential IP with a real Chromium browser, so JavaScript-rendered content is fully resolved and sites that reject datacenter traffic are still reachable. Built for agents that need readable text to feed a model rather than raw HTML to parse.",

  "POST /v1/render":
    "Send a URL and receive the complete HTML of the page after JavaScript execution, exactly as a browser would see it. The request goes through a French residential IP driving a real Chromium instance, which resolves single-page applications and gets past defences that block datacenter ranges. Use it when you need the full DOM to parse yourself rather than an extracted summary, and when a plain HTTP fetch returns an empty shell.",

  "POST /v1/screenshot":
    "Send a URL and receive a PNG screenshot of the fully rendered page, captured by a real Chromium browser exiting through a French residential IP. JavaScript is executed and lazy-loaded content resolved before capture, so the image matches what a human visitor would see. Useful for agents that must verify a page visually, archive evidence of a listing or a price, or hand a rendered view to a vision model for analysis.",

  "POST /v1/pdf":
    "Send a URL and receive the page as a PDF document, rendered by a real Chromium browser exiting through a French residential IP. JavaScript runs before printing, so single-page applications and dynamically loaded sections appear in the output. Useful for agents that need an archivable, shareable record of a web page: a quotation, a legal notice, a listing or any document that must be kept exactly as it was published on a given day.",

  "POST /v1/links":
    "Send a URL and receive every hyperlink found on the page, resolved to absolute addresses and returned with its anchor text. The page is rendered by a real browser first, so links injected by JavaScript are included rather than missed. Useful for agents mapping a site before crawling it, discovering pagination, or extracting an index of documents from a directory page.",

  "POST /v1/meta":
    "Send a URL and receive its metadata: title, description, Open Graph and Twitter card fields, canonical address, language and favicon. The page is rendered by a real browser, so tags injected client-side are captured too. Useful for agents that must preview a link, deduplicate content across mirrors, or qualify a source before deciding whether the full page is worth fetching.",

  /* ------------------------------------------------ entreprises France */
  "GET /v1/fr/entreprise-360/partial":
    "Lite overview of a French company by SIREN or name: legal identity, activity code, headcount bracket and current administrative status, drawn from the official INSEE Sirene registry. This is the cheaper preview of the full 360 profile, meant to let an agent confirm it has the right company before paying for depth. Upgrade to /v1/fr/entreprise-360 for financial accounts, insolvency history, directors and establishments.",

  "GET /v1/fr/entreprise-360":
    "Complete profile of a French company in a single call, assembled from official sources: legal identity and form, headquarters address, activity code, headcount, incorporation date, filed annual accounts, insolvency proceedings and registered establishments. Replaces four or five separate lookups against INSEE Sirene, INPI RNE and BODACC. Built for agents doing supplier vetting, onboarding checks or lead qualification on French companies.",

  "GET /v1/guard":
    "Check whether a domain, IP address or email is dangerous before your agent interacts with it. Combines reputation signals, domain age, hosting and known-abuse indicators into a single verdict with the reasoning behind it. Built for agents that follow links found in untrusted content and must decide, automatically and in one call, whether a destination is safe to visit or an address is safe to write to.",

  "GET /v1/fr/due-diligence":
    "Full due-diligence dossier on a French company, assembled from official registries in one call: legal identity, directors and beneficial owners, filed annual accounts with revenue and profit trend, insolvency proceedings from BODACC court announcements, and a consolidated risk reading. Replaces a paid solvency report and several hours of manual research. For agents vetting a supplier, a client or an acquisition target before a commitment is signed.",

  "GET /v1/fr/estimation-immo":
    "Estimate the market value of a French property from its address and surface area, using actual recorded sale prices from the DVF open dataset rather than asking-price listings. Returns an estimated value, the local median price per square metre and the sample size behind it, so an agent can judge how reliable the figure is. Useful for property valuation, investment screening and sanity-checking a listing price against what really sold nearby.",

  "GET /v1/fr/bilans":
    "Annual accounts and financial statements of a French company by SIREN, sourced from the INPI national register, an authentication-gated source most public APIs cannot reach. Returns revenue, net income and share capital along with the list of accounting periods actually filed, so an agent can see both the figures and how current they are. For credit decisions, supplier vetting and any check that needs audited numbers rather than estimates.",

  "GET /v1/fr/procedures-collectives":
    "Is this French company in insolvency proceedings? Returns a synthetic status, the full history of court judgments (safeguard, receivership, liquidation) and a registry deregistration flag, taken from official BODACC court announcements. This is the single most important check to run before signing a B2B contract, and it is the one that public company APIs usually omit.",

  "GET /v1/fr/score-entreprise/partial":
    "Lite solidity score for a French company: a rating from 0 to 100, its qualitative level and the count of insolvency proceedings on record. Enough for an agent to triage a list of companies cheaply and decide which ones deserve a closer look. Upgrade to /v1/fr/score-entreprise for the factor-by-factor breakdown and the underlying financials.",

  "GET /v1/fr/score-entreprise":
    "Solidity and risk score from 0 to 100 for a French company, computed by crossing INPI financial accounts (revenue and profit trend), BODACC insolvency proceedings, company age and current administrative status. Returns the score, its qualitative level and the factors that drove it, so an agent can explain the verdict rather than merely report it. Replaces a paid solvency report for supplier vetting and credit decisions.",

  "GET /v1/fr/analyse-immo/partial":
    "Lite property analysis for a French address: median price per square metre in the area, estimated value and an investment score. Enough to screen a shortlist of addresses cheaply before committing to depth. Upgrade to /v1/fr/analyse-immo for energy performance, environmental risks, local demographics and expected rental yield.",

  "GET /v1/fr/analyse-immo":
    "Full investment analysis of a French property from its address: estimated value against recorded sale prices, median price per square metre, energy performance rating, environmental and natural risk exposure, local demographics and expected rental yield. Assembled from DVF, DPE and INSEE open data in one call. For agents screening property investments or preparing a purchase decision file.",

  "GET /v1/fr/kyb/partial":
    "Lite know-your-business check on a French company: legal existence, current administrative status and any insolvency flag. The minimum an agent needs to decide whether a counterparty is real and active before going further. Upgrade to /v1/fr/kyb for directors, beneficial owners and the full compliance dossier.",

  "GET /v1/fr/kyb":
    "Know-your-business dossier on a French company, assembled from official registries for compliance and onboarding: verified legal identity, company form and registration, directors and beneficial owners, current administrative status, and insolvency proceedings from BODACC. Returns a structured file an agent can attach to a compliance record. For onboarding a supplier, a client or a partner where a documented check is required.",

  "GET /v1/fr/etude-implantation":
    "Location study for opening a business at a French address: local demographics, purchasing power, existing competition in the same activity, footfall drivers and how the surrounding area is evolving. Assembled from INSEE and official open data. For agents advising on where to open a shop, a branch or a service point, and for comparing several candidate locations on the same criteria.",

  "GET /v1/fr/reseau-dirigeant":
    "Map the network of a French company director: every other company where the same person holds or held a mandate, with each entity's status and activity. Reveals group structures, related parties and conflicts of interest that a single-company lookup will never surface. For agents running compliance checks, fraud detection or acquisition research on French counterparties.",

  "GET /v1/fr/concurrents":
    "Identify the competitors of a French company: businesses sharing the same activity code within the relevant geographic area, returned with their size, age and current status so the list can be ranked rather than merely read. For agents preparing market analysis, competitive benchmarking or a sales territory plan on the French market.",

  "GET /v1/fr/verif-artisan":
    "Verify a French craftsman or building trade professional before hiring: legal existence, trade registration, activity code, company age and any insolvency proceedings on record. Answers the question a marketplace or an insurer must settle before letting someone quote for work. For agents vetting contractors, onboarding trades on a platform, or checking a quotation is signed by a real registered business.",

  "GET /v1/fr/valorisation":
    "Estimate the value of a French company from its filed financial accounts, applying sector multiples to revenue and earnings and returning the resulting range with the assumptions behind it. Draws on INPI accounting data rather than declarations. For agents screening acquisition targets, preparing a negotiation, or giving an owner an order-of-magnitude answer before engaging a formal valuation.",

  /* ---------------------------------------------- entreprises UK et US */
  "GET /v1/uk/company":
    "Full profile of a UK company from Companies House: registered name and number, company type, incorporation date, registered office address, SIC activity codes, accounts and confirmation-statement filing dates, and current status. The authoritative record rather than a scraped copy. For agents vetting British counterparties, onboarding suppliers or enriching a CRM with verified company data.",

  "GET /v1/uk/officers":
    "Directors and officers of a UK company from Companies House: names, roles, appointment and resignation dates, nationality, country of residence and occupation. Shows who currently runs the company and who has left, which matters as much as the present board when assessing stability. For agents running compliance checks, mapping decision-makers or detecting recent governance changes.",

  "GET /v1/uk/psc":
    "Persons with significant control of a UK company from Companies House: the beneficial owners, the nature of their control, their ownership bands and the date each interest was registered. This is the ultimate-beneficial-owner record that anti-money-laundering checks require. For agents running KYB and compliance onboarding on British entities.",

  "GET /v1/uk/company-check":
    "Consolidated risk check on a UK company in one call: registry identity and status, directors, persons with significant control, filing history and overdue filings, plus any insolvency indicator. Replaces four separate Companies House lookups and the work of reconciling them. For agents vetting a British supplier or client before a contract is signed.",

  "GET /v1/us/company":
    "Profile of a US public company from SEC EDGAR: legal name, central index key, ticker symbols, exchange listings, standard industrial classification, business address and filer status. The authoritative regulatory record rather than an aggregator's copy. For agents resolving a company name to its regulatory identity before pulling financials or filings.",

  "GET /v1/us/financials":
    "Financial statements of a US public company from SEC EDGAR XBRL data: revenue, net income, assets, liabilities and equity across reported periods, as filed with the regulator. Structured numbers rather than a document to parse. For agents doing fundamental screening, comparing reported performance across periods, or feeding audited figures into a model.",

  "GET /v1/us/filings":
    "Recent regulatory filings of a US public company from SEC EDGAR: form type, filing and reporting dates, accession number and a direct link to each document. Covers annual and quarterly reports, current reports and insider transactions. For agents monitoring disclosure, detecting material events as they are filed, or retrieving the source document behind a figure.",

  "GET /v1/us/snapshot":
    "One-call snapshot of a US public company combining SEC EDGAR identity, latest reported financials and most recent filings. Replaces three separate lookups and the work of joining them on the right identifiers. For agents that need a company's regulatory and financial position in a single structured answer, for screening or for briefing before deeper research.",

  /* ------------------------------------------------ recherche et data */
  "GET /v1/maps":
    "Search local businesses on a map by activity and location: name, address, coordinates, rating, review count, category and opening status. Returns the structured result set an agent needs to build a prospect list or verify a physical presence, without scraping a mapping site directly.",

  "GET /v1/fr/enrich":
    "Enrich a French company record from a name, a SIREN or a website: returns verified legal identity, activity code, headcount bracket, headquarters address and current status. Turns a partial CRM row into a complete, registry-backed record. For agents cleaning a prospect database or qualifying inbound leads before routing them to sales.",

  "GET /v1/fr/leboncoin":
    "Search Leboncoin listings by keyword, category and location, returning title, price, location, publication date and listing link as structured data. The site blocks datacenter traffic outright, so the request is routed through a French residential IP with a real browser. For agents monitoring second-hand prices, sourcing deals or tracking a market segment.",

  "GET /v1/fr/seloger":
    "Search SeLoger property listings by location, budget and type, returning price, surface area, room count, address and listing link as structured data. The site rejects datacenter traffic, so requests exit through a French residential IP driving a real browser. For agents tracking asking prices, sourcing investment opportunities or monitoring a local property market.",

  "GET /v1/unblock":
    "Fetch a page that blocks you, and get the HTML back. The request is routed through a French residential IP with a real Chromium browser, resolving JavaScript and passing the defences that reject datacenter ranges and plain HTTP clients. Use it as a fallback whenever your own fetch returns a challenge page, an empty shell or an access-denied response.",

  "GET /v1/fr/biens-sous-cotes":
    "Find undervalued French properties in an area: listings whose asking price sits below the median price per square metre recorded in actual DVF sales nearby, returned with the gap expressed in percent. Crosses live listings against real transaction data so the comparison is against what sold, not what was asked. For agents sourcing property investment opportunities.",

  "GET /v1/fr/marches-publics":
    "Search French public procurement notices by keyword, buyer or region: object of the contract, buyer, estimated value, deadline and notice link, returned as structured data from official sources. For agents monitoring tender opportunities on behalf of a supplier or tracking public spending in a given sector.",

  "GET /v1/fr/qualified-leads":
    "Build a list of qualified French company leads from an activity and a territory, each row returned with verified registry identity, headcount bracket, age and solvency signals so the list arrives already filtered. Replaces buying a raw prospect file and cleaning it afterwards. For sales agents assembling a territory plan.",

  "GET /v1/amazon":
    "Look up an Amazon product by ASIN or search term: title, current price, availability, rating, review count and main image, returned as structured data. Requests exit through a residential IP with a real browser, since Amazon rejects datacenter traffic. For agents tracking prices, monitoring competitors or verifying a listing before a purchase decision.",

  "GET /v1/fr/immo":
    "Recorded French property transactions around an address from the official DVF dataset: actual sale prices, dates, surface areas and property types for comparable sales nearby. These are prices that were really paid, not asking prices. For agents valuing a property, checking whether a listing is priced fairly, or measuring how a local market has moved.",

  "GET /v1/sms/number":
    "Rent a real mobile phone number to receive an SMS or a one-time password. The number is a physical SIM in a handset we operate, not a virtual or VoIP line, so it passes the carrier checks that reject disposable numbers. Returns the number and a session identifier; read arriving messages with /v1/sms/inbox. For agents that must complete a phone verification step autonomously.",

  "GET /v1/sms/inbox":
    "Read the messages received by a phone number rented through /v1/sms/number: sender, body, and reception time, returned as structured data so an agent can extract a verification code without human help. The number is a physical SIM in a handset we operate, so it receives from senders that refuse virtual lines. Poll it until the expected message arrives.",
};
