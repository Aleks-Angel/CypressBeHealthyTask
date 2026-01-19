import { homePage } from "../support/page_objects/HomePage";

const viewports = [
  { device: 'iPhone XR', width: 414, height: 896 },
  { device: 'iPad 2', width: 768, height: 1024 },
  { device: 'Desktop', width: 1280, height: 720 }
];

describe('Futunatura UI Responsiveness', () => {
  viewports.forEach((viewport) => {
    context(`Testing on ${viewport.device}`, () => {
      beforeEach(() => {
        cy.viewport(viewport.width, viewport.height);
        cy.visit('/');
        cy.bypassCookieBanner();
      });

      it('should display the correct navigation style', () => {
        if (viewport.width < 992) {
          // Mobile/Tablet: Desktop menu should be hidden, Hamburger should exist
          homePage.headerHolder.within(() => {
            homePage.hamburgerMenu.should('be.visible');
            homePage.desktopMenu.should('not.be.visible');
          });
        } else {
          // Desktop: Hamburger should be hidden, Desktop menu visible
          homePage.desktopMenu.should('be.visible');
        }
      });
    });
  });
});
 