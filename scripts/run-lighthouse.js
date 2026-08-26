// Lighthouse audit core, shared by the lighthouse-audit.js CLI and run-random.js
// (which audits the URL of a GREEN order run for the Slack perf line). Standalone
// so the launch/config/extraction lives in one place.
//
// lighthouse + chrome-launcher are ESM-only / interop-quirky, so they're loaded
// via dynamic import(). Needs a local Chrome (chrome-launcher finds it). Run
// locally or in a green CI run — a WAF-blocked IP would score the block page, but
// the green-order gate in run-random.js guarantees the site was reachable.

const fs = require('fs');
const { USER_AGENT } = require('./user-agent');

// Desktop preset — minimal throttling so scores reflect the real server/page, not
// an emulated slow mobile CPU. maxWaitForLoad bumped because slow storefronts
// can't settle within the 45s default ("results may be incomplete").
const DESKTOP_CONFIG = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'desktop',
    screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
    throttling: { rttMs: 40, throughputKbps: 10 * 1024, cpuSlowdownMultiplier: 1 },
    maxWaitForLoad: 60000,
    onlyCategories: ['performance'],
  },
};

// Follow redirects (Node) to the canonical final URL before auditing, so
// Lighthouse scores the real page (e.g. futupets.gr → www.futupets.gr) instead of
// counting the redirect against load time and warning about it.
function resolveFinalUrl(startUrl, maxHops = 10) {
  return new Promise((resolve) => {
    let finished = false;
    const done = (u) => { if (!finished) { finished = true; resolve(u); } };
    const hop = (current, n) => {
      if (n > maxHops) { done(current); return; }
      let lib;
      try { lib = require(new URL(current).protocol === 'https:' ? 'node:https' : 'node:http'); }
      catch { done(current); return; }
      const req = lib.get(current, { timeout: 15000, headers: { 'User-Agent': USER_AGENT } }, (res) => {
        res.resume();
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let next;
          try { next = new URL(res.headers.location, current).href; } catch { done(current); return; }
          hop(next, n + 1);
          return;
        }
        done(current);
      });
      req.on('timeout', () => { req.destroy(); done(current); });
      req.on('error', () => done(current));
    };
    hop(startUrl, 0);
  });
}

/**
 * Run Lighthouse against `url`, write `${outBase}.html`/`.json`, return the metrics.
 * @returns {Promise<{score:number, ttfb:number|null, fcp:number|null,
 *   lcp:number|null, tbt:number|null, si:number|null, warnings:string[],
 *   unfinished:string[]}>}
 */
async function auditUrl(url, outBase) {
  // Resolve the export defensively (CJS vs ESM interop differs between packages).
  const chromeLauncher = await import('chrome-launcher');
  const launch = chromeLauncher.launch ?? chromeLauncher.default?.launch;
  const lhMod = await import('lighthouse');
  const lighthouse = lhMod.default ?? lhMod;
  const chrome = await launch({ chromeFlags: ['--headless=new', '--no-sandbox'] });
  try {
    const { lhr, report } = await lighthouse(
      url,
      { port: chrome.port, output: ['html', 'json'], logLevel: 'error' },
      DESKTOP_CONFIG,
    );
    fs.writeFileSync(`${outBase}.html`, report[0]);
    fs.writeFileSync(`${outBase}.json`, report[1]);
    const a = lhr.audits;
    const num = (id) => (a[id] ? a[id].numericValue : null);
    const netItems = (a['network-requests'] && a['network-requests'].details && a['network-requests'].details.items) || [];
    return {
      score: Math.round((lhr.categories.performance.score ?? 0) * 100),
      ttfb: num('server-response-time'),
      fcp: num('first-contentful-paint'),
      lcp: num('largest-contentful-paint'),
      tbt: num('total-blocking-time'),
      si: num('speed-index'),
      warnings: lhr.runWarnings || [],
      // Requests that never completed — the usual cause of a "results may be
      // incomplete" warning (e.g. a hanging marketing beacon that never closes).
      unfinished: netItems.filter(r => r.finished === false).map(r => r.url),
    };
  } finally {
    // chrome-launcher removes Chrome's temp user-data-dir here; on Windows that
    // rmdir can EPERM (the dir is briefly locked). Swallow it — the metrics are
    // already computed above, and a throw in finally would override the return
    // and discard them. (Worst case: a stray %TEMP%\lighthouse.* dir lingers.)
    try { await chrome.kill(); } catch { /* ignore temp-cleanup EPERM (Windows) */ }
  }
}

module.exports = { resolveFinalUrl, auditUrl, DESKTOP_CONFIG };
