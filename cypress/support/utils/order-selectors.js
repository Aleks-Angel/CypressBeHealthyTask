// Order-number element selectors — single source of truth.
// Used by both:
//   - domains_orders.js → hasSuccessMarkers() to detect a success page
//   - CheckoutPage.js   → captureOrderIdAndVerifyStatus() to extract the digits
//
// Previously duplicated as `SUCCESS_ORDER_NO_SELECTOR` in domains_orders and
// `ORDER_NO_SELECTOR` in CheckoutPage; the two drifted (CheckoutPage was
// broadened to add `.success-section__order-number` but domains_orders wasn't),
// which meant the success-detection branch missed brands that used the
// broadened selector. Extracted to prevent that class of drift recurring.

/**
 * Selector union matching the element that holds the order number on the
 * success page, across all storefront themes we test (Futunatura, Healthy,
 * Purely, Sweet, Erefit, Mycoway, On Energy). Order matters for `cy.get`
 * preference but any match counts as a hit.
 * @type {string}
 */
export const ORDER_NUMBER_SELECTOR = '.thank-you-orderno, .success-section__order-number, .order-id, .order-number, [class*="order-no"], [class*="orderno"]';
