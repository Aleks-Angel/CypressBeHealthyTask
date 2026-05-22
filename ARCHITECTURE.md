# Architecture

A pragmatic map of how this Cypress suite is organized and why. Read this before
making changes — the layout is intentional and some of the code is load-bearing
in non-obvious ways.

For *how to run* the suite, see [README.md](README.md).

---

## File tree

```
cypress/
├── e2e/                            One spec per concern. Specs are thin —
│   ├── checkout_flow.cy.js         they orchestrate page objects and commands.
│   ├── checkout_validation.cy.js
│   ├── domain_visit.cy.js          The one parametric spec — runs against a
│   ├── login_scenarios.cy.js       random brand × locale picked by CI.
│   └── responsiveness.cy.js
├── fixtures/
│   └── checkoutData.json           Localized test data (city/postalCode/
│                                    validation strings per language).
└── support/
    ├── e2e.js                      Global hooks: afterEach failure capture
    │                                (bridges error info to Node for the
    │                                 mochawesome augmenter), beforeEach modal
    │                                 cleanup, uncaught:exception swallow.
    ├── commands.js                 Cypress.Commands.add registrations.
    │                                Site-navigation/product commands only.
    ├── domains.js                  Brand URLs, locale list, KNOWN_BRANDS,
    │                                getTargetUrl(). Pure data + one helper.
    ├── orders/
    │   └── domains_orders.js       runDomainsOrders() — full checkout
    │                                orchestration used by domain_visit spec.
    ├── page_objects/               Page Object Model classes. Singletons
    │   ├── CheckoutPage.js  (746)  exported (e.g. `export const checkoutPage`).
    │   ├── ProductPage.js
    │   ├── HomePage.js
    │   └── LoginPage.js
    └── utils/                      Pure functions. No Cypress dependency
        ├── lang.js                 unless explicitly noted. Importable from
        └── success-patterns.js     any page object or command.
```

Top-level files:
- [cypress.config.js](cypress.config.js) — Cypress config, screenshot/video
  renaming, `after:spec` mochawesome augmenter (injects retry attempt errors +
  screenshots into the report), error-bridge `captureAttemptError` task.
- [run-random.js](run-random.js) — CLI: picks a random brand+locale, runs
  `domain_visit.cy.js` once, regenerates the HTML report. Used by CI.
- [open-cypress.js](open-cypress.js) — CLI: runs `domain_visit.cy.js` for one
  brand × *all* locales sequentially. Local "full sweep" entrypoint.

---

## Layer responsibilities — where does new code go?

| You want to add… | Put it in |
|---|---|
| A selector for a new page element | The relevant page object's `SELECTORS` block |
| A page-level action (click X, type Y, assert Z) | A method on the relevant page object |
| Something callable as `cy.foo()` across many specs | `support/commands.js` (`Cypress.Commands.add`) |
| A pure helper (no Cypress dependency) | `support/utils/` |
| Localized text/data per language | `fixtures/checkoutData.json` |
| A new brand or locale URL | `support/domains.js` |
| Test orchestration that spans multiple page objects | `support/orders/` |

If you're not sure: pure functions go in `utils/`, anything that needs `cy.*`
goes in `commands.js` or a page object.

---

## Load-bearing code — DO NOT casually refactor

The following code is **per-site tuned** for race conditions we've encountered
and stabilized through real failure investigations. Each timeout, retry count,
and `force: true` was chosen for a reason. Casual cleanup will reintroduce
flakes you can't reproduce locally.

### `CheckoutPage._selectFromVueSelect`
Vue-select races: the dropdown listbox is only mounted when the combobox is
open. Typing with `{force:true}` bypasses focus and leaves the listbox unmounted.
Method opens-types-verifies-retries-3×, polling the `.vs__selected` chip text
for commit confirmation. Used for RO/BG county and city dropdowns.

### `CheckoutPage.verifyCityAfterAccept`
Recovery after the terms-acceptance checkbox triggers a Vue re-render that
sometimes clears the city dropdown selection. Re-runs `_selectFromVueSelect`
with a 400ms settle wait. The chip text (not the input value) is the source
of truth because vue-select hides the input after committing.

