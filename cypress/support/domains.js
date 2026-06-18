// Brand URLs + locale list + per-brand TLD overrides used by run-random.js,
// open-cypress.js, and domain_visit.cy.js to construct a target URL for any
// brand × locale combination.
//
// Holland (.nl) is excluded from the language list due to payment method differences.
// sweetbites below does include nl — verify that domain is ready before adding 'nl' to languages.

const webApps = [
  'https://www.futunatura.',
  'https://www.healthyworld.',
  'https://www.onenergy.',
  'https://www.erefit.',
  'https://www.mycoway.',
  'https://www.purelynutrition.',
  'https://www.sweetbites.',
  // futupets' canonical host IS www — non-www 301-redirects to www (via an http
  // hop), verified 2026-06-17, so we target www directly to skip that redirect
  // chain. getTargetUrl appends the locale as the TLD (e.g. `https://www.futupets.si`).
  // The checkout flow is the same as the other BeHealthy brands (`/blagajna` etc.) —
  // only the product-entry step differs: futupets uses its homepage "Buy & Save"
  // slider via productPage.buyAndSaveProduct instead of search-then-pick-first-card.
  // Brand-aware branch in navigateToCheckout.
  'https://www.futupets.'
];

const brandOverrides = {
  healthyworld: {
    it: 'https://www.healthy-world.it',  hu: 'https://www.healthy-world.hu',
    de: 'https://www.healthyworldshop.de', cz: 'https://www.healthy-world.cz',
    sk: 'https://www.healthy-world.sk',  pl: 'https://www.healthy-world.pl',
    es: 'https://www.healthy-world.es',  uk: 'https://www.healthy-world.uk'
  },
  onenergy: {
    it: 'https://www.on-energy.it',      hu: 'https://www.on-energy.hu',
    de: 'https://www.onenergynutrition.de', ro: 'https://www.on-energy.ro',
    pl: 'https://www.on-energy.pl',      es: 'https://www.onenergynutrition.es',
    gr: 'https://www.onenergynutrition.gr'
  },
  purelynutrition: {
    hr: 'https://www.purely.hr',  hu: 'https://www.purely.hu',
    de: 'https://www.purely-nutrition.de', ro: 'https://www.purely.ro',
    cz: 'https://www.purely.cz',  sk: 'https://www.purely.sk',
    bg: 'https://www.purely.bg',  gr: 'https://www.purely.gr',
    pt: 'https://www.purely.pt'
  },
  sweetbites: {
    de: 'https://www.sweetnutri.de', pl: 'https://www.sweetnutri.pl',
    bg: 'https://www.sweetnutri.bg', es: 'https://www.sweetnutri.es',
    pt: 'https://www.sweetnutri.pt', nl: 'https://www.sweetnutri.nl'
  }
};

// List of languages
const languages = ['si', 'hr', 'it', 'hu', 'de', 'at', 'ro', 'cz', 'sk', 'pl', 'fr', 'bg', 'es', 'gr', 'pt', 'uk'];

// Identifiers used to detect which brand a given URL belongs to (substring match).
// Order matters when one brand string is a substring of another — none currently overlap.
const KNOWN_BRANDS = ['futunatura', 'healthy', 'erefit', 'mycoway', 'purely', 'energy', 'sweet', 'futupets'];

// Human-readable brand names for reports/notifications, keyed by the URL slug
// (the segment between `www.`/protocol and the trailing dot in each webApps entry).
// Single source of truth for the 8 brands — used by the Slack notifier so the
// summary reads "OnEnergy × de" instead of the raw base URL.
const BRAND_DISPLAY_NAMES = {
  futunatura: 'Futunatura',
  healthyworld: 'Healthyworld',
  onenergy: 'OnEnergy',
  erefit: 'Erefit',
  mycoway: 'Mycoway',
  purelynutrition: 'Purely',
  sweetbites: 'Sweetbites',
  futupets: 'Futupets'
};

// Brand-specific locale exclusions. Each entry lists locales NOT supported (or
// not deployed) for that brand — runners filter these out before iterating, and
// the random picker re-rolls when it lands on an excluded combo. Brand keys are
// matched against `selectedApp` via substring containment, same as KNOWN_BRANDS.
const excludedLocales = {
  futupets: ['fr', 'es', 'pt', 'uk']
};

/**
 * Build the target URL for a given brand base + locale.
 * Checks `brandOverrides` first (for brands with non-uniform TLD naming, e.g.
 * `purelynutrition` → `purely.hr`), then falls back to `${appBase}${lang}`.
 *
 * @param {string} appBase - One of the entries from `webApps` (e.g. 'https://www.futunatura.')
 * @param {string} lang - Locale code from `languages` (e.g. 'hr', 'de', 'at')
 * @returns {string} Full URL with protocol and TLD
 */
export function getTargetUrl(appBase, lang) {
  const brand = Object.keys(brandOverrides).find(key => appBase.includes(key));
  if (brand && brandOverrides[brand][lang]) return brandOverrides[brand][lang];
  return `${appBase}${lang}`;
}

/**
 * Resolve the list of locales a given brand actually supports — drops any
 * locale listed in `excludedLocales` for that brand. Brand-key matching is
 * substring-based against the appBase (e.g. `'https://www.futupets.'` matches
 * the `futupets` key).
 *
 * @param {string} appBase - Entry from `webApps`
 * @returns {string[]} Locales (subset of `languages`) supported for this brand
 */
export function supportedLocalesFor(appBase) {
  const brand = Object.keys(excludedLocales).find(key => appBase.toLowerCase().includes(key));
  const skip = brand ? excludedLocales[brand] : [];
  return languages.filter(lang => !skip.includes(lang));
}

/**
 * Map a brand base URL (or a full target URL) to a human-readable brand name.
 * Matches the URL against the `BRAND_DISPLAY_NAMES` slugs (substring); falls back
 * to the bare host segment (capitalized) for anything unrecognized.
 *
 * @param {string} appOrUrl - e.g. 'https://www.onenergy.' or 'https://www.onenergynutrition.de'
 * @returns {string} Display name, e.g. 'OnEnergy'
 */
export function brandLabel(appOrUrl) {
  const slug = Object.keys(BRAND_DISPLAY_NAMES).find(s => appOrUrl.includes(s));
  if (slug) return BRAND_DISPLAY_NAMES[slug];
  const bare = appOrUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\..*$/, '');
  return bare ? bare.charAt(0).toUpperCase() + bare.slice(1) : appOrUrl;
}

/**
 * Normalize a brand base URL or name to a comparable slug: lowercased, with
 * protocol / `www.` / dots stripped (so `'https://www.purelynutrition.'` and
 * `'PurelyNutrition'` both become `'purelynutrition'`).
 * @param {string} str
 * @returns {string}
 */
export function normalizeApp(str) {
  return str.toLowerCase().replace(/https?:\/\/(www\.)?/, '').replace(/\./g, '');
}

/**
 * Resolve a brand NAME (or fragment) to its `webApps` base URL — case- and
 * punctuation-insensitive (e.g. `'futupets'` → `'https://www.futupets.'`). Shared by
 * the open-cypress.js and lighthouse-audit.js CLIs. Returns undefined if no
 * brand matches.
 * @param {string} name
 * @returns {string|undefined}
 */
export function resolveBrandApp(name) {
  const target = normalizeApp(name);
  return webApps.find(app => normalizeApp(app).includes(target));
}

export {
  webApps,
  languages,
  KNOWN_BRANDS,
  excludedLocales
};