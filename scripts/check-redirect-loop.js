// Node-side redirect-loop probe used by the cypress.config.js `checkRedirectLoop`
// task (registered for cy.task). Lives standalone (no Cypress dep) so it can be
// unit-tested against a local loop server — the real WAF case only reproduces
// from GitHub's datacenter IP, so local tests of the logic are the best we get.
//
// Some storefronts' WAF redirect-loops GitHub's datacenter IP; cy.visit follows
// the redirects and throws at onWindowLoad once it exceeds redirectionLimit
// (>20 hops), BEFORE the suite's @siteReachable graceful-skip can run. This
// follows redirects itself (browser-like UA), capped + cycle-detected, and flags
// looped=true ONLY on a genuine loop. A 403/timeout/other status from Node is
// NOT a loop (the real browser, with its own TLS/JS, may still pass), so good
// stores aren't falsely skipped. Never throws — always resolves a verdict plus
// the redirect chain (for tuning on the next real CI hit).

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

/**
 * @param {{url: string, maxHops?: number}} args
 * @returns {Promise<{looped: boolean, reason: string, chain: Array<{status:number, location:string|null}>}>}
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
      resolve({ chain, ...r });
    };
    // Master deadline so the probe always resolves well under cy.task's timeout,
    // even if a hop's socket hangs in a way the per-request timeout misses.
    const master = setTimeout(() => done({ looped: false, reason: 'master-timeout' }), 20000);

    const hop = (current, count) => {
      if (count > maxHops) { done({ looped: true, reason: 'exceeded-max-hops' }); return; }
      let lib;
      try { lib = require(new URL(current).protocol === 'https:' ? 'node:https' : 'node:http'); }
      catch { done({ looped: false, reason: 'bad-url' }); return; }
      const req = lib.get(current, { timeout: 10000, headers: { 'User-Agent': BROWSER_UA } }, (res) => {
        const status = res.statusCode;
        const location = res.headers.location || null;
        chain.push({ status, location });
        res.resume(); // drain so the socket frees
        if (status >= 300 && status < 400 && location) {
          let next;
          try { next = new URL(location, current).href; }
          catch { done({ looped: false, reason: 'bad-location' }); return; }
          if (seen.has(next)) { done({ looped: true, reason: 'cycle' }); return; }
          seen.add(next);
          hop(next, count + 1);
        } else {
          done({ looped: false, reason: `status-${status}` });
        }
      });
      req.on('timeout', () => { req.destroy(); done({ looped: false, reason: 'timeout' }); });
      req.on('error', (e) => { done({ looped: false, reason: `error-${e.code || 'unknown'}` }); });
    };
    hop(url, 0);
  });
}

module.exports = { checkRedirectLoop };
