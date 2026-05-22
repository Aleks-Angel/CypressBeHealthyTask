import { runDomainsOrders } from '../support/orders/domains_orders';
import { KNOWN_BRANDS } from '../support/domains';

const lang = Cypress.expose('language').toUpperCase();
const appUrl = Cypress.expose('selectedApp');
const domainName = appUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('.')[0];
const capitalizedDomain = domainName.charAt(0).toUpperCase() + domainName.slice(1);

const CLOUDFLARE_TEXT_MARKERS = ['Performing security verification', 'Verify you are human'];
const CLOUDFLARE_IFRAME = 'iframe[src*="challenges.cloudflare.com"]';

function isCloudflareChallenged($body) {
  const text = $body.text();
  if (CLOUDFLARE_TEXT_MARKERS.some(marker => text.includes(marker))) return true;
  return $body.find(CLOUDFLARE_IFRAME).length > 0;
}

describe(`[${lang}] ${capitalizedDomain} Order Test`, () => {
  beforeEach(function () {
    cy.fixture('checkoutData').as('checkoutData');
  });

  it(`performs checkout and verifies success for ${lang}`, function () {
    cy.task('getSharedRandomUrl').then((url) => {
      cy.log(`🎯 Testing: ${url}`);
      cy.safeVisit(url);

      cy.get('@siteReachable').then((reachable) => {
        if (!reachable) {
          cy.log('⚠️ Site unreachable, skipping order flow');
          return;
        }

        cy.get('body').then(($body) => {
          if (isCloudflareChallenged($body)) {
            cy.log('⚠️ Cloudflare challenge detected — skipping domain');
            return;
          }

          if (KNOWN_BRANDS.some(key => url.includes(key))) {
            cy.log(`Running order flow for: ${url}`);
            runDomainsOrders(this.checkoutData);
          } else {
            cy.get('h1', { timeout: 10000 }).should('exist');
            cy.log('✅ Basic page load verified');
          }
        });
      });
    });
  });
});
