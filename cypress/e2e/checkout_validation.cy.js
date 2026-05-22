import { productPage } from '../support/page_objects/ProductPage';
import { checkoutPage } from '../support/page_objects/CheckoutPage';

// Hardcoded to Futunatura HR — validation messages in fixtures are Croatian-specific
// ("Greška: E-mail adresa nije ispravna.", etc.), so this spec is locked to .hr.
const PRODUCT_URL = 'https://www.futunatura.hr/vitamin-C-sumece-tablete';

describe('Checkout Form Validation', () => {
  beforeEach(function () {
    cy.fixture('checkoutData').as('data');

    cy.visitStorefront(PRODUCT_URL);

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