### `CheckoutPage._clickPaymentTarget` / `verifyPaymentMethodStable`
`force:true` clicks on payment-method wrappers don't fire the native `change`
event, so the underlying radio stays unset and submit ends up on the wrong
gateway. We explicitly `.check({force:true})` the radio after the wrapper click.

### `ProductPage._forceCloseStuckModal`
Bootstrap modal close transition occasionally never fires in headless Chrome,
leaving `display: block` inline on the modal. We strip the open-state classes,
inline styles, and `.modal-backdrop` ourselves.

### `cy.wait(<literal>)` instances in `domains_orders.js` and `CheckoutPage.js`
Each one is tuned for a specific brand's slowest observed behavior. In
particular:
- `cy.wait(8000)` after submit click — purely HR was redirecting at ~6s,
  shorter waits triggered false retries that ran against the success page.
- `cy.wait(900)` then `cy.get('#vs3__combobox', { timeout: 15000 })` — BG
  mycoway's cities API re-renders the city dropdown mid-wait.

If you need to change a wait, look at git blame first — most have an associated
commit explaining the failure they fix.

---

## CLI scripts — which one to use

```
              ┌──────────────────────────────────────────────┐
              │ I want to run the suite…                     │
              └──────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
  one brand,                random brand,             one specific
  all locales              random locale,            spec, fixed URL
        │                  fresh report                    │
        │                         │                        │
        ▼                         ▼                        ▼
  open-cypress.js           run-random.js          npx cypress run
  mycoway all                 (= CI default)        --spec ... --env
```

- **`npm run cypress:run:<brand>:all`** — calls `open-cypress.js`, sequentially
  runs every locale for one brand. Used locally when you want a full sweep.
- **`npm run cypress:run:random`** — calls `run-random.js`, picks one random
  brand×locale, runs once, wipes/regenerates report. **Used by GitHub Actions**
  (push trigger + hourly cron).
- **`npx cypress open`** — interactive runner. Pass `--env language=X,selectedBaseUrl=Y`
  to target a specific brand.

---

## Mochawesome report augmentation

Cypress retries (`retries.runMode: 1`) mean a failed-then-passed test shows up
in the HTML report as a single pass entry. To surface the flaky attempt's
error + screenshot in that pass entry:

1. `screenshotOnRunFailure: true` — Cypress auto-captures at failure time (the
   `after:screenshot` handler in [cypress.config.js](cypress.config.js) renames
   the file to `${lang}_${siteAlias}_order.png`).
2. `cy.task('captureAttemptError', ...)` in [e2e.js](cypress/support/e2e.js)'s
   afterEach bridges `this.currentTest.err` to a Node-side Map.
3. `after:spec` handler in [cypress.config.js](cypress.config.js) reads Cypress's
   `results.tests[].attempts[]`, walks the just-written mochawesome JSON, and
   injects "Flaky test", "Attempt N error", and "Failure screenshot (attempt 1)"
   into the test's `context` field.

`addContext` from afterEach itself does **not** work — mocha emits `test end`
before afterEach in Cypress, so by the time we'd attach the context, mochawesome
has already finalized the test entry. The Node-side augmenter sidesteps the
timing problem entirely by editing the JSON file after it's written.

---

## Conventions

- **Specs**: thin. Logic goes in page objects or commands. Specs read like a
  test plan, not implementation.
- **`force: true`**: only when there's a documented reason (Vue race, stuck
  modal, hidden overlay). Default is no force.
- **`cy.wait(<literal>)`**: avoid unless you have a documented race. Prefer
  `should()` assertions or `cy.intercept` waits.
- **Selectors**: prefer IDs and stable classes. Vue-select's `vsN` IDs are
  sequential and can shift on re-mount — `_selectFromVueSelect` handles the
  retry; new code that hardcodes `#vsN` should consider this.
- **Imports**: page objects export singleton instances (`export const checkoutPage`).
  Don't `new CheckoutPage()` in specs.
