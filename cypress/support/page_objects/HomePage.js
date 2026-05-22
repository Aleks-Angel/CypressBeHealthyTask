/**
 * Storefront homepage POM. Owns the burger/desktop nav selectors, the search
 * input on the homepage hero, the cookie banner (alternate cybot variant), and
 * the basket icon/dropdown used in checkout_flow.cy.js.
 *
 * Most getters are self-explanatory selectors; only the action methods are
 * documented below.
 */
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

  /**
   * Type a search term into the homepage search input and submit it.
   * @param {string} product - Search term to enter
   */
  searchFor(product) {
    this.searchInput.type(`${product}{enter}`);
  }

  /** Click "accept all" on the Cybot cookie banner (used by Futunatura). */
  acceptCookies() {
    this.acceptCookiesBtn.click();
  }
}
export const homePage = new HomePage();
