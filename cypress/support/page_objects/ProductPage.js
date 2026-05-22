/**
 * Product detail page POM. Owns add-to-cart, quantity controls, the post-add
 * confirmation modal (with the "stuck modal" workaround for headless Chrome),
 * and the "go to checkout" link selector. Used by every checkout-flow spec.
 */
class ProductPage {
  static SELECTORS = {
    PRODUCT_CARDS: '.embla_p a:has(.item_box)',
    ADD_TO_CART_BUTTON: '#button-cart',
    QUANTITY_PLUS_BUTTON: '.col-xl-3 > .holder > .plus',
    MODAL: '#addToCartModal',
    MODAL_BACKDROP: '.modal-backdrop',
    // The cart confirmation button has several theme-specific variants. Some locales
    // (UK Healthyworld) render the button OUTSIDE .modal-content but still inside
    // the modal, so .btn-black / .btn-primary--primary are intentionally unscoped.
    MODAL_GO_TO_CART: '.modal-content .btn-blue, .modal-content .btn-primary--blue, .modal-content .btn-primary--orange, .btn-black, .btn-primary--primary, .modal-content .btn-primary--green',
    MODAL_CONTINUE_SHOPPING: '.modal-content .btn-white-border',
    CHECKOUT_LINK: 'a[href*="route=checkout/checkout"]'
  };

  get productCards() { return cy.get(ProductPage.SELECTORS.PRODUCT_CARDS); }
  get addToCartButton() { return cy.get(ProductPage.SELECTORS.ADD_TO_CART_BUTTON); }
  get productQuantityPlusButton() { return cy.get(ProductPage.SELECTORS.QUANTITY_PLUS_BUTTON); }

  get modalId() { return ProductPage.SELECTORS.MODAL; }
  get addToCartModal() { return cy.get(this.modalId); }
  get modalBackdrop() { return cy.get(ProductPage.SELECTORS.MODAL_BACKDROP); }
  get goToCartButton() { return this.addToCartModal.find(ProductPage.SELECTORS.MODAL_GO_TO_CART); }
  get continueShoppingButton() { return this.addToCartModal.find(ProductPage.SELECTORS.MODAL_CONTINUE_SHOPPING); }

  get goToCheckoutButton() {
    return cy.get(ProductPage.SELECTORS.CHECKOUT_LINK).filter(':visible').first();
  }
  get pageBody() { return cy.get('body'); }

  /**
   * Handle the post-add-to-cart modal and ensure the UI is clear for next steps.
   * No-op if no modal is present (some themes redirect directly to /cart).
   *
   * @param {'continue'|'cart'} [action='continue'] - 'continue' keeps shopping, 'cart' navigates to the cart page
   * @returns {Cypress.Chainable}
   */
  handleCartModal(action = 'continue') {
    cy.log(`📦 Modal Check: Selecting "${action}"`);

    return this.pageBody.then(($body) => {
      const $modal = $body.find(this.modalId);
      if ($modal.length === 0) {
        cy.log('No modal found (redirect occurred). Skipping modal handling.');
        return;
      }

      const actionSelector = action === 'continue'
        ? ProductPage.SELECTORS.MODAL_CONTINUE_SHOPPING
        : ProductPage.SELECTORS.MODAL_GO_TO_CART;

      cy.wrap($modal).find(actionSelector).click({ force: true });
      this._forceCloseStuckModal();
    });
  }

  /**
   * Workaround for Bootstrap modals that don't close in headless Chrome.
   * Detects "stuck" via computed display (catches the case where Bootstrap
   * removed `.show` but left an inline `style="display: block"` behind, which
   * keeps the modal covering page elements). When stuck, strips the open-state
   * classes, the inline style, and the `.modal-backdrop`.
   *
   * @private
   */
  _forceCloseStuckModal() {
    cy.get('body').then(($body) => {
      const $modal = $body.find(this.modalId);
      if ($modal.length === 0 || $modal.css('display') === 'none') {
        cy.log('✅ Modal closed successfully');
        return;
      }
      cy.log('Headless workaround: forcing stuck modal to close');
      cy.wrap($modal).invoke('removeClass', 'show');
      cy.wrap($modal).invoke('attr', 'style', ''); // clear inline display:block from Bootstrap
      cy.wrap($body.find(ProductPage.SELECTORS.MODAL_BACKDROP)).invoke('remove');
      cy.wrap($body).invoke('removeClass', 'modal-open');
    });
  }

  /** Click the cart-page "checkout" link to advance to the checkout form. */
  checkOutProduct() {
    this.goToCheckoutButton.click();
  }
}

export const productPage = new ProductPage();
