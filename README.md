# BeHealthy E2E Cypress Automation

End-to-end Cypress test suite covering 8 BeHealthy storefronts (Futunatura, Healthyworld, Purely, Sweetbites, Erefit, Mycoway, OnEnergy, Futupets) across 16 locales. Uses the Page Object Model, runs stable in both headed and headless modes, and produces a self-contained mochawesome HTML report with failure screenshots embedded inline.

---

## ✨ What's notable

- **Brand × locale matrix** — one parametric spec (`domain_visit.cy.js`) runs against any of 8 brands × 16 locales = up to 128 combinations (futupets has 4 locales excluded via `excludedLocales`, bringing the real total to 124). URL composition lives in `cypress/support/domains.js` (one map for per-brand TLD overrides, one for unsupported locales per brand).
- **Vue race resilience** — checkouts use vue-select dropdowns and Bootstrap modals that race during AJAX-driven re-renders. The suite has explicit, per-site-tuned recovery for the BG/RO city/county dropdowns, payment-method radios, and stuck modals. See [ARCHITECTURE.md](ARCHITECTURE.md#load-bearing-code--do-not-casually-refactor) for which code is load-bearing.
- **Mochawesome flaky-attempt augmentation** — Cypress retries (`runMode: 1`) collapse a failed-then-passed test into a single pass entry in the report. A Node-side `after:spec` augmenter in `cypress.config.js` reads Cypress's per-attempt error info and injects "Flaky test", "Attempt N error", and "Failure screenshot (attempt 1)" into the visible test entry — so flaky tests in CI artifacts still show what failed and what they looked like at the failure moment.
- **Single-source-of-truth utilities** — localized regexes (success / cancel / status), the order-number selector union, and language-code resolution all live in `cypress/support/utils/*` so adding a new locale's wording or selector is a one-file edit. No copy-paste-drift bugs.
- **Self-contained HTML report** — screenshots are embedded as base64 data URIs into `final-report.html`, so emailing or archiving the single file preserves everything.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full breakdown of how the code is organized and which pieces are load-bearing. See [PORTING-TO-APP-REPO.md](PORTING-TO-APP-REPO.md) for the plan to merge this suite into the BeHealthy app repo once it's on GitHub.

---

## 🧪 Test Suites

| # | Spec | Coverage |
|---|---|---|
| 1 | `checkout_flow.cy.js` | Multi-product search → add to cart → checkout summary on Futunatura HR. Hamburger-menu navigation + side-cart deletion. |
| 2 | `checkout_validation.cy.js` | Mandatory-field error rendering + email-format rejection on Futunatura HR. |
| 3 | `login_scenarios.cy.js` | Login with valid credentials + logout; error paths for wrong credentials and empty fields. |
| 4 | `responsiveness.cy.js` | Multi-viewport check (iPhone XR, iPad 2, Desktop). Hamburger replaces desktop nav on small screens. |
| 5 | `domain_visit.cy.js` | **Domain matrix runner.** Resolves `selectedApp` + `language` → URL via `domains.js`, gracefully skips unreachable / Cloudflare-challenged sites, dispatches to the shared order flow (`runDomainsOrders`) for recognized brands. This is the spec invoked by the GitHub Actions workflow below. |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 22+ (CI runs on Node 24; lower versions may work but aren't validated)
- npm

### Installation

```bash
npm install
```

---

## ▶️ Running Tests

### Default modes

```bash
# Opens the Cypress UI runner with defaults (language=sl, futunatura base URL).
# Pass --env to override (see below).
npm run cypress:open

# Headless Chrome run of every spec with defaults.
npm run cypress:run
```

Defaults come from `cypress.config.js`:
- `language=sl` (Slovenian)
- `selectedApp=https://www.futunatura.`
- `selectedBaseUrl` is computed from those two via `getTargetUrl()`

### Pre-configured brand × locale (UI)

```bash
npm run cypress:open:futunatura:ro     # Futunatura Romania
npm run cypress:open:futunatura:si     # Futunatura Slovenia
npm run cypress:open:futunatura:hr     # Futunatura Croatia
npm run cypress:open:healthyworld:de   # Healthyworld Germany
npm run cypress:open:healthyworld:it   # Healthyworld Italy
npm run cypress:open:onenergy:ro       # OnEnergy Romania
npm run cypress:open:onenergy:de       # OnEnergy Germany
npm run cypress:open:purely:ro         # Purely Nutrition Romania
npm run cypress:open:purely:de         # Purely Nutrition Germany
npm run cypress:open:sweetbites:de     # Sweetbites Germany
npm run cypress:open:sweetbites:pl     # Sweetbites Poland
```

### Custom combinations — `open-cypress.js`

```bash
# Single brand + single language (opens UI)
node open-cypress.js <brand> <lang>
node open-cypress.js futunatura ro
node open-cypress.js purely bg
```

### Multi-language sweeps for one brand

```bash
# Defaults to FIRST 2 LANGUAGES (smoke). Use --full for all 16, or --slice=N for first N.
node open-cypress.js futunatura all                # headed, first 2 langs
node open-cypress.js futunatura all headless       # headless, first 2 langs
node open-cypress.js futunatura all headless --full           # all 16 langs
node open-cypress.js futunatura all headless --slice=5        # first 5 langs

# npm shortcuts that wrap the above:
npm run cypress:run:futunatura:all
npm run cypress:run:healthyworld:all
npm run cypress:run:onenergy:all
npm run cypress:run:purely:all
npm run cypress:run:sweetbites:all
```

In `all` mode `open-cypress.js`:
1. Wipes `cypress/results/`
2. Runs `domain_visit.cy.js` per language sequentially
3. Writes one mochawesome JSON per locale (`sl.json`, `hr.json`, ...)
4. Merges them into `cypress/results/final-report.html` via `mochawesome-merge` + `marge`

### Direct CLI — target one spec / one URL

```bash
# Run only the domain matrix spec against a specific URL
npx cypress run --spec "cypress/e2e/domain_visit.cy.js" \
  --env selectedBaseUrl=https://www.futunatura.ro

# Run with brand pattern + lang (let getTargetUrl compose the URL)
npx cypress run --spec "cypress/e2e/domain_visit.cy.js" \
  --env selectedApp=https://www.futunatura.,language=si
```

### Generate report manually

```bash
# After a non-open-cypress.js run, build the merged HTML report:
npm run report:generate

# Or run the suite + report in one shot (CI shortcut):
npm run test:ci
```

---

## 🤖 GitHub Actions — `domain_visit.cy.js`

The workflow picks a **random brand + random language** per run via `run-random.js` (which reads `webApps` + `languages` from `cypress/support/domains.js`, so the workflow stays in sync with the code without duplicating the lists in YAML). Lives at `.github/workflows/cypress-ci.yml`.

**Active triggers:**
- `push` to `main` — validates the test suite itself after a merge
- `pull_request` to `main` — informational status check on PRs (non-blocking by default — random pick can flake for reasons unrelated to the PR)
- `schedule` (hourly cron `0 * * * *`) — continuous matrix coverage, one random brand × locale per hour
- `workflow_dispatch` — manual run from the Actions tab

Every run (including the hourly cron) posts a summary to Slack when the
`SLACK_WEBHOOK_URL` secret is set — see [Slack notifications](#slack-notifications-optional-opt-in) below.

```yaml
name: Domain Visit (Random)

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  # Hourly smoke against a random brand × language.
  schedule:
    - cron: '0 * * * *'
  workflow_dispatch:

jobs:
  domain-visit-random:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          cache: 'npm'

      - run: npm ci

      - name: Run domain_visit.cy.js against a random brand × language
        run: npm run cypress:run:random

      - name: Upload Cypress results
        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: cypress-results
          path: |
            cypress/results/screenshots
            cypress/results/videos
            cypress/results/final-report.html
```

Notes:
- Action majors (`@v6`, `@v6`, `@v7`) are the Node-24-native releases — they silence the Node 20 deprecation warning that GitHub started emitting after Sep 2025. No `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` workaround needed.
- `npm run cypress:run:random` runs `node run-random.js`, which picks one brand from `webApps` and one language from `languages` (single source of truth — `cypress/support/domains.js`). The pick is logged to stdout so the CI log shows what was tested.
- `if: always()` on the artifact upload preserves screenshots + video + the mochawesome HTML even on failure — critical for the embedded-screenshot report to land in CI artifacts.
- To make PR checks blocking: repo Settings → Branches → main → "Require status checks to pass" → tick `Domain Visit (Random)`. Off by default because random-pick flakes are noisy in PR review.

### Local randomized runs

The same script works locally:

```bash
npm run cypress:run:random            # headless Chrome
npm run cypress:run:random:headed     # opens the Cypress UI with the random pick

# or call the script directly with extra flags:
node run-random.js --headed --browser firefox
```

### Slack notifications (optional, opt-in)

After the report is generated, `run-random.js` posts a one-line run summary
(🟢/🔴, brand × lang, pass/fail counts, duration) to Slack — **only if the
`SLACK_WEBHOOK_URL` environment variable is set**. Unset, it stays silent and
never errors. Logic lives in [scripts/notify-slack.js](scripts/notify-slack.js).

One-time setup (Slack side): create a Slack app → enable *Incoming Webhooks* →
add a webhook to the target channel → copy the `https://hooks.slack.com/...` URL.

Local:
```powershell
$env:SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/..."
npm run cypress:run:random
```

CI: add the URL as a repo secret named `SLACK_WEBHOOK_URL` (Settings → Secrets
and variables → Actions). The workflow already passes it through. CI messages
include a clickable **View report** link to the GitHub Actions run page, where
the `cypress-results` artifact (`final-report.html` with embedded screenshots +
video) downloads. Phase 1 is text-only — incoming webhooks can't upload files,
so the screenshot isn't rendered inline in Slack (that's Phase 2).

The message is written for a non-technical audience (managers/leads can be
invited to the channel): a plain-language pass/fail sentence, `Store` / `Website`
/ `Result` / `Triggered by` fields, and a friendly trigger label (`Hourly
automated check`, `Manual run`, `Code push`, `Pull request check`, or `Local
run`) — the commit SHA stays in parentheses on CI runs for traceability.

**Performance line (green runs only).** On a **passed** order run (and only when
`SLACK_WEBHOOK_URL` is set), `run-random.js` also Lighthouse-audits the same URL
and adds a `Performance:` field + a `🔦 Perf NN` header tag (`🟢 ≥90 / 🟡 50–89 /
🔴 <50`, with TTFB / LCP / Speed Index). A passed order *proves* the runner
reached the real store this run, so Lighthouse scores the real page, never a WAF
block — the green result is the reachability gate. Skipped/failed runs get no perf
line. The audit is best-effort (a Lighthouse failure never breaks the run or the
post). It's a **datacenter-IP regression baseline**, not real-user perf. Shared
audit core: [scripts/run-lighthouse.js](scripts/run-lighthouse.js).

---

## 🔦 Performance audits (Lighthouse)

Separate from the order-flow suite: [lighthouse-audit.js](lighthouse-audit.js)
runs a Lighthouse performance audit against the same brand × locale URLs (resolved
via `domains.js`, same `<brand> <locale>` args as `open-cypress.js`). Use it to
put real numbers on a "the site feels slow" hunch.

```powershell
npm run lighthouse -- futupets gr          # one locale
npm run lighthouse -- futupets gr,de,it    # several
npm run lighthouse -- futupets all         # every supported locale
```

Writes an HTML + JSON report per locale to `lighthouse-reports/` (gitignored) and
prints a summary — **Perf score, TTFB / Server Response Time, FCP, LCP, TBT,
Speed Index**. TTFB is the backend-health signal. It follows redirects to the
canonical URL first (e.g. `futupets.gr → www.futupets.gr`) and flags any request
that never finishes (a hanging marketing beacon trips Lighthouse's "results may be
incomplete" — the tool prints the offending URL so you don't have to dig the JSON).

- **Run locally, not in CI** — from a datacenter IP the WAF serves the block/
  challenge page, so Lighthouse would score that, not the store.
- It audits the **landing page load**; it does **not** measure mid-flow checkout
  AJAX (e.g. `checkout_vue/save`) — Lighthouse is for page-load perf, not the
  order endpoint.
- Needs `lighthouse` + `chrome-launcher` (devDependencies) and a local Chrome.

---

## 📊 Reports & Artifacts

Output goes under `cypress/results/`:

```
cypress/results/
├── screenshots/             # Per-failure screenshots, renamed to {lang}_{brand}_order.png
├── videos/                  # Per-spec recordings, renamed to {lang}_{brand}_order.mp4
├── {lang}.json              # Per-locale mochawesome JSON (multi-lang runs)
├── merged-report.json       # Aggregated by mochawesome-merge
└── final-report.html        # Self-contained HTML — open this
```

**Embedded screenshots:** when a test fails, Cypress (`screenshotOnRunFailure: true`) auto-captures the screenshot at the failure moment — before the page is cleared, so the PNG actually shows the page state the assertion saw. The `after:screenshot` hook in `cypress.config.js` renames the file to `{lang}_{brand}_order.png`. The `after:spec` augmenter then reads the per-attempt error info Cypress provides, embeds the screenshot as a base64 data URI, and injects it into the mochawesome JSON as test context — so the final HTML report is fully self-contained (no `file://` security blocks when opened from disk, and emailing the single HTML preserves the images).

**Flaky-test attempts:** when a test fails on attempt 1 and passes on retry, the augmenter injects three additional context sections into the (visible) passing entry:
- `Flaky test` — summary line ("Failed on attempt(s) 1..1, passed on attempt 2.")
- `Attempt N error` — the full assertion error + stack trace from each failed attempt
- `Failure screenshot (attempt 1)` — embedded PNG of what attempt 1's failure looked like

This works because the augmenter runs in Node, after mocha has finalized the test entry — `addContext` from inside afterEach is too late in Cypress's lifecycle (see [ARCHITECTURE.md](ARCHITECTURE.md#mochawesome-report-augmentation) for the why).

The renaming/move logic for screenshots and videos lives in `cypress.config.js` (`after:screenshot` and `after:spec` hooks). The lang-specific temp folders are deleted after each spec; only the final renamed files survive.

---

## 🏗 Project Architecture

```
cypress/
├── e2e/                            # 5 specs
├── support/
│   ├── commands.js                 # Custom cy.* commands (see below)
│   ├── e2e.js                      # Global hooks: failure-error bridge to Node + modal cleanup
│   ├── domains.js                  # webApps, languages, KNOWN_BRANDS, getTargetUrl()
│   ├── orders/
│   │   └── domains_orders.js       # Shared order flow used by domain_visit.cy.js across brands
│   ├── page_objects/
│   │   ├── HomePage.js             # Search, burger menu, cart drawer
│   │   ├── LoginPage.js            # Login form selectors
│   │   ├── ProductPage.js          # Add-to-cart button, modal handling, checkout link
│   │   └── CheckoutPage.js         # Customer info, payment method, address dropdowns, order cancellation
│   └── utils/                      # Pure functions / regex / selector unions
│       ├── lang.js                 # normalizeLanguageCode, resolveLangCode, pickLocalized, getSiteLanguage
│       ├── success-patterns.js     # SUCCESS_TEXT_PATTERN — "thank you for your order" across locales
│       ├── cancel-patterns.js      # CANCEL_SUCCESS_PATTERN, CANCEL_STATUS_PATTERN, STATUS_HEADING_PATTERN
│       └── order-selectors.js      # ORDER_NUMBER_SELECTOR — union across storefront themes
├── fixtures/
│   └── checkoutData.json           # validUser, invalidUser, search terms, payment config, validation messages
└── results/                        # See "Reports & Artifacts" above (gitignored)
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the "where does new code go?" decision table and the load-bearing-code section.

### Custom commands (`cypress/support/commands.js`)

| Command | Purpose |
|---|---|
| `cy.safeVisit(url, opts)` | `cy.visit` with a 30 s timeout, `failOnStatusCode: false`, and a `@siteReachable` alias for downstream branching. Doesn't go through `cy.request` (Node-side) because WAF/Cloudflare blocks that. |
| `cy.bypassCookieBanner()` | Dismisses the `#cookieBannerAllowAll` banner if present; safe no-op otherwise. |
| `cy.visitStorefront(url, opts)` | One-liner wrapper for `safeVisit` + `bypassCookieBanner` — the standard "open a storefront" entrypoint used by every spec's beforeEach. |
| `cy.searchProduct(query)` | Types into the search input + asserts at least one result tile rendered. Re-dismisses the cookie banner if it re-rendered. |
| `cy.selectFirstProduct()` | Clicks the first visible product tile (covers Futunatura/Healthy/Purely/OpenCart card layouts). |
| `cy.selectProductByIndex(idx)` | Selects by 0-based index or `'random'`. Same multi-theme selector coverage. |
| `cy.safeType(getElement, value)` | Type into an input with 3× retry + value verification; final fallback writes via `.val()` + `trigger('input','change')`. Protects against sites that wipe a field mid-operation (Vue re-renders, AJAX callbacks). `getElement` is a function returning a chainable, so retry can re-query a detached element. |

### Page object conventions

- `static SELECTORS = { ... }` at the top of each class — never hardcode raw selectors in methods.
- Getters return `cy.get(...)` chains (re-queryable, no stale handles).
- Cross-locale field switching (e.g. BG vs default address indices) handled via small helpers like `_byBgOrDefault`.
- Language normalization (`sl → si`, `cs → cz`, `el → gr`) lives in `utils/lang.js` (`normalizeLanguageCode`) — shared across page objects, not duplicated.
- Shared regex / selector unions live in `utils/` (success/cancel patterns, order-number selector). Page objects import them — adding a new locale's wording is a one-file edit.

### Vue race-condition handling

Storefronts that use Vue (especially Purely / Sweetbites / Mycoway checkouts) have race conditions where:
- Payment method radios show "checked" in the DOM but Vue's reactive store still has the default (so submit posts to the wrong gateway),
- Vue-select dropdowns hide their internal `input.vs__search` after selection (so post-render queries miss the input),
- Vue may unmount/re-key the combobox between operations on slower brands (BG mycoway, RO futunatura),
- City/county fields get cleared by Vue after the agreement checkbox is ticked.

`CheckoutPage.js` handles these explicitly via `_selectFromVueSelect` (3× retry with chip-commit polling), `selectPaymentMethodByLanguage` / `verifyPaymentMethodStable` (wrapper-click + native `.check()` to fire the change event), and the post-accept `verifyCityAfterAccept` (reuses `_selectFromVueSelect` for recovery). **Do not refactor these without a full domain × language test pass** — the `cy.wait(<literal>)` durations and retry counts are tuned per site. See [ARCHITECTURE.md](ARCHITECTURE.md#load-bearing-code--do-not-casually-refactor) for the full list of load-bearing pieces.

A 2026-06 reduction pass replaced several blind waits with deterministic signals (field-readiness assertions, the futupets `/thank-you` redirect, and a `cy.wait('@paySave')` intercept on the real payment-save AJAX that closes futupets's abandoned-order race) — verified green over 100+ orders. Brand-specific reductions are futupets-scoped; the other brands keep their calibrated waits. See ARCHITECTURE.md for the breakdown.

---

## 📝 Notes & gotchas

- **No automatic randomization in the config.** `cypress.config.js` defaults to `language=sl` + `webApps[0]`. The "random pick" lives in `run-random.js` (used by `npm run cypress:run:random` locally and by the GitHub Actions workflow).
- **`selectedApp` vs `selectedBaseUrl`:**
  - Pass `selectedApp=https://www.futunatura.` (base pattern, trailing dot) plus `language=ro` and `getTargetUrl()` composes the right URL (handling per-locale TLD overrides).
  - Pass `selectedBaseUrl=https://www.purely-nutrition.de` if you have the exact URL and want to skip the resolver.
- **Supported brand identifiers** (for `open-cypress.js` first arg): `futunatura`, `healthyworld`, `onenergy`, `erefit`, `mycoway`, `purelynutrition`, `sweetbites`, `futupets`.
- **Per-brand locale exclusions** are defined in `domains.js` `excludedLocales` and applied automatically by `run-random.js` (re-pick) and `open-cypress.js` (filter). Currently: `futupets` has no FR/ES/PT/UK deployments, so those 4 locales are skipped on futupets sweeps.
- **Supported language codes** (all 16): `si hr it hu de at ro cz sk pl fr bg es gr pt uk`.
- **`pageLoadTimeout: 120000`** is set in `cypress.config.js` — storefront success pages trail slow third-party trackers (Meta pixel, Google Tag) that keep `window.load` pending past the default 60 s. `domains_orders.js` calls `cy.window().then(win => win.stop())` once success is confirmed so the order-ID capture and cancellation steps don't sit blocked.
- **`Cypress.expose()`** is used (not the deprecated `Cypress.env()`) — see `cypress.config.js` where `language`, `selectedApp`, and `selectedBaseUrl` are mirrored into `config.expose`. Browser code reads them with `Cypress.expose('language')`.

---

## 📚 See also

- [ARCHITECTURE.md](ARCHITECTURE.md) — how the code is organized, the "where does new code go?" decision table, and the load-bearing-code list (timeouts/retries/`force:true` you should NOT casually refactor)
- [PORTING-TO-APP-REPO.md](PORTING-TO-APP-REPO.md) — sandboxed-merge plan for when this suite gets moved into the BeHealthy app repo
