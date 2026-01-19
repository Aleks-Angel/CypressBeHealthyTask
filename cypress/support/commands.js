
Cypress.Commands.add('bypassCookieBanner', () => {
  // Check if cookie banner exists and dismiss it
  cy.get('body').then(($body) => {
    const acceptButton = $body.find('#cookieBannerAllowAll');
    
    if (acceptButton.length > 0) {
      cy.get('#cookieBannerAllowAll')
        .click({ force: true });
      
      // Wait a moment for the banner to process the click
      cy.wait(500);
    }
  });
});

Cypress.Commands.add('searchProduct', (query) => {
  cy.get('input[type="search"][name="search"]')
    .should('be.visible')
    .should('not.be.disabled')
    .type(`${query}{enter}`);
  
  cy.wait(1000);
  
  // Dismiss cookie banner if it reappears
  cy.get('body').then(($body) => {
    const banner = $body.find('[class*="cookie-banner"]');
    if (banner.length > 0) {
      cy.get('#cookieBannerAllowAll')
        .click({ force: true });
      cy.wait(500);
    }
  });
});

Cypress.Commands.add('selectFirstProduct', () => {
  cy.get('.item_box')
    .should('be.visible')
    .first()
    .click({ force: true });
});
