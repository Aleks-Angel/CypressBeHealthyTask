import { productPage } from '../support/page_objects/ProductPage';
import { checkoutPage } from '../support/page_objects/CheckoutPage';
import { homePage } from '../support/page_objects/HomePage';

describe('Futunatura Purchase Journey with Data Fixtures', () => {
  
  beforeEach(function () {
    cy.fixture('checkoutData').as('data');
    
    cy.visit('/');
    cy.bypassCookieBanner();
  });

  it('completes a partial checkout flow using fixture data', function () {
    const user = this.data.validUser;
    const primaryProduct = this.data.searchTerms.primary;
    const secondaryProduct = this.data.searchTerms.secondary;
    
    // Search for and add primary product to cart
    cy.searchProduct(primaryProduct);
    cy.selectFirstProduct();
    cy.url().should('include', primaryProduct.toLowerCase().replace(/\s+/g, '-'));
    productPage.productQuantityPlusButton.click();
    productPage.addToCartButton.click({ force: true });

    productPage.handleCartModal('continue');
    cy.get('input.search_input').should('be.visible').and('not.be.disabled');
    productPage.pageBody.should('not.have.class', 'modal-open');
    
    // Search for secondary product
    cy.searchProduct(secondaryProduct);
    cy.selectFirstProduct();
    cy.url().should('include', secondaryProduct.toLowerCase().replace(/\s+/g, '-'));
    productPage.addToCartButton.click({ force: true });
    productPage.handleCartModal('cart');
    
    // Proceed to checkout
    cy.url().should('include', '/cart', { timeout: 15000 })
    productPage.checkOutProduct();
    checkoutPage.fillCustomerInfo(user);
    checkoutPage.submitOrderButton.should('be.enabled');
  });

  it('add product from burger menu and remove from checkout bag', function() {
    
    homePage.hamburgerDesktopMenu.click({ force: true });
    homePage.subMenuVitamins.click();
    homePage.subMenuMultivitamins.click();
    homePage.miltiVitaminsLink.click();

    cy.selectFirstProduct();
    productPage.addToCartButton.click();

    // Fix 2: Handle modal here too to uncover the Cart Basket Icon
    productPage.handleCartModal('continue');
    homePage.cartBasketIcon.should('be.visible').should('not.have.class', 'disabled').click();
    homePage.cartDeleteItemButton.click();
    homePage.cartCloseButton.click();
      
  });
});