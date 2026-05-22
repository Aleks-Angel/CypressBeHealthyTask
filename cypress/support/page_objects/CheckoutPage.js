import { normalizeLanguageCode, resolveLangCode, pickLocalized, getSiteLanguage } from '../utils/lang';
import { SUCCESS_TEXT_PATTERN } from '../utils/success-patterns';

// Localized "order cancelled / successfully cancelled" phrases.
const CANCEL_SUCCESS_PATTERN = /uspešno preklican|successfully cancel|storniert|annullat|anulată|úspěšně zrušena|zrušená|pomyślnie anulowane|annulée|отменена|cancelado|παραγγελίας|cancelada|poništena/i;

// Localized "cancelled" status tokens — matched against status text on the order page.
const CANCEL_STATUS_PATTERN = /preklican|cancelled|canceled|storniert/i;

// Localized "Status" heading on the order-status page.
const STATUS_HEADING_PATTERN = /Status|Статус|Starea|Stav|állapota|commande|Estado|παραγγελίας|ordine/i;

// Languages whose checkout uses an additional region/county vue-select dropdown.
const COUNTY_DROPDOWN_LANGS = ['ro', 'bg', 'sk', 'it'];

/**
 * Checkout page POM. Owns the full checkout form: customer-info inputs,
 * localized address fields (with brand-specific layouts for IT/SK/RO/BG), the
 * vue-select dropdowns for county/city, the payment-method radios, the
 * agreement checkbox, the submit button, the order-success rendering, and the
 * post-success order cancellation flow.
 *
 * Most methods are page-state operations — fill X, click Y, verify Z. The
 * load-bearing pieces here (and the reasons they look the way they do) are
 * documented in [ARCHITECTURE.md](../../../ARCHITECTURE.md#load-bearing-code).
 */
class CheckoutPage {
  // Selectors constants
  static SELECTORS = {
    EMAIL_INPUT: '#input-payment-email',
    FIRST_NAME_INPUT: '#input-payment-firstname',
    LAST_NAME_INPUT: '#input-payment-lastname',
    PHONE_INPUT: '#input-payment-telephone',
    ADDRESS_INPUT: '#input-payment-address_1',
    ADDRESS_INPUT_2: '#input-payment-address_2',
    CITY_INPUT: '#input-payment-city',
    POSTAL_CODE_INPUT: '#input-payment-postcode',
    SUBMIT_BUTTON: '#button-payment-method',
    AGREEMENT_CHECKBOX: '.quickcheckout-content-new #agree, .cart_terms_wrapper #agree, .terms-box__checkbox #agree, #agree, input[name="agree"]',
    NOTES_DROPDOWN: '.toogle-parent, .comment_address_title, .checkout-box__title-2--expandable',
    PAYMENT_METHOD_PARENT: '.payment-method-row.col-12, .payment-method-row.select-row, .checkout-box__select-method', 
    ORDER_NUMBER: '.thank-you-orderno',
    CANCEL_BUTTON: '#show-order-cancel, .action_menu_button, #order-cancel-btn, button.btn-cancel',
    CANCEL_CONFIRM: '.cancel_wrapper #submit-cancel-order',
    CANCELED_ORDER: '.cancel_wrapper #user-cancel-order',
    COUNTY_FIELD: '#vs2__combobox',
    COUNTY_INPUT: '#vs2__combobox input.vs__search',
    COUNTY_LIST: '#vs2__listbox',
    CITY_FIELD_1: '#vs3__combobox input.vs__search',
    CITY_LIST: '#vs3__listbox',
    NOTES_TEXTAREA: '#comment-collapse textarea.comment_text_area',
    COUNTY_SELECTED: '#vs2__combobox .vs__selected',
    BLOCK_ADDRESS_BG: '#input-payment-custom-field5',
    BLOCK_ADDRESS_DEFAULT: '#input-payment-custom-field3',
    SCALE_ADDRESS: '#input-payment-custom-field4',
    FLOOR_ADDRESS_BG: '#input-payment-custom-field6',
    FLOOR_ADDRESS_DEFAULT: '#input-payment-custom-field5',
    APARTMENT_ADDRESS_BG: '#input-payment-custom-field7',
    APARTMENT_ADDRESS_DEFAULT: '#input-payment-custom-field6'
  };

