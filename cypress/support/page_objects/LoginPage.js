/**
 * Login modal POM. Used by login_scenarios.cy.js against Futunatura's
 * `#kbexit_container` login overlay. Selectors based on the modal markup —
 * if Futunatura redesigns this modal, only this file should need touching.
 */
class LoginPage {
  static SELECTORS = {
    LOGIN_MODAL: '#kbexit_container',
    EMAIL_INPUT: '#login-form input[name="email"]',
    PASSWORD_INPUT: '#login-form input[name="password"]',
    LOGIN_BUTTON: '#login-btn',
    // `.desktop_profile_menu a[href*="logout"]` is the combined form of the
    // previous `.desktop_profile_menu`.find(`a[href*="logout"]`) chain.
    LOGOUT_BUTTON: '.desktop_profile_menu a[href*="logout"]',
    LOGIN_HEADER: '.header_holder',
    LOGIN_FORM: '#login-form',
    USER_PROFILE_PAGE: '.breadcrumb',
    ACCOUNT_HEADING: 'h1',
    ERROR_MESSAGE: '.alert',
    CUSTOMER_HEADER: 'h1.customer_name'
  };

  get loginModal() { return cy.get(LoginPage.SELECTORS.LOGIN_MODAL); }
  get emailInput() { return cy.get(LoginPage.SELECTORS.EMAIL_INPUT); }
  get passwordInput() { return cy.get(LoginPage.SELECTORS.PASSWORD_INPUT); }
  get loginButton() { return cy.get(LoginPage.SELECTORS.LOGIN_BUTTON); }
  get logoutButton() { return cy.get(LoginPage.SELECTORS.LOGOUT_BUTTON); }
  get loginHeader() { return cy.get(LoginPage.SELECTORS.LOGIN_HEADER); }
  get loginForm() { return cy.get(LoginPage.SELECTORS.LOGIN_FORM); }
  get userProfilePage() { return cy.get(LoginPage.SELECTORS.USER_PROFILE_PAGE); }
  get accountHeading() { return cy.get(LoginPage.SELECTORS.ACCOUNT_HEADING); }
  get errorMessage() { return cy.get(LoginPage.SELECTORS.ERROR_MESSAGE); }
  get customerHeader() { return cy.get(LoginPage.SELECTORS.CUSTOMER_HEADER); }

  /**
   * Type credentials and submit. Each field is optional — empty-fields test
   * cases pass `undefined` for both to assert client-side validation.
   * @param {string} [email] - Email to enter. Skipped if falsy.
   * @param {string} [password] - Password to enter. Skipped if falsy.
   */
  login(email, password) {
    if (email) this.emailInput.clear().type(email);
    if (password) this.passwordInput.clear().type(password);
    this.loginButton.click();
  }

  /** Click the logout link in the desktop profile menu. */
  logout() {
    this.logoutButton.scrollIntoView().should('be.visible').click();
  }
}
export const loginPage = new LoginPage();
