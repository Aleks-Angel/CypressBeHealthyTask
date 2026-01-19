import { productPage } from '../support/page_objects/ProductPage';
import { checkoutPage } from '../support/page_objects/CheckoutPage';

describe('Checkout Form Validation', () => {
  beforeEach(function () {
    cy.fixture('checkoutData').as('data');
    cy.visit('/vitamin-C-sumece-tablete');
    cy.bypassCookieBanner();

    productPage.addToCartButton.click();
    productPage.goToCartButton.click();
    cy.url().should('include', '/cart');
    productPage.goToCheckoutButton.click();

  });

  it('should display error messages for empty mandatory fields', function () {
    const validationMessages = this.data.validationMessages;
    checkoutPage.submitOrderButton.click();

    validationMessages.emptyFields.forEach(message => {
      cy.contains(message).should('be.visible');
    });
  });

  it('should reject an invalid email format', function () {
    const invalidUser = this.data.invalidUser;
    checkoutPage.emailInput.type(invalidUser.email);
    checkoutPage.acceptTermsAndConfirm();
    checkoutPage.submitOrderButton.click();

    checkoutPage.emailError
      .should('be.visible')
      .and('have.text', 'Greška: E-mail adresa nije ispravna.');
  });
});
