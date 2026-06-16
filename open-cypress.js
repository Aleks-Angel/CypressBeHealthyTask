#!/usr/bin/env node

const { languages, getTargetUrl, supportedLocalesFor, resolveBrandApp } = require('./cypress/support/domains');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const [,, webApp, language, mode] = process.argv;

if (!webApp || !language) {
  console.log('Usage: node open-cypress.js <webApp> <language|all> [headed|headless]');
  process.exit(1);
}

const selectedApp = resolveBrandApp(webApp);

if (!selectedApp) process.exit(1);

const generateFinalReport = () => {
  console.log('\n📊 Generating stable report using mochawesome-merge...');
  const resultsDir = path.join(__dirname, 'cypress', 'results');
  const tempMerged = path.join(resultsDir, 'temp_report.merged'); // 🎯 Changed extension
  const finalMergedJson = path.join(resultsDir, 'merged-report.json');

  try {
    // 1. Merge into a filename that DOES NOT end in .json
    // This prevents the tool from trying to read its own output file
    execSync(`npx mochawesome-merge "${resultsDir}/*.json" > "${tempMerged}"`, { stdio: 'inherit' });
    
    // 2. Rename it to the proper .json name now that the merge is done
    if (fs.existsSync(tempMerged)) {
      fs.renameSync(tempMerged, finalMergedJson);
    }

    // 3. Generate the HTML
    execSync(`npx marge "${finalMergedJson}" --reportDir "${resultsDir}" --reportFilename "final-report" --charts true --inline true --overwrite true --showHooks always`, { stdio: 'inherit' });
    
    console.log(`✅ Reports saved to: ${resultsDir}/final-report.html`);
  } catch (error) {
    console.error('❌ Reporting failed:', error.message);
  }
};

if (language === 'all') {
  const isHeadless = mode === 'headless';
  const resultsPath = path.join(__dirname, 'cypress', 'results');
  const videosPath  = path.join(resultsPath, 'videos');
  const screenshotsPath = path.join(resultsPath, 'screenshots');

  if (fs.existsSync(resultsPath)) fs.rmSync(resultsPath, { recursive: true, force: true });
  fs.mkdirSync(videosPath,      { recursive: true }); // creates results/videos too
  fs.mkdirSync(screenshotsPath, { recursive: true });

  const isFullRun = process.argv.includes('--full');
  const sliceArg = process.argv.find(a => a.startsWith('--slice='));
  const sliceCount = sliceArg ? parseInt(sliceArg.split('=')[1], 10) : 2;

  // Filter out locales this brand doesn't support (e.g. futupets has no FR/ES/PT/UK).
  // supportedLocalesFor returns the full `languages` array minus the brand's
  // entries in `excludedLocales`. Logged so the CLI shows what we're skipping.
  const brandLocales = supportedLocalesFor(selectedApp);
  const skipped = languages.filter(l => !brandLocales.includes(l));
  if (skipped.length > 0) {
    console.log(`ℹ️ Skipping unsupported locales for ${selectedApp}: ${skipped.join(', ')}`);
  }
  const testLanguages = isFullRun ? brandLocales : brandLocales.slice(0, sliceCount);

  const runNext = (index) => {
    if (index >= testLanguages.length) {
      generateFinalReport();
      return;
    }

    const lang = testLanguages[index];
    const targetUrl = getTargetUrl(selectedApp, lang);
    const modeFlag = isHeadless ? '--headless' : '--headed';

    // reportFilename=${lang} ensures we get sl.json instead of mochawesome_001.json
    const command = `npx cypress run ${modeFlag} --browser chrome --spec "cypress/e2e/domain_visit.cy.js" --env language=${lang},selectedBaseUrl=${targetUrl},selectedApp=${selectedApp} --reporter mochawesome --reporter-options "reportDir=cypress/results,overwrite=false,html=false,json=true,reportFilename=${lang}"`;

    console.log(`🚀 Running [${lang.toUpperCase()}] for ${selectedApp}...`);
    const cypress = spawn(command, [], { stdio: 'inherit', shell: true });
    cypress.on('close', () => runNext(index + 1));
  };
  runNext(0);
} else {
  const targetUrl = getTargetUrl(selectedApp, language);
  spawn(`npx cypress open --browser chrome --env "selectedBaseUrl=${targetUrl},language=${language},selectedApp=${selectedApp}"`, [], { stdio: 'inherit', shell: true });
}