  get emailInput() { return cy.get(CheckoutPage.SELECTORS.EMAIL_INPUT); }
  get firstNameInput() { return cy.get(CheckoutPage.SELECTORS.FIRST_NAME_INPUT); }
  get lastNameInput() { return cy.get(CheckoutPage.SELECTORS.LAST_NAME_INPUT); }
  get phoneNumberInput() { return cy.get(CheckoutPage.SELECTORS.PHONE_INPUT); } 
  get addressInput() { return cy.get(CheckoutPage.SELECTORS.ADDRESS_INPUT); } 
  get addressInput2() { return cy.get(CheckoutPage.SELECTORS.ADDRESS_INPUT_2); }
  get cityInput() { return cy.get(CheckoutPage.SELECTORS.CITY_INPUT); }
  get postalCodeInput() { return cy.get(CheckoutPage.SELECTORS.POSTAL_CODE_INPUT); }
  get submitOrderButton() { return cy.get(CheckoutPage.SELECTORS.SUBMIT_BUTTON); }
  get emailWrapper() { return cy.get('#input-payment-email').parent();  }
  get emailError() { return this.emailWrapper.find('.text-danger');}
  get orderConfirmationMsg() { return cy.contains(SUCCESS_TEXT_PATTERN); }
  get agreementCheckbox() { return cy.get(CheckoutPage.SELECTORS.AGREEMENT_CHECKBOX); }
  get NotesTextAreaDropdown() { return cy.get(CheckoutPage.SELECTORS.NOTES_DROPDOWN); }
  get parentPaymentMethod() { return cy.get(CheckoutPage.SELECTORS.PAYMENT_METHOD_PARENT); }
  get orderNumber() {return cy.get(CheckoutPage.SELECTORS.ORDER_NUMBER)}
  get cancelOrderButton() { return cy.get(CheckoutPage.SELECTORS.CANCEL_BUTTON); }
  get cancelYesButton() { return cy.get(CheckoutPage.SELECTORS.CANCEL_CONFIRM); }
  get canceledOrder() { return cy.get(CheckoutPage.SELECTORS.CANCELED_ORDER); }
  get countyAddressField() { return cy.get('#vs2__combobox'); }
  get scaleAddressField() { return cy.get('#input-payment-custom-field4'); }
  get blockAddressField() { return this._byBgOrDefault('BLOCK_ADDRESS_BG', 'BLOCK_ADDRESS_DEFAULT'); }
  get floorAddressField() { return this._byBgOrDefault('FLOOR_ADDRESS_BG', 'FLOOR_ADDRESS_DEFAULT'); }
  get apartmentAddressField() { return this._byBgOrDefault('APARTMENT_ADDRESS_BG', 'APARTMENT_ADDRESS_DEFAULT'); }

  /**
   * Pick a selector by current site locale: BG-specific or default.
   * BG's checkout offsets the address custom-field indices by one compared to
   * other locales (BG has an extra "block" field), so block/floor/apartment
   * each need a BG-specific selector.
   *
   * @param {string} bgKey - Key into CheckoutPage.SELECTORS used on BG
   * @param {string} defaultKey - Key used everywhere else
   * @returns {Cypress.Chainable<JQuery<HTMLElement>>} The resolved element
   * @private
   */
  _byBgOrDefault(bgKey, defaultKey) {
    return cy.get('html').invoke('attr', 'lang').then((lang) => {
      const langCode = lang ? lang.substring(0, 2).toLowerCase() : 'en';
      const selectorKey = langCode === 'bg' ? bgKey : defaultKey;
      return cy.get(CheckoutPage.SELECTORS[selectorKey]);
    });
  }

  // Target the input inside the combobox for typing.
  get countyAddressField1() { return cy.get(CheckoutPage.SELECTORS.COUNTY_INPUT); }
  // Target the listbox that appears after typing.
  get countyDropdownList() { return cy.get(CheckoutPage.SELECTORS.COUNTY_LIST); }
  get cityAddressField1() { return cy.get(CheckoutPage.SELECTORS.CITY_FIELD_1); }
  get cityDropdownList() { return cy.get(CheckoutPage.SELECTORS.CITY_LIST); }

  /**
   * Get the Nth notes textarea (the form renders one per delivery option).
   * @param {number} [index=0] - 0-based textarea index
   * @returns {Cypress.Chainable<JQuery<HTMLTextAreaElement>>}
   */
  getNotesTextarea(index = 0) {
    return cy.get(CheckoutPage.SELECTORS.NOTES_TEXTAREA).eq(index);
  }

  /**
   * Wait for loading overlays to clear and for the submit button to settle into
   * a stable, enabled state. Guards against Vue mid-render swapping out the
   * button between when we query it and when we click it.
   *
   * @returns {Cypress.Chainable}
   */
  waitForSubmitButtonStable() {
    cy.get('body').should('not.have.class', 'loading');
    cy.get('.loading-overlay, #preloader').should('not.exist');

    return this.submitOrderButton
      .scrollIntoView({ block: 'center' })
      .should('be.visible')
      .and('not.be.disabled')
      .then(($btn) => cy.wait(500).then(() => cy.wrap($btn).should('exist').and('not.be.disabled')));
  }

  /**
   * Gets localized data for the current site language.
   * @param {Object} user - User data object
   * @returns {Cypress.Chainable<{langCode:string, postalCode:string, county:string, city:string}>}
   */
  getLocalizedData(user) {
    return getSiteLanguage().then((lang) => {
      return cy.url().then((url) => {
        const langCode = resolveLangCode(lang, url);
        const county = pickLocalized(user.countyAddress, langCode);
        // For RO/BG, the city field on screen actually expects the county/region name —
        // they share data because city dropdowns are bound to a region selection.
        const cityFromCounty = ['ro', 'bg'].includes(langCode);
        return {
          langCode,
          postalCode: user.postalCode[langCode] || user.postalCode['en'] || '1000',
          county,
          city: cityFromCounty ? county : pickLocalized(user.city, langCode)
        };
      });
    });
  }

