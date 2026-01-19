```markdown
# Technical Implementation Notes

## 🛠 Stability Solutions for Headless Execution

The project implements several advanced Cypress techniques to handle the specific behaviors of the Futunatura site:

### 1. Conditional Modal Handling (`handleCartModal`)
The "Add to Cart" success modal is notoriously flaky in headless environments due to Bootstrap transitions and application errors.
- **The Solution:** Uses a jQuery length check (`$body.find('#addToCartModal').length`) to determine if a modal appeared.
- **Manual Cleanup:** If the modal backdrop hangs (blocking the next click), the script manually removes the `.modal-backdrop` and `modal-open` classes from the DOM to ensure the test continues.
- **Flexible Pathing:** Gracefully handles the "Direct-to-Cart" redirect behavior without timing out on a missing modal.

### 2. Global Exception Handling
During testing, the application occasionally triggers `Error: undefined` (unhandled promise rejections).
- **The Solution:** A global `uncaught:exception` handler in `cypress/support/e2e.js` returns `false` to ignore these non-critical app errors, preventing unnecessary test failures.

### 3. Selector Strategy & Getters
- **Pure Getters:** All Page Objects use `get` properties to provide clean, readable selectors.
- **Forced Actions:** `{ force: true }` is used selectively on elements (like the Hamburger menu or cart buttons) that may be momentarily covered by animation overlays or sticky headers.

### 4. Responsiveness Logic
The responsiveness suite uses a dynamic `if/else` check inside a loop of viewports. It calculates visibility logic based on a breakpoint of `992px` to match the site's CSS media queries for mobile vs. desktop navigation.

### 5. GitHub Actions (CI) Integration
- Configured to run on every `push`.
- Includes artifact uploading to capture **Videos** and **Screenshots** on failure, allowing for visual debugging of headless runs.