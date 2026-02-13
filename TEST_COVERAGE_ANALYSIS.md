# Test Coverage Analysis — Airfield App

## Current State

**Test coverage: 0%.** The project has no tests, no test infrastructure, and no CI pipeline.

### Project inventory

| File | Purpose |
|------|---------|
| `index.html` | Single-page HTML with a button element |
| `README.md` | Project readme (title only) |

There is no `package.json`, no test runner, no build tooling, and no CI configuration.

---

## Recommendations

Since this project is at a very early stage, the recommendations below focus on establishing a solid testing foundation that will scale as the app grows.

### 1. Set up a test runner and tooling

Before any tests can be written, the project needs basic infrastructure:

- **Initialize a `package.json`** with `npm init`.
- **Choose a test runner.** For a front-end web app, [Vitest](https://vitest.dev/) or [Jest](https://jestjs.io/) + [jsdom](https://github.com/jsdom/jsdom) are good options. Vitest is recommended for new projects due to speed and native ES module support.
- **Add a linter** (e.g., ESLint) to catch issues early.
- **Configure CI** (e.g., GitHub Actions) to run tests on every push/PR.

### 2. Add end-to-end (E2E) tests for the existing HTML

Even with just a static HTML page, an E2E framework can validate that the page renders correctly:

- **Tool:** [Playwright](https://playwright.dev/) or [Cypress](https://www.cypress.io/).
- **What to test:**
  - Page loads successfully and returns HTTP 200.
  - The `<title>` is "Airfield App".
  - The button with text "Hello Chris" is visible and clickable.
  - The page has a valid HTML structure (lang attribute, charset, viewport meta).

### 3. Add accessibility tests

Accessibility testing can start on day one regardless of project size:

- **Tool:** [axe-core](https://github.com/dequelabs/axe-core) (integrates with Playwright/Cypress) or the [pa11y](https://pa11y.org/) CLI.
- **What to test:**
  - No WCAG 2.1 AA violations.
  - The button is keyboard-focusable and has an accessible name.
  - Color contrast meets minimum ratios (relevant once styles are added).

### 4. Add HTML validation

- **Tool:** [html-validate](https://html-validate.org/) or the W3C Nu HTML Checker.
- **What to test:**
  - The document is valid HTML5.
  - No missing required attributes or deprecated elements.

### 5. Plan for unit tests as JavaScript is introduced

Once the project adds JavaScript (which is likely given it's called an "app"), unit tests should cover:

- **DOM manipulation logic** — any code that reads from or writes to the DOM.
- **Event handlers** — button clicks, form submissions, keyboard interactions.
- **Business logic** — data transformations, validation, calculations.
- **API interactions** — mock HTTP requests and test response handling.
- **State management** — if a framework like React/Vue is adopted, test component state transitions.

### 6. Set up continuous integration

A minimal GitHub Actions workflow should:

1. Install dependencies.
2. Run the linter.
3. Run unit tests with coverage reporting.
4. Run E2E tests.
5. Fail the build if coverage drops below a threshold (e.g., 80%).

---

## Priority order

| Priority | Action | Rationale |
|----------|--------|-----------|
| **P0** | Initialize `package.json` and install a test runner | Everything else depends on this |
| **P0** | Set up CI (GitHub Actions) | Ensures tests actually run |
| **P1** | E2E test for page rendering | Validates the one thing the app does today |
| **P1** | Accessibility tests | Cheap to add, high impact |
| **P2** | HTML validation | Catches markup errors early |
| **P2** | Unit test scaffolding | Ready for when JS is added |

---

## Summary

The airfield-app is at the very beginning of its development lifecycle with a single HTML file and zero testing infrastructure. This is the ideal moment to establish testing practices — it's far easier to maintain 100% coverage from the start than to retrofit tests onto a larger codebase. The highest-impact next steps are setting up a test runner, adding CI, and writing a small E2E test for the existing page.