  /**
   * Fills basic customer information fields
   * @param {Object} user - User data object
   */
  fillBasicInfo(user) {
    cy.log('👤 Entering Customer Details...');
    const forceType = ($field, value) => $field.clear({ force: true }).type(value, { force: true });

    forceType(this.firstNameInput, user.firstName);
    forceType(this.lastNameInput, user.lastName);
    forceType(this.emailInput, user.email);
    forceType(this.phoneNumberInput, user.phone);
    forceType(this.addressInput, user.address1);
    forceType(this.addressInput2, user.address2);

    // Let Vue settle after address fields before downstream rendering.
    cy.wait(500);
  }

  /**
 * Helper 1: For standard text inputs.
 * Re-types if the site wipes the field mid-operation.
 */
safeType(getElement, value, attempt = 1) {
  const maxAttempts = 3;
  const element = typeof getElement === 'function' ? getElement() : getElement;

  return element
    .should('exist')
    .should('be.visible')
    .clear({ force: true })
    .type(value, { force: true, delay: 50, timeout: 5000 })
    .then(($el) => {
      if (!$el || !$el.length) {
        cy.log(`⚠️ safeType target missing after type (attempt ${attempt}/${maxAttempts}).`);
        if (attempt < maxAttempts) {
          return cy.wait(200).then(() => this.safeType(getElement, value, attempt + 1));
        }
        throw new Error('safeType target missing after type');
      }

      const normalizeValue = (input) => typeof input === 'string' ? input.trim().toLowerCase() : input;
      const typedValue = $el.val();
      const expectedNormalized = normalizeValue(value);
      const actualNormalized = normalizeValue(typedValue);

      if (actualNormalized !== expectedNormalized) {
        cy.log(`⚠️ safeType attempt ${attempt}/${maxAttempts}: expected='${value}' actual='${typedValue}'`);
        if (attempt < maxAttempts) {
          return cy.wait(200).then(() => this.safeType(getElement, value, attempt + 1));
        }

        cy.log('⚠️ safeType final fallback writing value directly.');
        return cy.wrap($el).then(($input) => {
          $input.val(value);
          return cy.wrap($input)
            .trigger('input')
            .trigger('change')
            .should(($finalInput) => {
              const finalValue = normalizeValue($finalInput.val());
              expect(finalValue).to.equal(expectedNormalized);
            });
        });
      }

      return cy.wrap($el).blur().should(($input) => {
        const finalValue = normalizeValue($input.val());
        expect(finalValue).to.equal(expectedNormalized);
      });
    });
}

  /**
   * Fills address fields based on language. Dispatches to a country-specific filler
   * for layouts that need extra dropdowns (SK/IT/RO/BG), otherwise just sets the city.
   * @param {Object} user - User data object
   * @param {Object} localizedData - Localized data from getLocalizedData()
   */
  fillAddressFields(user, localizedData) {
    const { langCode, postalCode, county, city } = localizedData;
    cy.log(`📍 Step: Filling Address for [${langCode.toUpperCase()}]`);
    cy.log(`🏙️ Target City: ${city} | Zip: ${postalCode}`);

    this.postalCodeInput.clear({ force: true }).type(postalCode, { force: true });
    cy.log(`STEP: Entered Postal Code: ${postalCode}`);
    cy.wait(500); // let Vue settle after postal code entry

    this.cityInput.should('be.visible').and('not.be.disabled');

    if (langCode === 'sk') return this.fillSlovakianAddress(county, city);
    if (langCode === 'it') return this.fillItalianAddress(county, city);

    const isRoBg = langCode === 'ro' || langCode === 'bg';
    const hasRoBgExtraFields = user.blockAddress && user.floorAddress && user.apartmentAddress;
    if (isRoBg && hasRoBgExtraFields) {
      const shouldSkipScale = langCode === 'bg';
      return this.fillRomanianBulgarianAddress(county, city, user, shouldSkipScale);
    }

    return this.cityInput.invoke('val').then((existingValue) => {
      if (existingValue && existingValue.trim() === city) {
        cy.log(`ℹ️ City already populated: ${existingValue}`);
        return null;
      }
      return this.safeType(() => this.cityInput, city);
    });
  }

  /**
   * Fill the address fields for the Italian checkout layout (Provincia dropdown
   * + city text input). Clicks the first dropdown option after typing —
   * Italian provinces aren't unique enough to disambiguate by exact match,
   * so first match wins.
   *
   * @param {string} county - Provincia name (e.g. "Milano")
   * @param {string} city - City name (e.g. "Milan")
   * @returns {Cypress.Chainable}
   */
  fillItalianAddress(county, city) {
    this.countyAddressField1.clear({ force: true }).type(county, { force: true });
    this.countyDropdownList.should('be.visible').find('li').first().click({ force: true });
    return this.safeType(() => this.cityInput, city);
  }

  /**
   * Fill the address fields for the Slovakian checkout layout (county dropdown
   * with exact-match li click + city text input). Waits 600ms after county
   * selection to let Vue settle before typing city.
   *
   * @param {string} county - County name (exact match expected, e.g. "Košický")
   * @param {string} city - City name
   * @returns {Cypress.Chainable}
   */
  fillSlovakianAddress(county, city) {
    return this.countyAddressField1.clear({ force: true }).type(county, { force: true }).then(() => {
      this.countyDropdownList.find('li').contains(county).click({ force: true });
      cy.wait(600); // let Vue settle after county selection before typing city
      return this.safeType(() => this.cityInput, city);
    });
  }

