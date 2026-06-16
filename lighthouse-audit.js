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

const { webApps, getTargetUrl, supportedLocalesFor, brandLabel, normalizeApp, resolveBrandApp } = require('./cypress/support/domains');
const { resolveFinalUrl, auditUrl } = require('./scripts/run-lighthouse');
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

const selectedApp = resolveBrandApp(brandArg);
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
// Fresh each invocation — don't accumulate stale reports from earlier runs/locales.
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const ms = (v) => (v == null ? 'n/a' : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`);

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
