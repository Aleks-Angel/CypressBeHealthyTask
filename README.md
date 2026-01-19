```markdown
# Futunatura E2E Cypress Automation

A robust end-to-end testing suite for the Futunatura web store, built with Cypress using the Page Object Model (POM) pattern. This project is optimized for stable execution in both headed and headless environments.

## 🧪 Test Suites

The framework covers 4 core areas of the application:

1. **Purchase Journey (`checkout_flow.cy.js`)**
   - Flow from product search and multi-product selection to the checkout summary.
   - Navigation via the Burger Menu on Desktop to specific categories (Vitamins/Multivitamins).
   - Side-cart management, including item deletion and modal handling.

2. **Checkout Validation (`checkout_validation.cy.js`)**
   - Verifies mandatory field error messaging when the checkout form is submitted empty.
   - Validates email format constraints to ensure invalid data is rejected.

3. **Login Scenarios (`login_scenarios.cy.js`)**
   - **Positive:** Successful login with valid credentials and account logout.
   - **Negative:** Error handling for incorrect credentials and empty field submissions.

4. **UI Responsiveness (`responsiveness.cy.js`)**
   - Multi-viewport testing (iPhone XR, iPad 2, Desktop).
   - Dynamic UI verification, ensuring the Hamburger Menu replaces the Desktop Menu on smaller screens.


# 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
bash or terminal
- npm install


### Running Tests
Interactive Mode:
- npx cypress open 

Headless Mode:
- npx cypress run



# 🏗 **Project Architecture**

Page Object Model: Located in cypress/support/page_objects/ to centralize element selectors and business logic.

Fixtures: Located in cypress/fixtures/checkoutData.json for data-driven testing (user info, search terms, error messages).

Custom Commands: cy.bypassCookieBanner(), cy.searchProduct(), and cy.selectFirstProduct() for reusable workflow steps.