  /**
   * Vue-select dropdown selection with race-condition recovery.
   *
   * The `#vsN__listbox <ul>` is only rendered when the dropdown is OPEN.
   * Typing into the search input with `{force:true}` bypasses focus, so
   * vue-select stays closed and the listbox never appears. This method:
   *   1. Clicks the combobox to open it
   *   2. Types into the search input
   *   3. Re-opens if the listbox didn't render (with combobox-existence check
   *      to handle Vue unmounting the wrapper mid-render — falls through to
   *      the outer retry instead of burning 10s on a gone element)
   *   4. Clicks the matching `<li>`
   *   5. Polls `.vs__selected` chip text for commit (up to 2.5s)
   *   6. Retries the whole cycle on failure (default 3 attempts, 400ms backoff)
   *
   * Extracted so verifyCityAfterAccept can reuse it for post-accept recovery.
   *
   * @param {string} comboboxId - Combobox wrapper selector (e.g. '#vs3__combobox')
   * @param {string} inputSelector - Inner search input selector
   * @param {string} listSelector - Listbox `<ul>` selector
   * @param {string} value - Value to type/select
   * @param {number} [attemptsLeft=3] - Retry budget (decremented per attempt)
   * @returns {Cypress.Chainable}
   * @private
   */
  _selectFromVueSelect(comboboxId, inputSelector, listSelector, value, attemptsLeft = 3) {
    const normalize = (v) => typeof v === 'string' ? v.trim().toLowerCase() : '';
    return cy.get(comboboxId, { timeout: 10000 })
      .should('exist')
      .should('be.visible')
      .scrollIntoView()
      .click({ force: true })
      .then(() => {
        return cy.get(inputSelector, { timeout: 10000 })
          .should('exist')
          .clear({ force: true })
          .type(value, { force: true, delay: 60 });
      })
      .then(() => {
        return cy.get('body').then(($body) => {
          if ($body.find(listSelector).length > 0) return null;
          cy.log(`ℹ️ Listbox "${listSelector}" not in DOM — re-opening combobox`);
          // Vue can unmount/re-key the combobox between type() and this check
          // (seen on RO futunatura). Don't sink 10s waiting on a wrapper that's
          // gone — let the outer retry handle the fresh render after 400ms.
          if ($body.find(comboboxId).length === 0) {
            cy.log(`⚠️ Combobox "${comboboxId}" not in DOM either — Vue re-render in progress, falling through to retry`);
            return null;
          }
          return cy.get(comboboxId).click({ force: true });
        });
      })
      .then(() => {
        return cy.get(listSelector, { timeout: 10000 }).should('be.visible')
          .find('li', { timeout: 8000 })
          .should('have.length.greaterThan', 0)
          .filter((_, el) => normalize(el.textContent).includes(normalize(value)))
          .first()
          .should('be.visible')
          .click({ force: true });
      })
      .then(() => {
        const pollChipCommit = (msLeft) => {
          return cy.get('body').then(($body) => {
            const chipText = normalize($body.find(`${comboboxId} .vs__selected`).first().text());
            if (chipText === normalize(value)) return true;
            if (msLeft <= 0) return false;
            return cy.wait(250).then(() => pollChipCommit(msLeft - 250));
          });
        };
        return pollChipCommit(2500);
      })
      .then((committed) => {
        if (committed) {
          cy.log(`✅ Vue-select "${comboboxId}" committed to "${value}"`);
          return null;
        }
        if (attemptsLeft <= 0) {
          cy.log(`⚠️ Vue-select "${comboboxId}" never committed to "${value}" — proceeding anyway`);
          return null;
        }
        cy.log(`⚠️ Vue-select "${comboboxId}" race — retrying "${value}" (${attemptsLeft} left)`);
        return cy.wait(400).then(() => this._selectFromVueSelect(comboboxId, inputSelector, listSelector, value, attemptsLeft - 1));
      });
  }

  /**
   * Fill the address fields for the RO/BG checkout layouts (two vue-select
   * dropdowns for county/city + four text inputs for block/floor/apartment/
   * scale). Both county and city share the same value because the city dropdown
   * options are populated server-side from the county selection.
   *
   * @param {string} county - County/region name (e.g. "Burgas", "Bucuresti")
   * @param {string} city - Same value as county for these locales
   * @param {Object} user - User fixture data (provides block/floor/apartment/scale strings)
   * @param {boolean} shouldSkipScale - True for BG (no "scale" field on BG layout)
   * @returns {Cypress.Chainable}
   */
  fillRomanianBulgarianAddress(county, city, user, shouldSkipScale) {
    cy.log('📝 Step: Filling RO/BG Regional Address');

    return this._selectFromVueSelect(
      '#vs2__combobox',
      CheckoutPage.SELECTORS.COUNTY_INPUT,
      CheckoutPage.SELECTORS.COUNTY_LIST,
      county
    ).then(() => {
      cy.log(`📍 Selecting City: ${city}`);
      // Wait for Vue to render the city combobox in response to county selection,
      // AND for the cities API call to finish populating options.
      return cy.get('#vs3__combobox', { timeout: 15000 }).should('exist').should('be.visible');
    }).then(() => cy.wait(900)).then(() => {
      // Re-verify vs3 is still mounted after the wait. On slower brands (BG
      // mycoway) the cities API response can re-render the city combobox
      // mid-wait, leaving _selectFromVueSelect's 10s lookup to miss it.
      return cy.get('#vs3__combobox', { timeout: 15000 }).should('exist').should('be.visible');
    }).then(() => {
      return this._selectFromVueSelect(
        '#vs3__combobox',
        CheckoutPage.SELECTORS.CITY_FIELD_1,
        CheckoutPage.SELECTORS.CITY_LIST,
        city
      );
    }).then(() => {
      this.blockAddressField.clear({ force: true });
      this.blockAddressField.type(user.blockAddress, { force: true });
      if (!shouldSkipScale && user.scaleAddress) {
        this.scaleAddressField.clear({ force: true });
        this.scaleAddressField.type(user.scaleAddress, { force: true });
      }
      this.floorAddressField.clear({ force: true });
      this.floorAddressField.type(user.floorAddress, { force: true });
      this.apartmentAddressField.clear({ force: true });
      return this.apartmentAddressField.type(user.apartmentAddress, { force: true });
    });
  }

