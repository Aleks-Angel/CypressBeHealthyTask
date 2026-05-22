// Localized "thank you for your order" phrases — single source of truth.
// Imported by both domains_orders.js (post-submit success detection) and
// CheckoutPage.js (orderConfirmationMsg visibility check).
//
// MUST be multi-word: lone tokens like "pedido" / "Bestellung" / "commande"
// also appear in normal checkout copy ("Resumen del pedido" on ES,
// "Ihre Bestellung" headers on DE), which used to false-positive these
// checks and let the flow proceed before the real success page rendered.
//
// Variants per brand (add new heading phrases here when locales are added):
//   - futunatura SK/PT/HR: "Ďakujeme za..." / "Obrigado pela..." / "Hvala vam..."
//   - purely DE/AT:         "Danke, wir haben Ihre Bestellung erhalten"
//   - purely FR:            "Nous vous remercions de votre commande"
/** @type {RegExp} */
export const SUCCESS_TEXT_PATTERN = /thank you for|hvala (vam|za|ti)|ďakujeme za|obrigado (pela|por)|gracias por|danke,?\s*wir haben|danke für|vielen dank|bestellung erhalten|grazie per il|merci pour votre|nous vous remercions|Σας ευχαριστούμε|ευχαριστούμε για|Вашата поръчка|mulțumim pentru|děkujeme za|köszönjük|dziękujemy za|RENDELÉSÉT/i;
