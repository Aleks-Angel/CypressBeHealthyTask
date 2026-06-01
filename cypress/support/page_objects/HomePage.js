/**
 * Storefront homepage POM. Owns the burger/desktop nav selectors, the search
 * input on the homepage hero, the cookie banner (alternate cybot variant), and
 * the basket icon/dropdown used in checkout_flow.cy.js.
 *
 * Most getters are self-explanatory selectors; only the action methods are
 * documented below.
 */
class HomePage {
  static SELECTORS = {
    SEARCH_INPUT: 'input[name="q"]',
    ACCEPT_COOKIES_BTN: '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    HAMBURGER_MENU: '.hamburger_menu_trigger',
    DESKTOP_MENU: '.menu_wrapper > .container-xxl',
    HEADER_HOLDER: '.header_holder',
    HAMBURGER_DESKTOP_MENU: '.all_nav_link',
    SUBMENU_VITAMINS: 'span[data-submenu="submenu_1"]',
    SUBMENU_MULTIVITAMINS: 'span[data-lvl3="lvl3_189"]',
    CART_BASKET_ICON: '#cart span.basket_icon svg',
    CART_CLOSE_BUTTON: '#cart div.cart_close',
    CART_DELETE_ITEM_BUTTON: '#cart a[title="Ukloni"] img',
    MULTI_VITAMINS_LINK: '.active > .lvl3_list > :nth-child(1) > .lvl3_item_link'
  };

  get searchInput() { return cy.get(HomePage.SELECTORS.SEARCH_INPUT); }
  get acceptCookiesBtn() { return cy.get(HomePage.SELECTORS.ACCEPT_COOKIES_BTN); }
  get hamburgerMenu() { return cy.get(HomePage.SELECTORS.HAMBURGER_MENU); }
  get desktopMenu() { return cy.get(HomePage.SELECTORS.DESKTOP_MENU); }
  get headerHolder() { return cy.get(HomePage.SELECTORS.HEADER_HOLDER); }
  get hamburgerDesktopMenu() { return cy.get(HomePage.SELECTORS.HAMBURGER_DESKTOP_MENU); }
  get subMenuVitamins() { return cy.get(HomePage.SELECTORS.SUBMENU_VITAMINS); }
  get subMenuMultivitamins() { return cy.get(HomePage.SELECTORS.SUBMENU_MULTIVITAMINS); }
  get cartBasketIcon() { return cy.get(HomePage.SELECTORS.CART_BASKET_ICON); }
  get cartCloseButton() { return cy.get(HomePage.SELECTORS.CART_CLOSE_BUTTON); }
  get cartDeleteItemButton() { return cy.get(HomePage.SELECTORS.CART_DELETE_ITEM_BUTTON); }
  get multiVitaminsLink() { return cy.get(HomePage.SELECTORS.MULTI_VITAMINS_LINK); }

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
