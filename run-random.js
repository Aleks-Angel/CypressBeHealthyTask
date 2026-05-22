#!/usr/bin/env node

// Picks a random brand + language from cypress/support/domains.js and runs
// domain_visit.cy.js against the resulting URL. Used by `npm run cypress:run:random`
// and by the GitHub Actions workflow (so CI and local runs share one source of truth).
//
// Pass `--headed` to open the Cypress UI instead of headless Chrome.
// Pass `--browser <name>` to override the default (chrome).

const { webApps, languages, getTargetUrl } = require('./cypress/support/domains');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const app = pick(webApps);
const lang = pick(languages);
const url = getTargetUrl(app, lang);

const args = process.argv.slice(2);
const headed = args.includes('--headed');
const browserIdx = args.indexOf('--browser');
const browser = browserIdx !== -1 ? args[browserIdx + 1] : 'chrome';

console.log(`🎲 Random pick: ${app} + ${lang}`);
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

const child = spawn(command, [], { stdio: 'inherit', shell: true });
child.on('close', (code) => {
  generateFinalReport();
  process.exit(code ?? 0);
});
