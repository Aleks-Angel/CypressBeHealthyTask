const { defineConfig } = require('cypress');
const { webApps, getTargetUrl } = require('./cypress/support/domains');
const path = require('path');
const fs = require('fs');
const crypto = require('node:crypto');
const { checkRedirectLoop } = require('./scripts/check-redirect-loop');

// NOTE: this map exists here in Node context. e2e.js (browser context) cannot import from
// here, so the screenshot name in e2e.js is only a placeholder — the after:screenshot
// handler below always renames the final file with the values from this map.
const SITE_ALIAS_MAP = {
  purely: 'purenutrition',
  purelynutrition: 'purenutrition',
  healthyworld: 'healthyworld',
  onenergy: 'onenergy',
  sweetbites: 'sweetbites',
  futunatura: 'futunatura',
  erefit: 'erefit',
  mycoway: 'mycoway'
};

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function extractDomainName(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('.')[0]
    .replace(/-/g, '');
}

function findExistingNonEmpty(paths) {
  return paths.find(p => {
    try { return fs.existsSync(p) && fs.statSync(p).size > 0; } catch { return false; }
  });
}

async function waitForVideoFile(candidates, deadlineMs) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const found = findExistingNonEmpty(candidates);
    if (found) return found;
    await new Promise(r => setTimeout(r, 1000));
  }
  return null;
}

function safeRemove(filePath) {
  try { fs.unlinkSync(filePath); } catch { /* not critical */ }
}

async function waitForFile(filePath, deadlineMs) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    try { if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) return true; } catch { /* */ }
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

function findTestByTitle(suite, title) {
  for (const t of (suite.tests || [])) if (t.title === title) return t;
  for (const s of (suite.suites || [])) {
    const found = findTestByTitle(s, title);
    if (found) return found;
  }
  return null;
}

function formatAttemptError(attempt) {
  const e = attempt && attempt.error;
  if (!e) return 'No error details were captured for this attempt.';
  const header = e.name && e.message ? `${e.name}: ${e.message}` : (e.message || '(no message)');
  return e.stack ? `${header}\n\n${e.stack}` : header;
}

// Resolve the per-spec mochawesome JSON: prefer `<lang>.json` (our reportFilename),
// else the newest mochawesome*.json fallback. Waits up to 5s for it to flush to disk.
// Shared by the retry-info and step-trail augmenters below.
async function resolveSpecJson(resultsDir, lang) {
  let jsonFile = path.join(resultsDir, `${lang}.json`);
  if (!fs.existsSync(jsonFile)) {
    const fallback = fs.readdirSync(resultsDir)
      .filter(f => /^mochawesome.*\.json$/.test(f))
      .map(f => ({ f, mt: fs.statSync(path.join(resultsDir, f)).mtimeMs }))
      .sort((a, b) => b.mt - a.mt)[0];
    if (!fallback) return null;
    jsonFile = path.join(resultsDir, fallback.f);
  }
  return (await waitForFile(jsonFile, 5000)) ? jsonFile : null;
}

// Append a context entry to a test's mochawesome `context`, preserving any
// entries an earlier augmenter already set (retry info + step trail coexist).
function appendContext(test, entry) {
  let entries = [];
  if (test.context) {
    try {
      const parsed = JSON.parse(test.context);
      entries = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      entries = [{ title: 'Context', value: String(test.context) }];
    }
  }
  entries.push(entry);
  test.context = JSON.stringify(entries, null, 2);
}

// Render the captured cy.log steps as an aligned, monospace trail for the report:
//   " 1. +    0ms  🎯 Testing: https://…"
//   "13. +21770ms  ✅ Cancellation confirmed via success modal"
function formatStepTrail(steps) {
  const pad = String(steps[steps.length - 1].at).length;
  return steps
    .map((s, i) => `${String(i + 1).padStart(2)}. +${String(s.at).padStart(pad)}ms  ${s.msg}`)
    .join('\n');
}

