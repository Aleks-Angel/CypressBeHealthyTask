# Porting plan: integrate this Cypress suite into the BeHealthy app repo

A self-contained playbook for moving this suite into the BeHealthy OpenCart
application repo once a `staging.*` environment exists. **Sandboxed approach**:
everything Cypress-related lives in one folder (`qa/`), the app side is
functionally untouched.

For *how the current suite works*, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## When to use this plan

Apply this when **all** of the following are true:
- The BeHealthy app repo is hosted on GitHub (currently it's not)
- A staging environment exists (`staging.futunatura.hr`, etc.) — so PR validation
  can hit staging while scheduled cron continues to hit prod
- The team has agreed automation should live in the same repo as the app

If any of these aren't true yet, **keep automation in its own repo** — the
current arrangement is the right one for synthetic monitoring of deployed prod.

---

## The target repo (snapshot 2026-05-22)

The BeHealthy app repo is **OpenCart PHP** with a webpack-based frontend bundler
for 9 brands (`bioforma`, `on`, `hw`, `ef`, `mw`, `pn`, `bh`, `sn`, `fp`).
Deployment is via cPanel/FTP, not a CI/CD pipeline.

Key files at root:
- `admin/`, `catalog/`, `system/`, `vendor/` — OpenCart standard
- `package.json` — webpack theme builder only; **no test deps**, no app-runtime deps
- `webpack.config.js` — multi-theme builds (`build:bh`, `build:hw`, etc.)
- `.cpanel.yml`, `.ftpquota`, `exclude-list.txt` — deployment config
- `e_racuni/`, e-invoicing integration files

No existing Cypress, no existing test framework.

---

## Target layout (sandboxed)

```
BeHealthy/                          ← app root, UNTOUCHED
├── admin/                          (existing)
├── catalog/                        (existing)
├── system/                         (existing)
├── ...                             (existing)
├── package.json                    (existing — webpack only)
├── node_modules/                   (existing — webpack only)
├── webpack.config.js               (existing)
├── .cpanel.yml                     ← EDIT: add `qa/` to excludes
├── .gitignore                      ← EDIT: add `qa/*` exclusions
├── exclude-list.txt                ← EDIT (if used for FTP): add `qa/`
│
├── .github/
│   └── workflows/
│       └── cypress-ci.yml          ← NEW (working-directory: qa)
│
└── qa/                             ← YOUR SANDBOX
    ├── cypress/                    ← entire suite, copied wholesale
    ├── cypress.config.js
    ├── ARCHITECTURE.md
    ├── package.json                ← OWN, separate from app's
    ├── package-lock.json           ← OWN
    ├── node_modules/               ← OWN (gitignored)
    ├── run-random.js
    └── open-cypress.js
```

Folder name (`qa/`, `e2e/`, `automation/`, `cypress-tests/`) is a bikeshed —
pick what the team prefers. `qa/` is short and unambiguous.

---

## Why sandboxed (not root-level merge)

| Concern | Sandboxed (`qa/`) | Root-level merge |
|---|---|---|
| App devs `npm install` at root | Cypress not installed (no slowdown) | Downloads ~500 MB of Cypress |
| App `npm run build:hw` | Webpack ignores `qa/` cleanly | Webpack must be configured to skip `cypress/` |
| cPanel/FTP deploy | One-line exclude: `qa/` | Many individual files to exclude |
| Cypress dep upgrades | Independent of webpack version | Can conflict with shared deps |
| Extract back if needed | `git mv qa/* ../new-repo/` | Painful — files scattered |
| QA-only PRs | Touch only `qa/`, clean diff | Mixed in with app file diffs |

The app's `package.json` (which is purely a webpack theme builder) stays
**functionally identical** before and after. Frontend devs see one new folder
they can ignore.

---

## Files touched in the app repo (only these four)

### 1. `.cpanel.yml`
Add `qa/` to the deployment-exclude pattern. The exact syntax depends on the
cPanel YAML schema in use — read the existing file first. Goal: prevent `qa/`
from being FTP'd to the prod webserver.

### 2. `.gitignore`
Append:
```
qa/node_modules/
qa/cypress/screenshots/
qa/cypress/videos/
qa/cypress/results/
qa/_backup/
```

### 3. `exclude-list.txt`
If this file controls FTP/rsync exclusions (likely from the filename), add a
`qa/` entry. Verify by reading the existing file first.

### 4. `.github/workflows/cypress-ci.yml`
New file. See workflow YAML below.

**Not touched:** `package.json`, `node_modules/`, `webpack.config.js`, any app PHP code.

---

## The CI workflow (sandboxed pattern)

```yaml
name: Domain Visit (Random)

on:
  pull_request:
    branches: [main]
    paths: ['qa/**']               # only run when QA code changes
  push:
    branches: [main]
    paths: ['qa/**']
  # schedule:                       # uncomment to enable scheduled monitoring
  #   - cron: '0 * * * *'
  workflow_dispatch:

defaults:
  run:
    working-directory: qa           # every step runs from qa/, not repo root

jobs:
  domain-visit-random:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          cache: 'npm'
          cache-dependency-path: qa/package-lock.json
      - run: npm ci
      - run: npm run cypress:run:random
      - uses: actions/upload-artifact@v7
        if: always()
        with:
          name: cypress-results
          path: |
            qa/cypress/results/screenshots
            qa/cypress/results/videos
            qa/cypress/results/final-report.html
```

The two sandbox-critical lines:
- `defaults.run.working-directory: qa` — every step starts in `qa/`
- `cache-dependency-path: qa/package-lock.json` — caches `qa/`'s deps, not the app's

---

## Staging environment switch (when staging URLs exist)

Edit `qa/cypress/support/domains.js`:

```js
const ENVIRONMENT = process.env.CYPRESS_ENVIRONMENT || 'prod';

const webApps = ENVIRONMENT === 'staging'
  ? [
      'https://staging.futunatura.',
      'https://staging.healthyworld.',
      // ...one per brand
    ]
  : [
      'https://www.futunatura.',
      'https://www.healthyworld.',
      // ...one per brand (existing values)
    ];
```

Then in CI:
- PR validation runs hit staging → set `CYPRESS_ENVIRONMENT=staging` in the
  `pull_request` job's `env:` block
- Scheduled cron / push triggers hit prod → no env var needed (defaults to prod)

~30 min of work once staging URLs are confirmed. Document the env var in
[ARCHITECTURE.md](ARCHITECTURE.md) once added.

---

## Migration checklist

When the time comes, work this top-to-bottom:

```
□ Confirm the prerequisites at the top of this doc all hold
□ Confirm sandbox folder name with the team (qa/, e2e/, automation/, …)
□ Create branch in BeHealthy app repo: feat/add-cypress-sandbox
□ Create the sandbox folder at root (e.g. qa/)
□ Copy from this repo into the sandbox:
    cypress/                     → qa/cypress/
    cypress.config.js            → qa/cypress.config.js
    package.json                 → qa/package.json
    package-lock.json            → qa/package-lock.json
    run-random.js                → qa/run-random.js
    open-cypress.js              → qa/open-cypress.js
    ARCHITECTURE.md              → qa/ARCHITECTURE.md
    (and this file: PORTING-TO-APP-REPO.md — delete it from qa/ after migration)
□ Create .github/workflows/cypress-ci.yml (use the YAML above)
□ Edit .gitignore (add qa/ exclusions listed in this doc)
□ Edit .cpanel.yml (add qa/ to deploy excludes — read existing file for syntax)
□ Edit exclude-list.txt if used for FTP (add qa/)
□ Smoke test locally:
    cd qa
    npm ci
    npx cypress run --spec cypress/e2e/domain_visit.cy.js
    (verify mochawesome report generates at qa/cypress/results/final-report.html)
□ Add staging env switch to qa/cypress/support/domains.js (see above section)
□ Add CYPRESS_ENVIRONMENT=staging to the pull_request job in the workflow
□ Update qa/ARCHITECTURE.md to mention the env switch
□ Open PR in BeHealthy app repo
□ Verify the workflow runs against qa/ files only (paths filter working)
□ Verify cPanel deployment after merge does NOT include qa/ files
□ If satisfied: delete the original CypressBeHealthyTask repo, or archive it as
  historical reference
```

---

## Risks and gotchas

- **cPanel/FTP exclusion is silent on failure.** If you misconfigure `.cpanel.yml`
  or `exclude-list.txt`, the QA folder ships to prod with no warning. After the
  first post-merge deploy, manually verify by checking the prod server's file
  listing for the absence of `qa/`.

- **GitHub Actions enablement.** New BeHealthy app repos may have Actions
  disabled by default at the org level. Confirm `Settings → Actions → General`
  shows "Allow all actions" or equivalent before relying on CI.

- **Two `node_modules` in one repo.** Some teams dislike this; some tooling
  (linters, IDE indexers) may scan both. Acceptable in practice but flag for
  team awareness.

- **The Vue race tuning is per-site calibrated.** Same brands and same Vue
  versions on the app side means the tuning still applies. If the app team
  upgrades vue-select or migrates off Vue, the BG/RO city dropdown handling
  in `_selectFromVueSelect` will need re-validation.

- **Schedule trigger costs.** If you re-enable hourly cron in the sandboxed
  workflow, it'll run against the merged branch — eats CI minutes proportional
  to how often it fires. The current default is paused for that reason; weigh
  monitoring value against cost when you re-enable.

---

## Decision matrix: when to NOT do this merge

Keep the automation in its own repo if any of these are true:

- The BeHealthy app repo isn't on GitHub yet — wait
- There's no staging environment — tests would still hit prod, colocation buys
  nothing
- The dev team explicitly prefers separation (e.g. "QA owns testing, not us")
- You want to keep automation upgradeable on its own cadence
- The app repo's CI minutes are constrained

The current arrangement (separate repo, deployed against prod, hourly cron
paused, PR validation on the automation repo itself) **is the right design for
a synthetic-monitoring suite**. Only port it inside the app repo when there's
a clear organizational reason to do so.