  /**
   * Fill the entire customer info section (basic fields + address) using
   * localized data resolved from the current site language.
   *
   * @param {Object} user - User fixture data
   * @returns {Cypress.Chainable}
   */
  fillCustomerInfo(user) {
    return this.getLocalizedData(user).then((localizedData) => {
      const { langCode, city, postalCode } = localizedData;
      cy.log(`🌍 Detected language code: ${langCode}, using city: ${city}, postal code: ${postalCode}`);
      
      this.fillBasicInfo(user);
      return this.fillAddressFields(user, localizedData);
    });
  }

  /**
   * Check the "I accept terms and conditions" agreement checkbox.
   * Scrolls into view with a -100px offset so the sticky header doesn't
   * occlude the click target.
   *
   * @returns {Cypress.Chainable}
   */
  acceptTermsAndConfirm() {
    return this.agreementCheckbox
      .first()
      .should('exist')
      .scrollIntoView({ offset: { top: -100, left: 0 } })
      .check({ force: true })
      .should('be.checked');
  }

  /**
   * Post-accept-terms recovery: verify the city field (vue-select chip for
   * BG/RO, text input elsewhere) still holds the expected value and retype if
   * cleared. Optionally re-select the payment method in the same pass.
   *
   * Why this exists: accepting terms on some brands triggers a Vue re-render
   * that clears the city dropdown selection and/or unsets the payment method.
   * The `.vs__selected` chip (not `input.vs__search`) is the source of truth
   * because vue-select hides the input after committing.
   *
   * @param {Object} user - User fixture data (for localized city resolution)
   * @param {Object|null} paymentMethods - { defaultMethod, bankTransferLangs } or null to skip payment recheck
   * @returns {Cypress.Chainable}
   */
  verifyCityAfterAccept(user, paymentMethods) {
    return this.getLocalizedData(user).then(({ city, langCode }) => {
      const normalize = (value) => typeof value === 'string' ? value.trim().toLowerCase() : '';
      const expectedCity = city || '';
      const expectedNormalized = normalize(expectedCity);
      const isDropdownLang = langCode === 'bg' || langCode === 'ro';

      // BG/RO use vue-select: the .vs__selected chip is the source of truth.
      // The underlying input.vs__search becomes empty/hidden after selection,
      // so asserting on its visibility races with vue-select's render cycle.
      const verifyDropdownCity = () => {
        return cy.get('body').then(($body) => {
          const $chip = $body.find('#vs3__combobox .vs__selected').first();
          const chipText = normalize($chip.text());
          if (chipText && chipText === expectedNormalized) {
            cy.log(`✅ City dropdown selection '${$chip.text().trim()}' preserved after accept terms.`);
            return null;
          }
          cy.log(`⚠️ City dropdown cleared/changed after accept: expected='${expectedCity}' actual='${$chip.text().trim() || '<empty>'}'`);
          // Reuse the same retry helper the initial selection uses — the ad-hoc
          // clear+type+click here used to fail when the Vue re-render had
          // detached input.vs__search by the time we queried it. _selectFromVueSelect
          // re-opens the combobox, retries up to 3 times, and polls chip-commit.
          return cy.wait(400).then(() => this._selectFromVueSelect(
            '#vs3__combobox',
            CheckoutPage.SELECTORS.CITY_FIELD_1,
            CheckoutPage.SELECTORS.CITY_LIST,
            expectedCity
          )).then(() => cy.log(`✅ Re-selected city dropdown to '${expectedCity}'`));
        });
      };

      const verifyTextInputCity = () => {
        return cy.get(CheckoutPage.SELECTORS.CITY_INPUT)
          .filter(':visible')
          .first()
          .should('be.visible')
          .then(($input) => {
            const currentValue = $input.val();
            if (normalize(currentValue) === expectedNormalized) {
              cy.log(`✅ City field remained set to '${currentValue}' after accept terms.`);
              return null;
            }
            cy.log(`⚠️ City field changed after accept: expected='${expectedCity}' actual='${currentValue || '<empty>'}'`);
            return this.safeType(() => cy.get(CheckoutPage.SELECTORS.CITY_INPUT), expectedCity).then(() => {
              cy.log(`✅ Re-typed city field to '${expectedCity}'`);
            });
          });
      };

      return (isDropdownLang ? verifyDropdownCity() : verifyTextInputCity())
        .then(() => {
          if (!paymentMethods) return null;

          const isBankTransfer = paymentMethods.bankTransferLangs?.includes(langCode);
          const methodId = isBankTransfer ? 'bank_transfer' : (paymentMethods.defaultMethod || 'cod');

          return cy.get('body').then(($body) => {
            if (this._isPaymentMethodSelected($body, methodId)) {
              cy.log(`✅ Payment method '${methodId}' still selected after accept terms.`);
              return null;
            }
            cy.log(`⚠️ Payment method '${methodId}' was unset after accept terms — re-selecting.`);
            return this.selectPaymentMethodByLanguage(paymentMethods);
          });
        });
    });
  }

