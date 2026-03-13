const { defineConfig } = require("cypress");

module.exports = defineConfig({
  reporter: 'mochawesome',
  reporterOptions: {
    reportDir: 'cypress/results',
    overwrite: true,
    html: true,
    json: true,
    retries: {
    // 0 retries for 'cypress open' (headed), 
    // 2 retries for 'cypress run' (headless)
    runMode: 2,
    openMode: 0,
  },
  },

  // Global stability settings
  defaultCommandTimeout: 10000, 
  requestTimeout: 10000,
  viewportWidth: 1280,
  viewportHeight: 720,
  video: false, 
  screenshotOnRunFailure: true,

  // Disable insecure Cypress.env() access
  allowCypressEnv: false,

  e2e: {
    viewportWidth: 1280,
    viewportHeight: 720,
    baseUrl: 'https://www.futunatura.hr',
    setupNodeEvents(on, config) {
      // implement node event listeners here
      },
    chromeWebSecurity: false,

    
  },
});

