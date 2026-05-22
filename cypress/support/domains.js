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
  'https://www.sweetbites.'
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
const KNOWN_BRANDS = ['futunatura', 'healthy', 'erefit', 'mycoway', 'purely', 'energy', 'sweet'];

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

export {
  webApps,
  languages,
  KNOWN_BRANDS
};