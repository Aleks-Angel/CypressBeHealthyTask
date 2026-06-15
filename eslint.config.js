// ESLint flat config (ESLint 9+) — replaces .eslintrc.json.
//
// Mirrors the old config: eslint:recommended everywhere, plus
// plugin:cypress/recommended (rules + cy/Cypress/expect globals) for the spec
// + support code under cypress/. Two file groups because the runtime differs:
//   - Node CLI scripts + cypress.config.js: CommonJS, Node globals.
//   - cypress/**: ES modules, browser + Cypress globals.
//
// Rule overrides preserved from .eslintrc.json:
//   cypress/unsafe-to-chain-command  off   — we chain commands deliberately.
//   cypress/no-unnecessary-waiting    warn  — the ~17 cy.wait(<literal>) calls are
//     per-site Vue/AJAX race tuning (see ARCHITECTURE / CLAUDE.md); warn, not error.

const js = require('@eslint/js');
const globals = require('globals');
const pluginCypress = require('eslint-plugin-cypress');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  js.configs.recommended,

  // Node CLI scripts + Cypress config (CommonJS): run-random.js, open-cypress.js,
  // lighthouse-audit.js, cypress.config.js, eslint.config.js, scripts/**.
  {
    files: ['*.js', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },

  // Cypress specs + support (ES modules, browser + Cypress globals + plugin rules).
  {
    files: ['cypress/**/*.js'],
    extends: [pluginCypress.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'cypress/unsafe-to-chain-command': 'off',
      'cypress/no-unnecessary-waiting': 'warn',
    },
  },
]);
