import { runDomainsOrders } from '../support/orders/domains_orders';
import { KNOWN_BRANDS } from '../support/domains';

const lang = Cypress.expose('language').toUpperCase();
const appUrl = Cypress.expose('selectedApp');
const domainName = appUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('.')[0];
const capitalizedDomain = domainName.charAt(0).toUpperCase() + domainName.slice(1);

// Two Cloudflare presentations, both meaning the CI datacenter IP is blocked
// (not a real store error): the JS *challenge* interstitial ("Performing security
// verification" / "Verify you are human"), AND the hard *block* page ("Sorry, you
// have been blocked" / "Cloudflare Ray ID", served 403 at the same URL — no
// redirect-loop, so the safeVisit pre-flight probe can't see it). Either → skip.
const CLOUDFLARE_TEXT_MARKERS = [
  'Performing security verification',
  'Verify you are human',
  'Sorry, you have been blocked',
  'You are unable to access',
  'Cloudflare Ray ID',
];
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
          // Unreachable incl. WAF redirect-loop from the CI IP (see safeVisit
          // pre-flight). this.skip() marks the run inconclusive — a yellow
          // "skipped" in the report + a neutral Slack ⏭️ — instead of a false
          // ✅ (we never tested checkout) or ❌ (the store isn't actually broken).
          cy.log('⏭️ Site unreachable (WAF/bot-protection on CI IP) — skipping, not a checkout failure');
          // Defer skip so the log above lands in the step trail / Slack skip-reason
          // classifier (this.skip() throws synchronously, aborting before the queued
          // cy.log runs). return keeps the order flow below from queuing.
          cy.then(() => this.skip());
          return;
        }

        cy.get('body').then(($body) => {
          if (isCloudflareChallenged($body)) {
            cy.log('⏭️ Cloudflare challenge/block detected — skipping domain (inconclusive)');
            cy.then(() => this.skip());
            return;
          }

          if (KNOWN_BRANDS.some(key => url.includes(key))) {
            cy.log(`Running order flow for: ${url}`);
            // Pass a skip callback: if the picked product is out of stock (no
            // add-to-cart, only the "notify when available" form), the order flow
            // can't run — skip the test (inconclusive) instead of failing.
            runDomainsOrders(this.checkoutData, () => this.skip());
          } else {
            cy.get('h1', { timeout: 10000 }).should('exist');
            cy.log('✅ Basic page load verified');
          }
        });
      });
    });
  });
});
