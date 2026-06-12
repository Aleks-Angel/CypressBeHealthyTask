#!/usr/bin/env node

// Lighthouse performance audit for the storefronts the suite tests — same
// <brand> <locale> args as open-cypress.js, resolved through domains.js so the
// brand×locale matrix stays one source of truth.
//
//   node lighthouse-audit.js futupets gr
//   node lighthouse-audit.js futupets gr,de,it
//   node lighthouse-audit.js futupets all
//   npm run lighthouse -- futupets gr
//
// Writes an HTML + JSON report per locale to lighthouse-reports/ and prints a
// summary table (Perf score, Server Response Time / TTFB, FCP, LCP, TBT, Speed
// Index). Server Response Time is the one to watch for backend slowness.
//
// RUN LOCALLY, not from CI: from a datacenter IP the WAF serves the block/
// challenge page, so Lighthouse would score that, not the store. Desktop preset
// (minimal throttling) so the numbers reflect the real server + page, not an
// emulated mobile CPU.

const { webApps, getTargetUrl, supportedLocalesFor, brandLabel } = require('./cypress/support/domains');
const fs = require('fs');
const path = require('path');

const [, , brandArg, localeArg] = process.argv;
if (!brandArg || !localeArg) {
  console.log('Usage: node lighthouse-audit.js <brand> <locale|csv|all>');
  console.log('  e.g. node lighthouse-audit.js futupets gr');
  console.log('       node lighthouse-audit.js futupets gr,de,it');
  console.log('       node lighthouse-audit.js futupets all');
  process.exit(1);
}

const normalizeApp = (str) => str.toLowerCase().replace(/https?:\/\/(www\.)?/, '').replace(/\./g, '');
const selectedApp = webApps.find(app => normalizeApp(app).includes(normalizeApp(brandArg)));
if (!selectedApp) {
  console.error(`❌ Unknown brand "${brandArg}". Known: ${webApps.map(normalizeApp).join(', ')}`);
  process.exit(1);
}

const brandLocales = supportedLocalesFor(selectedApp);
const locales = localeArg === 'all'
  ? brandLocales
  : localeArg.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

const unsupported = locales.filter(l => !brandLocales.includes(l));
if (unsupported.length) {
  console.log(`ℹ️ Skipping locales not deployed for ${brandLabel(selectedApp)}: ${unsupported.join(', ')}`);
}
const targets = locales.filter(l => brandLocales.includes(l));
if (!targets.length) { console.error('❌ No valid locales to audit.'); process.exit(1); }

const outDir = path.join(__dirname, 'lighthouse-reports');
fs.mkdirSync(outDir, { recursive: true });

// Desktop preset — minimal throttling so the scores reflect the real server/page
// rather than an emulated slow mobile CPU. We only need the performance category.
const DESKTOP_CONFIG = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'desktop',
    screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
    throttling: { rttMs: 40, throughputKbps: 10 * 1024, cpuSlowdownMultiplier: 1 },
    // Slow storefronts (futupets) can't settle within the 45s default and return
    // "results may be incomplete". Give the load more room.
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
      const req = lib.get(current, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
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

const ms = (v) => (v == null ? 'n/a' : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`);

async function auditUrl(url, outBase) {
  // lighthouse is ESM-only; load both via dynamic import so this CJS script works.
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
    await chrome.kill();
  }
}

(async () => {
  const rows = [];
  for (const lang of targets) {
    const rawUrl = getTargetUrl(selectedApp, lang);
    const url = await resolveFinalUrl(rawUrl);
    const outBase = path.join(outDir, `${normalizeApp(selectedApp)}-${lang}`);
    const shown = url !== rawUrl ? `${rawUrl} → ${url}` : url;
    process.stdout.write(`🔦 Auditing ${brandLabel(selectedApp)} × ${lang.toUpperCase()} (${shown}) … `);
    try {
      const r = await auditUrl(url, outBase);
      console.log(`Perf ${r.score} | TTFB ${ms(r.ttfb)} | LCP ${ms(r.lcp)}`);
      // Lighthouse's own run warnings (e.g. "results may be incomplete" when the
      // page is too slow to settle) — surface them so the scores aren't trusted blind.
      r.warnings.forEach(w => console.log(`   ⚠️ ${w}`));
      // ...and the usual cause: requests that never closed (hanging beacons etc.).
      if (r.unfinished.length) {
        console.log(`   ⛔ ${r.unfinished.length} request(s) never finished (stall the "fully loaded" state):`);
        r.unfinished.slice(0, 5).forEach(u => console.log(`      ${u.slice(0, 110)}`));
      }
      rows.push({ lang, ...r });
    } catch (err) {
      console.log(`❌ ${err.message}`);
      rows.push({ lang, error: err.message });
    }
  }

  console.log(`\n📊 ${brandLabel(selectedApp)} — Lighthouse (desktop, performance)`);
  console.log('Locale  Perf  TTFB     FCP      LCP      TBT      SpeedIdx');
  for (const r of rows) {
    if (r.error) { console.log(`${r.lang.toUpperCase().padEnd(7)} ERROR — ${r.error}`); continue; }
    console.log(
      `${r.lang.toUpperCase().padEnd(7)} ${String(r.score).padEnd(5)} ` +
      `${ms(r.ttfb).padEnd(8)} ${ms(r.fcp).padEnd(8)} ${ms(r.lcp).padEnd(8)} ${ms(r.tbt).padEnd(8)} ${ms(r.si)}`,
    );
  }
  console.log(`\n📁 Reports: ${outDir}`);
})();
