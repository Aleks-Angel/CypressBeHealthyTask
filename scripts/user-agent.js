// Single source of truth for the User-Agent every part of the suite sends.
//
// Carries the `BeHealthy-QA-Cypress/1.0` token so Cloudflare can identify our
// synthetic-monitoring traffic and skip bot-protection for it (WAF custom rule:
// `http.user_agent equals "BeHealthy-QA-Cypress/1.0"` -> Skip). Fixes the recurring
// CI graceful-skips where a brand's WAF challenged/blocked GitHub's datacenter IP.
//
// Why the BARE token and not appended to a browser UA: the CF rule uses `equals`,
// so any extra characters stop it matching. If the rule is ever relaxed to
// `contains`, prefer appending — a real-browser UA degrades better on any zone or
// path the Skip rule does not cover:
//   const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
//     + '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
//   const USER_AGENT = `${BROWSER_UA} ${QA_TOKEN}`;
//
// ALL THREE consumers must send this same UA:
//   - cypress.config.js      browser launch flag (every request the page makes)
//   - check-redirect-loop.js the Node pre-flight probe that decides the WAF skip
//   - run-lighthouse.js      canonical-URL resolution before the audit
// The probe matters most: it runs BEFORE cy.visit, so leaving it on a plain browser
// UA would still get it challenged and skip the run before Cypress loaded the page.
//
// NOTE: a UA is public and spoofable (any page script can read navigator.userAgent),
// so this is identification, not authentication — pair the CF rule with a second
// condition (e.g. ASN) if the bypass surface matters.

const QA_TOKEN = 'BeHealthy-QA-Cypress/1.0';
const USER_AGENT = QA_TOKEN;

module.exports = { USER_AGENT, QA_TOKEN };
