// Selectors that match a product card across the various storefront themes
// (Futunatura, Healthy/Purely, OpenCart, Sweet/embla card layouts).
const PRODUCT_CARD_SELECTORS = [
  '.embla_p a:has(.item_box)',
  '.embla__container a:has(.p-top)',
  '.product-layout',
  '.embla__container .product-card'
].join(', ');

// Looser selector used by selectFirstProduct (kept distinct for backward compatibility
// with checkout_flow.cy.js, which relies on .item_box matching standalone tiles).
const FIRST_PRODUCT_SELECTORS = '.item_box, .embla__container a:has(.p-top), .product-layout';

const COOKIE_ACCEPT_BUTTON = '#cookieBannerAllowAll';
const COOKIE_BANNER_CONTAINER = '[class*="cookie-banner"]';

// Shared cookie-banner dismissal — used both as a standalone command and as a re-check
// after navigation in searchProduct (where the banner can re-render).
function dismissCookieBannerIfPresent($body) {
  const visibleBanner = $body.find(COOKIE_BANNER_CONTAINER).length > 0
    || $body.find(COOKIE_ACCEPT_BUTTON).length > 0;
  if (!visibleBanner) return;

  cy.get(COOKIE_ACCEPT_BUTTON).click({ force: true });
  cy.get(COOKIE_ACCEPT_BUTTON).should('not.be.visible');
}

/**
 * `cy.safeVisit(url, options?)`
 * Visit a URL with WAF/Cloudflare-friendly defaults. Sets `@siteReachable`
 * alias (false if redirected to a block/error page) so callers can branch.
 *
 * @param {string} url - URL to navigate to
 * @param {Partial<Cypress.VisitOptions>} [options] - Additional cy.visit options
 */
Cypress.Commands.add('safeVisit', (url, options = {}) => {
  // cy.request goes through Node — WAF/Cloudflare will block it regardless of UA.
  // Just visit directly; the browser-level UA override handles the actual request.
  cy.visit(url, {
    timeout: 30000,
    failOnStatusCode: false,
    ...options,
  }).then(() => {
    cy.url().then((currentUrl) => {
      // If we got redirected to a block/error page, treat as unreachable
      const blocked = ['403', 'error', 'blocked'].some(token => currentUrl.includes(token));
      cy.wrap(!blocked).as('siteReachable');
    });
  });
});

/**
 * `cy.bypassCookieBanner()`
 * Click "accept all" on the cookie banner if it's currently rendered.
 * No-op if the banner isn't present.
 */
Cypress.Commands.add('bypassCookieBanner', () => {
  cy.get('body').then(dismissCookieBannerIfPresent);
});

/**
 * `cy.visitStorefront(url, options?)`
 * Standard "open a storefront" entrypoint — wraps `safeVisit` + `bypassCookieBanner`
 * so specs don't repeat the boilerplate. Both underlying commands stay exposed
 * for the edge cases (e.g. domain_visit.cy.js wants to gate on `@siteReachable`
 * before touching the cookie banner).
 *
 * @param {string} url - URL to navigate to
 * @param {Partial<Cypress.VisitOptions>} [options] - Additional cy.visit options
 */
Cypress.Commands.add('visitStorefront', (url, options = {}) => {
  cy.safeVisit(url, options);
  cy.bypassCookieBanner();
});

/**
 * `cy.searchProduct(query)`
 * Type a query into the storefront search input and assert at least one product
 * card is rendered. Re-dismisses the cookie banner afterward (it sometimes
 * re-mounts after search-result navigation).
 *
 * @param {string} query - Search term (e.g. 'Vitamin C')
 */
Cypress.Commands.add('searchProduct', (query) => {
  cy.get('input[type="search"][name="search"]')
    .should('be.visible')
    .should('not.be.disabled')
    .type(`${query}{enter}`);

  cy.get('.item_box, .product-layout, .embla__container .product-card')
    .filter(':visible')
    .should('have.length.greaterThan', 0);

  // Banner sometimes re-renders after search-result navigation.
  cy.get('body').then(dismissCookieBannerIfPresent);
});

/**
 * `cy.selectFirstProduct()`
 * Click the first visible product card on the current page. Uses the looser
 * `FIRST_PRODUCT_SELECTORS` (kept distinct from PRODUCT_CARD_SELECTORS for
 * backward compatibility with checkout_flow.cy.js).
 */
Cypress.Commands.add('selectFirstProduct', () => {
  cy.get(FIRST_PRODUCT_SELECTORS)
    .filter(':visible')
    .should('be.visible')
    .first()
    .click({ force: true });
});

/**
 * `cy.selectProductByIndex(index?)`
 * Click a product card by 0-based index, or a random card if 'random' is passed.
 * Works across the various storefront card layouts (embla carousels, .product-layout,
 * .product-card).
 *
 * @param {number|'random'} [index=0] - 0-based card index or the literal string 'random'
 */
Cypress.Commands.add('selectProductByIndex', (index = 0) => {
  return cy.get(PRODUCT_CARD_SELECTORS)
    .filter(':visible')
    .should('have.length.greaterThan', 0)
    .then(($els) => {
      const targetIndex = index === 'random'
        ? Cypress._.random(0, $els.length - 1)
        : index;

      cy.wrap($els[targetIndex]).scrollIntoView();
      cy.wrap($els[targetIndex]).click({ force: true });
    });
});
