class CheckoutPage {
  get emailInput() { return cy.get('#input-payment-email'); }
  get firstNameInput() { return cy.get('#input-payment-firstname'); }
  get lastNameInput() { return cy.get('#input-payment-lastname'); }
  get orderNumberInput() { return cy.get('#input-payment-telephone'); } 
  get addressInput() { return cy.get('#input-payment-address_1'); } 
  get addressInput2() { return cy.get('#input-payment-address_2'); }
  get cityInput() { return cy.get('#input-payment-city'); }
  get postalCodeInput() { return cy.get('#input-payment-postcode'); }
  get submitOrderButton() { return cy.get('#button-payment-method'); }
  get emailWrapper() { return cy.get('#input-payment-email').parent();  }
  get emailError() { return this.emailWrapper.find('.text-danger');}
  get agreementCheckbox() { return cy.get('.quickcheckout-content-new').find('#agree'); }
  

  fillCustomerInfo(user) {
    
    this.firstNameInput.type(user.firstName);
    this.lastNameInput.type(user.lastName);
    this.emailInput.type(user.email);
    this.orderNumberInput.type(user.phone);
    this.addressInput.type(user.address1);
    this.addressInput2.type(user.address2);
    this.cityInput.type(user.city);
    this.postalCodeInput.type(user.postalCode);
  }

  acceptTermsAndConfirm() {
    this.agreementCheckbox.check({ force: true });
  }

}
export const checkoutPage = new CheckoutPage();
