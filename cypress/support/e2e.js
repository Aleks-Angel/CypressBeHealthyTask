// Global Cypress support file. Wires up:
//   - the commands.js registrations
//   - afterEach failure capture (bridges this.currentTest.err → Node-side Map
//     so the after:spec augmenter in cypress.config.js can inject it into the
//     mochawesome report)
//   - beforeEach modal-backdrop cleanup (Bootstrap leftover from previous test)
//   - global animation disable (stable screenshots, faster interactions)
//   - uncaught:exception swallow (storefronts throw unrelated tracker errors
//     post-conversion; suppressing them is intentional)
import './commands';

// --- Step trail -----------------------------------------------------------
// Record every cy.log as a narrated step so the mochawesome report shows what
// happened on EVERY run (incl. green ones), per test. The runner's command log
// and the video both clip the final synchronous cy.log (e.g. the cancel-
// confirmation log lands in frames the recorder has already stopped writing) —
// this captures it in JS the instant it fires, then bridges the trail to the
// Node-side after:spec augmenter (same path as captureAttemptError) which
// injects it as `context` on the test entry. Read-only: it only observes log.
const stepTrail = [];
let stepTrailStart = 0;

Cypress.Commands.overwrite('log', (originalFn, ...args) => {
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  stepTrail.push({ at: Date.now() - stepTrailStart, msg });
  return originalFn(...args);
});

/**
 * Read mocha's per-test retry counter robustly across mocha versions.
 * Cypress wraps mocha and the property name has historically varied:
 * `_currentRetry` (current), `currentRetry()` (older), `currentRetry` (older).
 *
 * @param {Mocha.Test|undefined} test - The current mocha test object
 * @returns {number} 0-based retry index (0 = first attempt, 1 = second, etc.)
 */
function getCurrentRetry(test) {
  if (!test) return 0;
  if (typeof test._currentRetry === 'number') return test._currentRetry;
  if (typeof test.currentRetry === 'function') return test.currentRetry();
  if (typeof test.currentRetry === 'number') return test.currentRetry;
  return 0;
}

afterEach(function () {
  const test = this.currentTest;
  if (!test) return;

  // Bridge the step trail (pass, fail, or skip) to Node so the after:spec
  // augmenter can inject it into the report. Sent once PER ATTEMPT, tagged with
  // the attempt number + state — beforeEach resets the trail between attempts, so
  // each send carries only that attempt's steps. The Node side keeps them all, so
  // a flaky/failed test shows where attempt 1 died vs. where attempt 2 went,
  // parallel to the per-attempt error capture below.
  if (stepTrail.length) {
    cy.task('recordStepTrail', {
      title: test.title,
      attempt: getCurrentRetry(test) + 1,
      state: test.state,
      steps: stepTrail.slice(),
    }, { log: false });
  }

  if (test.state === 'failed') {
    // Screenshot is auto-captured by Cypress (screenshotOnRunFailure: true) at the
    // moment of failure — the after:screenshot handler renames it. Bridge the
    // assertion error to Node so the after:spec augmenter can embed it; Cypress
    // 15's results.tests[].attempts[] doesn't carry per-attempt error info.
    const err = test.err;
    if (err) {
      cy.task('captureAttemptError', {
        title: test.title,
        message: err.message || String(err),
        stack: err.stack || ''
      });
    }
    return;
  }

  // Surface flaky retries in the terminal alongside the report entry.
  const currentRetry = getCurrentRetry(test);
  if (test.state === 'passed' && currentRetry > 0) {
    cy.task('log', `FLAKY: "${test.title}" passed on attempt ${currentRetry + 1} (failed ${currentRetry} time(s) before passing)`);
  }
});

beforeEach(() => {
  // Reset the step trail at the start of each attempt (so a retried test's
  // trail reflects only the final attempt, matching the report's final state).
  stepTrail.length = 0;
  stepTrailStart = Date.now();

  // Reduce log noise — we don't care about per-request entries in this suite.
  cy.intercept({ resourceType: /xhr|fetch/ }, { log: false });

  // Clear any stuck modal backdrop carried over from a previous test.
  cy.get('body').then(($body) => {
    const $backdrop = $body.find('.modal-backdrop');
    if ($backdrop.length === 0) return;
    $backdrop.remove();
    $body.removeClass('modal-open');
  });
});

// Disable CSS animations/transitions for stable screenshots and faster interactions.
Cypress.on('window:before:load', (win) => {
  const style = win.document.createElement('style');
  style.innerHTML = '*, *::before, *::after { transition: none !important; animation: none !important; }';
  win.document.head.appendChild(style);
});

// Storefronts emit unrelated JS errors that we don't care about — don't fail tests over them.
Cypress.on('uncaught:exception', () => false);
