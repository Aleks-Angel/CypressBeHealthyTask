// Out-of-stock detection — single source of truth, mirrors success-/cancel-patterns.
//
// When a product is sold out the storefront eventually shows a "notify when
// available" form instead of a working add-to-cart, so the order flow can't proceed.
// We detect that up front on the product page and SKIP the run (inconclusive) rather
// than failing — an out-of-stock product isn't a checkout bug, same philosophy as
// the WAF/unreachable skip.
//
// Signal: the schema.org availability meta, which is SERVER-RENDERED and present the
// instant the product page loads:
//   <meta itemprop="availability" content="http://schema.org/OutOfStock" />
// This is the reliable choice: it's in the initial HTML (no render race), it's
// language-agnostic (a schema.org URL, not translated text), and it's a web standard
// present across the OpenCart storefronts, not tied to one theme.
//
// NOT the visible markers: the #NotifyWhenAvailable* form AND the .out-of-stock class
// are both JS-INJECTED after load, so they're absent when the flow checks (verified
// on sweetbites.hr — an earlier selector keyed on them and fell through to add-to-cart
// before the swap happened). Verified against exactly one availability meta on the
// page (the main product), inside <body>. If a brand ever lacks the schema meta, add
// its out-of-stock marker to this union (one-file edit).
export const OUT_OF_STOCK_SELECTOR = 'meta[itemprop="availability"][content*="OutOfStock"]';

/**
 * Is the current product page marked out of stock (schema.org availability =
 * OutOfStock, so there's no add-to-cart to click)? The meta lives in <body> inside
 * the product's itemscope, so `$body.find` reaches it.
 *
 * @param {JQuery<HTMLElement>} $body - the current `<body>` jQuery element
 * @returns {boolean} true if the product is out of stock
 */
export function isOutOfStock($body) {
  return $body.find(OUT_OF_STOCK_SELECTOR).length > 0;
}
