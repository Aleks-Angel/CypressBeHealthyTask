import { loginPage } from '../support/page_objects/LoginPage';


describe('Futunatura Login Functionality', () => {
  
  beforeEach(function () {
    //cy.intercept({ resourceType: /xhr|fetch/ }, { log: false })
    cy.fixture('checkoutData').as('data');
    cy.visit('/');
    cy.bypassCookieBanner();
    
    loginPage.loginHeader.contains('Prijava').click();
    loginPage.loginForm.should('be.visible');
  });

  it('Negative: Should show error for incorrect credentials', function () {
    const { invalidEmailUser } = this.data.loginData;
    
    loginPage.login(invalidEmailUser.email, invalidEmailUser.password);
    cy.wait(1000);
    
    loginPage.errorMessage
      .should('be.visible');
  });

  it('Positive: Should successfully log in with valid credentials', function () {
    const { validEmailUser } = this.data.loginData;
    
    loginPage.login(validEmailUser.email, validEmailUser.password);
    //cy.url().should('include', '/account', { timeout: 20000 });
    loginPage.customerHeader.should('be.visible').and('not.be.empty');
    loginPage.userProfilePage.should('contain', 'Moj profil');
    

    loginPage.logout();
  });

  it('Negative: Should fail when fields are empty', function () {
    loginPage.loginButton.click();
    
    loginPage.errorMessage.should('be.visible');
  });
});