  /** Click the "delivery notes" accordion to expose the notes textareas. */
  NotesArrea() {
    this.NotesTextAreaDropdown.click();
  }

  /**
   * Pick the payment method appropriate for the current site language.
   * Banks transfer is used on the locales listed in `mapping.bankTransferLangs`;
   * everywhere else falls back to `mapping.defaultMethod` (typically `'cod'`).
   * Internally retries up to 3× via `_selectPaymentMethodWithRetry` because
   * Vue can swap the wrapper between query and click.
   *
   * @param {Object} mapping - `{ defaultMethod: string, bankTransferLangs: string[] }`
   * @returns {Cypress.Chainable}
   */
  selectPaymentMethodByLanguage(mapping) {
    return getSiteLanguage().then((lang) => {
      const langCode = normalizeLanguageCode(lang);
      const isBankTransfer = mapping.bankTransferLangs?.includes(langCode);
      const methodId = isBankTransfer ? 'bank_transfer' : (mapping.defaultMethod || 'cod');

      cy.log(`💳 Selecting payment method: ${methodId}`);
      return this._selectPaymentMethodWithRetry(methodId, 3);
    });
  }

  /**
   * Build the trio of selectors used by every payment-method operation:
   * the click target (wrapper row), the visible label, and the underlying
   * radio. Vue's `@click` listener is on the wrapper — force-clicking the
   * radio bypasses Vue and lets it reset to its default (Paywiser).
   *
   * @param {string} methodId - Payment method id (e.g. 'cod', 'bank_transfer')
   * @returns {{wrapper: string, label: string, radio: string}}
   * @private
   */
  _paymentSelectors(methodId) {
    return {
      wrapper: `.checkout-box__select-method[data-code="${methodId}"]`,
      label: `label[for="payment_method_${methodId}"], label[for="${methodId}"]`,
      radio: `input[type="radio"][name="payment_method"][value="${methodId}"], #payment_method_${methodId}, #${methodId}`
    };
  }

  /**
   * Check whether the payment method appears selected. Accepts the wrapper
   * being marked active (`.is-active`/`.selected`) OR the radio reporting
   * `:checked` — Vue updates them on different ticks.
   *
   * @param {JQuery<HTMLElement>} $body - Current body element
   * @param {string} methodId - Payment method id to test
   * @returns {boolean}
   * @private
   */
  _isPaymentMethodSelected($body, methodId) {
    const { wrapper, radio } = this._paymentSelectors(methodId);
    const $w = $body.find(wrapper);
    const $r = $body.find(radio);
    const wrapperSelected = $w.length > 0 && (
      $w.hasClass('selected') ||
      $w.hasClass('active') ||
      $w.hasClass('is-selected') ||
      $w.hasClass('is-active') ||
      $w.is('[class*="--selected"]') ||
      $w.is('[class*="--active"]')
    );
    const radioChecked = $r.length > 0 && $r.is(':checked');
    return wrapperSelected || radioChecked;
  }

  /**
   * Click the payment-method wrapper (fires Vue's `@click` handler) AND
   * `.check()` the underlying radio (fires the native `change` event that
   * v-model and any AJAX side-effects listen for). Without the `.check()`
   * step, Sweet's checkout reports the wrapper as "selected" visually but the
   * server-side `payment_method` on the cart never updates, so submit still
   * posts the default (paywiser_v2 on FR).
   *
   * @param {string} methodId - Payment method id
   * @returns {Cypress.Chainable}
   * @private
   */
  _clickPaymentTarget(methodId) {
    const { wrapper, label, radio } = this._paymentSelectors(methodId);
    return cy.get('body').then(($body) => {
      const clickChain = $body.find(wrapper).length
        ? cy.get(wrapper).first().scrollIntoView().click({ force: true })
        : $body.find(label).length
          ? cy.get(label).first().scrollIntoView().click({ force: true })
          : cy.get(radio).first().scrollIntoView().click({ force: true });
      return clickChain.then(() => {
        if ($body.find(radio).length === 0) return null;
        // .check() is the v-model-compatible way to select a radio — it dispatches change.
        return cy.get(radio).first().check({ force: true });
      });
    });
  }

