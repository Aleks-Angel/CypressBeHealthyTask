# BeHealthy E2E Cypress Automation

End-to-end Cypress test suite covering 7 BeHealthy storefronts (Futunatura, Healthyworld, Purely, Sweetbites, Erefit, Mycoway, OnEnergy) across 16 locales. Uses the Page Object Model, runs stable in both headed and headless modes, and produces a self-contained mochawesome HTML report with failure screenshots embedded inline.

---

## 🧪 Test Suites

| # | Spec | Coverage |
|---|---|---|
| 1 | `checkout_flow.cy.js` | Multi-product search → add to cart → checkout summary on Futunatura SI. Hamburger-menu navigation + side-cart deletion. |
| 2 | `checkout_validation.cy.js` | Mandatory-field error rendering + email-format rejection on Futunatura HR. |
| 3 | `login_scenarios.cy.js` | Login with valid credentials + logout; error paths for wrong credentials and empty fields. |
| 4 | `responsiveness.cy.js` | Multi-viewport check (iPhone XR, iPad 2, Desktop). Hamburger replaces desktop nav on small screens. |
| 5 | `domain_visit.cy.js` | **Domain matrix runner.** Resolves `selectedApp` + `language` → URL via `domains.js`, gracefully skips unreachable / Cloudflare-challenged sites, dispatches to the shared order flow (`runDomainsOrders`) for recognized brands. This is the spec invoked by the GitHub Actions workflow below. |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
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

## 🤖 GitHub Actions — `domain_visit.cy.js` on push + hourly

The workflow picks a **random brand + random language** for every run, both on every push and on an hourly schedule, so the matrix gets continuous coverage without pinning specific combinations.

Randomization is handled by `run-random.js` (which reads `webApps` + `languages` from `cypress/support/domains.js`, so the workflow stays in sync with the code without duplicating the lists in YAML).

Drop this in `.github/workflows/domain-visit.yml`:

```yaml
name: Domain Visit (Random)

on:
  push:
    branches: [main]
  schedule:
    # Hourly smoke against a random brand × language
    - cron: '0 * * * *'
  workflow_dispatch:

jobs:
  domain-visit-random:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Run domain_visit.cy.js against a random brand × language
        run: npm run cypress:run:random

      - name: Upload Cypress results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: cypress-results
          path: |
            cypress/results/screenshots
            cypress/results/videos
            cypress/results/final-report.html
```

Notes:
- `npm run cypress:run:random` runs `node run-random.js`, which picks one brand from `webApps` and one language from `languages` (single source of truth — `cypress/support/domains.js`). The pick is logged to stdout so the CI log shows what was tested.
- The cron uses GitHub's UTC time. Hourly = `0 * * * *`. Adjust if you want a quieter cadence (e.g. `0 */3 * * *` for every 3 hours).
- `if: always()` on the artifact upload preserves screenshots + video + the mochawesome HTML even on failure — critical for the embedded-screenshot report to land in CI artifacts.

### Local randomized runs

The same script works locally:

```bash
npm run cypress:run:random            # headless Chrome
npm run cypress:run:random:headed     # opens the Cypress UI with the random pick

# or call the script directly with extra flags:
node run-random.js --headed --browser firefox
```

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

**Embedded screenshots:** when a test fails, `cypress/support/e2e.js` captures the screenshot and attaches it inline (as a base64 data URI) to the mochawesome report via `mochawesome/addContext`. The HTML report is fully self-contained — no `file://` security blocks when opened from disk, and emailing the single HTML file preserves the images.

The renaming/move logic for screenshots and videos lives in `cypress.config.js` (`after:screenshot` and `after:spec` hooks). The lang-specific temp folders are deleted after each spec; only the final renamed files survive.

---

## 🏗 Project Architecture

