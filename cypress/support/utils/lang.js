// Pure language-resolution utilities — no Cypress page state involved.
// Extracted from CheckoutPage so ProductPage (or any future page object) can
// share the same TLD-aware language detection without duplicating the maps.

/**
 * Normalize an `<html lang>` value to a two-letter brand-internal locale code.
 * Some sites emit non-standard codes (`sl` for Slovenian, `cs` for Czech,
 * `el` for Greek) — this remaps them to the codes our fixtures use.
 *
 * @param {string|undefined} lang - Raw lang attribute value (e.g. 'sl-SI', 'cs', 'en')
 * @returns {string} Normalized 2-letter code (e.g. 'si', 'cz', 'gr', 'en')
 */
export function normalizeLanguageCode(lang) {
  if (!lang) return 'en';
  const langCode = lang.substring(0, 2).toLowerCase();
  const remap = { cs: 'cz', el: 'gr', sl: 'si' };
  return remap[langCode] ?? langCode;
}

/**
 * Resolve a brand-internal locale code, disambiguating `en` → `uk` and
 * `de` → `at` via the URL (both share generic `<html lang>` values with other
 * brands but need distinct fixture data).
 *
 * @param {string|undefined} lang - Raw `<html lang>` value
 * @param {string} url - Current page URL (used for TLD detection)
 * @returns {string} Locale code with UK/AT disambiguation applied
 */
export function resolveLangCode(lang, url) {
  let langCode = normalizeLanguageCode(lang);
  if (langCode === 'en' && /\.uk(\/|$)/.test(url)) langCode = 'uk';
  if (langCode === 'de' && /\.at(\/|$)/.test(url)) langCode = 'at';
  return langCode;
}

/**
 * Pick a localized value from a `{ langCode: value }` map.
 * Falls back to `en`, then `default`, then the first defined value.
 * Returns the input unchanged if it isn't an object (treats it as already-resolved).
 *
 * @param {Object<string,string>|string|undefined} value - Map of locale→string OR a plain string
 * @param {string} langCode - Locale to look up
 * @returns {string|undefined} The resolved localized string
 */
export function pickLocalized(value, langCode) {
  if (!value || typeof value !== 'object') return value;
  return value[langCode] || value['en'] || value['default'] || Object.values(value)[0];
}

/**
 * Read the active site language from the page's `<html lang="...">` attribute.
 *
 * @returns {Cypress.Chainable<string>} The lang attribute value
 */
export function getSiteLanguage() {
  return cy.get('html').invoke('attr', 'lang');
}
