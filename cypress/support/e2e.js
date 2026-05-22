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
