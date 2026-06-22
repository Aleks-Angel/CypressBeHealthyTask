import { productPage } from '../support/page_objects/ProductPage';
import { checkoutPage } from '../support/page_objects/CheckoutPage';
import { homePage } from '../support/page_objects/HomePage';

// Hardcoded to Futunatura HR: this spec uses Croatian search terms and Futunatura's
// burger-menu / submenu selectors (subMenuVitamins, multiVitaminsLink, etc.) which
// don't exist on other brands. Don't change without also revisiting those selectors.
const TARGET_URL = 'https://www.futunatura.hr/';

describe('Futunatura Purchase Journey with Data Fixtures', () => {
  beforeEach(function () {
    cy.fixture('checkoutData').as('data');

    cy.log(`🎯 Testing: ${TARGET_URL}`);
    cy.visitStorefront(TARGET_URL);
  });

  it('completes a partial checkout flow using fixture data', function () {
    const user = this.data.validUser;
    const primaryProduct = this.data.searchTerms.primary;
    const secondaryProduct = this.data.searchTerms.secondary;

    // Don't assert on URL slug — Futunatura's own slugs occasionally diverge from the
    // search term (e.g. /magenzij-sumece-tablete for "Magnezij"). Verifying the product
    // page rendered (Add-to-Cart button visible) is the real intent here.
    cy.searchProduct(primaryProduct);
    cy.selectFirstProduct();
    productPage.addToCartButton.should('be.visible');
    productPage.productQuantityPlusButton.click();
    productPage.addToCartButton.click({ force: true });

    productPage.handleCartModal('continue');
    cy.get('input.search_input').should('be.visible').and('not.be.disabled');
    productPage.pageBody.should('not.have.class', 'modal-open');

    cy.searchProduct(secondaryProduct);
    cy.selectFirstProduct();
    productPage.addToCartButton.should('be.visible');
    productPage.addToCartButton.click({ force: true });
    productPage.handleCartModal('cart');

    cy.url().should('include', '/cart', { timeout: 15000 });
    productPage.checkOutProduct();
    checkoutPage.fillCustomerInfo(user);
    checkoutPage.submitOrderButton.should('be.enabled');
  });

  it('adds product from burger menu and removes it from cart', function () {
    homePage.hamburgerDesktopMenu.click({ force: true });
    homePage.subMenuVitamins.click();
    homePage.subMenuMultivitamins.click();
    homePage.multiVitaminsLink.click();

    cy.selectFirstProduct();
    productPage.addToCartButton.click();

    // Modal must close before the basket icon becomes clickable.
    productPage.handleCartModal('continue');
    // Split the chain — the cart icon re-renders when the count badge updates after
    // add-to-cart, which detaches the <svg> we matched on. Re-query for the click.
    homePage.cartBasketIcon.should('be.visible').and('not.have.class', 'disabled');
    homePage.cartBasketIcon.click();
    // The weekly promo auto-adds a free-gift line (e.g. "Rashladna torba", 0.00 €)
    // tied to the qualifying product, so the cart holds 2+ items. Removing the
    // product cascades to remove its gift too, so ONE delete clears the cart —
    // hence .first() (a multi-click would try to click the now-detached gift row).
    // Assert the cart actually emptied: this is the check the old single .click()
    // lacked, which let the silent "2 delete buttons" break slip through (spec is
    // not in CI).
    homePage.cartDeleteItemButton.first().click();
    homePage.cartDeleteItemButton.should('not.exist');
    homePage.cartCloseButton.click();
  });
});