  /**
   * Click the payment method and verify the selection committed. Retries up to
   * `attemptsLeft` times. The 1500ms wait covers Vue's reactive tick + the
   * typical `/update_payment_method` AJAX round-trip that re-syncs the
   * server-side cart. Without this gap, the DOM looks right but the server
   * still treats the old method as active.
   *
   * @param {string} methodId - Payment method id
   * @param {number} attemptsLeft - Retry budget (decremented per attempt)
   * @returns {Cypress.Chainable}
   * @private
   */
  _selectPaymentMethodWithRetry(methodId, attemptsLeft) {
    return this._clickPaymentTarget(methodId).then(() => cy.wait(1500)).then(() => {
      return cy.get('body').then(($body) => {
        if (this._isPaymentMethodSelected($body, methodId)) {
          cy.log(`✅ Payment "${methodId}" confirmed selected`);
          return null;
        }
        if (attemptsLeft <= 0) {
          cy.log(`⚠️ Payment "${methodId}" still not selected after retries — proceeding`);
          return null;
        }
        cy.log(`⚠️ Vue race: "${methodId}" not selected — re-clicking (${attemptsLeft} left)`);
        return this._selectPaymentMethodWithRetry(methodId, attemptsLeft - 1);
      });
    });
  }

  /**
   * Re-assert the chosen payment method right before submit and re-select if
   * Vue has reset it. Two-pass: checks now, then waits 2s and checks again
   * (covers cases where Vue/AJAX briefly re-renders the payment block after
   * the agreement checkbox is enabled or notes are edited). Logs a warning
   * if the selection still isn't stable — caller proceeds anyway.
   *
   * @param {Object} mapping - `{ defaultMethod, bankTransferLangs }`
   * @returns {Cypress.Chainable}
   */
  verifyPaymentMethodStable(mapping) {
    return getSiteLanguage().then((lang) => {
      const langCode = normalizeLanguageCode(lang);
      const isBankTransfer = mapping.bankTransferLangs?.includes(langCode);
      const methodId = isBankTransfer ? 'bank_transfer' : (mapping.defaultMethod || 'cod');

      const checkOnce = () => cy.get('body').then(($body) => this._isPaymentMethodSelected($body, methodId));

      return checkOnce().then((ok1) => {
        if (!ok1) {
          cy.log(`⚠️ Pre-submit: "${methodId}" not selected — re-selecting`);
          return this._selectPaymentMethodWithRetry(methodId, 3).then(() => cy.wait(1500)).then(() => checkOnce()).then((ok2) => {
            if (!ok2) cy.log(`❌ Pre-submit: "${methodId}" still not stable — submit may redirect to default gateway`);
          });
        }
        // 2000ms settle covers cases where Vue/AJAX briefly re-renders the payment block
        // after the user enables the agreement checkbox or after notes are edited.
        return cy.wait(2000).then(checkOnce).then((ok2) => {
          if (!ok2) {
            cy.log(`⚠️ Pre-submit: "${methodId}" became unselected during settle — re-selecting`);
            return this._selectPaymentMethodWithRetry(methodId, 3).then(() => cy.wait(1500));
          }
          cy.log(`✅ Pre-submit: "${methodId}" stable`);
        });
      });
    });
  }

  /**
   * Cancel the order via the action menu, then confirm in the dialog.
   * Some sites show two buttons (Edit + Cancel) with Cancel at index 1; others
   * show only Cancel at index 0 — picks based on count. Logs and bails out if
   * no recognised cancel button is found.
   *
   * @returns {Cypress.Chainable}
   */
  cancelOrder() {
    const cancelSelectors = '#show-order-cancel, .action_menu_button, #order-cancel-btn, button.btn-cancel';

    cy.get('body').then(($body) => {
      const $buttons = $body.find(cancelSelectors).filter(':visible');
      if ($buttons.length === 0) {
        cy.log('⚠️ No cancel buttons found in the DOM');
        return;
      }

      const indexToClick = $buttons.length > 1 ? 1 : 0;
      cy.wrap($buttons).eq(indexToClick).click({ force: true });

      cy.get('#submit-cancel-order', { timeout: 10000 })
        .should('exist')
        .should('be.visible')
        .click({ force: true });

      cy.wait(3000);
      cy.log(`✅ Cancel order submitted (using button index ${indexToClick})`);
    });
  }

  /**
   * Confirm the cancellation was acknowledged by the storefront. Tries three
   * patterns in order:
   *   1. Inline `.cancel_wrapper` (Healthyworld/Futunatura)
   *   2. Success modal containing CANCEL_SUCCESS_PATTERN text (Erefit SI)
   *   3. CANCEL_STATUS_PATTERN text anywhere on the page (status timeline)
   *
   * Logs a warning (but doesn't fail) if none match — the order may still
   * have cancelled server-side; this is an additional sanity check.
   *
   * @returns {Cypress.Chainable}
   */
  orderCanceledSuccessfully() {
    cy.get('body', { timeout: 15000 }).should('exist');
    cy.wait(2000);

    cy.get('body').then(($body) => {
      const text = $body.text();

      // Pattern 1: inline cancel wrapper (Healthyworld/Futunatura style)
      if ($body.find('#user-cancel-order, .cancel_wrapper').length > 0) {
        cy.get('#user-cancel-order').should('exist');
        cy.log('✅ Cancellation confirmed via .cancel_wrapper');
        return;
      }

      // Pattern 2: success modal (Erefit.si style)
      const hasModal = $body.find('.modal, [class*="modal"], [class*="dialog"]').length > 0;
      if (hasModal && CANCEL_SUCCESS_PATTERN.test(text)) {
        cy.contains(CANCEL_SUCCESS_PATTERN).should('be.visible');
        cy.log('✅ Cancellation confirmed via success modal');
        return;
      }

      // Pattern 3: cancelled status text on the order timeline
      if (CANCEL_STATUS_PATTERN.test(text)) {
        cy.log('✅ Cancellation confirmed via status text on page');
        return;
      }

      cy.log('⚠️ Could not confirm cancellation — no known pattern matched');
    });
  }

