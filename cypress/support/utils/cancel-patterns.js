// Localized order-cancellation regex patterns — single source of truth.
// Imported by CheckoutPage.js for cancelOrder, orderCanceledSuccessfully, and
// the status-page heading assertion in _visitOrderStatusPage.
//
// Companion to utils/success-patterns.js — both extracted out of the page
// object so adding a new locale's wording is a one-file edit, not a hunt
// through a 900-line class.

/**
 * Multi-word "your order was successfully cancelled" phrases, matched against
 * the cancel-confirmation modal/banner on the order page.
 * @type {RegExp}
 */
export const CANCEL_SUCCESS_PATTERN = /uspešno preklican|successfully cancel|storniert|annullat|anulată|úspěšně zrušena|zrušená|pomyślnie anulowane|annulée|отменена|cancelado|παραγγελίας|cancelada|poništena/i;

/**
 * Single-word "cancelled" status tokens — matched against the order status
 * timeline on the order page (less strict than CANCEL_SUCCESS_PATTERN because
 * the timeline just renders the state name, not a full sentence).
 * @type {RegExp}
 */
export const CANCEL_STATUS_PATTERN = /preklican|cancelled|canceled|storniert/i;

/**
 * Localized "Status" / "Order" heading on the public order-status page, used
 * to confirm the page rendered in the expected language after we visit it.
 * @type {RegExp}
 */
export const STATUS_HEADING_PATTERN = /Status|Статус|Starea|Stav|állapota|commande|Estado|παραγγελίας|ordine/i;
