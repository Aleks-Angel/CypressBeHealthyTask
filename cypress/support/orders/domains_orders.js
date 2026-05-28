import { productPage } from '../page_objects/ProductPage';
import { checkoutPage } from '../page_objects/CheckoutPage';
import { SUCCESS_TEXT_PATTERN } from '../utils/success-patterns';
import { ORDER_NUMBER_SELECTOR } from '../utils/order-selectors';

const SUCCESS_URL_PATTERN = /\/(success|thank-you|zakljucek|hvala|completed|finished|order[-_]received)/i;
const CHECKOUT_URL_PATTERNS = ['/blagajna', '/checkout', '/kasse', '/platba', '/fizetés', '/paiement', '/pagamento', '/pago', '/ολοκλήρωση'];

/**
 * Detect whether we're on the order-success page using URL + DOM signals.
 * URL match wins (works across brand wording differences); falls back to the
 * order-number selector and then the localized "thank you" text pattern.
 *
 * @param {JQuery<HTMLElement>} $body - The current `<body>` jQuery element
 * @param {string} [url] - Current page URL; primary signal when provided
 * @returns {boolean} True if any success signal is present
 */
function hasSuccessMarkers($body, url) {
  // URL on a success path is the strongest signal — works regardless of how
  // each brand worded its success-page heading. The text fallback handles
  // edge cases where SUCCESS_URL_PATTERN doesn't catch a TLD's success URL.
  if (url && SUCCESS_URL_PATTERN.test(url)) return true;
  const hasOrderNo = $body.find(ORDER_NUMBER_SELECTOR).length > 0;
  const hasThankYou = SUCCESS_TEXT_PATTERN.test($body.text());
  return hasOrderNo || hasThankYou;
}

/**
 * Decide whether the submit click was *actually* ignored vs. simply slow.
 * Combines URL pattern + DOM markers because checking only the URL would
 * misfire on SI's `/blagajna/zakljucek` success path (which contains the
 * `/blagajna` checkout token).
 *
 * @param {string} url - Current page URL
 * @returns {Cypress.Chainable<boolean>} True if we appear stuck on checkout
 */
function isStillOnCheckoutPage(url) {
  const onCheckout = CHECKOUT_URL_PATTERNS.some(p => url.includes(p));
  if (!onCheckout) return cy.wrap(false);
  if (SUCCESS_URL_PATTERN.test(url)) return cy.wrap(false);
  return cy.get('body').then(($body) => !hasSuccessMarkers($body, url));
}

/**
 * Phase 1 of the order flow: dismiss the cookie banner, pick a product, add it
 * to the cart, close the cart-modal, confirm `/cart`, and click the checkout
 * link. Leaves the test on the checkout form.
 *
 * Brand-aware product entry: futupets uses its homepage "Buy & Save" slider
 * (no product-listing page in the layout we test); other brands use the first
 * card from a search-result / category listing.
 *
 * Modal handling — including the "re-click add-to-cart if modal didn't open"
 * resilience — lives in ProductPage.handleCartModal so all brands share it.
 */
function navigateToCheckout() {
  cy.bypassCookieBanner();
  cy.url().then((url) => {
    if (url.includes('futupets')) {
      productPage.buyAndSaveProduct.click({ force: true });
    } else {
      cy.selectProductByIndex(0);
    }
  });
  productPage.addToCartButton.click({ force: true });
  productPage.handleCartModal('cart');
  productPage.pageBody.should('not.have.class', 'modal-open');
  cy.url().should('include', '/cart', { timeout: 15000 });
  productPage.checkOutProduct();
}

/**
 * End-to-end order orchestration used by domain_visit.cy.js. Walks through:
 * product selection → fill customer info → notes → select payment method →
 * accept terms → re-verify city/county/payment after Vue re-renders → submit →
 * confirm success URL + DOM → capture order ID → cancel the order.
 *
 * Each step accounts for known Vue/Bootstrap race conditions (see the inline
 * comments and ARCHITECTURE.md "Load-bearing code" section). Do not strip the
 * cy.wait() literals without understanding the failure mode each one fixes.
 *
 * @param {Object} data - checkoutData fixture object
 * @param {Object} data.validUser - User data with localized address fields
 * @param {Object} data.paymentMethods - { defaultMethod, bankTransferLangs }
 * @returns {Cypress.Chainable}
 */
export function runDomainsOrders(data) {
  navigateToCheckout();

  return checkoutPage.fillCustomerInfo(data.validUser).then(() => {
    checkoutPage.NotesArrea();
    checkoutPage.submitOrderButton.should('be.enabled');

    checkoutPage.getNotesTextarea(0).type('Test');
    checkoutPage.getNotesTextarea(1).type('Test');

    return checkoutPage.selectPaymentMethodByLanguage(data.paymentMethods)
      .then(() => checkoutPage.acceptTermsAndConfirm())
      .then(() => cy.wait(2000))
      .then(() => checkoutPage.verifyCityAfterAccept(data.validUser, data.paymentMethods))
      .then(() => checkoutPage.refillCountyIfCleared(data.validUser))
      .then(() => cy.wait(3000))
      .then(() => checkoutPage.waitForSubmitButtonStable())
      .then(() => checkoutPage.verifyCityAfterAccept(data.validUser, null))
      .then(() => checkoutPage.selectPaymentMethodByLanguage(data.paymentMethods))
      .then(() => checkoutPage.verifyPaymentMethodStable(data.paymentMethods))
      .then(() => {
        checkoutPage.submitOrderButton.click({ force: true });
        // 3s wasn't long enough on slower brands (purely HR redirected at ~6s
        // post-click). The old timing falsely triggered the retry path while
        // the original submit was still in flight, then the retry's payment-
        // method recheck ran against the success page and timed out on the
        // bank_transfer radio.
        cy.wait(8000);
        return cy.url().then((url) => {
          return isStillOnCheckoutPage(url).then((stuck) => {
            if (!stuck) return null;
            cy.log('⚠️ Order button click was ignored, retrying...');
            return checkoutPage.verifyPaymentMethodStable(data.paymentMethods).then(() => {
              checkoutPage.submitOrderButton.click({ force: true });
            });
          });
        });
      })
      .then(() => {
        cy.url({ timeout: 30000 }).should('not.include', 'paywiser');
        // Pass the URL into hasSuccessMarkers so the SUCCESS_URL_PATTERN
        // branch can short-circuit the DOM-text check on brands whose
        // heading phrasing isn't in our regex (e.g. purely DE/AT/FR).
        return cy.url().then((url) => {
          return cy.get('body', { timeout: 30000 }).should(($body) => {
            expect(hasSuccessMarkers($body, url), `Order success page should be visible (url=${url})`).to.be.true;
          });
        });
      })
      .then(() => {
        // We have the success URL + DOM markers — everything we need to capture
        // the order ID is already in the page. Halt any still-pending requests
        // (slow third-party trackers) so subsequent commands don't sit blocked
        // waiting for window.load to fire.
        return cy.window().then((win) => {
          try { win.stop(); } catch { /* */ }
        });
      })
      .then(() => checkoutPage.orderConfirmationMsg.should('be.visible', { timeout: 30000 }))
      .then(() => checkoutPage.captureOrderIdAndVerifyStatus())
      .then(() => checkoutPage.cancelOrder())
      .then(() => checkoutPage.orderCanceledSuccessfully());
  });
}
