class HomePage {
  get searchInput() { return cy.get('input[name="q"]'); }
  get acceptCookiesBtn() { return cy.get('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll'); }
  get hamburgerMenu() { return cy.get('.hamburger_menu_trigger'); }
  get desktopMenu() { return cy.get('.menu_wrapper > .container-xxl'); }
  get headerHolder() { return cy.get('.header_holder'); }
  get hamburgerDesktopMenu() { return cy.get('.all_nav_link'); }
  get subMenuVitamins() { return cy.get('span[data-submenu="submenu_1"]'); }
  get subMenuMultivitamins() { return cy.get('span[data-lvl3="lvl3_189"]'); }
  get cartBasketIcon() { return cy.get('#cart span.basket_icon svg'); }
  get cartCloseButton() { return cy.get('#cart div.cart_close'); }
  get cartDeleteItemButton() { return cy.get('#cart a[title="Ukloni"] img'); }
  get burgerMenuCloseButton() { return cy.get('.offcanvas-header > .btn-close'); }
  get miltiVitaminsLink() { return cy.get('.active > .lvl3_list > :nth-child(1) > .lvl3_item_link'); }

  searchFor(product) {
    this.searchInput.type(`${product}{enter}`);
  }
  
  acceptCookies() {
    this.acceptCookiesBtn.click();
  }
}
export const homePage = new HomePage();
