/**
 * Login modal POM. Used by login_scenarios.cy.js against Futunatura's
 * `#kbexit_container` login overlay. Selectors based on the modal markup —
 * if Futunatura redesigns this modal, only this file should need touching.
 */
class LoginPage {
  get loginModal() { return cy.get('#kbexit_container'); }
  get emailInput() { return cy.get('#login-form input[name="email"]'); }
  get passwordInput() { return cy.get('#login-form input[name="password"]'); }
  get loginButton() { return cy.get('#login-btn'); }
  get logoutButton() { return cy.get('.desktop_profile_menu').find('a[href*="logout"]'); }
  get loginHeader() { return cy.get('.header_holder'); }
  get loginForm() { return cy.get('#login-form'); }
  get userProfilePage() { return cy.get('.breadcrumb'); }
  get accountHeading() { return cy.get('h1'); }
  get errorMessage() { return cy.get('.alert'); }
  get customerHeader() { return cy.get('h1.customer_name'); }

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