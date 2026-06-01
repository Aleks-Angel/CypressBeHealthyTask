/**
 * Product detail page POM. Owns add-to-cart, quantity controls, the post-add
 * confirmation modal (with the "stuck modal" workaround for headless Chrome),
 * and the "go to checkout" link selector. Used by every checkout-flow spec.
 */
class ProductPage {
  static SELECTORS = {
    // Add-to-cart button — `#button-cart` covers the OpenCart-themed BeHealthy
    // brands (Futunatura/Purely/Healthy/etc.); `.add-to-cart__submit-button`
    // covers futupets, whose markup uses semantic class names instead of an id.
    ADD_TO_CART_BUTTON: '#button-cart, .add-to-cart__submit-button',
    QUANTITY_PLUS_BUTTON: '.col-xl-3 > .holder > .plus',
    MODAL: '#addToCartModal',
    MODAL_BACKDROP: '.modal-backdrop',
    // The cart confirmation button has several theme-specific variants. Some locales
    // (UK Healthyworld) render the button OUTSIDE .modal-content but still inside
    // the modal, so .btn-black / .btn-primary--primary are intentionally unscoped.
    MODAL_GO_TO_CART: '.modal-content .btn-blue, .modal-content .btn-primary--blue, .modal-content .btn-primary--orange, .btn-black, .btn-primary--primary, .modal-content .btn-primary--green',
    MODAL_CONTINUE_SHOPPING: '.modal-content .btn-white-border',
    CHECKOUT_LINK: 'a[href*="route=checkout/checkout"]',
    // Futupets homepage layout — multiple horizontal carousels, each in a
    // `<section class="card-slider-section">`. The "Buy & Save" slider used by
    // tests is the 4th one (0-indexed: 3). Index lives in the getter rather
    // than SELECTORS because it's positional, not a CSS string.
    BUY_AND_SAVE_SLIDER: 'section.card-slider-section',
    PRODUCT_CARD_IN_SLIDER: 'a.product-card'
  };

  get addToCartButton() { return cy.get(ProductPage.SELECTORS.ADD_TO_CART_BUTTON); }
  get productQuantityPlusButton() { return cy.get(ProductPage.SELECTORS.QUANTITY_PLUS_BUTTON); }

  get modalId() { return ProductPage.SELECTORS.MODAL; }
  get addToCartModal() { return cy.get(this.modalId); }
  get goToCartButton() { return this.addToCartModal.find(ProductPage.SELECTORS.MODAL_GO_TO_CART); }

  get goToCheckoutButton() {
    return cy.get(ProductPage.SELECTORS.CHECKOUT_LINK).filter(':visible').first();
  }
  get pageBody() { return cy.get('body'); }

  /**
   * Click target for the "Buy & Save" slider on the futupets homepage — the
   * first product card inside the 4th `<section class="card-slider-section">`.
   * Used as the futupets entry point into the order flow because futupets has
   * no /search route in the layout we test; the homepage is the canonical
   * starting point.
   *
   * @returns {Cypress.Chainable<JQuery<HTMLAnchorElement>>}
   */
  get buyAndSaveProduct() {
    return cy.get(ProductPage.SELECTORS.BUY_AND_SAVE_SLIDER)
      .eq(3)
      .find(ProductPage.SELECTORS.PRODUCT_CARD_IN_SLIDER)
      .first();
  }

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
      if ($body.find(this.modalId).length === 0) {
        cy.log('No modal found (redirect occurred). Skipping modal handling.');
        return;
      }

      const actionSelector = action === 'continue'
        ? ProductPage.SELECTORS.MODAL_CONTINUE_SHOPPING
        : ProductPage.SELECTORS.MODAL_GO_TO_CART;

      // Wait for Bootstrap's open transition to commit (`.show` class) before
      // searching inside the modal — find()-ing buttons before the modal has
      // transitioned can race past empty inner DOM. This is the standard
      // Bootstrap modal lifecycle and applies to every brand.
      cy.get(this.modalId).should('have.class', 'show')
        .find(actionSelector).click({ force: true });
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
