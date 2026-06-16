// Pure text helper shared by page objects + commands. No Cypress dependency.

/**
 * Lowercase + trim for case/whitespace-insensitive comparison. Non-strings
 * return `''` (callers pass jQuery `.val()` / `.text()` / `textContent`, which
 * can be `undefined`/`null`) so the result is always safe for `.includes()` and
 * `===` comparisons without a null guard.
 *
 * @param {*} value
 * @returns {string} normalized string, or `''` for non-strings
 */
export function normalizeText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
