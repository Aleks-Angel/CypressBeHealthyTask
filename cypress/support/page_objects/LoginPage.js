class LoginPage {
  // Selectors based on the modal structure in your screenshot
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

  login(email, password) {
    if (email) this.emailInput.clear().type(email);
    if (password) this.passwordInput.clear().type(password);
    this.loginButton.click();

    //this.loginForm.should('not.exist');
  }

  logout() {
    this.logoutButton.scrollIntoView().should('be.visible').click();
  }
}
export const loginPage = new LoginPage();