import './commands'
beforeEach(() => {
  cy.intercept({ resourceType: /xhr|fetch/ }, { log: false });
});

// Disable transitions and animations to prevent headless flakiness
Cypress.on('window:before:load', (win) => {
    const style = win.document.createElement('style');
    style.innerHTML = `
        *, *::before, *::after {
            transition: none !important;
            animation: none !important;
        }
    `;
    win.document.head.appendChild(style);
});

Cypress.on('uncaught:exception', (err, runnable) => {
  // Returning false prevents Cypress from failing the test
  // when the Futunatura app throws internal JS errors.
  return false;
});

// 2. Forcibly clean the DOM between actions if a backdrop is stuck
// This is a common workaround for Bootstrap stability in headless CI
beforeEach(() => {
  cy.get('body').then(($body) => {
    const backdrop = $body.find('.modal-backdrop');
    if (backdrop.length > 0) {
      backdrop.remove(); // Manually remove it if it lingered
      $body.removeClass('modal-open'); // Restore scrolling
    }
  });
  });