// Inject the per-test step trail (bridged from e2e.js via recordStepTrail) into
// the mochawesome JSON for EVERY test — passed, failed, or skipped — so the
// report narrates what each run actually did. Runs after the retry augmenter and
// appends, so flaky-attempt context is preserved.
async function augmentReportWithStepTrails({ resultsDir, lang, stepTrails }) {
  if (!stepTrails || stepTrails.size === 0) return;

  const jsonFile = await resolveSpecJson(resultsDir, lang);
  if (!jsonFile) return;

  const report = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  let modified = false;

  for (const rootSuite of (report.results || [])) {
    for (const [title, steps] of stepTrails) {
      if (!steps || !steps.length) continue;
      const t = findTestByTitle(rootSuite, title);
      if (!t) continue;
      appendContext(t, { title: `Step trail (${steps.length} steps)`, value: formatStepTrail(steps) });
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(jsonFile, JSON.stringify(report, null, 2));
    console.log(`📋 Injected step trail(s) into ${path.basename(jsonFile)}`);
  }
}

// mochawesome's HTML report only renders the FINAL state of a retried test, so
// attempt-1's error and screenshot are otherwise invisible. This walks the
// per-spec mochawesome JSON after it's written and injects the failed-attempt
// error text plus an embedded screenshot as `context` entries on the visible
// test entry.
async function augmentReportWithRetryInfo({ resultsDir, lang, siteAlias, results, capturedErrors }) {
  const retried = (results && results.tests || []).filter(t => (t.attempts || []).length > 1);
  if (retried.length === 0) return;

  const jsonFile = await resolveSpecJson(resultsDir, lang);
  if (!jsonFile) return;

  const screenshotFile = path.join(resultsDir, 'screenshots', `${lang}_${siteAlias}_order.png`);
  const screenshotDataUri = fs.existsSync(screenshotFile)
    ? `data:image/png;base64,${fs.readFileSync(screenshotFile).toString('base64')}`
    : null;

  const report = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  let modified = false;

  retried.forEach(testResult => {
    const title = Array.isArray(testResult.title) ? testResult.title[testResult.title.length - 1] : testResult.title;
    const finalAttempt = testResult.attempts.length;
    const failedAttempts = (testResult.attempts || []).filter(a => a.state === 'failed');
    // Cypress 15's after:spec doesn't expose per-attempt errors — the bridge in
    // e2e.js captures them via cy.task('captureAttemptError') instead.
    const errorsFromBrowser = (capturedErrors && capturedErrors.get(title)) || [];

    for (const rootSuite of (report.results || [])) {
      const t = findTestByTitle(rootSuite, title);
      if (!t) continue;
      const finalState = testResult.state || t.state;
      const summary = finalState === 'passed'
        ? `Failed on attempt(s) 1..${failedAttempts.length}, passed on attempt ${finalAttempt}.`
        : `Failed on all ${finalAttempt} attempt(s).`;
      const entries = [{ title: 'Flaky test', value: summary }];
      failedAttempts.forEach((a, i) => {
        const bridged = errorsFromBrowser[i];
        const value = bridged
          ? (bridged.stack ? `${bridged.message}\n\n${bridged.stack}` : bridged.message)
          : formatAttemptError(a);
        entries.push({ title: `Attempt ${i + 1} error`, value });
      });
      if (screenshotDataUri) {
        entries.push({ title: 'Failure screenshot (attempt 1)', value: screenshotDataUri });
      }
      t.context = JSON.stringify(entries, null, 2);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(jsonFile, JSON.stringify(report, null, 2));
    console.log(`📝 Augmented ${path.basename(jsonFile)} with attempt-1 failure info (${retried.length} retried test(s))`);
  }
}

module.exports = defineConfig({
  // Cypress 15 deprecated browser-side Cypress.env() in favor of Cypress.expose() (public
  // values) and cy.env() (secrets). All our exposed values are public (language, brand
  // URL), so we mirror them into config.expose in setupNodeEvents below and turn off the
  // legacy API to silence the deprecation warning and surface any stray Cypress.env() calls.
  allowCypressEnv: false,
  reporter: 'mochawesome',
  reporterOptions: {
    reportDir: 'cypress/results',
    overwrite: false,
    html: false,
    json: true
  },

  defaultCommandTimeout: 10000,
  requestTimeout: 10000,
  // Storefront success pages trail slow third-party trackers (Meta pixel, Google
  // Tag, retargeting) that keep window.load pending past the default 60s. We
  // detect success via URL + DOM markers (not the load event) and call win.stop()
  // once confirmed; the bump here just gives that block room to run on cold caches.
  pageLoadTimeout: 120000,

  e2e: {
    video: true,
    videoCompression: 32,
    // Cypress captures right at the failure moment, before the page is cleared.
    // Manual cy.screenshot() in afterEach used to produce blank "about:blank" PNGs
    // because by then Cypress had already navigated away.
    screenshotOnRunFailure: true,
    viewportWidth: 1920,
    viewportHeight: 1080,
    chromeWebSecurity: false,
    screenshotsFolder: 'cypress/results/screenshots',
    videosFolder: 'cypress/results/videos',
    retries: {
      runMode: 1,
      openMode: 0
    },

    setupNodeEvents(on, config) {
      // Lock in CLI-driven config values with sensible defaults.
      config.env.language = config.env.language || 'sl';
      config.env.selectedApp = config.env.selectedApp || webApps[0];
      config.env.selectedBaseUrl = config.env.selectedBaseUrl
        || getTargetUrl(config.env.selectedApp, config.env.language);

      // Expose these public values to the browser via the Cypress 15 expose API.
      // Browser code reads them with Cypress.expose('language') etc.
      config.expose = {
        ...(config.expose || {}),
        language: config.env.language,
        selectedApp: config.env.selectedApp,
        selectedBaseUrl: config.env.selectedBaseUrl,
      };

      const lang = (config.env.language || 'sl').toLowerCase();
      const domainName = extractDomainName(config.env.selectedApp || 'purely');
      const siteAlias = SITE_ALIAS_MAP[domainName] || domainName;

      // Each run gets per-language temp folders; the root folders are the final destination
      // and are never trashed by Cypress between runs.
      const rootVideosFolder = path.join('cypress', 'results', 'videos');
      const rootScreenshotsFolder = config.screenshotsFolder;
      config.videosFolder = path.join(rootVideosFolder, lang);
      config.screenshotsFolder = path.join(rootScreenshotsFolder, lang);
      [rootVideosFolder, config.videosFolder, rootScreenshotsFolder, config.screenshotsFolder]
        .forEach(dir => fs.mkdirSync(dir, { recursive: true }));

      let screenshotCount = 0;

      // Bridge for per-attempt error details: Cypress 15's after:spec results.tests[].attempts[]
      // only carries `state`, not the assertion error. e2e.js's afterEach reads
      // this.currentTest.err and pushes it here via cy.task('captureAttemptError').
      // Keyed by test title; one entry per failed attempt in order.
      const capturedAttemptErrors = new Map();

      // Per-test step trails bridged from e2e.js's cy.log recorder (keyed by test
      // title; final attempt overwrites). Injected into the report in after:spec.
      const stepTrails = new Map();

      on('after:screenshot', (details) => {
        screenshotCount++;
        const suffix = screenshotCount > 1 ? `_${screenshotCount}` : '';
        const newFileName = `${lang}_${siteAlias}_order${suffix}.png`;
        const newPath = path.join(rootScreenshotsFolder, newFileName);

        if (!fs.existsSync(details.path)) {
          console.warn(`⚠️ Screenshot source not found: ${details.path}`);
          return { path: newPath };
        }

        try {
          fs.copyFileSync(details.path, newPath);
          fs.unlinkSync(details.path);
          console.log(`📸 Screenshot saved: ${newFileName}`);
        } catch (error) {
          console.error(`❌ Failed to save screenshot: ${error.message} | src: ${details.path} | dst: ${newPath}`);
        }
        return { path: newPath };
      });

      on('after:spec', async (spec, results) => {
        try {
          await augmentReportWithRetryInfo({
            resultsDir: path.join('cypress', 'results'),
            lang,
            siteAlias,
            results,
            capturedErrors: capturedAttemptErrors,
          });
        } catch (e) {
          console.warn('⚠️ Retry-info augmentation failed:', e.message);
        }
        capturedAttemptErrors.clear();

        try {
          await augmentReportWithStepTrails({
            resultsDir: path.join('cypress', 'results'),
            lang,
            stepTrails,
          });
        } catch (e) {
          console.warn('⚠️ Step-trail augmentation failed:', e.message);
        }
        stepTrails.clear();

        const specBaseName = path.basename(spec.relative, '.cy.js');
        const rawCandidates = [
          path.join(config.videosFolder, `${specBaseName}.mp4`),
          path.join(config.videosFolder, `${specBaseName}.cy.js.mp4`)
        ];
        const compressedCandidates = [
          path.join(config.videosFolder, `${specBaseName}-compressed.mp4`),
          path.join(config.videosFolder, `${specBaseName}.cy.js-compressed.mp4`)
        ];
        const allCandidates = [...compressedCandidates, ...rawCandidates];

        const sourceVideo = await waitForVideoFile(allCandidates, 30000);

        if (sourceVideo) {
          const newVideoName = `${lang}_${siteAlias}_order.mp4`;
          const finalVideoPath = path.join(rootVideosFolder, newVideoName);

          fs.mkdirSync(rootVideosFolder, { recursive: true });
          fs.copyFileSync(sourceVideo, finalVideoPath);
          console.log(`✅ Video saved: ${newVideoName}`);

          allCandidates.forEach(safeRemove);

          try {
            if (fs.readdirSync(config.videosFolder).length === 0) {
              fs.rmdirSync(config.videosFolder);
              console.log(`🧹 Removed empty folder: ${config.videosFolder}`);
            }
          } catch { /* optional cleanup */ }
        } else {
          console.warn(`⚠️ Video not found for spec ${spec.relative}`);
        }

        try { fs.rmSync(config.screenshotsFolder, { recursive: true, force: true }); } catch { /* */ }
      });

      on('before:browser:launch', (browser, launchOptions) => {
        if (['chrome', 'chromium', 'edge'].includes(browser.name)) {
          launchOptions.args.push(`--user-agent=${USER_AGENT}`);
        }
        if (browser.name === 'firefox') {
          launchOptions.preferences['general.useragent.override'] = USER_AGENT;
        }
        return launchOptions;
      });

      on('task', {
        getSharedRandomUrl() { return config.env.selectedBaseUrl; },
        log(message) { console.log(message); return null; },
        sha1({ value }) { return crypto.createHash('sha1').update(value).digest('hex'); },
        captureAttemptError({ title, message, stack }) {
          if (!capturedAttemptErrors.has(title)) capturedAttemptErrors.set(title, []);
          capturedAttemptErrors.get(title).push({ message, stack });
          return null;
        },
        // Store a test's step trail (last write wins → final attempt's trail).
        // Injected into the mochawesome report in after:spec.
        recordStepTrail({ title, steps }) {
          stepTrails.set(title, steps);
          return null;
        },
        // Pre-flight redirect-loop probe — catches the WAF redirect-loop that
        // makes cy.visit throw at onWindowLoad before @siteReachable can skip.
        // Logic lives in scripts/check-redirect-loop.js (standalone + testable).
        checkRedirectLoop(args) { return checkRedirectLoop(args); }
      });

      return config;
    },
  },
});