  /**
   * Re-fill the county/region vue-select dropdown if Vue reactivity cleared
   * it after accepting terms. Only applies to languages with a county
   * dropdown (ro, bg, sk, it); no-op elsewhere.
   *
   * @param {Object} user - User fixture data (for localized county resolution)
   * @returns {Cypress.Chainable}
   */
  refillCountyIfCleared(user) {
    return this.getLocalizedData(user).then(({ langCode, county, city }) => {
      if (!COUNTY_DROPDOWN_LANGS.includes(langCode)) return null;

      cy.log(`🔍 Checking county dropdown state for [${langCode.toUpperCase()}]`);

      return cy.get('body').then(($body) => {
        const $countySelected = $body.find(CheckoutPage.SELECTORS.COUNTY_SELECTED);
        const isCountySet = $countySelected.length > 0 && !!$countySelected.text().trim();

        if (isCountySet) {
          cy.log(`✅ County still set: "${$countySelected.text().trim()}"`);
          return null;
        }

        cy.log(`⚠️ County was cleared by Vue — re-filling for [${langCode.toUpperCase()}]`);

        if (langCode === 'sk') {
          return this.fillSlovakianAddress(county, city);
        } else if (langCode === 'it') {
          return this.fillItalianAddress(county, city);
        } else {
          return this.fillRomanianBulgarianAddress(county, city, user, langCode === 'bg');
        }
      });
    });
  }

  /**
   * Capture the order ID from the success page, hash it (sha1) via a Node-side
   * task, and visit the order-status URL with the hash as a query param. The
   * status page asserts the order is reachable and rendered in the local
   * language.
   *
   * The 30s timeout matches upstream cy.url/orderConfirmationMsg timeouts —
   * slow success pages like Sweet Nutri ES took >10s to render the number.
   * The selector union mirrors SUCCESS_ORDER_NO_SELECTOR in domains_orders.js.
   *
   * @returns {Cypress.Chainable}
   */
  captureOrderIdAndVerifyStatus() {
    const ORDER_NO_SELECTOR = '.thank-you-orderno, .success-section__order-number, .order-id, .order-number, [class*="order-no"], [class*="orderno"]';
    const ORDER_NO_RE = /\d{3,}/;

    return cy.get(ORDER_NO_SELECTOR, { timeout: 30000 })
      .then(($el) => this._extractOrderNoWithFallbacks($el, ORDER_NO_SELECTOR, ORDER_NO_RE))
      .then((orderNo) => {
        cy.log(`📦 Captured Order ID: ${orderNo}`);
        return cy.task('sha1', { value: orderNo });
      })
      .then((hashed) => this._visitOrderStatusPage(hashed));
  }

  /**
   * Find the order-number digits in three fallback locations: inside the
   * matched element, inside its parent (when the label and number are split
   * across siblings), or anywhere in the body text. Returns the first match.
   * Throws if no match is found.
   *
   * @param {JQuery<HTMLElement>} $el - Initial selector match
   * @param {string} selector - The selector string (used for re-querying parent)
   * @param {RegExp} pattern - Regex that captures the digits (e.g. /\d{3,}/)
   * @returns {Cypress.Chainable<string>} The captured digits
   * @private
   */
  _extractOrderNoWithFallbacks($el, selector, pattern) {
    const direct = $el.text().match(pattern);
    if (direct) return cy.wrap(direct[0]);

    return cy.get(selector).parent().invoke('text').then((parentText) => {
      const parentMatch = parentText.match(pattern);
      if (parentMatch) return parentMatch[0];

      return cy.get('body').invoke('text').then((bodyText) => {
        const bodyMatch = bodyText.match(pattern);
        if (bodyMatch) return bodyMatch[0];
        throw new Error('Order ID not found on the checkout success page');
      });
    });
  }

  /**
   * Visit the public order-status page for a hashed order ID and assert the
   * status heading is rendered in one of the supported localizations.
   * Skips the heading check if the storefront redirected us (some brands gate
   * the status page behind login).
   *
   * @param {string} hashedOrderId - sha1 of the order number (computed via cy.task)
   * @returns {Cypress.Chainable}
   * @private
   */
  _visitOrderStatusPage(hashedOrderId) {
    return cy.url().then((currentUrl) => {
      const baseDomain = new URL(currentUrl).hostname;
      const statusUrl = `https://${baseDomain}/index.php?route=information/order_status&order=${hashedOrderId}`;

      cy.log(`🔗 Status URL: ${statusUrl}`);
      cy.visit(statusUrl, { failOnStatusCode: false });

      cy.location('href').then((href) => {
        if (!href.includes('route=information/order_status')) {
          cy.log(`⚠️ Status page redirected to ${href}`);
          return;
        }
        cy.get('h1').invoke('text').should('match', STATUS_HEADING_PATTERN);
      });
    });
  }
}
export const checkoutPage = new CheckoutPage();