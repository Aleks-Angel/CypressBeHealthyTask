#!/usr/bin/env node

// Picks a random brand + language from cypress/support/domains.js and runs
// domain_visit.cy.js against the resulting URL. Used by `npm run cypress:run:random`
// and by the GitHub Actions workflow (so CI and local runs share one source of truth).
//
// Pass `--headed` to open the Cypress UI instead of headless Chrome.
// Pass `--browser <name>` to override the default (chrome).

const { webApps, getTargetUrl, supportedLocalesFor, brandLabel } = require('./cypress/support/domains');
const { notifySlack, readStats } = require('./scripts/notify-slack');
const { resolveFinalUrl, auditUrl } = require('./scripts/run-lighthouse');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Pick a brand first, then pick a locale from THAT brand's supported set
// (i.e. excluding entries in `excludedLocales` — e.g. futupets has no FR/ES/PT/UK).
// Otherwise CI could randomly select a known-bad combo and burn a run on it.
const app = pick(webApps);
const lang = pick(supportedLocalesFor(app));
const url = getTargetUrl(app, lang);

const args = process.argv.slice(2);
const headed = args.includes('--headed');
const browserIdx = args.indexOf('--browser');
const browser = browserIdx !== -1 ? args[browserIdx + 1] : 'chrome';

console.log(`🎲 Random pick: ${brandLabel(app)} + ${lang}`);
console.log(`🎯 Target URL: ${url}`);
console.log(`🖥  Mode:       ${headed ? 'headed' : 'headless'} (${browser})`);

// Wipe cypress/results/ before each run. Without this, mochawesome's per-spec JSON
// files accumulate (mochawesome_001.json, _002.json, ...) and final-report.html
// never refreshes to reflect the current run.
const resultsDir = path.join(__dirname, 'cypress', 'results');
if (fs.existsSync(resultsDir)) {
  fs.rmSync(resultsDir, { recursive: true, force: true });
}
fs.mkdirSync(resultsDir, { recursive: true });

const generateFinalReport = () => {
  console.log('\n📊 Generating final-report.html via mochawesome-merge + marge...');
  const tempMerged = path.join(resultsDir, 'temp_report.merged');
  const mergedJson = path.join(resultsDir, 'merged-report.json');
  try {
    // Merge into a non-.json filename first so the tool doesn't try to read its own
    // output as input (mochawesome-merge globs *.json and would include itself).
    execSync(`npx mochawesome-merge "${resultsDir}/*.json" > "${tempMerged}"`, { stdio: 'inherit' });
    if (fs.existsSync(tempMerged)) fs.renameSync(tempMerged, mergedJson);
    execSync(
      `npx marge "${mergedJson}" --reportDir "${resultsDir}" --reportFilename "final-report" --charts true --inline true --overwrite true --showHooks always`,
      { stdio: 'inherit' }
    );
    console.log(`✅ Report ready: ${resultsDir}/final-report.html`);
  } catch (error) {
    console.error('❌ Reporting failed:', error.message);
  }
};

const command = [
  'npx cypress run',
  headed ? '--headed' : '',
  `--browser ${browser}`,
  '--spec "cypress/e2e/domain_visit.cy.js"',
  `--env selectedApp=${app},language=${lang},selectedBaseUrl=${url}`
].filter(Boolean).join(' ');

// Lighthouse the URL ONLY on a green order run, for the Slack perf line. A passed
// order proves the IP reached the real store this run, so Lighthouse gets the real
// page (not a WAF block) — the green result is the reachability gate. Gated on the
// webhook too (perf only feeds the Slack card). Best-effort: a Lighthouse failure
// (e.g. no Chrome on the runner) must never break the run or the notification.
const auditIfGreen = async () => {
  const stats = readStats();
  const passed = !!stats && stats.passes > 0 && stats.failures === 0 && stats.pending === 0;
  if (!passed || !process.env.SLACK_WEBHOOK_URL) return null;
  try {
    const finalUrl = await resolveFinalUrl(url);
    const outDir = path.join(__dirname, 'lighthouse-reports');
    // Clear stale reports so the folder doesn't pile up. CI-safe: this runs during
    // the job, before the fresh report is written below — the artifact-upload step
    // runs later and gets the current report. (On a clean CI runner the rm is a no-op.)
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    const outBase = path.join(outDir, `${brandLabel(app).toLowerCase()}-${lang}`);
    console.log(`🔦 Green run — Lighthouse audit of ${finalUrl} …`);
    const perf = await auditUrl(finalUrl, outBase);
    console.log(`   Perf ${perf.score} | TTFB ${perf.ttfb != null ? Math.round(perf.ttfb) + 'ms' : 'n/a'}`);
    return perf;
  } catch (err) {
    console.error('⚠️ Lighthouse audit skipped (non-fatal):', err.message);
    return null;
  }
};

const child = spawn(command, [], { stdio: 'inherit', shell: true });
child.on('close', async (code) => {
  generateFinalReport();
  const perf = await auditIfGreen();
  // Post a summary to Slack if SLACK_WEBHOOK_URL is set (no-op otherwise, never throws).
  // Runs after the report so notify-slack can read the merged JSON.
  await notifySlack({ brand: brandLabel(app), lang, url, exitCode: code ?? 0, perf });
  // Set the code and let the event loop drain instead of process.exit(): forcing
  // exit while fetch's socket handle is still closing trips a libuv assertion on
  // Windows (UV_HANDLE_CLOSING, src\win\async.c). Natural drain avoids the race.
  process.exitCode = code ?? 0;
});
