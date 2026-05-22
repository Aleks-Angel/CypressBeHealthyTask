import { loginPage } from '../support/page_objects/LoginPage';

const TARGET_URL = 'https://www.futunatura.hr/';

describe('Futunatura Login Functionality', () => {
  
  beforeEach(function () {
    cy.fixture('checkoutData').as('data');
    cy.log(`🎯 Testing: ${TARGET_URL}`);
    cy.visitStorefront(TARGET_URL);
    
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
    loginPage.customerHeader.should('be.visible').and('not.be.empty');
    loginPage.userProfilePage.should('contain', 'Moj profil');
    
    loginPage.logout();
  });

  it('Negative: Should fail when fields are empty', function () {
    loginPage.loginButton.click();
    
    loginPage.errorMessage.should('be.visible');
  });
});