```
cypress/
├── e2e/                            # Specs (5 above + cypress/e2e/ph/ for WIP)
├── support/
│   ├── commands.js                 # Custom cy.* commands (see below)
│   ├── e2e.js                      # Global hooks: failure screenshot + mochawesome addContext
│   ├── domains.js                  # webApps, languages, KNOWN_BRANDS, getTargetUrl()
│   ├── orders/
│   │   └── domains_orders.js       # Shared order flow used by domain_visit.cy.js across brands
│   └── page_objects/
│       ├── HomePage.js             # Search, burger menu, cart drawer
│       ├── LoginPage.js            # Login form selectors
│       ├── ProductPage.js          # Add-to-cart button, modal handling, checkout link
│       └── CheckoutPage.js         # Customer info, payment method, address dropdowns, order cancellation
├── fixtures/
│   └── checkoutData.json           # validUser, invalidUser, search terms, payment config, validation messages
└── results/                        # See "Reports & Artifacts" above
```

### Custom commands (`cypress/support/commands.js`)

| Command | Purpose |
|---|---|
| `cy.safeVisit(url, opts)` | `cy.visit` with a 30 s timeout, `failOnStatusCode: false`, and a `@siteReachable` alias for downstream branching. Doesn't go through `cy.request` (Node-side) because WAF/Cloudflare blocks that. |
| `cy.bypassCookieBanner()` | Dismisses the `#cookieBannerAllowAll` banner if present; safe no-op otherwise. |
| `cy.searchProduct(query)` | Types into the search input + asserts at least one result tile rendered. Re-dismisses the cookie banner if it re-rendered. |
| `cy.selectFirstProduct()` | Clicks the first visible product tile (covers Futunatura/Healthy/Purely/OpenCart card layouts). |
| `cy.selectProductByIndex(idx)` | Selects by 0-based index or `'random'`. Same multi-theme selector coverage. |

### Page object conventions

- `static SELECTORS = { ... }` at the top of each class — never hardcode raw selectors in methods.
- Getters return `cy.get(...)` chains (re-queryable, no stale handles).
- Cross-locale field switching (e.g. BG vs default address indices) handled via small helpers like `_byBgOrDefault`.
- Language normalization (`sl → si`, `cs → cz`, `el → gr`) lives in `CheckoutPage.normalizeLanguageCode`.

### Vue race-condition handling

Storefronts that use Vue (especially Purely / Sweetbites checkouts) have race conditions where:
- Payment method radios show "checked" in the DOM but Vue's reactive store still has the default,
- Vue-select dropdowns hide their internal `input.vs__search` after selection,
- City/county fields get cleared by Vue after the agreement checkbox is ticked.

`CheckoutPage.js` handles these explicitly in `selectPaymentMethodByLanguage`, `verifyPaymentMethodStable`, the Vue-select helper in `fillRomanianBulgarianAddress`, and the post-accept `verifyCityAfterAccept`. **Do not refactor these without a full domain × language test pass** — the timings are tuned per site.

---

## 📝 Notes & gotchas

- **No automatic randomization in the config.** `cypress.config.js` defaults to `language=sl` + `webApps[0]`. The "random pick" lives in the GitHub Actions workflow's shell step (or `--env` from your CI matrix).
- **`selectedApp` vs `selectedBaseUrl`:**
  - Pass `selectedApp=https://www.futunatura.` (base pattern, trailing dot) plus `language=ro` and `getTargetUrl()` composes the right URL (handling per-locale TLD overrides).
  - Pass `selectedBaseUrl=https://www.purely-nutrition.de` if you have the exact URL and want to skip the resolver.
- **Supported brand identifiers** (for `open-cypress.js` first arg): `futunatura`, `healthyworld`, `onenergy`, `erefit`, `mycoway`, `purelynutrition`, `sweetbites`.
- **Supported language codes** (all 16): `si hr it hu de at ro cz sk pl fr bg es gr pt uk`.
- The `cypress/e2e/ph/` folder contains work-in-progress specs (e.g. `purely_order.js`) that are not yet wired into the suite. Treat as experimental.
