// Node-side reachability probe used by the cypress.config.js `checkRedirectLoop`
// task (registered for cy.task). Lives standalone (no Cypress dep) so it can be
// unit-tested against local servers — the real WAF case only reproduces from
// GitHub's datacenter IP, so local tests of the logic are the best we get.
//
// Why a Node pre-flight at all: some storefronts' WAF blocks GitHub's datacenter
// IP, and cy.visit then dies at onWindowLoad BEFORE the suite's @siteReachable
// graceful-skip can run. We detect the block up front, from Node, and skip.
//
// It catches all three Cloudflare presentations we've seen, because Node gets the
// SAME response the blocked browser does — it just doesn't execute the JS:
//   1. HTTP redirect-loop  → cycle / >maxHops in the redirect chain.
//   2. Hard-block page      → "Sorry, you have been blocked" body (served 200/403).
//   3. JS challenge page    → "Please wait while your request is being verified" /
//                             the /cdn-cgi/challenge-platform/ script. (This is the
//                             one that loops the *browser* via JS — invisible to a
//                             redirect-only check, which is why we read the body.)
//
// Precision: `blocked` is set ONLY on a redirect cycle or a recognized Cloudflare
// challenge/block body — NOT on a bare 403/timeout (which could be a Node-only
// block the real browser passes), so good stores aren't falsely skipped. Never
// throws — always resolves a verdict + the redirect chain (for tuning).

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

// Cloudflare-infrastructure-specific markers — present on its challenge/block
// pages, not on a real storefront page. The challenge-platform script path is the
// most reliable single signal for the JS interstitial.
const CF_MARKERS = [
  'Please wait while your request is being verified',
  'Performing security verification',
  'Verify you are human',
  'Sorry, you have been blocked',
  'You are unable to access',
  'Cloudflare Ray ID',
  '/cdn-cgi/challenge-platform/',
];

const MAX_BODY = 65536; // CF markers live near the top; cap so we don't pull full product pages

/**
 * @param {{url: string, maxHops?: number}} args
 * @returns {Promise<{looped: boolean, blocked: boolean, reason: string,
 *   chain: Array<{status:number, location:string|null}>}>}
 *   `blocked` true ⇒ skip the store (WAF). `looped` is a subset (redirect cycle).
 */
function checkRedirectLoop({ url, maxHops = 12 }) {
  return new Promise((resolve) => {
    const chain = [];
    const seen = new Set([url]);
    let finished = false;
    const done = (r) => {
      if (finished) return;
      finished = true;
      clearTimeout(master);
      resolve({ chain, looped: false, blocked: false, ...r });
    };
    // Master deadline so the probe always resolves well under cy.task's timeout.
    const master = setTimeout(() => done({ reason: 'master-timeout' }), 20000);

    const hop = (current, count) => {
      if (count > maxHops) { done({ looped: true, blocked: true, reason: 'exceeded-max-hops' }); return; }
      let lib;
      try { lib = require(new URL(current).protocol === 'https:' ? 'node:https' : 'node:http'); }
      catch { done({ reason: 'bad-url' }); return; }
      const req = lib.get(current, { timeout: 10000, headers: { 'User-Agent': BROWSER_UA } }, (res) => {
        const status = res.statusCode;
        const location = res.headers.location || null;
        chain.push({ status, location });

        // Redirect: follow it (cycle-detected), don't need the body.
        if (status >= 300 && status < 400 && location) {
          res.resume();
          let next;
          try { next = new URL(location, current).href; }
          catch { done({ reason: 'bad-location' }); return; }
          if (seen.has(next)) { done({ looped: true, blocked: true, reason: 'cycle' }); return; }
          seen.add(next);
          hop(next, count + 1);
          return;
        }

        // Terminal response: read a capped slice of the body and look for a
        // Cloudflare challenge/block page (the browser would loop/stall on it).
        const mitigated = String(res.headers['cf-mitigated'] || '').includes('challenge');
        let body = '';
        let capped = false;
        res.on('data', (chunk) => {
          if (capped) return;
          body += chunk;
          if (body.length >= MAX_BODY) { capped = true; res.destroy(); }
        });
        const evaluate = () => {
          const cf = mitigated || CF_MARKERS.some(m => body.includes(m));
          done({ blocked: cf, reason: cf ? 'cf-challenge-or-block' : `status-${status}` });
        };
        res.on('end', evaluate);
        res.on('close', evaluate); // fires if we destroyed the stream after the cap
      });
      req.on('timeout', () => { req.destroy(); done({ reason: 'timeout' }); });
      req.on('error', (e) => { done({ reason: `error-${e.code || 'unknown'}` }); });
    };
    hop(url, 0);
  });
}

module.exports = { checkRedirectLoop };
