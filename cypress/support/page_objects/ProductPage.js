class ProductPage {
  // --- Product Elements ---
  get productCards() { return cy.get('.item_box'); }
  get addToCartButton() { return cy.get('#button-cart'); }
  get productQuantityPlusButton() { return cy.get('.col-xl-3 > .holder > .plus'); }

  // --- Modal Elements ---
  get modalId() { return '#addToCartModal'; }
  get addToCartModal() { return cy.get(this.modalId); }
  get modalBackdrop() { return cy.get('.modal-backdrop'); }
  
  // Scoped getters for buttons inside the modal
  get goToCartButton() { 
    return this.addToCartModal.contains('Idi na košaricu'); 
  }
  get continueShoppingButton() { 
    return this.addToCartModal.contains('Nastavi s kupovinom'); 
  }

  // --- Checkout/Navigation Elements ---
  get goToCheckoutButton() { return cy.contains('Na blagajnu'); }
  get pageBody() { return cy.get('body'); }

  /**
   * Handles the post-add-to-cart modal and ensures the UI is clear for next steps.
   * Includes a headless workaround for stuck Bootstrap transitions.
   */
  handleCartModal(action = 'continue') {
    // 1. Check the body for the modal existence without failing the test
    return this.pageBody.then(($body) => {
      if ($body.find(this.modalId).length > 0) {
        cy.log('Modal detected, initiating cleanup...');

        // 2. Click based on action
        const actionButton = action === 'continue' ? this.continueShoppingButton : this.goToCartButton;
        actionButton.click({ force: true });

        // 3. Headless Stability Workaround
        cy.wait(1000); 
        
        return cy.get('body').then(($refreshedBody) => {
          if ($refreshedBody.find(`${this.modalId}.show`).length > 0) {
            cy.log('Headless workaround: Forcing stuck modal to close');
            
            // Manual DOM manipulation for stuck Bootstrap transitions
            this.addToCartModal.invoke('hide').invoke('removeClass', 'show');
            this.modalBackdrop.invoke('remove');
            this.pageBody.invoke('removeClass', 'modal-open');
          }
          
          // 4. Final safety visibility check
          if ($refreshedBody.find(this.modalId).length > 0) {
            this.addToCartModal.should('not.be.visible');
          }
        });
      } else {
        cy.log('No modal found (Redirect occurred). Skipping modal handling.');
      }
    });
  }

  
  clickFirstProduct() {
    this.productCards.first().click();
  }

  addItemToCart() {
    this.addToCartButton.click(); 
    this.handleCartModal('cart');
  }

  checkOutProduct() {
    this.goToCheckoutButton.click();
  }
}

export const productPage = new ProductPage();